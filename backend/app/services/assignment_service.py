"""
Assignment Service — Handles submission CRUD, grading, and auto-completion.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import (
    AssignmentSubmission, SubmissionStatus, Lesson, LessonProgress,
    Enrollment, Module,
)

logger = logging.getLogger(__name__)


class AssignmentService:

    @staticmethod
    async def get_submission(
        lesson_id: UUID,
        child_profile_id: UUID,
        db: AsyncSession,
    ) -> AssignmentSubmission | None:
        """Get a child's submission for a lesson."""
        result = await db.execute(
            select(AssignmentSubmission).where(
                AssignmentSubmission.lesson_id == lesson_id,
                AssignmentSubmission.child_profile_id == child_profile_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def submit(
        lesson_id: UUID,
        child_profile_id: UUID,
        answer_text: str | None,
        file_urls: list[str] | None,
        db: AsyncSession,
    ) -> AssignmentSubmission:
        """Create or update a submission."""
        submission = await AssignmentService.get_submission(
            lesson_id, child_profile_id, db
        )

        if submission:
            # Update existing
            submission.answer_text = answer_text
            if file_urls is not None:
                submission.file_urls = file_urls
            submission.status = SubmissionStatus.SUBMITTED.value
            submission.submitted_at = datetime.now(timezone.utc)
        else:
            # Create new
            submission = AssignmentSubmission(
                lesson_id=lesson_id,
                child_profile_id=child_profile_id,
                answer_text=answer_text,
                file_urls=file_urls or [],
                status=SubmissionStatus.SUBMITTED,
                submitted_at=datetime.now(timezone.utc),
            )
            db.add(submission)

        await db.flush()
        logger.info(
            f"Submission {'updated' if submission.updated_at else 'created'} "
            f"for lesson {lesson_id}, child {child_profile_id}"
        )
        return submission

    @staticmethod
    async def grade_submission(
        submission_id: UUID,
        grade: int,
        feedback: str | None,
        grader_id: UUID,
        db: AsyncSession,
    ) -> AssignmentSubmission:
        """Grade a submission and auto-complete the lesson."""
        submission = await db.get(AssignmentSubmission, submission_id)
        if not submission:
            raise ValueError("Submission not found")

        submission.grade = grade
        submission.feedback = feedback
        submission.status = SubmissionStatus.GRADED.value
        submission.graded_by = grader_id
        submission.graded_at = datetime.now(timezone.utc)

        # Auto-complete the lesson for this child
        await AssignmentService._auto_complete_lesson(
            lesson_id=submission.lesson_id,
            child_profile_id=submission.child_profile_id,
            db=db,
        )

        await db.flush()
        logger.info(
            f"Submission {submission_id} graded: {grade}, "
            f"lesson auto-completed"
        )
        return submission

    @staticmethod
    async def list_submissions(
        lesson_id: UUID,
        status_filter: SubmissionStatus | None,
        db: AsyncSession,
    ) -> list[AssignmentSubmission]:
        """List all submissions for a lesson (admin view)."""
        query = (
            select(AssignmentSubmission)
            .where(AssignmentSubmission.lesson_id == lesson_id)
            .order_by(AssignmentSubmission.submitted_at.desc())
        )
        if status_filter:
            query = query.where(AssignmentSubmission.status == status_filter)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def _auto_complete_lesson(
        lesson_id: UUID,
        child_profile_id: UUID,
        db: AsyncSession,
    ) -> None:
        """Mark lesson as completed when assignment is graded."""
        from app.services.progress_service import ProgressService

        # Get the course_id from lesson -> module -> course
        lesson = await db.get(Lesson, lesson_id)
        if not lesson:
            return

        module = await db.get(Module, lesson.module_id)
        if not module:
            return

        await ProgressService.update_lesson_progress(
            child_profile_id=child_profile_id,
            course_id=module.course_id,
            lesson_id=lesson_id,
            watch_seconds=0,
            is_completed=True,
            last_position=0,
            db=db,
        )
