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

BD_PHONE_PATTERN = re.compile(r"^01[3-9]\d{8}$")

_config_cache: Optional[tuple[FraudConfig, float]] = None
_CONFIG_TTL = 60


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
            config = FraudConfig(id=1)
            db.add(config)
            await db.flush()

        # Ensure no None values — fill from column defaults
        defaults = {
            "block_phone_enabled": True, "block_ip_enabled": True, "block_fingerprint_enabled": True,
            "phone_rate_window_hours": 24, "phone_rate_max_orders": 2, "phone_rate_score": 30,
            "ip_rate_window_hours": 24, "ip_rate_max_orders": 3, "ip_rate_score": 25,
            "fingerprint_rate_window_hours": 24, "fingerprint_rate_max_orders": 3, "fingerprint_rate_score": 25,
            "min_address_length": 15, "address_quality_score": 15,
            "max_single_item_qty": 5, "max_total_items": 10, "quantity_spike_score": 20,
            "phone_format_score": 40, "vpn_proxy_score": 30, "blacklist_score": 35, "prepaid_discount_score": -20,
            "medium_risk_threshold": 30, "high_risk_threshold": 60, "max_cart_value": 5000,
        }
        for field, default in defaults.items():
            if getattr(config, field, None) is None:
                setattr(config, field, default)

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
    async def check_hard_limits(
        phone: str,
        ip: Optional[str],
        fingerprint: Optional[dict],
        db: AsyncSession,
    ) -> Optional[str]:
        """
        Check hard rate limits that should BLOCK the order.
        Returns an error message if blocked, None if OK.
        """
        config = await FraudService._get_config(db)
        now = datetime.now(timezone.utc)

        # Phone rate limit — hard block (if enabled)
        if getattr(config, "block_phone_enabled", True):
            phone_window = now - timedelta(hours=config.phone_rate_window_hours)
            phone_count = (await db.execute(
                select(func.count(Order.id)).where(
                    Order.shipping_phone == phone,
                    Order.created_at >= phone_window,
                )
            )).scalar() or 0
            if phone_count >= config.phone_rate_max_orders:
                return f"This phone number has already placed {phone_count} orders in the last {config.phone_rate_window_hours} hours. Please try again later."

        # IP rate limit — hard block (if enabled)
        if getattr(config, "block_ip_enabled", True) and ip:
            ip_window = now - timedelta(hours=config.ip_rate_window_hours)
            ip_count = (await db.execute(
                select(func.count(Order.id)).where(
                    Order.ip_address == ip,
                    Order.created_at >= ip_window,
                )
            )).scalar() or 0
            if ip_count >= config.ip_rate_max_orders:
                return f"Too many orders from this network. Please try again later."

        # Fingerprint rate limit — hard block (if enabled)
        if getattr(config, "block_fingerprint_enabled", True):
            fp_hash = FraudService.hash_fingerprint(fingerprint)
            if fp_hash:
                fp_window = now - timedelta(hours=config.fingerprint_rate_window_hours)
                fp_count = (await db.execute(
                    select(func.count(Order.id)).where(
                        Order.device_fingerprint["hash"].astext == fp_hash,
                        Order.created_at >= fp_window,
                    )
                )).scalar() or 0
                if fp_count >= config.fingerprint_rate_max_orders:
                    return f"Too many orders from this device. Please try again later."

        return None

    @staticmethod
    async def score_order(
        phone: str,
        ip_info: Optional[dict],
        fingerprint: Optional[dict],
        items: list[dict],
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

        # 6. Phone blacklist
        blacklist_result = await db.execute(
            select(func.count(Order.id)).where(
                Order.shipping_phone == phone,
                Order.status.in_([OrderStatus.CANCELLED.value]),
            )
        )
        cancelled_count = blacklist_result.scalar() or 0

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

        # 7. Quantity spike
        total_qty = sum(item.get("quantity", 1) for item in items)
        max_single = max((item.get("quantity", 1) for item in items), default=0)
        if max_single > config.max_single_item_qty or total_qty > config.max_total_items:
            score += config.quantity_spike_score
            flags.append(f"quantity_spike:max_single={max_single},total={total_qty}")

        # 8. Prepaid discount
        if payment_method in ("bkash", "nagad", "card", "bank"):
            score += config.prepaid_discount_score
            flags.append("prepaid_payment_discount")

        score = max(0, score)

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

        if len(address) < config.min_address_length or not area:
            result["score"] += config.address_quality_score
            result["flags"].append(
                f"address_quality:length={len(address)},area_missing={not area}"
            )
            if result["score"] >= config.high_risk_threshold:
                result["risk_level"] = "high"
            elif result["score"] >= config.medium_risk_threshold:
                result["risk_level"] = "medium"

        return result
