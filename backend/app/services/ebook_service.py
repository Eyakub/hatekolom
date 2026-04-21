"""
E-book Download Service — Backblaze B2 presigned URLs with audit trail.

Security layers:
1. Entitlement check — user must own the ebook
2. Rate limit — max 3 downloads per 24h per user per ebook
3. Presigned URL — 5-minute TTL from Backblaze B2
4. Audit log — every download is tracked
"""

import logging
from uuid import UUID
from datetime import datetime, timezone

import boto3
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.exceptions import ForbiddenError, RateLimitError, NotFoundError
from app.models import Ebook, Entitlement, EntitlementType

logger = logging.getLogger(__name__)


class EbookService:

    def __init__(self):
        if settings.B2_KEY_ID and settings.B2_KEY_ID != "mock":
            self.s3 = boto3.client(
                "s3",
                endpoint_url=settings.B2_ENDPOINT,
                aws_access_key_id=settings.B2_KEY_ID,
                aws_secret_access_key=settings.B2_APP_KEY,
                region_name=settings.B2_REGION,
            )
        else:
            self.s3 = None

    async def generate_download_url(
        self,
        ebook_id: UUID,
        user_id: UUID,
        db: AsyncSession,
        redis: Redis,
    ) -> dict:
        """Generate a secure, time-limited download URL for an ebook."""

        # 1. Get ebook — try by ebook.id first, then by product_id
        result = await db.execute(select(Ebook).where(Ebook.id == ebook_id))
        ebook = result.scalar_one_or_none()
        if not ebook:
            # Try by product_id (frontend passes product_id from entitlements)
            result = await db.execute(select(Ebook).where(Ebook.product_id == ebook_id))
            ebook = result.scalar_one_or_none()
        if not ebook:
            raise NotFoundError("E-book")

        # 2. Check entitlement
        ent_result = await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.product_id == ebook.product_id,
                Entitlement.entitlement_type == EntitlementType.EBOOK_DOWNLOAD,
                Entitlement.is_active == True,
            )
        )
        entitlement = ent_result.scalar_one_or_none()
        if not entitlement:
            raise ForbiddenError("You don't have access to this e-book")

        # 3. Rate limit: max 3 downloads per 24h
        rate_key = f"ebook:dl:{user_id}:{ebook_id}:24h"
        download_count = await redis.get(rate_key)
        if download_count and int(download_count) >= 3:
            raise RateLimitError("Download limit reached (3 per day). Try again tomorrow.")

        # 4. Generate presigned URL (or mock)
        if self.s3:
            presigned_url = self.s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.B2_BUCKET_NAME,
                    "Key": ebook.b2_key,
                    "ResponseContentDisposition": f'attachment; filename="{ebook_id}.pdf"',
                },
                ExpiresIn=300,  # 5 minutes
            )
        else:
            # Local mode — serve file from static directory
            presigned_url = f"/static/uploads/{ebook.b2_key}"

        # 5. Track download
        await redis.incr(rate_key)
        await redis.expire(rate_key, 86400)  # 24h TTL

        # Update entitlement metadata
        meta = entitlement.metadata_ or {}
        meta["total_downloads"] = meta.get("total_downloads", 0) + 1
        meta["last_downloaded"] = datetime.now(timezone.utc).isoformat()
        entitlement.metadata_ = meta
        await db.commit()

        remaining = 3 - (int(download_count or 0) + 1)

        logger.info(f"Ebook download: user={user_id}, ebook={ebook_id}, remaining={remaining}")

        return {
            "download_url": presigned_url,
            "expires_in_seconds": 300,
            "downloads_remaining_today": max(0, remaining),
            "total_downloads": meta["total_downloads"],
        }

    async def get_user_ebooks(
        self,
        user_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all ebooks owned by a user (for dashboard)."""
        result = await db.execute(
            select(Entitlement)
            .where(
                Entitlement.user_id == user_id,
                Entitlement.entitlement_type == EntitlementType.EBOOK_DOWNLOAD,
                Entitlement.is_active == True,
            )
        )
        entitlements = result.scalars().all()

        ebooks = []
        for ent in entitlements:
            ebook_result = await db.execute(
                select(Ebook).where(Ebook.product_id == ent.product_id)
            )
            ebook = ebook_result.scalar_one_or_none()
            if ebook:
                from app.models import Product
                prod_result = await db.execute(
                    select(Product).where(Product.id == ebook.product_id)
                )
                product = prod_result.scalar_one_or_none()

                meta = ent.metadata_ or {}
                ebooks.append({
                    "ebook_id": str(ebook.id),
                    "product_id": str(ebook.product_id),
                    "title": product.title if product else "",
                    "title_bn": product.title_bn if product else None,
                    "thumbnail_url": product.thumbnail_url if product else None,
                    "author": ebook.author,
                    "pages": ebook.pages,
                    "total_downloads": meta.get("total_downloads", 0),
                    "last_downloaded": meta.get("last_downloaded"),
                    "granted_at": ent.granted_at.isoformat() if ent.granted_at else None,
                    "order_item_id": str(ent.order_item_id) if ent.order_item_id else None,
                })

        return ebooks
