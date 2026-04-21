"""Shipping models — rates, shipments, events (state machine)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Integer, Text,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import ShipmentStatus, ShippingZone


class ShippingRate(Base):
    __tablename__ = "shipping_rates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone = Column(String(30), unique=True, nullable=False)
    rate = Column(Numeric(10, 2), nullable=False)
    label = Column(String(100), nullable=True)
    label_bn = Column(String(100), nullable=True)


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    status = Column(String(30), default=ShipmentStatus.PENDING.value)
    zone = Column(String(30), nullable=False)
    courier_name = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    recipient_name = Column(String(255), nullable=False)
    recipient_phone = Column(String(15), nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_area = Column(String(255), nullable=True)
    delivery_city = Column(String(100), nullable=True)
    admin_notes = Column(Text, nullable=True)
    estimated_delivery = Column(DateTime(timezone=True), nullable=True)
    actual_delivery = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    order = relationship("Order", back_populates="shipment")
    events = relationship("ShipmentEvent", back_populates="shipment", lazy="noload",
                          order_by="ShipmentEvent.event_time.desc()")


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(30), nullable=False)
    description = Column(Text, nullable=True)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    event_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    shipment = relationship("Shipment", back_populates="events")
    admin = relationship("User")
