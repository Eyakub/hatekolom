import logging
from datetime import datetime, timezone
from uuid import uuid4, UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import (
    User, Order, OrderItem, OrderStatus, Product, ProductType,
    Payment, PaymentMethod, PaymentStatus,
    ShippingRate, ShippingZone, ChildProfile,
)
from app.schemas import (
    OrderCreateRequest, OrderResponse, EntitlementResponse,
)
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from app.services.payment_service import PaymentService
from app.services.entitlement_service import EntitlementService
from app.models import Entitlement, EntitlementType
from app.schemas.fraud import GuestOrderRequest, IpCheckResponse
from app.services.fraud_service import FraudService
from app.utils.ip_check import check_ip, get_client_ip
from app.models.fraud import FraudConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["Orders"])


def _generate_order_number() -> str:
    now = datetime.now(timezone.utc)
    return f"ORD-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"


@router.get("/ip-check", response_model=IpCheckResponse)
async def ip_check(request: Request):
    """Prefetch IP info for guest checkout. No auth required."""
    client_ip = get_client_ip(request)
    result = await check_ip(client_ip)
    return IpCheckResponse(**result)


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
    max_cart_value = (config.max_cart_value if config and config.max_cart_value is not None else 5000)

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

    # Hard rate limits — only for COD (prepaid = already proven intent)
    real_ip = ip_info.get("ip") if ip_info else client_ip
    if data.payment_method.lower() == "cod":
        block_reason = await FraudService.check_hard_limits(
            phone=data.phone,
            ip=real_ip,
            fingerprint=data.device_fingerprint,
            db=db,
        )
        if block_reason:
            raise HTTPException(status_code=429, detail=block_reason)

    # Fraud scoring (for orders that pass hard limits)
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
        shipping_name=data.name,
        shipping_phone=data.phone,
        shipping_address=data.address,
        shipping_area=data.area,
        shipping_city=data.city,
        shipping_zone=zone.value,
        shipping_postal=data.postal,
        is_guest=True,
        fraud_score=fraud_result["score"],
        fraud_flags=fraud_result["flags"],
        ip_address=real_ip,
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


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an order — the main purchase endpoint.

    Flow:
    1. Validate products exist and are active
    2. Validate child profile belongs to parent (if provided)
    3. Calculate totals (including shipping if physical items)
    4. Create order + order items
    5. Process payment (mock for Phase 1)
    6. If payment succeeds → entitlements auto-granted
    """
    # Block admin users from placing orders
    user_role_names = {r.name.value if hasattr(r.name, "value") else r.name for r in (user.roles or [])}
    if user_role_names.intersection({"super_admin", "admin"}):
        raise HTTPException(
            status_code=403,
            detail="Admin accounts cannot place orders. Use a regular user account."
        )
    # Resolve child IDs: support both single and multi-child
    all_child_ids = []
    if data.child_profile_ids and len(data.child_profile_ids) > 0:
        # Multi-child ("all children")
        for cid in data.child_profile_ids:
            child_result = await db.execute(
                select(ChildProfile).where(
                    ChildProfile.id == cid,
                    ChildProfile.parent_id == user.id,
                )
            )
            if not child_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail=f"Child profile {cid} not found or not yours")
            all_child_ids.append(cid)
        primary_child_id = all_child_ids[0]  # First child as primary on the order
    elif data.child_profile_id:
        child_result = await db.execute(
            select(ChildProfile).where(
                ChildProfile.id == data.child_profile_id,
                ChildProfile.parent_id == user.id,
            )
        )
        if not child_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Child profile not found or not yours")
        primary_child_id = data.child_profile_id
        all_child_ids = [data.child_profile_id]
    else:
        primary_child_id = None
        all_child_ids = []

    # Load products
    subtotal = Decimal("0")
    order_items_data = []
    has_physical = False

    for item in data.items:
        result = await db.execute(
            select(Product).where(Product.id == item.product_id, Product.is_active == True)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        if product.product_type == ProductType.PHYSICAL_BOOK:
            has_physical = True

        unit_price = Decimal("0") if product.is_free else product.price
        total_price = unit_price * item.quantity
        subtotal += total_price

        order_items_data.append({
            "product_id": product.id,
            "quantity": item.quantity,
            "unit_price": unit_price,
            "total_price": total_price,
        })

    # Shipping fee
    shipping_fee = Decimal("0")
    if has_physical:
        if not data.shipping:
            raise HTTPException(
                status_code=400,
                detail="Shipping address required for physical items"
            )

        zone = ShippingZone(data.shipping.shipping_zone)
        rate_result = await db.execute(
            select(ShippingRate).where(ShippingRate.zone == zone)
        )
        rate = rate_result.scalar_one_or_none()
        shipping_fee = Decimal(str(rate.rate)) if rate else Decimal("60")

    total = subtotal - Decimal("0") + shipping_fee  # discount placeholder

    # Determine payment method
    if total == 0:
        payment_method = PaymentMethod.FREE
    else:
        try:
            payment_method = PaymentMethod(data.payment_method.lower())
        except (ValueError, AttributeError):
            payment_method = PaymentMethod.MOCK_SUCCESS

    # Create order
    order = Order(
        user_id=user.id,
        child_profile_id=primary_child_id,
        order_number=_generate_order_number(),
        status=OrderStatus.PENDING.value,
        subtotal=subtotal,
        discount=Decimal("0"),
        shipping_fee=shipping_fee,
        total=total,
        notes=data.notes,
        coupon_code=data.coupon_code,
    )

    # Shipping address
    if data.shipping:
        order.shipping_name = data.shipping.shipping_name
        order.shipping_phone = data.shipping.shipping_phone
        order.shipping_address = data.shipping.shipping_address
        order.shipping_area = data.shipping.shipping_area
        order.shipping_city = data.shipping.shipping_city
        order.shipping_zone = ShippingZone(data.shipping.shipping_zone)
        order.shipping_postal = data.shipping.shipping_postal

    db.add(order)
    await db.flush()

    # Create order items
    for item_data in order_items_data:
        db.add(OrderItem(order_id=order.id, **item_data))

    await db.flush()

    # Process payment
    payment = await PaymentService.initiate_payment(
        order, payment_method, db,
        customer_name=user.full_name or "Customer",
        customer_phone=user.phone or "01700000000",
        customer_email=user.email,
        extra_child_ids=all_child_ids if len(all_child_ids) > 1 else None,
    )

    # Extract gateway URL if SSLCommerz
    gateway_url = None
    if payment.gateway_response and isinstance(payment.gateway_response, dict):
        gateway_url = payment.gateway_response.get("gateway_url")

    # Reload order with all relationships
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


@router.get("/my", response_model=list[OrderResponse])
async def list_my_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's orders."""
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payment),
            selectinload(Order.shipment),
        )
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    orders = result.scalars().all()

    responses = []
    for o in orders:
        order_dict = OrderResponse.model_validate(o).model_dump()
        # Enrich items with product details
        enriched_items = []
        for item in o.items:
            item_dict = {
                "id": item.id,
                "product_id": item.product_id,
                "product_title": (item.product.title_bn or item.product.title) if item.product else None,
                "product_type": item.product.product_type if item.product else None,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
            }
            enriched_items.append(item_dict)
        order_dict["items"] = enriched_items

        # Include shipment tracking data
        if o.shipment:
            order_dict["shipment"] = {
                "id": o.shipment.id,
                "status": o.shipment.status,
                "courier_name": o.shipment.courier_name,
                "tracking_number": o.shipment.tracking_number,
                "estimated_delivery": o.shipment.estimated_delivery,
                "actual_delivery": o.shipment.actual_delivery,
            }

        responses.append(order_dict)
    return responses


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get order by ID (own orders or admin)."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment), selectinload(Order.user))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check ownership (unless admin)
    user_roles = {r.name.value if hasattr(r.name, "value") else r.name for r in user.roles}
    if order.user_id != user.id and not user_roles.intersection({"super_admin", "admin"}):
        raise HTTPException(status_code=403, detail="Not your order")

    return OrderResponse.model_validate(order)


