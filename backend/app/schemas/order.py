"""Order, Payment, Shipment, Entitlement schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


# ---- Orders ----

class OrderItemRequest(BaseModel):
    product_id: UUID
    quantity: int = 1


class ShippingAddressRequest(BaseModel):
    shipping_name: str = Field(..., min_length=2)
    shipping_phone: str = Field(..., min_length=11, max_length=15)
    shipping_address: str = Field(..., min_length=5)
    shipping_area: Optional[str] = None
    shipping_city: str = Field(default="Dhaka")
    shipping_zone: str = Field(..., pattern="^(inside_dhaka|outside_dhaka)$")
    shipping_postal: Optional[str] = None


class OrderCreateRequest(BaseModel):
    child_profile_id: Optional[UUID] = None
    child_profile_ids: Optional[list[UUID]] = None  # For "all children" purchase
    items: list[OrderItemRequest] = Field(..., min_length=1)
    shipping: Optional[ShippingAddressRequest] = None
    coupon_code: Optional[str] = None
    notes: Optional[str] = None
    payment_method: str = "mock_success"


class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_title: Optional[str] = None
    product_type: Optional[str] = None
    quantity: int
    unit_price: Decimal
    total_price: Decimal

    model_config = {"from_attributes": True}


class PaymentResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    status: str
    method: str
    tran_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderUserBrief(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    user: Optional[OrderUserBrief] = None
    child_profile_id: Optional[UUID] = None
    order_number: str
    status: str
    subtotal: Decimal
    discount: Decimal
    shipping_fee: Decimal
    total: Decimal
    currency: str
    shipping_name: Optional[str] = None
    shipping_phone: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_area: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_zone: Optional[str] = None
    notes: Optional[str] = None
    coupon_code: Optional[str] = None
    items: list[OrderItemResponse] = []
    payment: Optional[PaymentResponse] = None
    shipment: Optional["OrderShipmentBrief"] = None
    gateway_url: Optional[str] = None  # SSLCommerz redirect URL
    # Fraud fields (admin-visible)
    is_guest: Optional[bool] = None
    fraud_score: Optional[int] = None
    fraud_flags: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderShipmentBrief(BaseModel):
    """Lightweight shipment info embedded in order responses."""
    id: UUID
    status: str
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---- Shipments ----

class ShipmentUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(confirmed|dispatched|delivered|returned|cancelled)$")
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    admin_notes: Optional[str] = None
    estimated_delivery: Optional[datetime] = None


class ShipmentEventResponse(BaseModel):
    id: UUID
    status: str
    description: Optional[str] = None
    event_time: datetime

    model_config = {"from_attributes": True}


class ShipmentResponse(BaseModel):
    id: UUID
    order_id: UUID
    status: str
    zone: str
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    delivery_address: str
    delivery_area: Optional[str] = None
    delivery_city: Optional[str] = None
    admin_notes: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    events: list[ShipmentEventResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Entitlements ----

class EntitlementResponse(BaseModel):
    id: UUID
    user_id: UUID
    child_profile_id: Optional[UUID] = None
    product_id: UUID
    product_title: Optional[str] = None
    product_type: Optional[str] = None
    product_slug: Optional[str] = None
    entitlement_type: str
    is_active: bool
    granted_at: datetime
    expires_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
