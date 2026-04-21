"""Order, OrderItem, Payment models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import OrderStatus, PaymentStatus, PaymentMethod, ShippingZone


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id"), nullable=True)
    order_number = Column(String(20), unique=True, nullable=False, index=True)
    status = Column(String(30), default=OrderStatus.PENDING.value)
    subtotal = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), default=0)
    shipping_fee = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="BDT")
    # Shipping address
    shipping_name = Column(String(255), nullable=True)
    shipping_phone = Column(String(15), nullable=True)
    shipping_address = Column(Text, nullable=True)
    shipping_area = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_zone = Column(String(30), nullable=True)
    shipping_postal = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    coupon_code = Column(String(50), nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True)
    # Fraud / guest fields
    is_guest = Column(Boolean, default=False)
    fraud_score = Column(Integer, nullable=True)
    fraud_flags = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    device_fingerprint = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="orders")
    child = relationship("ChildProfile")
    items = relationship("OrderItem", back_populates="order", lazy="noload")
    payment = relationship("Payment", back_populates="order", uselist=False, lazy="noload")
    shipment = relationship("Shipment", back_populates="order", uselist=False, lazy="noload")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    entitlements = relationship("Entitlement", back_populates="order_item", lazy="noload")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="BDT")
    status = Column(String(30), default=PaymentStatus.INITIATED.value)
    method = Column(String(30), nullable=False)
    tran_id = Column(String(100), unique=True, nullable=False, index=True)
    session_key = Column(String(255), nullable=True)
    gateway_response = Column(JSONB, default=dict)
    val_id = Column(String(100), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    order = relationship("Order", back_populates="payment")
