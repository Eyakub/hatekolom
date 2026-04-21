"""
Video Security Service — Signed embed URLs + watermark data.

Layer 1: Backend generates time-limited, user-bound tokens for video access
Layer 2: YouTube referrer lockdown (configured in YouTube Studio)
Layer 3: Frontend canvas watermark overlay
Layer 4: Playback heartbeat for concurrent session detection
"""

import hashlib
import secrets
import time
import logging
from uuid import UUID

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class VideoService:

    @staticmethod
    def generate_signed_embed(
        youtube_id: str,
        user_id: str,
        session_id: str,
        ttl_seconds: int = 3600,
    ) -> dict:
        """Generate a time-limited, user-bound video access token."""
        expires_at = int(time.time()) + ttl_seconds
        nonce = secrets.token_urlsafe(16)

        payload = f"{youtube_id}:{user_id}:{session_id}:{expires_at}:{nonce}"
        signature = hashlib.sha256(
            f"{payload}:{settings.VIDEO_SIGNING_SECRET}".encode()
        ).hexdigest()

        return {
            "token": f"{nonce}.{expires_at}.{signature}",
            "youtube_id": youtube_id,
            "expires_at": expires_at,
            "watermark_text": f"ID:{user_id[:8]}",
            "embed_url": f"https://www.youtube.com/embed/{youtube_id}?enablejsapi=1&modestbranding=1&rel=0&showinfo=0",
        }

    @staticmethod
    def verify_token(
        token: str,
        youtube_id: str,
        user_id: str,
        session_id: str,
    ) -> bool:
        """Verify a video access token."""
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return False

            nonce, expires_str, signature = parts
            expires_at = int(expires_str)

            if time.time() > expires_at:
                return False

            payload = f"{youtube_id}:{user_id}:{session_id}:{expires_at}:{nonce}"
            expected = hashlib.sha256(
                f"{payload}:{settings.VIDEO_SIGNING_SECRET}".encode()
            ).hexdigest()

            return signature == expected
        except (ValueError, IndexError):
            return False

    @staticmethod
    async def record_heartbeat(
        user_id: str,
        lesson_id: str,
        session_id: str,
        position_seconds: int,
        redis: Redis,
    ) -> dict:
        """
        Record playback heartbeat. Detects concurrent sessions.
        Returns: {"status": "ok"} or {"status": "killed", "reason": "..."}
        """
        session_key = f"video:session:{user_id}:{lesson_id}"
        active_key = f"video:active:{user_id}"

        # Check concurrent sessions
        active_sessions = await redis.smembers(active_key)
        max_concurrent = 2

        if len(active_sessions) >= max_concurrent and session_id.encode() not in active_sessions:
            # Too many sessions — kill oldest
            oldest = sorted(active_sessions)[0]
            await redis.srem(active_key, oldest)
            logger.warning(
                f"Concurrent limit reached for user {user_id}. Killed session {oldest}"
            )

        # Register this session
        await redis.setex(session_key, 60, session_id)  # 60s TTL
        await redis.sadd(active_key, session_id)
        await redis.expire(active_key, 120)  # Cleanup after 2 min of no heartbeats

        return {"status": "ok", "position": position_seconds}
