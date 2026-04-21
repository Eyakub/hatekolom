"""IP check utility — calls ip-api.com to detect VPN/proxy."""

import logging
import time
import ipaddress

import httpx

logger = logging.getLogger(__name__)

# Simple in-memory cache: {ip: (result_dict, timestamp)}
_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 3600  # 1 hour


def _is_private_ip(ip: str) -> bool:
    """Check if an IP is private/localhost/reserved."""
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return True


async def check_ip(ip: str) -> dict:
    """
    Check if an IP is a VPN/proxy/datacenter using ip-api.com.
    Returns: {"is_vpn": bool, "country": str, "ip": str}
    Falls back to safe defaults if the API is unavailable.

    If ip is private/localhost, calls ip-api.com without an IP param
    so it auto-detects the caller's public IP.
    """
    # Check cache
    if ip in _cache:
        result, ts = _cache[ip]
        if time.time() - ts < _CACHE_TTL:
            return result

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            # If private IP, let ip-api detect the public IP automatically
            if _is_private_ip(ip):
                url = "http://ip-api.com/json/"
            else:
                url = f"http://ip-api.com/json/{ip}"

            resp = await client.get(
                url,
                params={"fields": "proxy,hosting,country,status,query"},
            )
            data = resp.json()

            if data.get("status") == "success":
                real_ip = data.get("query", ip)
                result = {
                    "is_vpn": bool(data.get("proxy") or data.get("hosting")),
                    "country": data.get("country", "Unknown"),
                    "ip": real_ip,
                }
                # Cache under both the original and real IP
                _cache[real_ip] = (result, time.time())
            else:
                result = {"is_vpn": False, "country": "Unknown", "ip": ip}

    except Exception as e:
        logger.warning(f"ip-api.com check failed for {ip}: {e}")
        result = {"is_vpn": False, "country": "Unknown", "ip": ip}

    _cache[ip] = (result, time.time())
    return result


def get_client_ip(request) -> str:
    """
    Extract real client IP from request.
    Checks common proxy headers in priority order.
    """
    # Standard proxy headers (in order of reliability)
    for header in ("x-forwarded-for", "x-real-ip", "cf-connecting-ip"):
        value = request.headers.get(header)
        if value:
            # x-forwarded-for can be comma-separated: client, proxy1, proxy2
            return value.split(",")[0].strip()

    return request.client.host if request.client else "unknown"
