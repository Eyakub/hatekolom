import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models.site_settings import SiteSettings
from app.api.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings/site", tags=["Site Settings"])

from pydantic import BaseModel

class SiteSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    support_phone: Optional[str] = None
    support_email: Optional[str] = None
    office_address: Optional[str] = None
    facebook_url: Optional[str] = None
    youtube_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    instagram_url: Optional[str] = None
    footer_description_en: Optional[str] = None
    footer_description_bn: Optional[str] = None
    feature_flags: Optional[dict] = None

@router.get("")
async def get_site_settings(db: AsyncSession = Depends(get_db)):
    """
    Public endpoint to fetch current site settings.
    If none exist, creates default settings.
    """
    result = await db.execute(select(SiteSettings).limit(1))
    settings = result.scalar_one_or_none()

    if not settings:
        # Create defaults
        settings = SiteSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return {
        "id": str(settings.id),
        "platform_name": settings.platform_name,
        "logo_url": settings.logo_url,
        "favicon_url": settings.favicon_url,
        "support_phone": settings.support_phone,
        "support_email": settings.support_email,
        "office_address": settings.office_address,
        "facebook_url": settings.facebook_url,
        "youtube_url": settings.youtube_url,
        "linkedin_url": settings.linkedin_url,
        "instagram_url": settings.instagram_url,
        "footer_description_en": settings.footer_description_en,
        "footer_description_bn": settings.footer_description_bn,
        "feature_flags": settings.feature_flags or {},
        "updated_at": settings.updated_at
    }

@router.put("")
async def update_site_settings(
    settings_in: SiteSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Admin-only endpoint to update site settings.
    """
    user_role_names = {r.name for r in (user.roles or [])}
    if not user_role_names.intersection({"super_admin", "admin"}):
        raise HTTPException(status_code=403, detail="Only super admins can update settings")

    result = await db.execute(select(SiteSettings).limit(1))
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = SiteSettings()
        db.add(settings)

    # Update only provided fields
    update_data = settings_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.commit()
    await db.refresh(settings)

    return {
        "success": True,
        "message": "Settings updated successfully",
        "settings": {
            "platform_name": settings.platform_name,
            "logo_url": settings.logo_url
        }
    }
