"""
Admin API — Dashboard stats, order management, and course admin.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, String
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional

from app.db import get_db
from app.models import (
    User, Order, OrderStatus, OrderItem, Payment, PaymentStatus,
    Course, Product, Enrollment, Shipment, ShipmentStatus,
)
from app.api.deps import PermissionChecker
from app.core.permissions import Permission
from app.models.fraud import FraudConfig
from app.schemas.fraud import (
    FraudConfigResponse, FraudConfigUpdateRequest,
    FraudDashboardSummary, DailyOrderTrend, TopFlag, RepeatOffender,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============================================
# DASHBOARD STATS
# ============================================

class DashboardStats(BaseModel):
    total_users: int = 0
    total_courses: int = 0
    total_orders: int = 0
    total_revenue: str = "0"
    pending_orders: int = 0
    confirmed_orders: int = 0
    pending_shipments: int = 0
    active_enrollments: int = 0
    new_users_today: int = 0
    orders_today: int = 0
    revenue_today: str = "0"


class RevenuePoint(BaseModel):
    date: str
    amount: str


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    user: User = Depends(PermissionChecker([Permission.ANALYTICS_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """Get admin dashboard statistics."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total users
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0

    # Total courses
    total_courses = (await db.execute(select(func.count(Course.id)))).scalar() or 0

    # Orders
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0

    # Revenue (successful payments only)
    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == PaymentStatus.SUCCESS)
    )).scalar() or Decimal("0")

    # Pending orders
    pending_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.PENDING)
    )).scalar() or 0

    # Confirmed orders
    confirmed_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.CONFIRMED)
    )).scalar() or 0

    # Pending shipments
    pending_shipments = (await db.execute(
        select(func.count(Shipment.id)).where(Shipment.status == ShipmentStatus.PENDING)
    )).scalar() or 0

    # Active enrollments
    active_enrollments = (await db.execute(
        select(func.count(Enrollment.id))
    )).scalar() or 0

    # Today's stats
    new_users_today = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )).scalar() or 0

    orders_today = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= today_start)
    )).scalar() or 0

    revenue_today = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == PaymentStatus.SUCCESS)
        .where(Payment.created_at >= today_start)
    )).scalar() or Decimal("0")

    return DashboardStats(
        total_users=total_users,
        total_courses=total_courses,
        total_orders=total_orders,
        total_revenue=str(total_revenue),
        pending_orders=pending_orders,
        confirmed_orders=confirmed_orders,
        pending_shipments=pending_shipments,
        active_enrollments=active_enrollments,
        new_users_today=new_users_today,
        orders_today=orders_today,
        revenue_today=str(revenue_today),
    )


