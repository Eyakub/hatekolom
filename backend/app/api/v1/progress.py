from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import (
    User, ChildProfile, Course, Module, Lesson, Enrollment,
    Entitlement, EntitlementType,
)
from app.api.deps import get_current_user
from app.services.progress_service import ProgressService
from app.services.entitlement_service import EntitlementService
from app.models.exam import ProductExam, Exam

router = APIRouter(prefix="/progress", tags=["Progress"])


class UpdateProgressRequest(BaseModel):
    child_profile_id: UUID
    course_id: UUID
    lesson_id: UUID
    watch_seconds: int = 0
    is_completed: bool = False
    last_position: int = 0


# ============================================
# COURSE CONTENT PLAYER — per child
# ============================================

@router.get("/children/{child_id}/courses/{course_id}")
async def get_course_content_with_progress(
    child_id: UUID,
    course_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get course content (modules + lessons) with per-lesson progress for a child.
    This powers the accordion course player UI.

    Returns modules → lessons with:
    - lesson_type (video_lecture, smart_note, assignment)
    - is_locked (based on entitlement)
    - is_completed
    - watch_seconds / last_position
    """
    # Verify child belongs to parent
    child_result = await db.execute(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == user.id,
        )
    )
    child = child_result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    # Get course with full content tree
    course_result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.product),
            selectinload(Course.modules)
            .selectinload(Module.lessons)
            .selectinload(Lesson.video),
        )
        .where(Course.id == course_id)
    )
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check entitlement (child-level, then parent-level fallback)
    has_access = await EntitlementService.has_course_access(
        user_id=user.id,
        product_id=course.product_id,
        child_profile_id=child_id,
        db=db,
    )

    # Get or auto-create enrollment (for progress tracking)
    enrollment_result = await db.execute(
        select(Enrollment).where(
            Enrollment.child_profile_id == child_id,
            Enrollment.course_id == course_id,
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()

    # Auto-create enrollment if child has access but no enrollment yet
    if has_access and not enrollment:
        enrollment = Enrollment(
            child_profile_id=child_id,
            course_id=course_id,
        )
        db.add(enrollment)
        await db.flush()

    # Get progress data if enrolled
    progress_map = {}
    if enrollment:
        progress_data = await ProgressService.get_course_progress(
            child_id, course_id, db
        )
        for lp in progress_data.get("lessons", []):
            progress_map[lp["lesson_id"]] = lp

    # Build response with sequential lock status
    # Track whether the previous lesson (across modules) was completed
    prev_completed = True  # First lesson is always unlocked
    modules_data = []
    for module in sorted(course.modules, key=lambda m: m.sort_order):
        lessons_data = []
        for lesson in sorted(module.lessons, key=lambda l: l.sort_order):
            lesson_id_str = str(lesson.id)
            progress = progress_map.get(lesson_id_str, {})
            is_completed = progress.get("is_completed", False)

            # Lock logic:
            # 1. Free preview → always unlocked
            # 2. No access → locked (paywall)
            # 3. Has access → sequential: locked until previous lesson completed
            if lesson.is_free or module.is_free:
                is_locked = False
            elif not has_access:
                is_locked = True
            else:
                is_locked = not prev_completed

            lessons_data.append({
                "id": lesson_id_str,
                "title": lesson.title,
                "title_bn": lesson.title_bn,
                "lesson_type": lesson.lesson_type.value if hasattr(lesson.lesson_type, "value") else lesson.lesson_type,
                "sort_order": lesson.sort_order,
                "duration_seconds": lesson.duration_seconds,
                "is_free": lesson.is_free,
                "is_locked": is_locked,
                "is_completed": is_completed,
                "watch_seconds": progress.get("watch_seconds", 0),
                "last_position": progress.get("last_position", 0),
                "has_video": lesson.video is not None,
                "content": lesson.content if not is_locked else None,
                "content_bn": lesson.content_bn if not is_locked else None,
                "allow_submission": lesson.allow_submission,
                "max_grade": lesson.max_grade,
            })

            # Update sequential tracker (only for enrolled users)
            if has_access:
                prev_completed = is_completed

        modules_data.append({
            "id": str(module.id),
            "title": module.title,
            "title_bn": module.title_bn,
            "sort_order": module.sort_order,
            "is_free": module.is_free,
            "lessons": lessons_data,
            "total_lessons": len(lessons_data),
            "completed_lessons": sum(1 for l in lessons_data if l["is_completed"]),
        })

    # Check if course has attached exams
    exam_links = await db.execute(
        select(ProductExam).where(ProductExam.product_id == course.product_id)
    )
    links = exam_links.scalars().all()
    attached_exams = []
    if links:
        exam_ids = [link.exam_id for link in links]
        exams_result = await db.execute(
            select(Exam)
            .options(selectinload(Exam.product))
            .where(Exam.id.in_(exam_ids))
        )
        exams = exams_result.scalars().all()

        # Check if student has exam access for each
        for e in exams:
            ent = await db.execute(
                select(Entitlement).where(
                    or_(
                        Entitlement.child_profile_id == child_id,
                        Entitlement.user_id == user.id,
                    ),
                    Entitlement.product_id == e.product_id,
                    Entitlement.is_active == True,
                )
            )
            exam_has_access = ent.scalars().first() is not None
            # Also check course-level entitlement (ProductExam passthrough)
            if not exam_has_access:
                course_ent = await db.execute(
                    select(Entitlement).where(
                        or_(
                            Entitlement.child_profile_id == child_id,
                            Entitlement.user_id == user.id,
                        ),
                        Entitlement.product_id == course.product_id,
                        Entitlement.is_active == True,
                    )
                )
                exam_has_access = course_ent.scalars().first() is not None

            attached_exams.append({
                "exam_id": str(e.id),
                "product_id": str(e.product_id),
                "title": e.product.title,
                "title_bn": e.product.title_bn,
                "slug": e.product.slug,
                "price": float(e.product.price),
                "is_free": e.product.is_free,
                "has_access": exam_has_access,
            })

    return {
        "course": {
            "id": str(course.id),
            "title": course.product.title,
            "title_bn": course.product.title_bn,
            "thumbnail_url": course.product.thumbnail_url,
            "total_lessons": course.total_lessons,
            "course_type": course.course_type.value if hasattr(course.course_type, "value") else course.course_type,
            "has_exam": len(attached_exams) > 0,
            "attached_exams": attached_exams,
        },
        "enrollment": {
            "enrolled": enrollment is not None,
            "has_access": has_access,
            "progress_pct": float(enrollment.progress_pct) if enrollment else 0,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment and enrollment.enrolled_at else None,
            "completed_at": enrollment.completed_at.isoformat() if enrollment and enrollment.completed_at else None,
        },
        "modules": modules_data,
    }


@router.post("/update")
async def update_progress(
    data: UpdateProgressRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update lesson progress (called when watching video, completing assignment, etc.)."""
    # Verify child belongs to parent
    child_result = await db.execute(
        select(ChildProfile).where(
            ChildProfile.id == data.child_profile_id,
            ChildProfile.parent_id == user.id,
        )
    )
    if not child_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Child not found")

    progress = await ProgressService.update_lesson_progress(
        child_profile_id=data.child_profile_id,
        course_id=data.course_id,
        lesson_id=data.lesson_id,
        watch_seconds=data.watch_seconds,
        is_completed=data.is_completed,
        last_position=data.last_position,
        db=db,
    )

    return {
        "lesson_id": str(data.lesson_id),
        "is_completed": progress.is_completed,
        "watch_seconds": progress.watch_seconds,
        "last_position": progress.last_position,
    }


@router.get("/children/{child_id}/enrollments")
async def list_child_enrollments(
    child_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all purchased courses for a child (entitlement-driven)."""
    # Verify child belongs to parent
    child_result = await db.execute(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == user.id,
        )
    )
    if not child_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Child not found")

    # Query entitlements for COURSE_ACCESS — only explicitly assigned to this child
    from app.models import Product, ProductType
    ent_result = await db.execute(
        select(Entitlement)
        .options(selectinload(Entitlement.product))
        .where(
            Entitlement.child_profile_id == child_id,
            Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
            Entitlement.is_active == True,
        )
        .order_by(Entitlement.granted_at.desc())
    )
    entitlements = ent_result.scalars().all()

    # For each entitlement, find the course and any enrollment progress
    items = []
    for ent in entitlements:
        product = ent.product
        if not product:
            continue

        # Find the course for this product
        course_result = await db.execute(
            select(Course).where(Course.product_id == product.id)
        )
        course = course_result.scalar_one_or_none()
        if not course:
            continue

        # Check for enrollment (progress tracking)
        enrollment_result = await db.execute(
            select(Enrollment).where(
                Enrollment.child_profile_id == child_id,
                Enrollment.course_id == course.id,
            )
        )
        enrollment = enrollment_result.scalar_one_or_none()

        items.append({
            "enrollment_id": str(enrollment.id) if enrollment else str(ent.id),
            "course_id": str(course.id),
            "course_title": product.title or "",
            "course_title_bn": product.title_bn,
            "course_thumbnail": product.thumbnail_url,
            "course_type": course.course_type.value if hasattr(course.course_type, "value") else "",
            "total_lessons": course.total_lessons,
            "progress_pct": float(enrollment.progress_pct) if enrollment else 0.0,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment and enrollment.enrolled_at else ent.granted_at.isoformat() if ent.granted_at else None,
            "completed_at": enrollment.completed_at.isoformat() if enrollment and enrollment.completed_at else None,
        })

    return {
        "enrollments": items,
        "total": len(items),
    }
