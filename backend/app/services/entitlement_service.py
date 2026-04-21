"""
Entitlement Engine — The core commerce logic.

When a payment succeeds, this service:
1. Inspects each OrderItem's product_type
2. If product is a Bundle → iterates bundle_items
3. For each atomic product, creates the appropriate entitlement:
   - course → course_access entitlement + enrollment
   - ebook → ebook_download entitlement
   - physical_book → physical_shipment entitlement + shipment record
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import (
    Order, OrderItem, Product, ProductType, Bundle, BundleItem,
    Entitlement, EntitlementType, Enrollment, Shipment,
    ShipmentStatus, ShippingZone, ShipmentEvent,
)

logger = logging.getLogger(__name__)


class EntitlementService:

    @staticmethod
    async def grant_entitlements_for_order(
        order: Order, db: AsyncSession, extra_child_ids: list | None = None,
        physical_only: bool = False,
    ) -> list[Entitlement]:
        """
        Process a paid order and create all entitlements.
        Called after payment succeeds.
        extra_child_ids: additional children to grant (for "all children" purchases).
        physical_only: if True, only grant PHYSICAL_SHIPMENT entitlements (for COD).
        """
        entitlements_created = []

        # Load order items with products
        result = await db.execute(
            select(OrderItem)
            .options(selectinload(OrderItem.product))
            .where(OrderItem.order_id == order.id)
        )
        order_items = result.scalars().all()

        # Build list of child IDs to grant for
        child_ids_to_grant = set()
        if order.child_profile_id:
            child_ids_to_grant.add(order.child_profile_id)
        if extra_child_ids:
            for cid in extra_child_ids:
                child_ids_to_grant.add(cid)

        # If no children at all, grant with None (user-level entitlement)
        if not child_ids_to_grant:
            child_ids_to_grant = {None}

        for item in order_items:
            product = item.product

            if product.product_type == ProductType.BUNDLE:
                bundle_result = await db.execute(
                    select(BundleItem)
                    .options(selectinload(BundleItem.product))
                    .where(BundleItem.bundle_id == (
                        select(Bundle.id).where(Bundle.product_id == product.id).scalar_subquery()
                    ))
                )
                bundle_items = bundle_result.scalars().all()

                for bi in bundle_items:
                    for child_id in child_ids_to_grant:
                        ents = await EntitlementService._grant_for_product(
                            user_id=order.user_id,
                            child_profile_id=child_id,
                            product=bi.product,
                            order_item_id=item.id,
                            order=order,
                            db=db,
                            physical_only=physical_only,
                        )
                        entitlements_created.extend(ents)
            else:
                for child_id in child_ids_to_grant:
                    ents = await EntitlementService._grant_for_product(
                        user_id=order.user_id,
                        child_profile_id=child_id,
                        product=product,
                        order_item_id=item.id,
                        order=order,
                        db=db,
                        physical_only=physical_only,
                    )
                    entitlements_created.extend(ents)

        await db.commit()
        logger.info(
            f"Granted {len(entitlements_created)} entitlements for order {order.order_number}"
        )

        # Send notifications (non-blocking)
        try:
            from app.models import User
            user_result = await db.execute(
                select(User).where(User.id == order.user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                # Email notification
                if user.email:
                    from app.services.email_service import EmailService
                    await EmailService.send_order_confirmation(
                        email=user.email,
                        name=user.full_name,
                        order_number=order.order_number,
                        total=str(order.total),
                    )
                # SMS notification
                if user.phone:
                    from app.services.sms_service import SMSService
                    await SMSService.send_order_confirmation(
                        phone=user.phone,
                        order_number=order.order_number,
                        amount=str(order.total),
                    )
        except Exception as e:
            logger.warning(f"Failed to send order notifications: {e}")

        return entitlements_created

    @staticmethod
    async def _grant_for_product(
        user_id: UUID,
        child_profile_id: UUID | None,
        product: Product,
        order_item_id: UUID,
        order: Order,
        db: AsyncSession,
        physical_only: bool = False,
    ) -> list[Entitlement]:
        """Grant entitlements for a single (non-bundle) product.
        If physical_only=True, skip digital entitlements (for COD orders)."""
        created = []

        # Skip digital products when physical_only is set (COD)
        if physical_only and product.product_type in (ProductType.COURSE, ProductType.EBOOK, ProductType.EXAM, ProductType.GAME, ProductType.ABACUS):
            return created

        # Guest orders (no user_id) can't hold user-scoped entitlements.
        # For physical products we still create the Shipment (delivery info lives there).
        # For digital products there's no one to grant access to, so skip entirely.
        is_guest = user_id is None
        if is_guest and product.product_type != ProductType.PHYSICAL_BOOK:
            logger.info(
                f"Skipping entitlement for guest order — digital product {product.id} has no user to grant to"
            )
            return created

        # Helper: check if entitlement already exists
        async def _exists(etype: EntitlementType) -> bool:
            q = select(Entitlement).where(
                Entitlement.product_id == product.id,
                Entitlement.entitlement_type == etype,
            )
            if child_profile_id:
                q = q.where(Entitlement.child_profile_id == child_profile_id)
            else:
                q = q.where(Entitlement.user_id == user_id)
            result = await db.execute(q)
            return result.scalar_one_or_none() is not None

        if product.product_type == ProductType.COURSE:
            if not await _exists(EntitlementType.COURSE_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.COURSE_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)

            # Auto-create enrollment for the child
            if child_profile_id:
                from app.models import Course
                course_result = await db.execute(
                    select(Course).where(Course.product_id == product.id)
                )
                course = course_result.scalar_one_or_none()
                if course:
                    # Check if already enrolled
                    existing = await db.execute(
                        select(Enrollment).where(
                            Enrollment.child_profile_id == child_profile_id,
                            Enrollment.course_id == course.id,
                        )
                    )
                    if not existing.scalar_one_or_none():
                        db.add(Enrollment(
                            child_profile_id=child_profile_id,
                            course_id=course.id,
                        ))

        elif product.product_type == ProductType.EBOOK:
            if not await _exists(EntitlementType.EBOOK_DOWNLOAD):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.EBOOK_DOWNLOAD.value,
                )
                db.add(ent)
                created.append(ent)

        elif product.product_type == ProductType.EXAM:
            if not await _exists(EntitlementType.EXAM_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.EXAM_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)

        elif product.product_type == ProductType.GAME:
            if not await _exists(EntitlementType.GAME_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.GAME_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)

        elif product.product_type == ProductType.ABACUS:
            if not await _exists(EntitlementType.ABACUS_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.ABACUS_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)

        elif product.product_type == ProductType.PHYSICAL_BOOK:
            # Physical books always create new entitlements for logged-in users
            # (multiple orders = multiple shipments). Guest orders skip the
            # entitlement row because user_id is NOT NULL on entitlements, and
            # the Shipment record below is the real fulfillment artefact.
            if not is_guest:
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.PHYSICAL_SHIPMENT.value,
                )
                db.add(ent)
                created.append(ent)

            # Auto-create shipment if order has shipping address
            if order.shipping_address:
                shipment = Shipment(
                    order_id=order.id,
                    status=ShipmentStatus.PENDING.value,
                    zone=order.shipping_zone or ShippingZone.INSIDE_DHAKA.value,
                    recipient_name=order.shipping_name or "",
                    recipient_phone=order.shipping_phone or "",
                    delivery_address=order.shipping_address,
                    delivery_area=order.shipping_area,
                    delivery_city=order.shipping_city,
                )
                db.add(shipment)
                await db.flush()
                db.add(ShipmentEvent(
                    shipment_id=shipment.id,
                    status=ShipmentStatus.PENDING.value,
                    description="Shipment created from order",
                ))

        return created

    @staticmethod
    async def check_entitlement(
        user_id: UUID,
        product_id: UUID,
        entitlement_type: EntitlementType,
        child_profile_id: UUID | None,
        db: AsyncSession,
    ) -> Entitlement | None:
        """Check if a user/child has an active entitlement for a product."""
        query = select(Entitlement).where(
            Entitlement.user_id == user_id,
            Entitlement.product_id == product_id,
            Entitlement.entitlement_type == entitlement_type,
            Entitlement.is_active == True,
        )
        if child_profile_id:
            query = query.where(Entitlement.child_profile_id == child_profile_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_entitlements(
        user_id: UUID,
        db: AsyncSession,
        entitlement_type: EntitlementType | None = None,
    ) -> list[Entitlement]:
        """Get all active entitlements for a user."""
        query = select(Entitlement).where(
            Entitlement.user_id == user_id,
            Entitlement.is_active == True,
        )
        if entitlement_type:
            query = query.where(Entitlement.entitlement_type == entitlement_type)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def has_course_access(
        user_id: UUID,
        product_id: UUID,
        child_profile_id: UUID | None,
        db: AsyncSession,
    ) -> bool:
        """
        Check if user/child has course access.
        Checks child-level entitlement first, then falls back to parent-level.
        """
        # Check child-level entitlement
        if child_profile_id:
            result = await db.execute(
                select(Entitlement).where(
                    Entitlement.child_profile_id == child_profile_id,
                    Entitlement.product_id == product_id,
                    Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
                    Entitlement.is_active == True,
                )
            )
            if result.scalar_one_or_none():
                return True

        # Check parent-level entitlement
        result = await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.product_id == product_id,
                Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
                Entitlement.is_active == True,
            )
        )
        return result.scalar_one_or_none() is not None
