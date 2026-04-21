# Guest Checkout & Fraud Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow guest checkout for physical-only orders with a backend fraud scoring system that flags suspicious orders for admin review.

**Architecture:** New `POST /orders/guest` endpoint (no auth) that validates items are physical-only, runs a multi-factor fraud scoring engine (rate limits, VPN detection, phone blacklist, address quality), stores score/flags on the Order, and returns an order confirmation. Frontend conditionally shows a simplified guest form on `/checkout` when unauthenticated + physical-only cart. Admin panel gets risk badges, a configurable fraud settings page, and a fraud analytics dashboard.

**Tech Stack:** FastAPI, SQLAlchemy (async), PostgreSQL, Alembic, Next.js 14, Zustand, Tailwind CSS, ip-api.com (free tier), Redis (existing rate limiter)

**Spec:** `docs/superpowers/specs/2026-04-12-guest-checkout-fraud-prevention-design.md`

---

### Task 1: FraudConfig Model

**Files:**
- Create: `backend/app/models/fraud.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the FraudConfig model**

Create `backend/app/models/fraud.py`:

```python
"""Fraud configuration model — single-row settings table."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class FraudConfig(Base):
    __tablename__ = "fraud_config"

    id = Column(Integer, primary_key=True, default=1)

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
```

- [ ] **Step 2: Register in models __init__**

In `backend/app/models/__init__.py`, add after the Coupon import (line 59):

```python
# Fraud Config
from app.models.fraud import FraudConfig  # noqa: F401
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/fraud.py backend/app/models/__init__.py
git commit -m "feat: add FraudConfig model"
```

---

### Task 2: Order Model Changes

**Files:**
- Modify: `backend/app/models/order.py:17-49`

- [ ] **Step 1: Add fraud columns and make user_id nullable**

In `backend/app/models/order.py`, change `user_id` on line 21 from `nullable=False` to `nullable=True`:

```python
user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
```

Then add these new columns after `idempotency_key` (line 40) and before `created_at` (line 41):

```python
    # Fraud / guest fields
    is_guest = Column(Boolean, default=False)
    fraud_score = Column(Integer, nullable=True)
    fraud_flags = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    device_fingerprint = Column(JSONB, nullable=True)
```

Note: `Boolean` is already imported in the file's imports (line 7).

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/order.py
git commit -m "feat: add fraud columns to Order, make user_id nullable"
```

---

### Task 3: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/<auto>_add_fraud_config_and_guest_order_fields.py`

- [ ] **Step 1: Generate migration**

```bash
cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend
alembic revision --autogenerate -m "add fraud_config table and guest order fields"
```

- [ ] **Step 2: Review the generated migration**

Open the generated file and verify it includes:
- `CREATE TABLE fraud_config` with all columns
- `ALTER TABLE orders` adding: `is_guest`, `fraud_score`, `fraud_flags`, `ip_address`, `device_fingerprint`
- `ALTER TABLE orders` changing `user_id` to nullable

- [ ] **Step 3: Run migration**

```bash
alembic upgrade head
```

- [ ] **Step 4: Seed default FraudConfig row**

Create a small script or add to migration's `upgrade()` after the table creation:

```python
op.execute("""
    INSERT INTO fraud_config (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
""")
```

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/
git commit -m "feat: migration for fraud_config table and guest order fields"
```

---

### Task 4: IP Check Utility

**Files:**
- Create: `backend/app/utils/ip_check.py`

- [ ] **Step 1: Create the IP check utility**

Create `backend/app/utils/ip_check.py`:

```python
"""IP check utility — calls ip-api.com to detect VPN/proxy."""

import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Simple in-memory cache: {ip: (result_dict, timestamp)}
_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 3600  # 1 hour


async def check_ip(ip: str) -> dict:
    """
    Check if an IP is a VPN/proxy/datacenter using ip-api.com.
    Returns: {"is_vpn": bool, "country": str, "ip": str}
    Falls back to safe defaults if the API is unavailable.
    """
    # Check cache
    if ip in _cache:
        result, ts = _cache[ip]
        if time.time() - ts < _CACHE_TTL:
            return result

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "proxy,hosting,country,status"},
            )
            data = resp.json()

            if data.get("status") == "success":
                result = {
                    "is_vpn": bool(data.get("proxy") or data.get("hosting")),
                    "country": data.get("country", "Unknown"),
                    "ip": ip,
                }
            else:
                result = {"is_vpn": False, "country": "Unknown", "ip": ip}

    except Exception as e:
        logger.warning(f"ip-api.com check failed for {ip}: {e}")
        result = {"is_vpn": False, "country": "Unknown", "ip": ip}

    _cache[ip] = (result, time.time())
    return result


def get_client_ip(request) -> str:
    """Extract real client IP from request, respecting X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/utils/ip_check.py
git commit -m "feat: add IP check utility for VPN/proxy detection"
```

---

### Task 5: Fraud Schemas

**Files:**
- Create: `backend/app/schemas/fraud.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/schemas/order.py:69-95`

- [ ] **Step 1: Create fraud schemas**

Create `backend/app/schemas/fraud.py`:

```python
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
    phone: str = Field(..., min_length=11, max_length=15)
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
    # Address & quantity
    min_address_length: int
    address_quality_score: int
    max_single_item_qty: int
    max_total_items: int
    quantity_spike_score: int
    # Fixed scores
    phone_format_score: int
    vpn_proxy_score: int
    blacklist_score: int
    prepaid_discount_score: int
    # Risk thresholds
    medium_risk_threshold: int
    high_risk_threshold: int
    # Guest order limits
    max_cart_value: int
    # Meta
    updated_at: Optional[datetime] = None
    updated_by: Optional[UUID] = None

    model_config = {"from_attributes": True}


class FraudConfigUpdateRequest(BaseModel):
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


class RiskDistribution(BaseModel):
    low: int
    medium: int
    high: int


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
```

- [ ] **Step 2: Update OrderResponse to include fraud fields**

In `backend/app/schemas/order.py`, update the `OrderResponse` class. Change `user_id: UUID` to `user_id: Optional[UUID] = None` on line 71, and add fraud fields after `gateway_url` (line 92):

```python
    # Fraud fields (admin-visible)
    is_guest: Optional[bool] = None
    fraud_score: Optional[int] = None
    fraud_flags: Optional[list] = None
```

- [ ] **Step 3: Register in schemas __init__**

In `backend/app/schemas/__init__.py`, add after the Order imports (around line 58):

```python
# Fraud
from app.schemas.fraud import (  # noqa: F401
    GuestOrderRequest, IpCheckResponse,
    FraudConfigResponse, FraudConfigUpdateRequest,
)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/fraud.py backend/app/schemas/order.py backend/app/schemas/__init__.py
git commit -m "feat: add fraud and guest order schemas"
```

---

### Task 6: Fraud Service

**Files:**
- Create: `backend/app/services/fraud_service.py`

- [ ] **Step 1: Create the FraudService**

Create `backend/app/services/fraud_service.py`:

```python
"""Fraud scoring service — multi-factor risk assessment for guest orders."""

import re
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import Order, OrderStatus, ShipmentStatus, Shipment
from app.models.fraud import FraudConfig

logger = logging.getLogger(__name__)

# BD mobile pattern: 01[3-9]XXXXXXXX (11 digits)
BD_PHONE_PATTERN = re.compile(r"^01[3-9]\d{8}$")

# Cached config
_config_cache: Optional[tuple[FraudConfig, float]] = None
_CONFIG_TTL = 60  # 1 minute


class FraudService:

    @staticmethod
    async def _get_config(db: AsyncSession) -> FraudConfig:
        """Load FraudConfig with short TTL cache."""
        import time
        global _config_cache

        if _config_cache:
            config, ts = _config_cache
            if time.time() - ts < _CONFIG_TTL:
                return config

        result = await db.execute(select(FraudConfig).where(FraudConfig.id == 1))
        config = result.scalar_one_or_none()
        if not config:
            # Auto-create default config
            config = FraudConfig(id=1)
            db.add(config)
            await db.flush()

        _config_cache = (config, time.time())
        return config

    @staticmethod
    def hash_fingerprint(fingerprint: Optional[dict]) -> Optional[str]:
        """Hash a device fingerprint dict into a stable string."""
        if not fingerprint:
            return None
        raw = json.dumps(fingerprint, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    @staticmethod
    async def score_order(
        phone: str,
        ip_info: Optional[dict],
        fingerprint: Optional[dict],
        items: list[dict],  # [{"product_id": ..., "quantity": ...}]
        payment_method: str,
        db: AsyncSession,
    ) -> dict:
        """
        Score a guest order for fraud risk.
        Returns: {"score": int, "flags": list[str], "risk_level": str}
        """
        config = await FraudService._get_config(db)
        score = 0
        flags = []
        now = datetime.now(timezone.utc)

        # 1. Phone format
        if not BD_PHONE_PATTERN.match(phone):
            score += config.phone_format_score
            flags.append("invalid_phone_format")

        # 2. Phone rate limit
        phone_window = now - timedelta(hours=config.phone_rate_window_hours)
        phone_count_result = await db.execute(
            select(func.count(Order.id)).where(
                Order.shipping_phone == phone,
                Order.created_at >= phone_window,
            )
        )
        phone_count = phone_count_result.scalar() or 0
        if phone_count >= config.phone_rate_max_orders:
            score += config.phone_rate_score
            flags.append(f"phone_rate_limit:{phone_count}_orders_in_{config.phone_rate_window_hours}h")

        # 3. IP rate limit
        ip = ip_info.get("ip") if ip_info else None
        if ip:
            ip_window = now - timedelta(hours=config.ip_rate_window_hours)
            ip_count_result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.ip_address == ip,
                    Order.created_at >= ip_window,
                )
            )
            ip_count = ip_count_result.scalar() or 0
            if ip_count >= config.ip_rate_max_orders:
                score += config.ip_rate_score
                flags.append(f"ip_rate_limit:{ip_count}_orders_in_{config.ip_rate_window_hours}h")

        # 4. Fingerprint rate limit
        fp_hash = FraudService.hash_fingerprint(fingerprint)
        if fp_hash:
            fp_window = now - timedelta(hours=config.fingerprint_rate_window_hours)
            # Query orders with matching fingerprint hash in the JSONB
            fp_count_result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.device_fingerprint.isnot(None),
                    Order.created_at >= fp_window,
                )
            )
            # We need to compare hashes — store hash in device_fingerprint.hash
            # For now, count all orders with fingerprint in the window as a rough proxy
            # (refined once we store {"hash": ...} in device_fingerprint)
            fp_count = fp_count_result.scalar() or 0
            # More precise: count orders where device_fingerprint->>'hash' = fp_hash
            fp_precise_result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.device_fingerprint["hash"].astext == fp_hash,
                    Order.created_at >= fp_window,
                )
            )
            fp_count = fp_precise_result.scalar() or 0
            if fp_count >= config.fingerprint_rate_max_orders:
                score += config.fingerprint_rate_score
                flags.append(f"fingerprint_rate_limit:{fp_count}_orders_in_{config.fingerprint_rate_window_hours}h")

        # 5. VPN/Proxy
        if ip_info and ip_info.get("is_vpn"):
            score += config.vpn_proxy_score
            flags.append("vpn_proxy_detected")

        # 6. Phone blacklist (cancelled/returned orders)
        blacklist_result = await db.execute(
            select(func.count(Order.id)).where(
                Order.shipping_phone == phone,
                Order.status.in_([
                    OrderStatus.CANCELLED.value,
                ]),
            )
        )
        cancelled_count = blacklist_result.scalar() or 0

        # Check returned shipments
        returned_result = await db.execute(
            select(func.count(Shipment.id))
            .join(Order, Order.id == Shipment.order_id)
            .where(
                Order.shipping_phone == phone,
                Shipment.status == ShipmentStatus.RETURNED.value,
            )
        )
        returned_count = returned_result.scalar() or 0

        if cancelled_count > 0 or returned_count > 0:
            score += config.blacklist_score
            flags.append(f"phone_blacklisted:cancelled={cancelled_count},returned={returned_count}")

        # 7. Address quality
        # We receive address from the caller — need to pass it
        # This is checked in score_order_with_address below

        # 8. Quantity spike
        total_qty = sum(item.get("quantity", 1) for item in items)
        max_single = max((item.get("quantity", 1) for item in items), default=0)
        if max_single > config.max_single_item_qty or total_qty > config.max_total_items:
            score += config.quantity_spike_score
            flags.append(f"quantity_spike:max_single={max_single},total={total_qty}")

        # 9. Prepaid discount
        if payment_method in ("bkash", "nagad", "card", "bank"):
            score += config.prepaid_discount_score
            flags.append("prepaid_payment_discount")

        # Ensure score doesn't go below 0
        score = max(0, score)

        # Risk level
        if score >= config.high_risk_threshold:
            risk_level = "high"
        elif score >= config.medium_risk_threshold:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {"score": score, "flags": flags, "risk_level": risk_level}

    @staticmethod
    async def score_with_address(
        phone: str,
        address: str,
        area: Optional[str],
        ip_info: Optional[dict],
        fingerprint: Optional[dict],
        items: list[dict],
        payment_method: str,
        db: AsyncSession,
    ) -> dict:
        """Score order including address quality check."""
        result = await FraudService.score_order(
            phone, ip_info, fingerprint, items, payment_method, db
        )
        config = await FraudService._get_config(db)

        # Address quality
        if len(address) < config.min_address_length or not area:
            result["score"] += config.address_quality_score
            result["flags"].append(
                f"address_quality:length={len(address)},area_missing={not area}"
            )
            # Recompute risk level
            if result["score"] >= config.high_risk_threshold:
                result["risk_level"] = "high"
            elif result["score"] >= config.medium_risk_threshold:
                result["risk_level"] = "medium"

        return result
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/fraud_service.py
git commit -m "feat: add FraudService with multi-factor scoring"
```

---

### Task 7: Guest Order & IP Check Endpoints

**Files:**
- Modify: `backend/app/api/v1/orders.py`

- [ ] **Step 1: Add imports at top of orders.py**

Add these imports to the existing imports at the top of `backend/app/api/v1/orders.py`:

```python
from fastapi import Request
from app.schemas.fraud import GuestOrderRequest, IpCheckResponse
from app.services.fraud_service import FraudService
from app.utils.ip_check import check_ip, get_client_ip
from app.models.fraud import FraudConfig
```

- [ ] **Step 2: Add IP check endpoint**

Add this endpoint after the `_generate_order_number` function (after line 33) and before the `create_order` endpoint:

```python
@router.get("/ip-check", response_model=IpCheckResponse)
async def ip_check(request: Request):
    """Prefetch IP info for guest checkout. No auth required."""
    client_ip = get_client_ip(request)
    result = await check_ip(client_ip)
    return IpCheckResponse(**result)
