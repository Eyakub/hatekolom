from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.db import get_db
from app.models import User, Shipment, ShipmentStatus
from app.schemas import ShipmentResponse, ShipmentUpdateRequest
from app.api.deps import PermissionChecker
from app.core.permissions import Permission
from app.services.shipping_service import ShippingService

router = APIRouter(prefix="/shipments", tags=["Shipments"])


@router.get("/", response_model=list[ShipmentResponse])
async def list_shipments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    status_filter: str = Query(None, alias="status"),
    zone: str = Query(None),
    user: User = Depends(PermissionChecker([Permission.SHIPMENT_MANAGE])),
    db: AsyncSession = Depends(get_db),
):
    """List all shipments (admin only)."""
    query = (
        select(Shipment)
        .options(selectinload(Shipment.events))
        .order_by(Shipment.created_at.desc())
    )

    if status_filter:
        query = query.where(Shipment.status == ShipmentStatus(status_filter))
    if zone:
        query = query.where(Shipment.zone == zone)

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    shipments = result.scalars().all()
    return [ShipmentResponse.model_validate(s) for s in shipments]


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(
    shipment_id: UUID,
    user: User = Depends(PermissionChecker([Permission.SHIPMENT_MANAGE])),
    db: AsyncSession = Depends(get_db),
):
    """Get shipment details (admin only)."""
    result = await db.execute(
        select(Shipment)
        .options(selectinload(Shipment.events))
        .where(Shipment.id == shipment_id)
    )
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    return ShipmentResponse.model_validate(shipment)


@router.patch("/{shipment_id}", response_model=ShipmentResponse)
async def update_shipment(
    shipment_id: UUID,
    data: ShipmentUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.SHIPMENT_MANAGE])),
    db: AsyncSession = Depends(get_db),
):
    """
    Update shipment status (admin only).

    Valid transitions:
      pending → confirmed, cancelled
      confirmed → dispatched, cancelled
      dispatched → delivered, returned
    """
    shipment = await ShippingService.update_status(
        shipment_id=shipment_id,
        new_status=ShipmentStatus(data.status),
        admin_id=user.id,
        db=db,
        courier_name=data.courier_name,
        tracking_number=data.tracking_number,
        admin_notes=data.admin_notes,
        estimated_delivery=data.estimated_delivery,
    )

    # Reload with events
    result = await db.execute(
        select(Shipment)
        .options(selectinload(Shipment.events))
        .where(Shipment.id == shipment_id)
    )
    shipment = result.scalar_one()
    return ShipmentResponse.model_validate(shipment)
