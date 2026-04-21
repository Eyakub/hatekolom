"""
Shipping State Machine — Admin-managed, Inside/Outside Dhaka.

Valid transitions:
  pending    → confirmed, cancelled
  confirmed  → dispatched, cancelled
  dispatched → delivered, returned
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Shipment, ShipmentEvent, ShipmentStatus
from app.core.exceptions import InvalidTransitionError, NotFoundError

logger = logging.getLogger(__name__)

# Valid state transitions (using string values)
VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"dispatched", "cancelled"},
    "dispatched": {"delivered", "returned"},
    "delivered": set(),
    "returned": set(),
    "cancelled": set(),
}


class ShippingService:

    @staticmethod
    async def update_status(
        shipment_id: UUID,
        new_status: ShipmentStatus,
        admin_id: UUID,
        db: AsyncSession,
        courier_name: str | None = None,
        tracking_number: str | None = None,
        admin_notes: str | None = None,
        estimated_delivery=None,
    ) -> Shipment:
        """Transition shipment to a new status with validation."""
        result = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id)
        )
        shipment = result.scalar_one_or_none()

        if not shipment:
            raise NotFoundError("Shipment")

        # Validate transition
        allowed = VALID_TRANSITIONS.get(shipment.status, set())
        if new_status.value not in allowed:
            raise InvalidTransitionError(
                f"Cannot transition from '{shipment.status}' to '{new_status.value}'. "
                f"Allowed: {list(allowed)}"
            )

        # Update shipment
        shipment.status = new_status.value

        if courier_name is not None:
            shipment.courier_name = courier_name
        if tracking_number is not None:
            shipment.tracking_number = tracking_number
        if admin_notes is not None:
            shipment.admin_notes = admin_notes
        if estimated_delivery is not None:
            shipment.estimated_delivery = estimated_delivery

        if new_status == ShipmentStatus.DELIVERED:
            from datetime import datetime, timezone
            shipment.actual_delivery = datetime.now(timezone.utc)

        # Log event
        description_map = {
            ShipmentStatus.CONFIRMED: "Order confirmed by admin, preparing for dispatch",
            ShipmentStatus.DISPATCHED: f"Dispatched via {courier_name or 'courier'}. Tracking: {tracking_number or 'N/A'}",
            ShipmentStatus.DELIVERED: "Successfully delivered",
            ShipmentStatus.RETURNED: "Delivery failed, package returned",
            ShipmentStatus.CANCELLED: "Shipment cancelled by admin",
        }

        event = ShipmentEvent(
            shipment_id=shipment.id,
            status=new_status.value,
            description=description_map.get(new_status, ""),
            changed_by=admin_id,
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment, ["events"])

        logger.info(
            f"Shipment {shipment_id} transitioned to {new_status.value} by admin {admin_id}"
        )
        return shipment

