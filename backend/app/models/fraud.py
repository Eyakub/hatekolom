"""Fraud configuration model — single-row settings table."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class FraudConfig(Base):
    __tablename__ = "fraud_config"

    id = Column(Integer, primary_key=True, default=1)

    # Hard block toggles
    block_phone_enabled = Column(Boolean, default=True)
    block_ip_enabled = Column(Boolean, default=True)
    block_fingerprint_enabled = Column(Boolean, default=True)

    # Rate limits
    phone_rate_window_hours = Column(Integer, default=24)
    phone_rate_max_orders = Column(Integer, default=2)
    phone_rate_score = Column(Integer, default=30)
    ip_rate_window_hours = Column(Integer, default=24)
    ip_rate_max_orders = Column(Integer, default=3)
    ip_rate_score = Column(Integer, default=25)
    fingerprint_rate_window_hours = Column(Integer, default=24)
    fingerprint_rate_max_orders = Column(Integer, default=3)
    fingerprint_rate_score = Column(Integer, default=25)

    # Address & quantity
    min_address_length = Column(Integer, default=15)
    address_quality_score = Column(Integer, default=15)
    max_single_item_qty = Column(Integer, default=5)
    max_total_items = Column(Integer, default=10)
    quantity_spike_score = Column(Integer, default=20)

    # Fixed scores
    phone_format_score = Column(Integer, default=40)
    vpn_proxy_score = Column(Integer, default=30)
    blacklist_score = Column(Integer, default=35)
    prepaid_discount_score = Column(Integer, default=-20)

    # Risk thresholds
    medium_risk_threshold = Column(Integer, default=30)
    high_risk_threshold = Column(Integer, default=60)

    # Guest order limits
    max_cart_value = Column(Integer, default=5000)

    # Meta
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
