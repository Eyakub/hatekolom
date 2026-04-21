"""
Payment Service — Unified gateway for mock + SSLCommerz.

Phase 1: mock_success / mock_fail / free      → instant result
Phase 2: bkash / nagad / card / bank           → SSLCommerz redirect
"""

import logging
from uuid import uuid4
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Order, OrderItem, Payment, PaymentStatus, PaymentMethod, OrderStatus, ProductType
from app.services.entitlement_service import EntitlementService

logger = logging.getLogger(__name__)


class PaymentService:

    @staticmethod
    async def initiate_payment(
        order: Order,
        method: PaymentMethod,
        db: AsyncSession,
        customer_name: str = "Customer",
        customer_phone: str = "01700000000",
        customer_email: str | None = None,
        extra_child_ids: list | None = None,
    ) -> Payment:
        """Create a payment record and process it."""
        tran_id = f"TXN-{order.order_number}-{uuid4().hex[:8]}"

        payment = Payment(
            order_id=order.id,
            amount=order.total,
            currency=order.currency,
            method=method.value,
            tran_id=tran_id,
            status=PaymentStatus.INITIATED.value,
        )
        db.add(payment)
        await db.flush()

        # ─── FREE ──────────────────────────────────
        if method == PaymentMethod.FREE:
            payment.status = PaymentStatus.SUCCESS.value
            payment.verified_at = datetime.now(timezone.utc)
            order.status = OrderStatus.CONFIRMED.value
            await db.flush()
            await EntitlementService.grant_entitlements_for_order(order, db, extra_child_ids=extra_child_ids)
            # Auto-fulfill digital orders
            order.status = OrderStatus.FULFILLED.value

        # ─── MOCK SUCCESS ──────────────────────────
        elif method == PaymentMethod.MOCK_SUCCESS:
            payment.status = PaymentStatus.SUCCESS.value
            payment.verified_at = datetime.now(timezone.utc)
            payment.gateway_response = {
                "mock": True,
                "message": "Payment simulated as successful",
            }
            order.status = OrderStatus.CONFIRMED.value
            await db.flush()
            await EntitlementService.grant_entitlements_for_order(order, db, extra_child_ids=extra_child_ids)
            # Auto-fulfill digital orders
            order.status = OrderStatus.FULFILLED.value

        # ─── MOCK FAIL ─────────────────────────────
        elif method == PaymentMethod.MOCK_FAIL:
            payment.status = PaymentStatus.FAILED.value
            payment.gateway_response = {
                "mock": True,
                "message": "Payment simulated as failed",
            }
            order.status = OrderStatus.CANCELLED.value

        # ─── COD (Cash on Delivery) ────────────────
        elif method == PaymentMethod.COD:
            payment.status = PaymentStatus.INITIATED.value
            payment.gateway_response = {
                "cod": True,
                "message": "Cash on Delivery — payment collected upon shipment delivery",
            }
            # COD orders stay PENDING until admin confirms
            order.status = OrderStatus.PENDING.value

        # ─── SSLCOMMERZ (bKash, Nagad, Card, Bank) ─
        elif method in (
            PaymentMethod.BKASH,
            PaymentMethod.NAGAD,
            PaymentMethod.CARD,
            PaymentMethod.BANK,
        ):
            from app.services.sslcommerz_service import SSLCommerzService, SSLCommerzError

            try:
                result = await SSLCommerzService.init_payment(
                    order_number=order.order_number,
                    amount=order.total,
                    currency=order.currency or "BDT",
                    customer_name=customer_name,
                    customer_phone=customer_phone,
                    customer_email=customer_email,
                    tran_id=tran_id,
                )
                payment.status = PaymentStatus.PROCESSING.value
                payment.session_key = result.get("session_key")
                payment.gateway_response = {
                    "gateway_url": result.get("gateway_url"),
                    "session_key": result.get("session_key"),
                }
                # Order stays PENDING until IPN/callback confirms
            except SSLCommerzError as e:
                logger.error(f"SSLCommerz init failed for {order.order_number}: {e}")
                payment.status = PaymentStatus.FAILED.value
                payment.gateway_response = {"error": str(e)}
                order.status = OrderStatus.CANCELLED.value

        else:
            payment.status = PaymentStatus.PROCESSING.value

        await db.commit()
        logger.info(
            f"Payment {tran_id} for order {order.order_number}: {payment.status}"
        )
        return payment

    @staticmethod
    async def complete_payment(
        tran_id: str,
        val_id: str,
        gateway_data: dict,
        db: AsyncSession,
    ) -> Payment | None:
        """
        Called by SSLCommerz callback/IPN to mark payment as successful.
        Validates with SSLCommerz API and grants entitlements.
        """
        from app.services.sslcommerz_service import SSLCommerzService
        from sqlalchemy.orm import selectinload

        # Find payment
        result = await db.execute(
            select(Payment).where(Payment.tran_id == tran_id)
        )
        payment = result.scalar_one_or_none()
        if not payment:
            logger.error(f"Payment not found for tran_id={tran_id}")
            return None

        if payment.status == PaymentStatus.SUCCESS.value:
            logger.info(f"Payment {tran_id} already marked SUCCESS, skipping")
            return payment

        # Validate with SSLCommerz
        validation = await SSLCommerzService.validate_payment(val_id)

        if validation.get("status") == "VALID" or validation.get("status") == "VALIDATED":
            payment.status = PaymentStatus.SUCCESS.value
            payment.val_id = val_id
            payment.verified_at = datetime.now(timezone.utc)
            payment.gateway_response = validation

            # Update order
            order_result = await db.execute(
                select(Order)
                .options(selectinload(Order.items).selectinload(OrderItem.product))
                .where(Order.id == payment.order_id)
            )
            order = order_result.scalar_one_or_none()
            if order:
                order.status = OrderStatus.CONFIRMED.value
                await db.flush()
                await EntitlementService.grant_entitlements_for_order(order, db)

                # Auto-fulfill if all items are digital (course/ebook)
                all_digital = all(
                    item.product and item.product.product_type in (ProductType.COURSE.value, ProductType.EBOOK.value)
                    for item in order.items
                )
                if all_digital:
                    order.status = OrderStatus.FULFILLED.value

            await db.commit()
            logger.info(f"Payment {tran_id} validated and confirmed")
        else:
            payment.status = PaymentStatus.FAILED.value
            payment.gateway_response = validation

            order_result = await db.execute(
                select(Order).where(Order.id == payment.order_id)
            )
            order = order_result.scalar_one_or_none()
            if order:
                order.status = OrderStatus.CANCELLED.value

            await db.commit()
            logger.warning(f"Payment {tran_id} validation failed: {validation.get('status')}")

        return payment

    @staticmethod
    async def confirm_cod_payment(order_id, db: AsyncSession) -> Payment | None:
        """
        Confirm COD payment after delivery.
        Called when admin marks shipment as DELIVERED.
        Grants remaining digital entitlements that were held.
        """
        from sqlalchemy.orm import selectinload

        result = await db.execute(
            select(Payment).where(
                Payment.order_id == order_id,
                Payment.method == PaymentMethod.COD,
            )
        )
        payment = result.scalar_one_or_none()
        if not payment or payment.status == PaymentStatus.SUCCESS.value:
            return payment

        payment.status = PaymentStatus.SUCCESS.value
        payment.verified_at = datetime.now(timezone.utc)

        # Load order and grant remaining (digital) entitlements
        order_result = await db.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.product))
            .where(Order.id == order_id)
        )
        order = order_result.scalar_one_or_none()
        if order:
            # Grant digital entitlements that were skipped during COD order creation
            await EntitlementService.grant_entitlements_for_order(order, db)
            order.status = OrderStatus.FULFILLED.value

        await db.commit()
        logger.info(f"COD payment confirmed for order {order_id}")
        return payment

    @staticmethod
    async def verify_payment(tran_id: str, db: AsyncSession) -> Payment | None:
        """Look up a payment by transaction ID."""
        result = await db.execute(
            select(Payment).where(Payment.tran_id == tran_id)
        )
        return result.scalar_one_or_none()
