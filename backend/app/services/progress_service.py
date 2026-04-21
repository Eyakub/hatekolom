"""
Progress Tracking Service — per-child lesson progress and course completion.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import Enrollment, LessonProgress, Lesson, Module, Course
from app.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)


class ProgressService:

    @staticmethod
    async def get_or_create_enrollment(
        child_profile_id: UUID,
        course_id: UUID,
        db: AsyncSession,
    ) -> Enrollment:
        """Get existing enrollment or raise if not enrolled."""
        result = await db.execute(
            select(Enrollment).where(
                Enrollment.child_profile_id == child_profile_id,
                Enrollment.course_id == course_id,
            )
        )
        enrollment = result.scalar_one_or_none()
        if not enrollment:
            raise NotFoundError("Enrollment")
        return enrollment

    @staticmethod
    async def update_lesson_progress(
        child_profile_id: UUID,
        course_id: UUID,
        lesson_id: UUID,
        watch_seconds: int = 0,
        is_completed: bool = False,
        last_position: int = 0,
        db: AsyncSession = None,
    ) -> LessonProgress:
        """Update or create progress for a specific lesson."""
        enrollment = await ProgressService.get_or_create_enrollment(
            child_profile_id, course_id, db
        )

        # Get or create lesson progress
        result = await db.execute(
            select(LessonProgress).where(
                LessonProgress.enrollment_id == enrollment.id,
                LessonProgress.lesson_id == lesson_id,
            )
        )
        progress = result.scalar_one_or_none()

        if progress:
            progress.watch_seconds = max(progress.watch_seconds, watch_seconds)
            progress.last_position = last_position
            if is_completed and not progress.is_completed:
                progress.is_completed = True
                progress.completed_at = datetime.now(timezone.utc)
        else:
            progress = LessonProgress(
                enrollment_id=enrollment.id,
                lesson_id=lesson_id,
                watch_seconds=watch_seconds,
                is_completed=is_completed,
                last_position=last_position,
                completed_at=datetime.now(timezone.utc) if is_completed else None,
            )
            db.add(progress)

        await db.flush()

        # Recalculate course progress percentage
        await ProgressService._recalculate_course_progress(enrollment, db)

        await db.commit()
        return progress

    @staticmethod
    async def _recalculate_course_progress(
        enrollment: Enrollment,
        db: AsyncSession,
    ):
        """Recalculate overall course completion percentage."""
        # Total lessons in course
        total_result = await db.execute(
            select(func.count()).select_from(Lesson)
            .join(Module)
            .where(Module.course_id == enrollment.course_id)
        )
        total_lessons = total_result.scalar() or 0

        if total_lessons == 0:
            enrollment.progress_pct = Decimal("0")
            return

        # Completed lessons
        completed_result = await db.execute(
            select(func.count()).select_from(LessonProgress)
            .where(
                LessonProgress.enrollment_id == enrollment.id,
                LessonProgress.is_completed == True,
            )
        )
        completed_lessons = completed_result.scalar() or 0

        enrollment.progress_pct = Decimal(str(
            round((completed_lessons / total_lessons) * 100, 2)
        ))

        # Check if course is complete
        if completed_lessons >= total_lessons:
            enrollment.completed_at = datetime.now(timezone.utc)

    @staticmethod
    async def get_course_progress(
        child_profile_id: UUID,
        course_id: UUID,
        db: AsyncSession,
    ) -> dict:
        """Get full progress for a course including per-lesson status."""
        enrollment = await ProgressService.get_or_create_enrollment(
            child_profile_id, course_id, db
        )

        # Get all lessons with progress
        result = await db.execute(
            select(Lesson, LessonProgress)
            .join(Module, Lesson.module_id == Module.id)
            .outerjoin(
                LessonProgress,
                (LessonProgress.lesson_id == Lesson.id) &
                (LessonProgress.enrollment_id == enrollment.id),
            )
            .where(Module.course_id == course_id)
            .order_by(Module.sort_order, Lesson.sort_order)
        )
        rows = result.all()

        lessons_progress = []
        for lesson, progress in rows:
            lessons_progress.append({
                "lesson_id": str(lesson.id),
                "module_id": str(lesson.module_id),
                "title": lesson.title,
                "title_bn": lesson.title_bn,
                "lesson_type": lesson.lesson_type.value if hasattr(lesson.lesson_type, "value") else lesson.lesson_type,
                "sort_order": lesson.sort_order,
                "is_free": lesson.is_free,
                "is_completed": progress.is_completed if progress else False,
                "watch_seconds": progress.watch_seconds if progress else 0,
                "last_position": progress.last_position if progress else 0,
            })

        return {
            "enrollment_id": str(enrollment.id),
            "course_id": str(course_id),
            "child_profile_id": str(child_profile_id),
            "progress_pct": float(enrollment.progress_pct),
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
            "lessons": lessons_progress,
        }
