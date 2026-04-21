"""
Course Feedback API — guardians submit feedback, admins respond.
Public reviews visible to all; complaints/suggestions private.
"""

from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field, field_validator

_URL_PATTERN = re.compile(
    r'https?://|www\.|[a-zA-Z0-9-]+\.(com|org|net|io|dev|co|me|info|biz|xyz|bd|in)\b',
    re.IGNORECASE,
)

from app.db import get_db
from app.models import User
from app.models.feedback import CourseFeedback
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission

router = APIRouter(prefix="/feedback", tags=["Course Feedback"])


# ---- Schemas ----

class FeedbackCreate(BaseModel):
    course_id: str
    feedback_type: str = Field(default="review", pattern="^(review|complaint|suggestion|improvement)$")
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    message: str = Field(..., min_length=1, max_length=5000)

    @field_validator("message")
    @classmethod
    def no_links(cls, v: str) -> str:
        if _URL_PATTERN.search(v):
            raise ValueError("লিংক দেওয়া যাবে না")
        return v


class FeedbackRespond(BaseModel):
    admin_response: str = Field(..., min_length=1, max_length=5000)
    is_resolved: bool = False


# ---- Guardian Endpoints ----

@router.post("/", status_code=201)
async def create_feedback(
    data: FeedbackCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Guardian submits feedback on a course."""
    feedback = CourseFeedback(
        course_id=UUID(data.course_id),
        user_id=user.id,
        feedback_type=data.feedback_type,
        rating=data.rating if data.feedback_type == "review" else None,
        message=data.message,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return _serialize(feedback)


@router.get("/course/{course_id}")
async def get_my_feedback(
    course_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Guardian gets feedback for a course:
    - All reviews (visible to everyone)
    - Own complaints/suggestions/improvements (private)
    """
    result = await db.execute(
        select(CourseFeedback)
        .options(selectinload(CourseFeedback.user), selectinload(CourseFeedback.responder))
        .where(
            CourseFeedback.course_id == course_id,
            or_(
                CourseFeedback.feedback_type == "review",
                CourseFeedback.user_id == user.id,
            ),
        )
        .order_by(CourseFeedback.created_at.desc())
    )
    feedbacks = result.scalars().all()
    return [_serialize(f) for f in feedbacks]


# ---- Public Endpoint (no auth) ----

@router.get("/course/{course_id}/reviews")
async def get_public_reviews(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Public: get all reviews for a course (no auth required)."""
    result = await db.execute(
        select(CourseFeedback)
        .options(selectinload(CourseFeedback.user))
        .where(
            CourseFeedback.course_id == course_id,
            CourseFeedback.feedback_type == "review",
        )
        .order_by(CourseFeedback.created_at.desc())
    )
    feedbacks = result.scalars().all()

    # Compute summary
    ratings = [f.rating for f in feedbacks if f.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0

    return {
        "reviews": [_serialize(f) for f in feedbacks],
        "total": len(feedbacks),
        "average_rating": avg_rating,
        "rating_count": len(ratings),
    }


# ---- Admin Endpoints ----

@router.get("/course/{course_id}/all")
async def get_all_feedback(
    course_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Admin gets all feedback for a course."""
    result = await db.execute(
        select(CourseFeedback)
        .options(selectinload(CourseFeedback.user), selectinload(CourseFeedback.responder))
        .where(CourseFeedback.course_id == course_id)
        .order_by(CourseFeedback.created_at.desc())
    )
    feedbacks = result.scalars().all()
    return [_serialize(f) for f in feedbacks]


@router.put("/{feedback_id}/respond")
async def respond_to_feedback(
    feedback_id: UUID,
    data: FeedbackRespond,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Admin responds to a feedback entry."""
    feedback = await db.get(CourseFeedback, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback.admin_response = data.admin_response
    feedback.responded_by = user.id
    feedback.responded_at = datetime.now(timezone.utc)
    feedback.is_resolved = data.is_resolved

    await db.commit()
    await db.refresh(feedback, attribute_names=["user", "responder"])

    return _serialize(feedback)


@router.delete("/{feedback_id}", status_code=204)
async def delete_feedback(
    feedback_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Guardian deletes their own feedback, or admin deletes any."""
    feedback = await db.get(CourseFeedback, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    is_admin = any(r.name in ("admin", "super_admin") for r in (user.roles or []))
    if feedback.user_id != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")

    await db.delete(feedback)
    await db.commit()


# ---- Helper ----

def _serialize(f: CourseFeedback) -> dict:
    return {
        "id": str(f.id),
        "course_id": str(f.course_id),
        "user_id": str(f.user_id),
        "user_name": f.user.full_name if f.user else None,
        "feedback_type": f.feedback_type,
        "rating": f.rating,
        "message": f.message,
        "admin_response": f.admin_response,
        "responder_name": f.responder.full_name if f.responder else None,
        "responded_at": f.responded_at.isoformat() if f.responded_at else None,
        "is_resolved": f.is_resolved,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
