"""Fraud-related Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ---- Guest Order ----

class GuestOrderItemRequest(BaseModel):
    product_id: UUID
    quantity: int = 1


class GuestOrderRequest(BaseModel):
    phone: str = Field(..., pattern=r"^01[3-9]\d{8}$")
    name: str = Field(..., min_length=2)
    address: str = Field(..., min_length=5)
    area: Optional[str] = None
    city: str = Field(default="Dhaka")
    zone: str = Field(..., pattern="^(inside_dhaka|outside_dhaka)$")
    postal: Optional[str] = None
    notes: Optional[str] = None
    items: list[GuestOrderItemRequest] = Field(..., min_length=1)
    payment_method: str = "cod"
    device_fingerprint: Optional[dict] = None
    ip_info: Optional[dict] = None


class IpCheckResponse(BaseModel):
    is_vpn: bool
    country: str
    ip: str


# ---- Fraud Config ----

class FraudConfigResponse(BaseModel):
    # Hard block toggles
    block_phone_enabled: bool = True
    block_ip_enabled: bool = True
    block_fingerprint_enabled: bool = True
    # Rate limits
    phone_rate_window_hours: int
    phone_rate_max_orders: int
    phone_rate_score: int
    ip_rate_window_hours: int
    ip_rate_max_orders: int
    ip_rate_score: int
    fingerprint_rate_window_hours: int
    fingerprint_rate_max_orders: int
    fingerprint_rate_score: int
    min_address_length: int
    address_quality_score: int
    max_single_item_qty: int
    max_total_items: int
    quantity_spike_score: int
    phone_format_score: int
    vpn_proxy_score: int
    blacklist_score: int
    prepaid_discount_score: int
    medium_risk_threshold: int
    high_risk_threshold: int
    max_cart_value: int
    updated_at: Optional[datetime] = None
    updated_by: Optional[UUID] = None

    model_config = {"from_attributes": True}


class FraudConfigUpdateRequest(BaseModel):
    block_phone_enabled: Optional[bool] = None
    block_ip_enabled: Optional[bool] = None
    block_fingerprint_enabled: Optional[bool] = None
    phone_rate_window_hours: Optional[int] = None
    phone_rate_max_orders: Optional[int] = None
    phone_rate_score: Optional[int] = None
    ip_rate_window_hours: Optional[int] = None
    ip_rate_max_orders: Optional[int] = None
    ip_rate_score: Optional[int] = None
    fingerprint_rate_window_hours: Optional[int] = None
    fingerprint_rate_max_orders: Optional[int] = None
    fingerprint_rate_score: Optional[int] = None
    min_address_length: Optional[int] = None
    address_quality_score: Optional[int] = None
    max_single_item_qty: Optional[int] = None
    max_total_items: Optional[int] = None
    quantity_spike_score: Optional[int] = None
    phone_format_score: Optional[int] = None
    vpn_proxy_score: Optional[int] = None
    blacklist_score: Optional[int] = None
    prepaid_discount_score: Optional[int] = None
    medium_risk_threshold: Optional[int] = None
    high_risk_threshold: Optional[int] = None
    max_cart_value: Optional[int] = None


# ---- Fraud Dashboard ----

class FraudDashboardSummary(BaseModel):
    total_orders: int
    guest_orders: int
    authenticated_orders: int
    low_risk: int
    medium_risk: int
    high_risk: int
    cancelled_rate: float
    returned_rate: float


class DailyOrderTrend(BaseModel):
    date: str
    total: int
    low_risk: int
    medium_risk: int
    high_risk: int


class TopFlag(BaseModel):
    flag: str
    count: int


class RepeatOffender(BaseModel):
    phone: str
    total_orders: int
    cancelled_count: int
    returned_count: int
    last_order_date: Optional[datetime] = None
