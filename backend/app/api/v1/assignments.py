"""Assignment submission endpoints — student submit + admin grade."""

from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models import (
    User, ChildProfile, Lesson, AssignmentSubmission, SubmissionStatus,
)
from app.api.deps import get_current_user
from app.services.assignment_service import AssignmentService

router = APIRouter(prefix="/assignments", tags=["Assignments"])


# ── Schemas ──────────────────────────────────────────

class SubmitRequest(BaseModel):
    child_profile_id: UUID
    answer_text: str | None = None
    file_urls: list[str] | None = None


class GradeRequest(BaseModel):
    grade: int
    feedback: str | None = None


class SubmissionResponse(BaseModel):
    id: str
    lesson_id: str
    child_profile_id: str
    answer_text: str | None
    file_urls: list
    status: str
    grade: int | None
    feedback: str | None
    max_grade: int
    submitted_at: str | None
    graded_at: str | None

    @classmethod
    def from_model(cls, sub: AssignmentSubmission, max_grade: int = 10):
        return cls(
            id=str(sub.id),
            lesson_id=str(sub.lesson_id),
            child_profile_id=str(sub.child_profile_id),
            answer_text=sub.answer_text,
            file_urls=sub.file_urls or [],
            status=sub.status.value if hasattr(sub.status, "value") else sub.status,
            grade=sub.grade,
            feedback=sub.feedback,
            max_grade=max_grade,
            submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
            graded_at=sub.graded_at.isoformat() if sub.graded_at else None,
        )


# ── Student Endpoints ────────────────────────────────

@router.get("/{lesson_id}/my-submission")
async def get_my_submission(
    lesson_id: UUID,
    child_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get student's submission for a lesson."""
    child = await _verify_child(child_id, user.id, db)

    lesson = await db.get(Lesson, lesson_id)
    if not lesson or not lesson.allow_submission:
        raise HTTPException(status_code=404, detail="Assignment not found")

    submission = await AssignmentService.get_submission(lesson_id, child_id, db)

    if not submission:
        return {"submission": None, "max_grade": lesson.max_grade}

    return {
        "submission": SubmissionResponse.from_model(submission, lesson.max_grade),
        "max_grade": lesson.max_grade,
    }


@router.post("/{lesson_id}/submit")
async def submit_assignment(
    lesson_id: UUID,
    data: SubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an assignment answer. Cannot resubmit once submitted."""
    child = await _verify_child(data.child_profile_id, user.id, db)

    lesson = await db.get(Lesson, lesson_id)
    if not lesson or not lesson.allow_submission:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Check if already submitted (no resubmission allowed)
    existing = await AssignmentService.get_submission(lesson_id, data.child_profile_id, db)
    if existing and existing.status in (SubmissionStatus.SUBMITTED, SubmissionStatus.GRADED):
        raise HTTPException(status_code=400, detail="Already submitted — resubmission is not allowed")

    if not data.answer_text and not data.file_urls:
        raise HTTPException(status_code=400, detail="Answer text or file required")

    if data.file_urls and not getattr(lesson, "allow_image_upload", False):
        raise HTTPException(status_code=400, detail="Image upload is not allowed for this assignment")

    submission = await AssignmentService.submit(
        lesson_id=lesson_id,
        child_profile_id=data.child_profile_id,
        answer_text=data.answer_text,
        file_urls=data.file_urls,
        db=db,
    )
    await db.commit()

    return {
        "submission": SubmissionResponse.from_model(submission, lesson.max_grade),
    }


# ── Admin/Instructor Endpoints ──────────────────────

@router.get("/{lesson_id}/submissions")
async def list_submissions(
    lesson_id: UUID,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all submissions for a lesson (admin/instructor)."""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    status_filter = SubmissionStatus(status) if status else None
    submissions = await AssignmentService.list_submissions(
        lesson_id, status_filter, db
    )

    return {
        "submissions": [
            {
                **SubmissionResponse.from_model(s, lesson.max_grade).model_dump(),
                "child_name": s.child_profile.full_name if s.child_profile else None,
            }
            for s in submissions
        ],
        "total": len(submissions),
        "max_grade": lesson.max_grade,
    }


@router.post("/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: UUID,
    data: GradeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grade a student's submission."""
    submission = await db.get(AssignmentSubmission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    lesson = await db.get(Lesson, submission.lesson_id)
    if data.grade < 0 or data.grade > (lesson.max_grade if lesson else 10):
        raise HTTPException(
            status_code=400,
            detail=f"Grade must be between 0 and {lesson.max_grade if lesson else 10}",
        )

    submission = await AssignmentService.grade_submission(
        submission_id=submission_id,
        grade=data.grade,
        feedback=data.feedback,
        grader_id=user.id,
        db=db,
    )
    await db.commit()

    return {
        "submission": SubmissionResponse.from_model(
            submission, lesson.max_grade if lesson else 10
        ),
    }


# ── Helpers ──────────────────────────────────────────

async def _verify_child(
    child_id: UUID, parent_id: UUID, db: AsyncSession,
) -> ChildProfile:
    """Verify child belongs to parent."""
    result = await db.execute(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == parent_id,
        )
    )
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    return child

