"""
Rate Limiting Middleware — Redis-based, per-IP.

Limits:
  - General: 100 req/min
  - Auth endpoints: 10 req/min (brute-force protection)
  - Download endpoints: 5 req/min
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

RATE_LIMITS = {
    "/api/v1/auth/login": (10, 60),
    "/api/v1/auth/register": (5, 60),
    "/api/v1/ebooks/": (5, 60),
    "/api/v1/orders/guest": (10, 3600),     # 10 per hour per IP
    "/api/v1/orders/ip-check": (30, 3600),  # 30 per hour per IP
    "default": (100, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            try:
                from redis.asyncio import Redis
                self._redis = Redis.from_url(
                    settings.REDIS_URL, decode_responses=True,
                    socket_connect_timeout=2, socket_timeout=2,
                )
                await self._redis.ping()
            except Exception as e:
                logger.warning(f"Redis not available for rate limiting: {e}")
                self._redis = None
        return self._redis

    async def dispatch(self, request: Request, call_next):
        # Skip non-API and OPTIONS requests
        if request.method == "OPTIONS" or not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        # Determine rate limit
        path = request.url.path
        max_requests, window = RATE_LIMITS["default"]
        for pattern, limits in RATE_LIMITS.items():
            if pattern != "default" and path.startswith(pattern):
                max_requests, window = limits
                break

        # Check rate limit via Redis
        try:
            redis = await self._get_redis()
            if redis:
                rate_key = f"rate:{client_ip}:{path.split('?')[0]}"
                current = await redis.get(rate_key)

                if current and int(current) >= max_requests:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": "Too many requests. Please try again later.",
                            "retry_after": window,
                        },
                        headers={"Retry-After": str(window)},
                    )

                pipe = redis.pipeline()
                await pipe.incr(rate_key)
                await pipe.expire(rate_key, window)
                await pipe.execute()
        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")

        return await call_next(request)
