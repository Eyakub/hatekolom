"""Entitlement model — grants access to products after purchase."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import EntitlementType


class Entitlement(Base):
    __tablename__ = "entitlements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    order_item_id = Column(UUID(as_uuid=True), ForeignKey("order_items.id"), nullable=True)
    entitlement_type = Column(String(30), nullable=False)
    is_active = Column(Boolean, default=True)
    granted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    metadata_ = Column("metadata", JSONB, default=dict)

    user = relationship("User")
    child = relationship("ChildProfile", back_populates="entitlements")
    product = relationship("Product")
    order_item = relationship("OrderItem", back_populates="entitlements")

    __table_args__ = (
        Index(
            "idx_entitlement_child_product",
            "child_profile_id", "product_id", "entitlement_type",
            unique=True,
            postgresql_where=Column("is_active") == True,
        ),
    )
