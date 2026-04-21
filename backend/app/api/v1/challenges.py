"""
Challenges API — Admin CRUD, public listing, student submission lookup.
"""

import logging
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel

from app.db import get_db
from app.models import User
from app.models.challenge import Challenge
from app.models.drawing import Drawing
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/challenges", tags=["Challenges"])


# ---- Schemas ----

class ChallengeCreateRequest(BaseModel):
    title: str
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    reference_image_url: Optional[str] = None
    challenge_type: str = "drawing"
    starts_at: str  # ISO datetime string
    ends_at: Optional[str] = None
    is_active: bool = True


class ChallengeUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    reference_image_url: Optional[str] = None
    challenge_type: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_active: Optional[bool] = None


# ---- Helpers ----

def _parse_iso(dt_str: str) -> datetime:
    """Parse an ISO datetime string, handling the Z suffix."""
    return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


def _challenge_dict(c: Challenge, submission_count: Optional[int] = None) -> dict:
    d = {
        "id": str(c.id),
        "title": c.title,
        "title_bn": c.title_bn,
        "description": c.description,
        "description_bn": c.description_bn,
        "reference_image_url": c.reference_image_url,
        "challenge_type": c.challenge_type,
        "starts_at": str(c.starts_at),
        "ends_at": str(c.ends_at) if c.ends_at else None,
        "is_active": c.is_active,
        "created_at": str(c.created_at),
    }
    if submission_count is not None:
        d["submission_count"] = submission_count
    return d


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.post("/", status_code=201)
async def create_challenge(
    data: ChallengeCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new challenge (admin)."""
    challenge = Challenge(
        title=data.title,
        title_bn=data.title_bn,
        description=data.description,
        description_bn=data.description_bn,
        reference_image_url=data.reference_image_url,
        challenge_type=data.challenge_type,
        starts_at=_parse_iso(data.starts_at),
        ends_at=_parse_iso(data.ends_at) if data.ends_at else None,
        is_active=data.is_active,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return _challenge_dict(challenge)


@router.put("/{challenge_id}")
async def update_challenge(
    challenge_id: UUID,
    data: ChallengeUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Update a challenge (admin)."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if data.title is not None:
        challenge.title = data.title
    if data.title_bn is not None:
        challenge.title_bn = data.title_bn
    if data.description is not None:
        challenge.description = data.description
    if data.description_bn is not None:
        challenge.description_bn = data.description_bn
    if data.reference_image_url is not None:
        challenge.reference_image_url = data.reference_image_url
    if data.challenge_type is not None:
        challenge.challenge_type = data.challenge_type
    if data.starts_at is not None:
        challenge.starts_at = _parse_iso(data.starts_at)
    if data.ends_at is not None:
        challenge.ends_at = _parse_iso(data.ends_at)
    if data.is_active is not None:
        challenge.is_active = data.is_active

    await db.commit()
    await db.refresh(challenge)
    return _challenge_dict(challenge)


@router.get("/admin")
async def list_challenges_admin(
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """List ALL challenges including inactive (admin), newest first."""
    result = await db.execute(
        select(Challenge).order_by(desc(Challenge.starts_at))
    )
    challenges = result.scalars().all()
    return [_challenge_dict(c) for c in challenges]


@router.delete("/{challenge_id}", status_code=204)
async def delete_challenge(
    challenge_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a challenge (admin)."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    await db.delete(challenge)
    await db.commit()


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@router.get("/today")
async def get_today_challenge(
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent active challenge whose starts_at <= now, or null."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Challenge)
        .where(
            Challenge.is_active == True,
            Challenge.starts_at <= now,
        )
        .order_by(desc(Challenge.starts_at))
        .limit(1)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        return None
    return _challenge_dict(challenge)


@router.get("/")
async def list_challenges(
    db: AsyncSession = Depends(get_db),
):
    """List active challenges where is_active=True, starts_at <= now, and not yet ended."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Challenge)
        .where(
            Challenge.is_active == True,
            Challenge.starts_at <= now,
            # ends_at is null OR ends_at > now
            (Challenge.ends_at == None) | (Challenge.ends_at > now),
        )
        .order_by(desc(Challenge.starts_at))
    )
    challenges = result.scalars().all()
    return [_challenge_dict(c) for c in challenges]


@router.get("/{challenge_id}")
async def get_challenge(
    challenge_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Challenge detail with submission_count."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Count all drawings for this challenge regardless of status
    count_result = await db.execute(
        select(func.count()).select_from(Drawing).where(
            Drawing.challenge_id == challenge_id,
        )
    )
    submission_count = count_result.scalar() or 0

    return _challenge_dict(challenge, submission_count=submission_count)


# ============================================
# STUDENT ENDPOINTS
# ============================================

@router.get("/{challenge_id}/my-submission")
async def my_submission(
    challenge_id: UUID,
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the child's drawing for this challenge, or null if none exists."""
    result = await db.execute(
        select(Drawing).where(
            Drawing.challenge_id == challenge_id,
            Drawing.child_profile_id == child_profile_id,
        )
    )
    drawing = result.scalar_one_or_none()
    if not drawing:
        return None

    return {
        "id": str(drawing.id),
        "child_profile_id": str(drawing.child_profile_id),
        "user_id": str(drawing.user_id),
        "image_url": drawing.image_url,
        "title": drawing.title,
        "title_bn": drawing.title_bn,
        "challenge_id": str(drawing.challenge_id) if drawing.challenge_id else None,
        "status": drawing.status,
        "is_featured": drawing.is_featured,
        "like_count": drawing.like_count,
        "created_at": str(drawing.created_at) if drawing.created_at else None,
    }
