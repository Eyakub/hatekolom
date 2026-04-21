"""Coupon model for discount codes."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class DiscountType(str, __import__("enum").Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    discount_type = Column(String(20), nullable=False, default="percentage")  # percentage, fixed
    discount_value = Column(Numeric(10, 2), nullable=False)  # e.g. 10 for 10% or ৳10
    min_order_amount = Column(Numeric(10, 2), default=0)
    max_discount_amount = Column(Numeric(10, 2), nullable=True)  # Cap for percentage discounts
    max_uses = Column(Integer, default=100)
    times_used = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
