"""
Badge API — Admin CRUD + Student badge wall/earned endpoints.
"""

import logging
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db import get_db
from app.models import User
from app.models.badge import Badge
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from app.services.badge_service import BadgeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/badges", tags=["Badges"])


# ---- Schemas ----

class BadgeCreateRequest(BaseModel):
    name: str
    name_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    icon_url: Optional[str] = None
    category: str = "general"
    criteria: dict = {}
    sort_order: int = 0


class BadgeUpdateRequest(BaseModel):
    name: Optional[str] = None
    name_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    icon_url: Optional[str] = None
    category: Optional[str] = None
    criteria: Optional[dict] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# ---- Helper ----

def _badge_dict(badge: Badge) -> dict:
    return {
        "id": str(badge.id),
        "name": badge.name,
        "name_bn": badge.name_bn,
        "description": badge.description,
        "description_bn": badge.description_bn,
        "icon_url": badge.icon_url,
        "category": badge.category,
        "criteria": badge.criteria,
        "is_active": badge.is_active,
        "sort_order": badge.sort_order,
        "created_at": str(badge.created_at) if badge.created_at else None,
    }


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.post("/", status_code=201)
async def create_badge(
    data: BadgeCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new badge (admin)."""
    badge = Badge(
        name=data.name,
        name_bn=data.name_bn,
        description=data.description,
        description_bn=data.description_bn,
        icon_url=data.icon_url,
        category=data.category,
        criteria=data.criteria,
        sort_order=data.sort_order,
    )
    db.add(badge)
    await db.commit()
    await db.refresh(badge)
    return _badge_dict(badge)


@router.put("/{badge_id}", status_code=200)
async def update_badge(
    badge_id: UUID,
    data: BadgeUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Update badge fields (admin)."""
    badge = await db.get(Badge, badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(badge, field, value)

    await db.commit()
    await db.refresh(badge)
    return _badge_dict(badge)


@router.get("/", status_code=200)
async def list_badges_admin(
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """List all badges — admin view (includes inactive)."""
    result = await db.execute(
        select(Badge).order_by(Badge.sort_order, Badge.created_at)
    )
    badges = result.scalars().all()
    return [_badge_dict(b) for b in badges]


@router.delete("/{badge_id}", status_code=204)
async def delete_badge(
    badge_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a badge (admin)."""
    badge = await db.get(Badge, badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")

    await db.delete(badge)
    await db.commit()


# ============================================
# STUDENT ENDPOINTS
# ============================================

@router.get("/wall")
async def get_badge_wall(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Badge wall — all badges with earned/locked state + progress."""
    return await BadgeService.get_badge_wall(child_profile_id, db)


@router.get("/earned")
async def get_earned_badges(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Only earned badges for a child."""
    return await BadgeService.get_child_badges(child_profile_id, db)