@router.get("/revenue-chart")
async def get_revenue_chart(
    days: int = Query(30, ge=7, le=90),
    user: User = Depends(PermissionChecker([Permission.ANALYTICS_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """Get daily revenue for chart (last N days)."""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(Payment.created_at).label("date"),
            func.coalesce(func.sum(Payment.amount), 0).label("amount"),
        )
        .where(
            Payment.status == PaymentStatus.SUCCESS,
            Payment.created_at >= start_date,
        )
        .group_by(func.date(Payment.created_at))
        .order_by(func.date(Payment.created_at))
    )
    rows = result.all()

    return [
        {"date": str(row.date), "amount": str(row.amount)}
        for row in rows
    ]


@router.get("/orders/counts")
async def get_order_counts(
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Get order counts grouped by status for filter tabs."""
    result = await db.execute(
        select(Order.status, func.count(Order.id))
        .group_by(Order.status)
    )
    rows = result.all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    return {"total": total, **counts}


@router.get("/orders/ops-stats")
async def get_orders_ops_stats(
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Operational stats for the Orders admin panel — today's activity, pending queue, AOV, fulfillment rate."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_30 = now - timedelta(days=30)

    # Today
    orders_today = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= today_start)
    )).scalar() or 0
    revenue_today = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == PaymentStatus.SUCCESS)
        .where(Payment.created_at >= today_start)
    )).scalar() or Decimal("0")

    # Operational queues
    pending_count = (await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.PENDING)
    )).scalar() or 0

    # Unpaid COD: pending/confirmed/processing COD orders without successful payment
    unpaid_cod = (await db.execute(
        select(func.count(Order.id))
        .join(Payment, Payment.order_id == Order.id)
        .where(
            Payment.method == "cod",
            Payment.status != PaymentStatus.SUCCESS,
            Order.status.in_([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING]),
        )
    )).scalar() or 0

    # High-risk orders (last 30 days)
    high_risk_count = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= last_30,
            Order.fraud_score.isnot(None),
            Order.fraud_score >= 60,
        )
    )).scalar() or 0

    # Average order value (last 30 days, all orders)
    aov_row = (await db.execute(
        select(func.coalesce(func.avg(Order.total), 0))
        .where(Order.created_at >= last_30)
    )).scalar()
    avg_order_value = float(aov_row or 0)

    # Fulfillment rate (last 30 days): fulfilled / (fulfilled + cancelled + refunded)
    finished_rows = (await db.execute(
        select(Order.status, func.count(Order.id))
        .where(
            Order.created_at >= last_30,
            Order.status.in_([
                OrderStatus.FULFILLED, OrderStatus.CANCELLED, OrderStatus.REFUNDED,
            ]),
        )
        .group_by(Order.status)
    )).all()
    finished_map = {row[0]: row[1] for row in finished_rows}
    fulfilled = finished_map.get("fulfilled", 0)
    cancelled = finished_map.get("cancelled", 0)
    refunded = finished_map.get("refunded", 0)
    finished_total = fulfilled + cancelled + refunded
    fulfillment_rate = round((fulfilled / finished_total * 100), 1) if finished_total > 0 else 0.0

    return {
        "orders_today": orders_today,
        "revenue_today": str(revenue_today),
        "pending_count": pending_count,
        "unpaid_cod_count": unpaid_cod,
        "high_risk_count": high_risk_count,
        "avg_order_value": avg_order_value,
        "fulfillment_rate": fulfillment_rate,
        "cancelled_30d": cancelled,
        "fulfilled_30d": fulfilled,
    }


# ============================================
# ORDER MANAGEMENT
# ============================================

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(confirmed|processing|fulfilled|cancelled|refunded)$")
    admin_notes: Optional[str] = None


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Update order status."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    new_status = data.status

    # Validate transition (use lowercase .value strings)
    valid_transitions: dict[str, list[str]] = {
        "pending": ["confirmed", "cancelled"],
        "confirmed": ["processing", "fulfilled", "cancelled"],
        "processing": ["fulfilled", "cancelled"],
        "fulfilled": ["refunded"],
    }

    allowed = valid_transitions.get(old_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {old_status} to {new_status}",
        )

    order.status = new_status
    if data.admin_notes:
        order.notes = (order.notes or "") + f"\n[Admin] {data.admin_notes}"

    # If confirming and has items, grant entitlements
    if new_status == "confirmed" and old_status == "pending":
        from app.services.entitlement_service import EntitlementService
        await EntitlementService.grant_entitlements_for_order(order, db)

    # If refunding, update payment
    if new_status == "refunded" and order.payment:
        pass  # Phase 2: SSLCommerz refund API

    await db.commit()

    return {
        "success": True,
        "order_id": str(order.id),
        "old_status": old_status,
        "new_status": new_status,
    }


@router.patch("/orders/{order_id}/confirm-payment")
async def confirm_order_payment(
    order_id: str,
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Mark COD payment as paid/collected by admin."""
    from app.services.payment_service import PaymentService

    payment = await PaymentService.confirm_cod_payment(order_id, db)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found or already confirmed")

    return {
        "success": True,
        "payment_status": payment.status,
    }

@router.get("/orders/{order_id}/detail")
async def get_order_detail(
    order_id: UUID,
    user: User = Depends(PermissionChecker([Permission.ORDER_VIEW_ALL])),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Get full order details with customer info."""
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payment),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get customer info
    customer = None
    if order.user_id:
        customer_result = await db.execute(
            select(User).where(User.id == order.user_id)
        )
        customer = customer_result.scalar_one_or_none()

    return {
        "order": {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status,
            "subtotal": str(order.subtotal),
            "discount": str(order.discount),
            "shipping_fee": str(order.shipping_fee),
            "total": str(order.total),
            "currency": order.currency,
            "notes": order.notes,
            "shipping_name": order.shipping_name,
            "shipping_phone": order.shipping_phone,
            "shipping_address": order.shipping_address,
            "shipping_area": order.shipping_area,
            "shipping_city": order.shipping_city,
            "created_at": str(order.created_at),
        },
        "customer": {
            "id": str(customer.id) if customer else None,
            "name": customer.full_name if customer else (order.shipping_name or "Guest"),
            "phone": customer.phone if customer else (order.shipping_phone or None),
            "email": customer.email if customer else None,
        },
        "items": [
            {
                "id": str(item.id),
                "product_title": item.product.title if item.product else "Unknown",
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "total_price": str(item.total_price),
            }
            for item in order.items
        ],
        "payment": {
            "status": order.payment.status,
            "method": order.payment.method,
            "tran_id": order.payment.tran_id,
            "amount": str(order.payment.amount),
        } if order.payment else None,
        "fraud": {
            "score": order.fraud_score,
            "flags": order.fraud_flags,
            "risk_level": "high" if (order.fraud_score or 0) >= 60 else "medium" if (order.fraud_score or 0) >= 30 else "low",
            "is_guest": order.is_guest,
            "ip_address": order.ip_address,
        } if order.fraud_score is not None else None,
    }


# ============================================
# CSV EXPORT
# ============================================

@router.get("/orders/export/csv")
async def export_orders_csv(
    user: User = Depends(PermissionChecker([Permission.ORDER_EXPORT])),
    db: AsyncSession = Depends(get_db),
):
    """Export all orders as CSV."""
    import csv
    import io

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.payment),
        )
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    # Get customer info
    user_ids = [o.user_id for o in orders if o.user_id]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_result.scalars().all()}

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Order Number", "Status", "Subtotal", "Discount", "Shipping Fee", "Total",
        "Payment Method", "Payment Status",
        "Customer Name", "Customer Phone",
        "Shipping Name", "Shipping Phone", "Shipping Address", "Shipping City",
        "Created At",
    ])

    for o in orders:
        customer = users_map.get(o.user_id) if o.user_id else None
        writer.writerow([
            o.order_number,
            o.status,
            str(o.subtotal),
            str(o.discount),
            str(o.shipping_fee),
            str(o.total),
            o.payment.method if o.payment else "",
            o.payment.status if o.payment else "",
            customer.full_name if customer else "",
            customer.phone if customer else "",
            o.shipping_name or "",
            o.shipping_phone or "",
            o.shipping_address or "",
            o.shipping_city or "",
            str(o.created_at),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders_export.csv"},
    )


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
    import app.services.fraud_service as fs
    fs._config_cache = None

    return FraudConfigResponse.model_validate(config)


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
            "returned_count": 0,
            "last_order_date": row.last_order_date,
        }
        for row in offender_rows
    ]

    # --- Suspicious IPs ---
    ip_rows = (await db.execute(
        select(
            Order.ip_address,
            func.count(Order.id).label("order_count"),
            func.sum(case(
                (Order.is_guest == True, 1), else_=0
            )).label("guest_count"),
            func.sum(case(
                (Order.status == OrderStatus.CANCELLED.value, 1), else_=0
            )).label("cancelled_count"),
            func.avg(Order.fraud_score).label("avg_score"),
            func.max(Order.created_at).label("last_order_date"),
        )
        .where(
            Order.ip_address.isnot(None),
            Order.created_at >= cutoff,
        )
        .group_by(Order.ip_address)
        .having(func.count(Order.id) >= 2)
        .order_by(func.count(Order.id).desc())
        .limit(20)
    )).all()

    suspicious_ips = [
        {
            "ip": row.ip_address,
            "order_count": row.order_count,
            "guest_count": int(row.guest_count or 0),
            "cancelled_count": int(row.cancelled_count or 0),
            "avg_score": round(float(row.avg_score or 0), 1),
            "last_order_date": row.last_order_date,
        }
        for row in ip_rows
    ]

    # --- VPN summary ---
    vpn_orders = (await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= cutoff,
            Order.fraud_flags.isnot(None),
            Order.fraud_flags.cast(String).contains("vpn_proxy_detected"),
        )
    )).scalar() or 0

    summary["vpn_orders"] = vpn_orders

    return {
        "summary": summary,
        "daily_trend": daily_trend,
        "top_flags": top_flags,
        "repeat_offenders": repeat_offenders,
        "suspicious_ips": suspicious_ips,
    }


@router.get("/fraud-orders")
async def list_fraud_orders(
    days: int = Query(7, ge=1, le=90),
    risk: str = Query("high", pattern="^(high|medium|low|all)$"),
    limit: int = Query(25, ge=1, le=100),
    user: User = Depends(PermissionChecker([Permission.ANALYTICS_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """List orders filtered by fraud risk level, newest first."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    config_result = await db.execute(select(FraudConfig).where(FraudConfig.id == 1))
    config = config_result.scalar_one_or_none()
    medium_threshold = config.medium_risk_threshold if config else 30
    high_threshold = config.high_risk_threshold if config else 60

    query = select(Order).where(
        Order.created_at >= cutoff,
        Order.fraud_score.isnot(None),
    )

    if risk == "high":
        query = query.where(Order.fraud_score >= high_threshold)
    elif risk == "medium":
        query = query.where(
            Order.fraud_score >= medium_threshold,
            Order.fraud_score < high_threshold,
        )
    elif risk == "low":
        query = query.where(Order.fraud_score < medium_threshold)

    query = query.order_by(Order.fraud_score.desc(), Order.created_at.desc()).limit(limit)

    orders = (await db.execute(query)).scalars().all()

    return [
        {
            "id": str(o.id),
            "order_number": o.order_number,
            "status": o.status,
            "total": str(o.total),
            "currency": o.currency,
            "shipping_name": o.shipping_name,
            "shipping_phone": o.shipping_phone,
            "shipping_city": o.shipping_city,
            "is_guest": o.is_guest,
            "ip_address": o.ip_address,
            "fraud_score": o.fraud_score,
            "fraud_flags": o.fraud_flags or [],
            "risk_level": (
                "high" if (o.fraud_score or 0) >= high_threshold
                else "medium" if (o.fraud_score or 0) >= medium_threshold
                else "low"
            ),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders
    ]
