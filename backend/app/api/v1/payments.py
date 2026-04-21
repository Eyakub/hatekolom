"""
SSLCommerz Payment Callback Endpoints.

Handles success/fail/cancel redirects and IPN notifications.
"""

import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models import Payment, Order, PaymentStatus
from app.services.payment_service import PaymentService
from app.services.sslcommerz_service import SSLCommerzService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/sslcommerz/success")
async def sslcommerz_success(request: Request, db: AsyncSession = Depends(get_db)):
    """
    SSLCommerz redirects here after successful payment.
    Validates the payment and redirects user to frontend success page.
    """
    form_data = await request.form()
    data = dict(form_data)

    tran_id = data.get("tran_id", "")
    val_id = data.get("val_id", "")
    amount = data.get("amount", "0")
    status = data.get("status", "")

    logger.info(f"SSLCommerz SUCCESS callback: tran_id={tran_id}, val_id={val_id}, status={status}")

    if not tran_id or not val_id:
        logger.error("Missing tran_id or val_id in success callback")
        return RedirectResponse(
            url=f"{settings.SSLCOMMERZ_FAIL_URL}?error=missing_data",
            status_code=303,
        )

    # Validate and complete payment
    payment = await PaymentService.complete_payment(
        tran_id=tran_id,
        val_id=val_id,
        gateway_data=data,
        db=db,
    )

    if payment and payment.status == PaymentStatus.SUCCESS.value:
        # Find order number for frontend
        order_result = await db.execute(
            select(Order).where(Order.id == payment.order_id)
        )
        order = order_result.scalar_one_or_none()
        order_number = order.order_number if order else ""

        return RedirectResponse(
            url=f"{settings.SSLCOMMERZ_SUCCESS_URL}?tran_id={tran_id}&order={order_number}",
            status_code=303,
        )
    else:
        return RedirectResponse(
            url=f"{settings.SSLCOMMERZ_FAIL_URL}?tran_id={tran_id}&error=validation_failed",
            status_code=303,
        )


@router.post("/sslcommerz/fail")
async def sslcommerz_fail(request: Request, db: AsyncSession = Depends(get_db)):
    """SSLCommerz redirects here after a failed payment."""
    form_data = await request.form()
    data = dict(form_data)

    tran_id = data.get("tran_id", "")
    logger.warning(f"SSLCommerz FAIL callback: tran_id={tran_id}")

    # Mark payment as failed
    if tran_id:
        result = await db.execute(
            select(Payment).where(Payment.tran_id == tran_id)
        )
        payment = result.scalar_one_or_none()
        if payment and payment.status != PaymentStatus.SUCCESS.value:
            payment.status = PaymentStatus.FAILED.value
            payment.gateway_response = data

            order_result = await db.execute(
                select(Order).where(Order.id == payment.order_id)
            )
            order = order_result.scalar_one_or_none()
            if order:
                from app.models import OrderStatus
                order.status = OrderStatus.CANCELLED.value

            await db.commit()

    return RedirectResponse(
        url=f"{settings.SSLCOMMERZ_FAIL_URL}?tran_id={tran_id}",
        status_code=303,
    )


@router.post("/sslcommerz/cancel")
async def sslcommerz_cancel(request: Request, db: AsyncSession = Depends(get_db)):
    """SSLCommerz redirects here when user cancels payment."""
    form_data = await request.form()
    data = dict(form_data)

    tran_id = data.get("tran_id", "")
    logger.info(f"SSLCommerz CANCEL callback: tran_id={tran_id}")

    # Mark payment as cancelled
    if tran_id:
        result = await db.execute(
            select(Payment).where(Payment.tran_id == tran_id)
        )
        payment = result.scalar_one_or_none()
        if payment and payment.status != PaymentStatus.SUCCESS.value:
            payment.status = PaymentStatus.CANCELLED.value
            payment.gateway_response = data

            order_result = await db.execute(
                select(Order).where(Order.id == payment.order_id)
            )
            order = order_result.scalar_one_or_none()
            if order:
                from app.models import OrderStatus
                order.status = OrderStatus.CANCELLED.value

            await db.commit()

    return RedirectResponse(
        url=f"{settings.SSLCOMMERZ_CANCEL_URL}?tran_id={tran_id}",
        status_code=303,
    )


@router.post("/sslcommerz/ipn")
async def sslcommerz_ipn(request: Request, db: AsyncSession = Depends(get_db)):
    """
    SSLCommerz Instant Payment Notification (server-to-server).
    
    This is the most reliable callback — it's sent directly from SSLCommerz
    servers, not through the user's browser. We use it as the primary
    payment confirmation mechanism.
    """
    form_data = await request.form()
    data = dict(form_data)

    tran_id = data.get("tran_id", "")
    val_id = data.get("val_id", "")
    status = data.get("status", "")

    logger.info(f"SSLCommerz IPN: tran_id={tran_id}, status={status}")

    # Verify IPN hash
    if not SSLCommerzService.verify_ipn_hash(data):
        logger.error(f"IPN hash verification failed for tran_id={tran_id}")
        return {"status": "HASH_VERIFICATION_FAILED"}

    if status == "VALID":
        payment = await PaymentService.complete_payment(
            tran_id=tran_id,
            val_id=val_id,
            gateway_data=data,
            db=db,
        )
        return {"status": "OK" if payment else "PAYMENT_NOT_FOUND"}

    elif status == "FAILED":
        result = await db.execute(
            select(Payment).where(Payment.tran_id == tran_id)
        )
        payment = result.scalar_one_or_none()
        if payment and payment.status != PaymentStatus.SUCCESS.value:
            payment.status = PaymentStatus.FAILED.value
            payment.gateway_response = data
            await db.commit()
        return {"status": "FAILED_RECORDED"}

    return {"status": "IGNORED", "received_status": status}


@router.get("/status/{tran_id}")
async def get_payment_status(
    tran_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check payment status by transaction ID (for frontend polling)."""
    result = await db.execute(
        select(Payment).where(Payment.tran_id == tran_id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found")

    order_result = await db.execute(
        select(Order).where(Order.id == payment.order_id)
    )
    order = order_result.scalar_one_or_none()

    return {
        "tran_id": payment.tran_id,
        "status": payment.status,
        "method": payment.method,
        "amount": str(payment.amount),
        "order_status": order.status if order else None,
    }
