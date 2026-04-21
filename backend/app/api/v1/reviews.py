"""
Reviews API — Submit, list, and get average ratings for courses.
"""

from uuid import UUID
from datetime import datetime, timezone

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field, field_validator
from typing import Optional

_URL_PATTERN = re.compile(
    r'https?://|www\.|[a-zA-Z0-9-]+\.(com|org|net|io|dev|co|me|info|biz|xyz|bd|in)\b',
    re.IGNORECASE,
)

from app.db import get_db
from app.models import User
from app.models.review import Review
from app.api.deps import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews"])


def _reject_urls(value: str | None) -> str | None:
    if value and _URL_PATTERN.search(value):
        raise ValueError("Links are not allowed in reviews")
    return value


class ReviewCreate(BaseModel):
    course_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

    @field_validator("comment")
    @classmethod
    def no_links(cls, v: str | None) -> str | None:
        return _reject_urls(v)


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None

    @field_validator("comment")
    @classmethod
    def no_links(cls, v: str | None) -> str | None:
        return _reject_urls(v)


@router.post("/", status_code=201)
async def create_review(
    data: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a review for a course (one per user per course)."""
    # Check existing
    existing = await db.execute(
        select(Review).where(
            Review.user_id == user.id,
            Review.course_id == UUID(data.course_id),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already reviewed this course")

    review = Review(
        user_id=user.id,
        course_id=UUID(data.course_id),
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    return {
        "id": str(review.id),
        "rating": review.rating,
        "comment": review.comment,
        "created_at": str(review.created_at),
    }


@router.patch("/{review_id}")
async def update_review(
    review_id: UUID,
    data: ReviewUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update your own review."""
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your review")

    if data.rating is not None:
        review.rating = data.rating
    if data.comment is not None:
        review.comment = data.comment

    await db.commit()
    return {"message": "Updated"}


@router.get("/course/{course_id}")
async def get_course_reviews(
    course_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get reviews for a course (public)."""
    # Average + count
    stats_result = await db.execute(
        select(
            func.count(Review.id).label("total"),
            func.coalesce(func.avg(Review.rating), 0).label("average"),
        ).where(Review.course_id == course_id)
    )
    stats = stats_result.one()

    # Reviews list
    result = await db.execute(
        select(Review)
        .where(Review.course_id == course_id)
        .order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    reviews = result.scalars().all()

    # Get user names
    user_ids = [r.user_id for r in reviews]
    if user_ids:
        users_result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users_map = {u.id: u for u in users_result.scalars().all()}
    else:
        users_map = {}

    return {
        "total_reviews": stats.total,
        "average_rating": round(float(stats.average), 1),
        "reviews": [
            {
                "id": str(r.id),
                "rating": r.rating,
                "comment": r.comment,
                "user_name": users_map.get(r.user_id, None).full_name if users_map.get(r.user_id) else "Anonymous",
                "created_at": str(r.created_at),
            }
            for r in reviews
        ],
    }


@router.delete("/{review_id}", status_code=204)
async def delete_review(
    review_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete your own review."""
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your review")
    await db.delete(review)
    await db.commit()
