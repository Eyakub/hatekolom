"""
Coupon API — CRUD and checkout validation.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional

from app.db import get_db
from app.models.coupon import Coupon
from app.models import User
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coupons", tags=["Coupons"])


# Schemas

class CouponCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    discount_type: str = Field(default="percentage", pattern="^(percentage|fixed)$")
    discount_value: float = Field(..., gt=0)
    min_order_amount: float = Field(default=0, ge=0)
    max_discount_amount: Optional[float] = None
    max_uses: int = Field(default=100, ge=1)
    is_active: bool = True


class CouponUpdateRequest(BaseModel):
    discount_value: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    max_uses: Optional[int] = None
    is_active: Optional[bool] = None


class CouponResponse(BaseModel):
    id: str
    code: str
    discount_type: str
    discount_value: str
    min_order_amount: str
    max_discount_amount: Optional[str] = None
    max_uses: int
    times_used: int
    is_active: bool
    created_at: Optional[str] = None


class CouponApplyRequest(BaseModel):
    code: str
    subtotal: float = Field(..., gt=0)


class CouponApplyResponse(BaseModel):
    valid: bool
    discount: str = "0"
    message: str = ""


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.get("/", response_model=list[CouponResponse])
async def list_coupons(
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """List all coupons (admin)."""
    result = await db.execute(
        select(Coupon).order_by(Coupon.created_at.desc())
    )
    coupons = result.scalars().all()
    return [
        CouponResponse(
            id=str(c.id),
            code=c.code,
            discount_type=c.discount_type,
            discount_value=str(c.discount_value),
            min_order_amount=str(c.min_order_amount),
            max_discount_amount=str(c.max_discount_amount) if c.max_discount_amount else None,
            max_uses=c.max_uses,
            times_used=c.times_used,
            is_active=c.is_active,
            created_at=str(c.created_at) if c.created_at else None,
        )
        for c in coupons
    ]


@router.post("/", response_model=CouponResponse, status_code=201)
async def create_coupon(
    data: CouponCreateRequest,
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new coupon (admin)."""
    # Check uniqueness
    existing = await db.execute(select(Coupon).where(Coupon.code == data.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Coupon '{data.code}' already exists")

    coupon = Coupon(
        code=data.code.upper(),
        discount_type=data.discount_type,
        discount_value=Decimal(str(data.discount_value)),
        min_order_amount=Decimal(str(data.min_order_amount)),
        max_discount_amount=Decimal(str(data.max_discount_amount)) if data.max_discount_amount else None,
        max_uses=data.max_uses,
        is_active=data.is_active,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)

    return CouponResponse(
        id=str(coupon.id),
        code=coupon.code,
        discount_type=coupon.discount_type,
        discount_value=str(coupon.discount_value),
        min_order_amount=str(coupon.min_order_amount),
        max_discount_amount=str(coupon.max_discount_amount) if coupon.max_discount_amount else None,
        max_uses=coupon.max_uses,
        times_used=coupon.times_used,
        is_active=coupon.is_active,
        created_at=str(coupon.created_at) if coupon.created_at else None,
    )


@router.patch("/{coupon_id}", response_model=CouponResponse)
async def update_coupon(
    coupon_id: UUID,
    data: CouponUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Update a coupon (admin)."""
    coupon = await db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("discount_value", "min_order_amount", "max_discount_amount"):
            setattr(coupon, field, Decimal(str(value)) if value is not None else None)
        else:
            setattr(coupon, field, value)

    await db.commit()
    await db.refresh(coupon)

    return CouponResponse(
        id=str(coupon.id),
        code=coupon.code,
        discount_type=coupon.discount_type,
        discount_value=str(coupon.discount_value),
        min_order_amount=str(coupon.min_order_amount),
        max_discount_amount=str(coupon.max_discount_amount) if coupon.max_discount_amount else None,
        max_uses=coupon.max_uses,
        times_used=coupon.times_used,
        is_active=coupon.is_active,
        created_at=str(coupon.created_at) if coupon.created_at else None,
    )


# ============================================
# PUBLIC ENDPOINT — Validate at checkout
# ============================================

@router.post("/apply", response_model=CouponApplyResponse)
async def apply_coupon(
    data: CouponApplyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate a coupon code at checkout.
    
    Returns the calculated discount amount if valid.
    """
    result = await db.execute(
        select(Coupon).where(Coupon.code == data.code.upper())
    )
    coupon = result.scalar_one_or_none()

    if not coupon:
        return CouponApplyResponse(valid=False, message="Invalid coupon code")

    if not coupon.is_active:
        return CouponApplyResponse(valid=False, message="This coupon is no longer active")

    if coupon.max_uses and coupon.times_used >= coupon.max_uses:
        return CouponApplyResponse(valid=False, message="Coupon usage limit reached")

    if coupon.expires_at and coupon.expires_at < datetime.now(timezone.utc):
        return CouponApplyResponse(valid=False, message="Coupon has expired")

    subtotal = Decimal(str(data.subtotal))

    if coupon.min_order_amount and subtotal < coupon.min_order_amount:
        return CouponApplyResponse(
            valid=False,
            message=f"Minimum order amount is ৳{coupon.min_order_amount}",
        )

    # Calculate discount
    if coupon.discount_type == "percentage":
        discount = subtotal * coupon.discount_value / 100
        if coupon.max_discount_amount:
            discount = min(discount, coupon.max_discount_amount)
    else:
        discount = min(coupon.discount_value, subtotal)

    return CouponApplyResponse(
        valid=True,
        discount=str(discount),
        message=f"Coupon applied! You save ৳{discount}",
    )
