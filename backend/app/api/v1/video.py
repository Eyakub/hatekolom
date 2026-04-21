import logging
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from redis.asyncio import Redis

from app.db import get_db
from app.core.config import settings
from app.models import User, Lesson, Module, Course
from app.api.deps import get_current_user
from app.services.video_service import VideoService
from app.services.entitlement_service import EntitlementService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["Video"])


class VideoAccessRequest(BaseModel):
    lesson_id: UUID
    child_profile_id: UUID | None = None


class VideoAccessResponse(BaseModel):
    token: str
    youtube_id: str
    embed_url: str
    expires_at: int
    watermark_text: str


class HeartbeatRequest(BaseModel):
    lesson_id: UUID
    session_id: str
    position_seconds: int
    token: str


@router.post("/access", response_model=VideoAccessResponse)
async def get_video_access(
    data: VideoAccessRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a signed video access token for a specific lesson.
    Requires course_access entitlement (or lesson.is_free).
    """
    # Get lesson with video
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.video))
        .where(Lesson.id == data.lesson_id)
    )
    lesson = result.scalar_one_or_none()

    if not lesson or not lesson.video:
        raise HTTPException(status_code=404, detail="Video lesson not found")

    # Check access: free lessons are open, paid require entitlement
    if not lesson.is_free:
        module = await db.get(Module, lesson.module_id)
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")

        course = await db.get(Course, module.course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        has_access = await EntitlementService.has_course_access(
            user_id=user.id,
            product_id=course.product_id,
            child_profile_id=data.child_profile_id,
            db=db,
        )

        if not has_access and not module.is_free:
            raise HTTPException(
                status_code=403,
                detail="Purchase required to access this lesson",
            )

    # Generate signed embed URL
    session_id = secrets.token_urlsafe(16)
    signed = VideoService.generate_signed_embed(
        youtube_id=lesson.video.youtube_id,
        user_id=str(user.id),
        session_id=session_id,
    )

    return VideoAccessResponse(**signed)


@router.post("/heartbeat")
async def video_heartbeat(
    data: HeartbeatRequest,
    user: User = Depends(get_current_user),
):
    """
    Playback heartbeat — sent every 30s during video watching.
    Tracks position and detects concurrent sessions.
    """
    try:
        redis = Redis.from_url(settings.REDIS_URL)
        try:
            return await VideoService.record_heartbeat(
                user_id=str(user.id),
                lesson_id=str(data.lesson_id),
                session_id=data.session_id,
                position_seconds=data.position_seconds,
                redis=redis,
            )
        finally:
            await redis.aclose()
    except Exception:
        # Redis unavailable — heartbeat is non-critical
        logger.debug("Heartbeat skipped: Redis unavailable")
        return {"status": "ok", "concurrent": False}
