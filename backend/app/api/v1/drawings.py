"""
Drawing API — Student save/my/delete, Parent approval, Public gallery, Admin management.
"""

import logging
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.db import get_db
from app.models import User
from app.models.drawing import Drawing, DrawingLike
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from app.services.badge_service import BadgeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drawings", tags=["Drawings"])


# ---- Schemas ----

class DrawingCreateRequest(BaseModel):
    child_profile_id: UUID
    image_url: str
    title: Optional[str] = None
    title_bn: Optional[str] = None
    challenge_id: Optional[UUID] = None


# ---- Helper ----

def _drawing_dict(d: Drawing) -> dict:
    return {
        "id": str(d.id),
        "child_profile_id": str(d.child_profile_id),
        "user_id": str(d.user_id),
        "image_url": d.image_url,
        "title": d.title,
        "title_bn": d.title_bn,
        "challenge_id": str(d.challenge_id) if d.challenge_id else None,
        "status": d.status,
        "is_featured": d.is_featured,
        "like_count": d.like_count,
        "created_at": str(d.created_at) if d.created_at else None,
    }


# ============================================
# STUDENT ENDPOINTS
# ============================================

@router.post("/", status_code=201)
async def save_drawing(
    data: DrawingCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a new drawing (student). Status starts as 'pending'."""
    drawing = Drawing(
        child_profile_id=data.child_profile_id,
        user_id=user.id,
        image_url=data.image_url,
        title=data.title,
        title_bn=data.title_bn,
        challenge_id=data.challenge_id,
        status="pending",
    )
    db.add(drawing)
    await db.commit()
    await db.refresh(drawing)
    return _drawing_dict(drawing)


@router.get("/my")
async def my_drawings(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all drawings for a child (all statuses), newest first."""
    result = await db.execute(
        select(Drawing)
        .where(Drawing.child_profile_id == child_profile_id)
        .order_by(desc(Drawing.created_at))
    )
    drawings = result.scalars().all()
    return [_drawing_dict(d) for d in drawings]


@router.delete("/{drawing_id}", status_code=204)
async def delete_drawing(
    drawing_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete own drawing (student). Verifies ownership."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    if drawing.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this drawing")

    await db.delete(drawing)
    await db.commit()


# ============================================
# PARENT ENDPOINTS
# ============================================

@router.get("/pending")
async def pending_drawings(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pending drawings awaiting parent approval for a child."""
    result = await db.execute(
        select(Drawing)
        .where(
            Drawing.child_profile_id == child_profile_id,
            Drawing.status == "pending",
        )
        .order_by(desc(Drawing.created_at))
    )
    drawings = result.scalars().all()
    return [_drawing_dict(d) for d in drawings]


@router.put("/{drawing_id}/approve")
async def approve_drawing(
    drawing_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a drawing (parent). Triggers badge check for drawing_count."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    drawing.status = "approved"
    await db.commit()
    await db.refresh(drawing)

    # Check and award badges for drawing milestone
    newly_awarded = await BadgeService.check_and_award(
        drawing.child_profile_id, "drawing_count", db
    )

    return {
        "drawing": _drawing_dict(drawing),
        "newly_awarded_badges": [
            {
                "badge_id": str(b.id),
                "name": b.name,
                "name_bn": b.name_bn,
                "icon_url": b.icon_url,
            }
            for b in newly_awarded
        ],
    }


@router.put("/{drawing_id}/reject")
async def reject_drawing(
    drawing_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a drawing (parent)."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    drawing.status = "rejected"
    await db.commit()
    await db.refresh(drawing)
    return _drawing_dict(drawing)


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@router.get("/gallery")
async def drawing_gallery(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort: str = Query("recent", regex="^(recent|popular|featured)$"),
    challenge_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Public gallery of approved drawings. Sort: recent | popular | featured."""
    query = select(Drawing).where(Drawing.status == "approved")

    if challenge_id:
        query = query.where(Drawing.challenge_id == challenge_id)

    if sort == "popular":
        query = query.order_by(desc(Drawing.like_count), desc(Drawing.created_at))
    elif sort == "featured":
        query = query.order_by(desc(Drawing.is_featured), desc(Drawing.created_at))
    else:  # recent
        query = query.order_by(desc(Drawing.created_at))

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    drawings = result.scalars().all()
    return [_drawing_dict(d) for d in drawings]


@router.get("/{drawing_id}")
async def get_drawing(
    drawing_id: UUID,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single drawing detail. Must be approved or owned by the requesting user."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    # Allow if approved OR if user owns it
    if drawing.status != "approved":
        if user is None or drawing.user_id != user.id:
            raise HTTPException(status_code=403, detail="Drawing is not available")

    return _drawing_dict(drawing)


@router.post("/{drawing_id}/like")
async def toggle_like(
    drawing_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle like on a drawing. Returns {liked, like_count}. Triggers badge check on like."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    # Check for existing like
    result = await db.execute(
        select(DrawingLike).where(
            DrawingLike.drawing_id == drawing_id,
            DrawingLike.user_id == user.id,
        )
    )
    existing_like = result.scalar_one_or_none()

    if existing_like:
        # Unlike
        await db.delete(existing_like)
        drawing.like_count = max(0, (drawing.like_count or 0) - 1)
        liked = False
    else:
        # Like
        new_like = DrawingLike(drawing_id=drawing_id, user_id=user.id)
        db.add(new_like)
        drawing.like_count = (drawing.like_count or 0) + 1
        liked = True

    await db.commit()
    await db.refresh(drawing)

    # Check and award badges for like milestone
    await BadgeService.check_and_award(drawing.child_profile_id, "like_count", db)

    return {"liked": liked, "like_count": drawing.like_count}


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.get("/admin")
async def list_drawings_admin(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """All drawings with optional status filter (admin)."""
    query = select(Drawing)

    if status:
        query = query.where(Drawing.status == status)

    query = query.order_by(desc(Drawing.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    drawings = result.scalars().all()
    return [_drawing_dict(d) for d in drawings]


@router.put("/{drawing_id}/feature")
async def toggle_feature(
    drawing_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Toggle is_featured on a drawing (admin). Awards badge when featuring."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    was_featured = drawing.is_featured
    drawing.is_featured = not was_featured
    await db.commit()
    await db.refresh(drawing)

    # Only check badge when turning ON featured
    if drawing.is_featured:
        await BadgeService.check_and_award(drawing.child_profile_id, "featured_count", db)

    return _drawing_dict(drawing)


@router.delete("/{drawing_id}/admin", status_code=204)
async def admin_delete_drawing(
    drawing_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Admin delete any drawing."""
    drawing = await db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    await db.delete(drawing)
    await db.commit()