```

- [ ] **Step 3: Add guest order endpoint**

Add this endpoint right after the `ip_check` endpoint (before `create_order`):

```python
@router.post("/guest", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_guest_order(
    data: GuestOrderRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a guest order — no auth required.
    Physical items only, all payment methods, no coupons.
    """
    # Load fraud config for cart value cap
    config_result = await db.execute(select(FraudConfig).where(FraudConfig.id == 1))
    config = config_result.scalar_one_or_none()
    max_cart_value = config.max_cart_value if config else 5000

    # Validate all items are physical and active
    subtotal = Decimal("0")
    order_items_data = []

    for item in data.items:
        result = await db.execute(
            select(Product).where(Product.id == item.product_id, Product.is_active == True)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.product_type != ProductType.PHYSICAL_BOOK.value:
            raise HTTPException(
                status_code=400,
                detail="Guest checkout only available for physical items"
            )

        unit_price = product.price
        total_price = unit_price * item.quantity
        subtotal += total_price

        order_items_data.append({
            "product_id": product.id,
            "quantity": item.quantity,
            "unit_price": unit_price,
            "total_price": total_price,
        })

    # Cart value cap
    if subtotal > max_cart_value:
        raise HTTPException(
            status_code=400,
            detail=f"Guest order total cannot exceed {max_cart_value} BDT"
        )

    # Shipping fee
    zone = ShippingZone(data.zone)
    rate_result = await db.execute(
        select(ShippingRate).where(ShippingRate.zone == zone)
    )
    rate = rate_result.scalar_one_or_none()
    shipping_fee = Decimal(str(rate.rate)) if rate else Decimal("60")

    total = subtotal + shipping_fee

    # IP check — validate prefetched ip_info against actual request IP
    client_ip = get_client_ip(request)
    ip_info = data.ip_info
    if not ip_info or ip_info.get("ip") != client_ip:
        ip_info = await check_ip(client_ip)

    # Fraud scoring
    fp_hash = FraudService.hash_fingerprint(data.device_fingerprint)
    fraud_result = await FraudService.score_with_address(
        phone=data.phone,
        address=data.address,
        area=data.area,
        ip_info=ip_info,
        fingerprint=data.device_fingerprint,
        items=[{"product_id": str(i.product_id), "quantity": i.quantity} for i in data.items],
        payment_method=data.payment_method.lower(),
        db=db,
    )

    # Look up phone in users table — link if found
    user_result = await db.execute(
        select(User).where(User.phone == data.phone)
    )
    existing_user = user_result.scalar_one_or_none()

    # Determine payment method
    if total == 0:
        payment_method = PaymentMethod.FREE
    else:
        try:
            payment_method = PaymentMethod(data.payment_method.lower())
        except (ValueError, AttributeError):
            payment_method = PaymentMethod.COD

    # Create order
    order = Order(
        user_id=existing_user.id if existing_user else None,
        order_number=_generate_order_number(),
        status=OrderStatus.PENDING.value,
        subtotal=subtotal,
        discount=Decimal("0"),
        shipping_fee=shipping_fee,
        total=total,
        notes=data.notes,
        # Shipping
        shipping_name=data.name,
        shipping_phone=data.phone,
        shipping_address=data.address,
        shipping_area=data.area,
        shipping_city=data.city,
        shipping_zone=zone.value,
        shipping_postal=data.postal,
        # Guest / fraud
        is_guest=True,
        fraud_score=fraud_result["score"],
        fraud_flags=fraud_result["flags"],
        ip_address=client_ip,
        device_fingerprint={"hash": fp_hash, "raw": data.device_fingerprint} if data.device_fingerprint else None,
    )

    db.add(order)
    await db.flush()

    # Create order items
    for item_data in order_items_data:
        db.add(OrderItem(order_id=order.id, **item_data))

    await db.flush()

    # Process payment
    payment = await PaymentService.initiate_payment(
        order, payment_method, db,
        customer_name=data.name,
        customer_phone=data.phone,
    )

    # Extract gateway URL if SSLCommerz
    gateway_url = None
    if payment.gateway_response and isinstance(payment.gateway_response, dict):
        gateway_url = payment.gateway_response.get("gateway_url")

    # Reload order with relationships
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.payment),
        )
        .where(Order.id == order.id)
    )
    order = result.scalar_one()

    response = OrderResponse.model_validate(order)
    response.gateway_url = gateway_url
    return response
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/orders.py
git commit -m "feat: add guest order and IP check endpoints"
```

---

### Task 8: Fraud Config Admin Endpoints

**Files:**
- Modify: `backend/app/api/v1/admin.py`

- [ ] **Step 1: Add imports**

Add to the imports section of `backend/app/api/v1/admin.py`:

```python
from app.models.fraud import FraudConfig
from app.schemas.fraud import FraudConfigResponse, FraudConfigUpdateRequest
```

- [ ] **Step 2: Add fraud config GET/PATCH endpoints**

Add at the end of `backend/app/api/v1/admin.py` (after the CSV export endpoint):

```python
# ============================================
# FRAUD CONFIG
# ============================================

@router.get("/fraud-config", response_model=FraudConfigResponse)
async def get_fraud_config(
    user: User = Depends(PermissionChecker([Permission.ANALYTICS_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """Get current fraud scoring configuration. Superadmin only."""
    result = await db.execute(select(FraudConfig).where(FraudConfig.id == 1))
    config = result.scalar_one_or_none()
    if not config:
        config = FraudConfig(id=1)
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return FraudConfigResponse.model_validate(config)


@router.patch("/fraud-config", response_model=FraudConfigResponse)
async def update_fraud_config(
    data: FraudConfigUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.ANALYTICS_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """Update fraud scoring configuration. Superadmin only."""
    result = await db.execute(select(FraudConfig).where(FraudConfig.id == 1))
    config = result.scalar_one_or_none()
    if not config:
        config = FraudConfig(id=1)
        db.add(config)
        await db.flush()

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_by = user.id
    await db.commit()
    await db.refresh(config)

    # Invalidate fraud service config cache
    from app.services.fraud_service import _config_cache
    import app.services.fraud_service as fs
    fs._config_cache = None

    return FraudConfigResponse.model_validate(config)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/admin.py
git commit -m "feat: add fraud config admin endpoints"
```

---

### Task 9: Fraud Dashboard Endpoint

**Files:**
- Modify: `backend/app/api/v1/admin.py`

- [ ] **Step 1: Add dashboard schema imports**

Add to the imports in `backend/app/api/v1/admin.py`:

```python
from app.schemas.fraud import (
    FraudConfigResponse, FraudConfigUpdateRequest,
    FraudDashboardSummary, DailyOrderTrend, TopFlag, RepeatOffender,
)
```

(Merge this with the import added in Task 8.)

- [ ] **Step 2: Add fraud dashboard endpoint**

Add after the fraud config endpoints:

```python
# ============================================
# FRAUD DASHBOARD
# ============================================

@router.get("/fraud-dashboard")
async def get_fraud_dashboard(
    days: int = Query(7, ge=1, le=90),
    user: User = Depends(PermissionChecker([Permission.ANALYTICS_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """Get fraud analytics dashboard data."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Load fraud config for thresholds
    config_result = await db.execute(select(FraudConfig).where(FraudConfig.id == 1))
    config = config_result.scalar_one_or_none()
    medium_threshold = config.medium_risk_threshold if config else 30
    high_threshold = config.high_risk_threshold if config else 60

    # --- Summary ---
    total_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= cutoff)
    )).scalar() or 0

    guest_orders = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= cutoff, Order.is_guest == True
        )
    )).scalar() or 0

    low_risk = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= cutoff,
            Order.fraud_score.isnot(None),
            Order.fraud_score < medium_threshold,
        )
    )).scalar() or 0

    medium_risk = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= cutoff,
            Order.fraud_score.isnot(None),
            Order.fraud_score >= medium_threshold,
            Order.fraud_score < high_threshold,
        )
    )).scalar() or 0

    high_risk = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= cutoff,
            Order.fraud_score.isnot(None),
            Order.fraud_score >= high_threshold,
        )
    )).scalar() or 0

    cancelled = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= cutoff,
            Order.status == OrderStatus.CANCELLED.value,
        )
    )).scalar() or 0

    returned_shipments = (await db.execute(
        select(func.count(Shipment.id))
        .join(Order, Order.id == Shipment.order_id)
        .where(
            Order.created_at >= cutoff,
            Shipment.status == ShipmentStatus.RETURNED.value,
        )
    )).scalar() or 0

    summary = {
        "total_orders": total_orders,
        "guest_orders": guest_orders,
        "authenticated_orders": total_orders - guest_orders,
        "low_risk": low_risk,
        "medium_risk": medium_risk,
        "high_risk": high_risk,
        "cancelled_rate": round(cancelled / total_orders * 100, 1) if total_orders > 0 else 0,
        "returned_rate": round(returned_shipments / total_orders * 100, 1) if total_orders > 0 else 0,
    }

    # --- Daily trend ---
    daily_rows = (await db.execute(
        select(
            func.date(Order.created_at).label("date"),
            func.count(Order.id).label("total"),
            func.sum(case(
                (Order.fraud_score < medium_threshold, 1), else_=0
            )).label("low_risk"),
            func.sum(case(
                (Order.fraud_score.between(medium_threshold, high_threshold - 1), 1), else_=0
            )).label("medium_risk"),
            func.sum(case(
                (Order.fraud_score >= high_threshold, 1), else_=0
            )).label("high_risk"),
        )
        .where(Order.created_at >= cutoff, Order.fraud_score.isnot(None))
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )).all()

    daily_trend = [
        {
            "date": str(row.date),
            "total": row.total,
            "low_risk": int(row.low_risk or 0),
            "medium_risk": int(row.medium_risk or 0),
            "high_risk": int(row.high_risk or 0),
        }
        for row in daily_rows
    ]

    # --- Top flags ---
    # Extract flags from JSONB across all orders in period
    flagged_orders = (await db.execute(
        select(Order.fraud_flags).where(
            Order.created_at >= cutoff,
            Order.fraud_flags.isnot(None),
        )
    )).scalars().all()

    flag_counts: dict[str, int] = {}
    for flags_list in flagged_orders:
        if isinstance(flags_list, list):
            for flag in flags_list:
                # Normalize: strip details after colon for grouping
                base_flag = flag.split(":")[0] if ":" in flag else flag
                flag_counts[base_flag] = flag_counts.get(base_flag, 0) + 1

    top_flags = sorted(
        [{"flag": k, "count": v} for k, v in flag_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # --- Repeat offenders ---
    offender_rows = (await db.execute(
        select(
            Order.shipping_phone,
            func.count(Order.id).label("total_orders"),
            func.sum(case(
                (Order.status == OrderStatus.CANCELLED.value, 1), else_=0
            )).label("cancelled_count"),
            func.max(Order.created_at).label("last_order_date"),
        )
        .where(
            Order.shipping_phone.isnot(None),
            Order.created_at >= cutoff,
        )
        .group_by(Order.shipping_phone)
        .having(
            func.sum(case(
                (Order.status == OrderStatus.CANCELLED.value, 1), else_=0
            )) >= 3
        )
        .order_by(func.sum(case(
            (Order.status == OrderStatus.CANCELLED.value, 1), else_=0
        )).desc())
        .limit(20)
    )).all()

    repeat_offenders = [
        {
            "phone": row.shipping_phone,
            "total_orders": row.total_orders,
            "cancelled_count": int(row.cancelled_count or 0),
            "returned_count": 0,  # Would need a join with shipments; simplified for now
            "last_order_date": row.last_order_date,
        }
        for row in offender_rows
    ]

    return {
        "summary": summary,
        "daily_trend": daily_trend,
        "top_flags": top_flags,
        "repeat_offenders": repeat_offenders,
    }
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/admin.py
git commit -m "feat: add fraud dashboard analytics endpoint"
```

---

### Task 10: Rate Limiting for Guest Endpoints

**Files:**
- Modify: `backend/app/core/middleware.py:19-24`

- [ ] **Step 1: Add guest endpoint rate limits**

In `backend/app/core/middleware.py`, add entries to the `RATE_LIMITS` dict (after line 22):

```python
RATE_LIMITS = {
    "/api/v1/auth/login": (10, 60),
    "/api/v1/auth/register": (5, 60),
    "/api/v1/ebooks/": (5, 60),
    "/api/v1/orders/guest": (10, 3600),     # 10 per hour per IP
    "/api/v1/orders/ip-check": (30, 3600),  # 30 per hour per IP
    "default": (100, 60),
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/middleware.py
git commit -m "feat: add rate limits for guest order endpoints"
```

---

### Task 11: Frontend Device Fingerprint Utility

**Files:**
- Create: `frontend/src/lib/fingerprint.ts`

- [ ] **Step 1: Create the fingerprint utility**

Create `frontend/src/lib/fingerprint.ts`:

```typescript
/**
 * Lightweight device fingerprint — canvas + screen + timezone + UA.
 * No external library needed.
 */
export function generateFingerprint(): Record<string, string | number> {
  const components: Record<string, string | number> = {};

  // Screen
  components.screenWidth = window.screen.width;
  components.screenHeight = window.screen.height;
  components.colorDepth = window.screen.colorDepth;

  // Timezone
  components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  components.timezoneOffset = new Date().getTimezoneOffset();

  // User agent
  components.userAgent = navigator.userAgent;

  // Language
  components.language = navigator.language;

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = "#069";
      ctx.fillText("FP-LMS-2026", 2, 15);
      components.canvas = canvas.toDataURL().slice(-50); // last 50 chars
    }
  } catch {
    components.canvas = "unavailable";
  }

  return components;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/fingerprint.ts
git commit -m "feat: add client-side device fingerprint utility"
```

---

### Task 12: Frontend Guest Checkout Flow

**Files:**
- Modify: `frontend/src/app/checkout/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `frontend/src/app/checkout/page.tsx`, add after the existing imports (around line 18):

```typescript
import { generateFingerprint } from "@/lib/fingerprint";
```

- [ ] **Step 2: Add guest checkout state and IP prefetch**

Inside the `CheckoutContent` component, after the existing state declarations (after `const [showNotes, setShowNotes] = useState(false);` on line 51), add:

```typescript
  // Guest checkout state
  const [guestMode, setGuestMode] = useState(false);
  const [ipInfo, setIpInfo] = useState<any>(null);
  const [fingerprint, setFingerprint] = useState<any>(null);

  // Determine if guest checkout is available
  const canGuestCheckout = isCartCheckout && cartIsAllPhysical && !isAuthenticated;

  // Prefetch IP info and fingerprint for guest checkout
  useEffect(() => {
    if (!mounted || !_hasHydrated || !canGuestCheckout) return;
    setGuestMode(true);
    // IP check
    api.get("/orders/ip-check").then((res: any) => setIpInfo(res)).catch(() => {});
    // Fingerprint
    setFingerprint(generateFingerprint());
  }, [mounted, _hasHydrated, canGuestCheckout]);
```

- [ ] **Step 3: Modify the auth redirect logic**

Currently at line 131, `handleSubmit` checks `if (!isAuthenticated || !accessToken) { redirectToLogin(); return; }`. Replace the `handleSubmit` function with a version that handles both guest and authenticated flows:

Replace the entire `handleSubmit` function (lines 129-163) with:

```typescript
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Guest order flow
    if (guestMode && canGuestCheckout) {
      setSubmitting(true);
      try {
        const guestData: any = {
          phone: form.shipping_phone,
          name: form.shipping_name,
          address: form.shipping_address,
          area: form.shipping_area || undefined,
          city: form.shipping_city,
          zone: form.shipping_zone,
          postal: undefined,
          notes: form.notes || undefined,
          items: cartItems.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
          payment_method: paymentMethod,
          device_fingerprint: fingerprint || undefined,
          ip_info: ipInfo || undefined,
        };
        const result: any = await api.post("/orders/guest", guestData);
        if (result.gateway_url) { window.location.href = result.gateway_url; return; }
        cartStore.clearCart();
        setOrderResult(result);
        setSuccess(true);
      } catch (err: any) {
        const msg = err.message || "";
        let userMsg = msg;
        if (msg.includes("shipping_address") || msg.includes("address")) userMsg = t("সম্পূর্ণ ডেলিভারি ঠিকানা দিন", "Please enter a complete delivery address");
        else if (msg.includes("shipping_name") || msg.includes("name")) userMsg = t("প্রাপকের নাম দিন", "Please enter the recipient name");
        else if (msg.includes("shipping_phone") || msg.includes("phone")) userMsg = t("সঠিক মোবাইল নম্বর দিন", "Please enter a valid mobile number");
        else if (msg.includes("physical")) userMsg = t("গেস্ট চেকআউট শুধু ফিজিক্যাল আইটেমের জন্য", "Guest checkout is only for physical items");
        else if (msg.includes("exceed")) userMsg = t("অর্ডারের পরিমাণ সীমা অতিক্রম করেছে", "Order amount exceeds limit");
        else if (!msg || msg === "Request failed") userMsg = t("অর্ডার তৈরিতে সমস্যা হয়েছে", "Failed to place order");
        import("@/stores/toast-store").then((m) => m.toast.error(userMsg));
      } finally { setSubmitting(false); }
      return;
    }

    // Authenticated order flow (existing)
    if (!isAuthenticated || !accessToken) { redirectToLogin(); return; }
    setSubmitting(true);
    try {
      const orderData: any = { payment_method: paymentMethod, notes: form.notes || undefined, coupon_code: couponValid ? couponCode.toUpperCase() : undefined };
      if (isCartCheckout) {
        orderData.items = cartItems.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
        if (cartStore.totalPrice() === 0) orderData.payment_method = "free";
      } else {
        if (!productId) return;
        orderData.items = [{ product_id: productId, quantity: 1 }];
        if (product?.is_free) orderData.payment_method = "free";
      }
      if (isCartCheckout && cartHasPhysical) {
        orderData.shipping = { shipping_name: form.shipping_name, shipping_phone: form.shipping_phone, shipping_address: form.shipping_address, shipping_area: form.shipping_area, shipping_city: form.shipping_city, shipping_zone: form.shipping_zone, shipping_postal: "" };
      }
      const selectedIds = Array.from(selectedChildIds);
      if (selectedIds.length > 1) orderData.child_profile_ids = selectedIds;
      else if (selectedIds.length === 1) orderData.child_profile_id = selectedIds[0];

      const result: any = await api.post("/orders/", orderData, accessToken);
      if (result.gateway_url) { window.location.href = result.gateway_url; return; }
      if (isCartCheckout) cartStore.clearCart();
      setOrderResult(result); setSuccess(true);
    } catch (err: any) {
      const msg = err.message || "";
      let userMsg = msg;
      if (msg.includes("shipping_address")) userMsg = t("সম্পূর্ণ ডেলিভারি ঠিকানা দিন", "Please enter a complete delivery address");
      else if (msg.includes("shipping_name")) userMsg = t("প্রাপকের নাম দিন", "Please enter the recipient name");
      else if (msg.includes("shipping_phone")) userMsg = t("সঠিক মোবাইল নম্বর দিন", "Please enter a valid mobile number");
      else if (!msg || msg === "Request failed") userMsg = t("অর্ডার তৈরিতে সমস্যা হয়েছে", "Failed to place order");
      import("@/stores/toast-store").then((m) => m.toast.error(userMsg));
    } finally { setSubmitting(false); }
  };
```

- [ ] **Step 4: Replace the login prompt with guest checkout awareness**

Replace the login prompt block (lines 291-306) that currently shows for all unauthenticated users. Change it to show a different message when guest checkout is available:

```tsx
        {/* Login prompt or Guest checkout notice */}
        {!isAuthenticated && !guestMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0 text-2xl">👋</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-violet-800 font-bn">{t("আপনার অ্যাকাউন্টে লগইন করুন", "Please log in to your account")}</p>
              <p className="text-xs text-violet-500 font-bn mt-0.5">{t("অর্ডার করতে ও ট্র্যাক করতে লগইন প্রয়োজন", "Login is required to place and track orders")}</p>
            </div>
            <button onClick={redirectToLogin} className="px-5 py-2.5 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-all font-bn shadow-sm">
              {t("লগইন", "Login")}
            </button>
          </motion.div>
        )}

        {guestMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 text-2xl">🛒</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800 font-bn">{t("দ্রুত অর্ডার", "Quick Order")}</p>
              <p className="text-xs text-emerald-500 font-bn mt-0.5">{t("লগইন ছাড়াই অর্ডার করুন — শুধু নাম, ফোন ও ঠিকানা দিন", "Order without login — just name, phone & address")}</p>
            </div>
            <button onClick={redirectToLogin} className="px-4 py-2 bg-white text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-all font-bn">
              {t("লগইন", "Login")}
            </button>
          </motion.div>
        )}
```

- [ ] **Step 5: Show shipping form for guest mode**

The existing shipping form (lines 362+) only shows for `isCartCheckout && cartHasPhysical`. For guest mode, the form should show always (since guest = always physical). Change the condition wrapping the shipping address section from:

```tsx
{isCartCheckout && cartHasPhysical && (
```

to:

```tsx
{((isCartCheckout && cartHasPhysical) || guestMode) && (
```

- [ ] **Step 6: Hide coupon section for guest mode**

Find the coupon input section and wrap it with a condition to hide it in guest mode. The coupon section has `applyCoupon` function. Wrap the coupon UI block with:

```tsx
{!guestMode && (
  // ... existing coupon section ...
)}
```

- [ ] **Step 7: Hide child selection for guest mode**

The child selection section (lines 313-358) is already gated by `isAuthenticated && children.length > 0`, so it will automatically hide for guests. No change needed.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/checkout/page.tsx frontend/src/lib/fingerprint.ts
git commit -m "feat: add guest checkout flow on frontend"
```

---

### Task 13: Admin Order List — Risk Badges & Guest Tags

**Files:**
- Modify: `frontend/src/app/admin/page.tsx` (the orders tab section)

- [ ] **Step 1: Create a FraudBadge component**

Add this helper component inside or above the admin page component (or in a shared location — follow existing patterns):

```tsx
function FraudBadge({ score, isGuest }: { score?: number | null; isGuest?: boolean }) {
  if (score == null) return isGuest ? <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500">Guest</span> : null;

  // Default thresholds (ideally load from API, but for display use static defaults)
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const colors = {
    low: "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
  };

  return (
    <div className="flex items-center gap-1.5">
      {isGuest && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500">Guest</span>}
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${colors[level]}`}>
        {level === "high" ? "High Risk" : level === "medium" ? "Medium" : "Low"} ({score})
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add FraudBadge to order rows in the admin orders table**

In the orders table row where customer name / order info is displayed, add the `FraudBadge` component:

```tsx
<FraudBadge score={order.fraud_score} isGuest={order.is_guest} />
```

Place this near the customer name in each order row.

- [ ] **Step 3: Add risk level filter**

Add a filter dropdown or tab buttons for risk level alongside existing status filters:

```tsx
<select
  value={riskFilter}
  onChange={(e) => setRiskFilter(e.target.value)}
  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
>
  <option value="">All Risk Levels</option>
  <option value="low">Low Risk</option>
  <option value="medium">Medium Risk</option>
  <option value="high">High Risk</option>
  <option value="guest">Guest Orders Only</option>
</select>
```

Add the `riskFilter` state and apply it when fetching/filtering orders.

- [ ] **Step 4: Add fraud detail section in order detail view**

When viewing an order's details (order detail modal or expanded view), add a fraud info section:

```tsx
{order.fraud_score != null && (
  <div className="bg-gray-50 rounded-xl p-4 mt-4">
    <h4 className="text-xs font-bold text-gray-700 mb-2">Fraud Analysis</h4>
    <div className="flex items-center gap-3 mb-2">
      <span className="text-sm font-bold">{order.fraud_score}/100</span>
      <FraudBadge score={order.fraud_score} isGuest={order.is_guest} />
    </div>
    {order.fraud_flags?.length > 0 && (
      <div className="space-y-1">
        {order.fraud_flags.map((flag: string, i: number) => (
          <div key={i} className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {flag}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat: add fraud badges and risk filters to admin orders"
```

---

### Task 14: Admin Fraud Config Page

**Files:**
- Modify: `frontend/src/components/admin/AdminLayout.tsx:36-41`
- Create or modify the admin page to add a fraud-config tab

- [ ] **Step 1: Add sidebar items**

In `frontend/src/components/admin/AdminLayout.tsx`, add to the Commerce group (line 41, after coupons):

```typescript
{ id: "fraud-config", bn: "ফ্রড সেটিংস", en: "Fraud Config", icon: Shield },
{ id: "fraud-dashboard", bn: "ফ্রড ড্যাশবোর্ড", en: "Fraud Dashboard", icon: BarChart3 },
```

Add `Shield` and `BarChart3` to the lucide-react imports at line 7:

```typescript
import {
  LayoutDashboard, Users, BookOpen, ShoppingBag, Truck,
  Settings, ChevronRight, Loader2, Tag, GraduationCap, LogOut, Loader, Home,
  Shield, BarChart3
} from "lucide-react";
```

- [ ] **Step 2: Build fraud config tab content**

In the admin page component, add the fraud-config tab rendering. This should be a form that loads `GET /admin/fraud-config` and saves via `PATCH /admin/fraud-config`:

```tsx
{activeTab === "fraud-config" && (
  <FraudConfigTab accessToken={accessToken} />
)}
```

Create a `FraudConfigTab` component (can be inline or in a separate file — follow existing pattern in the admin page):

```tsx
function FraudConfigTab({ accessToken }: { accessToken: string }) {
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useLocaleStore();

  useEffect(() => {
    api.get("/admin/fraud-config", accessToken).then(setConfig).catch(() => {});
  }, [accessToken]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.patch("/admin/fraud-config", config, accessToken);
      setConfig(updated);
      toast.success(t("সেভ হয়েছে", "Saved successfully"));
    } catch {
      toast.error(t("সেভ করতে সমস্যা হয়েছে", "Failed to save"));
    }
    setSaving(false);
  };

  if (!config) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-12" />;

  const groups = [
    {
      title: t("রেট লিমিট", "Rate Limits"),
      fields: [
        { key: "phone_rate_window_hours", label: t("ফোন — সময় উইন্ডো (ঘন্টা)", "Phone — Time Window (hours)") },
        { key: "phone_rate_max_orders", label: t("ফোন — সর্বোচ্চ অর্ডার", "Phone — Max Orders") },
        { key: "phone_rate_score", label: t("ফোন — স্কোর", "Phone — Score") },
        { key: "ip_rate_window_hours", label: t("IP — সময় উইন্ডো (ঘন্টা)", "IP — Time Window (hours)") },
        { key: "ip_rate_max_orders", label: t("IP — সর্বোচ্চ অর্ডার", "IP — Max Orders") },
        { key: "ip_rate_score", label: t("IP — স্কোর", "IP — Score") },
        { key: "fingerprint_rate_window_hours", label: t("ডিভাইস — সময় উইন্ডো (ঘন্টা)", "Device — Time Window (hours)") },
        { key: "fingerprint_rate_max_orders", label: t("ডিভাইস — সর্বোচ্চ অর্ডার", "Device — Max Orders") },
        { key: "fingerprint_rate_score", label: t("ডিভাইস — স্কোর", "Device — Score") },
      ],
    },
    {
      title: t("ঠিকানা ও পরিমাণ", "Address & Quantity"),
      fields: [
        { key: "min_address_length", label: t("ন্যূনতম ঠিকানা দৈর্ঘ্য", "Min Address Length") },
        { key: "address_quality_score", label: t("ঠিকানা স্কোর", "Address Quality Score") },
        { key: "max_single_item_qty", label: t("একক আইটেম সর্বোচ্চ", "Max Single Item Qty") },
        { key: "max_total_items", label: t("মোট আইটেম সর্বোচ্চ", "Max Total Items") },
        { key: "quantity_spike_score", label: t("পরিমাণ স্কোর", "Quantity Spike Score") },
      ],
    },
    {
      title: t("স্কোর পয়েন্ট", "Score Points"),
      fields: [
        { key: "phone_format_score", label: t("ভুল ফোন ফরম্যাট", "Invalid Phone Format") },
        { key: "vpn_proxy_score", label: t("VPN/প্রক্সি", "VPN/Proxy") },
        { key: "blacklist_score", label: t("ব্ল্যাকলিস্ট", "Blacklist") },
        { key: "prepaid_discount_score", label: t("প্রিপেইড ডিসকাউন্ট", "Prepaid Discount") },
      ],
    },
    {
      title: t("রিস্ক থ্রেশহোল্ড", "Risk Thresholds"),
      fields: [
        { key: "medium_risk_threshold", label: t("মিডিয়াম রিস্ক", "Medium Risk Threshold") },
        { key: "high_risk_threshold", label: t("হাই রিস্ক", "High Risk Threshold") },
        { key: "max_cart_value", label: t("গেস্ট সর্বোচ্চ কার্ট (BDT)", "Guest Max Cart Value (BDT)") },
      ],
    },
  ];

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-lg font-bold mb-6 font-bn">{t("ফ্রড কনফিগারেশন", "Fraud Configuration")}</h2>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.title} className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4 font-bn">{group.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{field.label}</label>
                  <input
                    type="number"
                    value={config[field.key] ?? ""}
                    onChange={(e) => setConfig({ ...config, [field.key]: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-[10px] text-gray-400 font-bn">
          {config.updated_at && `Last updated: ${new Date(config.updated_at).toLocaleString()}`}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all"
        >
          {saving ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ করুন", "Save")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/AdminLayout.tsx frontend/src/app/admin/page.tsx
git commit -m "feat: add fraud config admin page"
```

---

### Task 15: Admin Fraud Dashboard Page

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Build the fraud dashboard tab**

Add the tab rendering:

```tsx
{activeTab === "fraud-dashboard" && (
  <FraudDashboardTab accessToken={accessToken} />
)}
```

Create the `FraudDashboardTab` component:

```tsx
function FraudDashboardTab({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(7);
  const { t } = useLocaleStore();

  useEffect(() => {
    api.get(`/admin/fraud-dashboard?days=${days}`, accessToken).then(setData).catch(() => {});
  }, [accessToken, days]);

  if (!data) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-12" />;

  const { summary, daily_trend, top_flags, repeat_offenders } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-bn">{t("ফ্রড ড্যাশবোর্ড", "Fraud Dashboard")}</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
        >
          <option value={1}>{t("আজ", "Today")}</option>
          <option value={7}>{t("৭ দিন", "Last 7 days")}</option>
          <option value={30}>{t("৩০ দিন", "Last 30 days")}</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("মোট অর্ডার", "Total Orders"), value: summary.total_orders, color: "text-gray-900" },
          { label: t("গেস্ট অর্ডার", "Guest Orders"), value: summary.guest_orders, color: "text-blue-600" },
          { label: t("হাই রিস্ক", "High Risk"), value: summary.high_risk, color: "text-red-600" },
          { label: t("ক্যান্সেল রেট", "Cancel Rate"), value: `${summary.cancelled_rate}%`, color: "text-amber-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 font-bn">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Risk Distribution */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-4 font-bn">{t("রিস্ক ডিস্ট্রিবিউশন", "Risk Distribution")}</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden flex">
            {summary.total_orders > 0 && (
              <>
                <div className="bg-green-400 h-full" style={{ width: `${(summary.low_risk / (summary.low_risk + summary.medium_risk + summary.high_risk || 1)) * 100}%` }} />
                <div className="bg-amber-400 h-full" style={{ width: `${(summary.medium_risk / (summary.low_risk + summary.medium_risk + summary.high_risk || 1)) * 100}%` }} />
                <div className="bg-red-400 h-full" style={{ width: `${(summary.high_risk / (summary.low_risk + summary.medium_risk + summary.high_risk || 1)) * 100}%` }} />
              </>
            )}
          </div>
          <div className="flex gap-3 text-[10px] shrink-0">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Low: {summary.low_risk}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Med: {summary.medium_risk}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> High: {summary.high_risk}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Triggered Flags */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4 font-bn">{t("বেশি ট্রিগার হওয়া ফ্ল্যাগ", "Top Triggered Flags")}</h3>
          {top_flags.length === 0 ? (
            <p className="text-xs text-gray-400">{t("কোনো ডেটা নেই", "No data")}</p>
          ) : (
            <div className="space-y-2">
              {top_flags.map((f: any) => (
                <div key={f.flag} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 font-mono">{f.flag}</span>
                  <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Repeat Offenders */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4 font-bn">{t("বারবার অফেন্ডার", "Repeat Offenders")}</h3>
          {repeat_offenders.length === 0 ? (
            <p className="text-xs text-gray-400">{t("কোনো অফেন্ডার নেই", "No offenders found")}</p>
          ) : (
            <div className="space-y-2">
              {repeat_offenders.map((o: any) => (
                <div key={o.phone} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                  <div>
                    <span className="text-xs font-mono font-bold text-gray-800">{o.phone}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{o.total_orders} orders</span>
                  </div>
                  <span className="text-xs font-bold text-red-600">{o.cancelled_count} cancelled</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat: add fraud analytics dashboard to admin"
```

---

### Task 16: Handle Guest Orders in Payment Callbacks

**Files:**
- Modify: `backend/app/api/v1/payments.py` (SSLCommerz callback)
- Modify: `backend/app/services/payment_service.py:131-203`

- [ ] **Step 1: Check payment callbacks handle null user_id**

In `backend/app/services/payment_service.py`, the `complete_payment` method (line 131-203) loads the Order and calls `EntitlementService.grant_entitlements_for_order`. For guest physical-only orders, entitlements will create `PHYSICAL_SHIPMENT` entries which only create Shipment records — no user-dependent entitlements. Verify the entitlement service handles `order.user_id = None`.

Check `backend/app/services/entitlement_service.py` — if `user_id` is required for entitlement creation, add a guard:

In the entitlement service's `_grant_for_product` or `grant_entitlements_for_order`, add at the top:

```python
# Skip entitlement creation for guest orders without user_id
# (Shipments are created directly, not via entitlements for guests)
if not order.user_id:
    # For guest orders, just create the shipment directly
    if has_physical:
        # Shipment already created during order placement
        pass
    return
```

Or more precisely — ensure that the physical shipment entitlement code doesn't crash when `user_id` is None. If it does, add a null check.

- [ ] **Step 2: Update admin order detail endpoint**

In `backend/app/api/v1/admin.py`, the `get_order_detail` endpoint (line 258-323) queries the customer by `order.user_id`. Add null handling for guest orders:

```python
# Get customer info (may be null for guest orders)
customer = None
if order.user_id:
    customer_result = await db.execute(
        select(User).where(User.id == order.user_id)
    )
    customer = customer_result.scalar_one_or_none()
```

Also add fraud info to the response:

```python
"fraud": {
    "score": order.fraud_score,
    "flags": order.fraud_flags,
    "risk_level": "high" if (order.fraud_score or 0) >= 60 else "medium" if (order.fraud_score or 0) >= 30 else "low",
    "is_guest": order.is_guest,
    "ip_address": order.ip_address,
} if order.fraud_score is not None else None,
```

- [ ] **Step 3: Update CSV export for guest orders**

In `backend/app/api/v1/admin.py`, the `export_orders_csv` endpoint (line 330-390) queries users by `user_ids`. Filter out None values:

```python
user_ids = [o.user_id for o in orders if o.user_id]
```

And handle None customer in the CSV row:

```python
customer = users_map.get(o.user_id) if o.user_id else None
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/payment_service.py backend/app/services/entitlement_service.py backend/app/api/v1/admin.py
git commit -m "feat: handle guest orders in payment callbacks and admin views"
```

---

### Task 17: Verification & Testing

- [ ] **Step 1: Start backend and verify migration**

```bash
cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend
alembic upgrade head
```

Verify the `fraud_config` table exists with default row, and `orders` table has new columns.

- [ ] **Step 2: Test IP check endpoint**

```bash
curl http://localhost:8000/api/v1/orders/ip-check
```

Expected: `{"is_vpn": false, "country": "...", "ip": "127.0.0.1"}`

- [ ] **Step 3: Test guest order endpoint**

```bash
curl -X POST http://localhost:8000/api/v1/orders/guest \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "01712345678",
    "name": "Test Customer",
    "address": "House 10, Road 5, Dhanmondi, Dhaka",
    "area": "Dhanmondi",
    "city": "Dhaka",
    "zone": "inside_dhaka",
    "items": [{"product_id": "<a-physical-product-uuid>", "quantity": 1}],
    "payment_method": "cod"
  }'
```

Expected: `201` with order response including `fraud_score`, `fraud_flags`, `is_guest: true`

- [ ] **Step 4: Test fraud config endpoints**

```bash
# Get config (needs admin auth token)
curl http://localhost:8000/api/v1/admin/fraud-config -H "Authorization: Bearer <token>"

# Update config
curl -X PATCH http://localhost:8000/api/v1/admin/fraud-config \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"max_cart_value": 10000}'
```

- [ ] **Step 5: Test fraud dashboard**

```bash
curl "http://localhost:8000/api/v1/admin/fraud-dashboard?days=7" -H "Authorization: Bearer <token>"
```

- [ ] **Step 6: Test frontend guest checkout**

1. Open browser, go to `/shop`
2. Add a physical book to cart (don't log in)
3. Go to `/checkout?source=cart`
4. Verify: guest checkout form shows (name, phone, address, payment method)
5. Verify: no login redirect, no coupon field, no child selection
6. Fill form and submit
7. Verify: order created successfully, success page shown

- [ ] **Step 7: Test admin panel**

1. Log in as admin
2. Check orders list — verify risk badges and guest tags appear
3. Check Fraud Config page — verify all fields load and save
4. Check Fraud Dashboard — verify summary cards, risk distribution, flags, offenders

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: guest checkout with fraud prevention - complete"
```