@router.get("/", response_model=list[OrderResponse])
async def list_all_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    days: int = Query(None, description="Filter orders from last N days (1=today, 7, 30, etc.)"),
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """List all orders (admin only)."""
    query = (
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product), 
            selectinload(Order.payment), 
            selectinload(Order.user),
            selectinload(Order.shipment)
        )
        .order_by(Order.created_at.desc())
    )

    if status_filter:
        query = query.where(Order.status == OrderStatus(status_filter))

    if days:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(Order.created_at >= cutoff)

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    orders = result.scalars().all()
    
    responses = []
    for o in orders:
        order_dict = OrderResponse.model_validate(o).model_dump()
        enriched_items = []
        for item in o.items:
            item_dict = {
                "id": item.id,
                "product_id": item.product_id,
                "product_title": (item.product.title_bn or item.product.title) if item.product else None,
                "product_type": item.product.product_type if item.product else None,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
            }
            enriched_items.append(item_dict)
        order_dict["items"] = enriched_items

        if o.shipment:
            order_dict["shipment"] = {
                "id": o.shipment.id,
                "status": o.shipment.status,
                "courier_name": o.shipment.courier_name,
                "tracking_number": o.shipment.tracking_number,
                "estimated_delivery": o.shipment.estimated_delivery,
                "actual_delivery": o.shipment.actual_delivery,
            }

        responses.append(order_dict)

    return responses


# ============================================
# ENTITLEMENTS
# ============================================

@router.get("/my/entitlements", response_model=list[EntitlementResponse])
async def list_my_entitlements(
    entitlement_type: str = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's entitlements (e.g., purchased ebooks for dashboard)."""
    ent_type = EntitlementType(entitlement_type) if entitlement_type else None
    entitlements = await EntitlementService.get_user_entitlements(user.id, db, ent_type)

    # Enrich with product info
    results = []
    for e in entitlements:
        product_result = await db.execute(
            select(Product).where(Product.id == e.product_id)
        )
        product = product_result.scalar_one_or_none()
        data = {
            "id": e.id,
            "user_id": e.user_id,
            "child_profile_id": e.child_profile_id,
            "product_id": e.product_id,
            "product_title": product.title_bn or product.title if product else None,
            "product_type": product.product_type if product else None,
            "product_slug": product.slug if product else None,
            "entitlement_type": e.entitlement_type,
            "is_active": e.is_active,
            "granted_at": e.granted_at,
            "expires_at": e.expires_at,
        }
        results.append(EntitlementResponse(**data))

    return results
