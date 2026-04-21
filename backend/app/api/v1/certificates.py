"""
Certificate API — Generate, download, and verify certificates.
"""

import logging
import uuid as uuid_mod
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.db import get_db
from app.models import User, Course, Enrollment, LessonProgress, Module, Lesson
from app.models.certificate import Certificate
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/certificates", tags=["Certificates"])


def _generate_cert_number() -> str:
    """Generate unique certificate number like CERT-2026-XXXX."""
    year = datetime.now(timezone.utc).year
    short_id = uuid_mod.uuid4().hex[:8].upper()
    return f"CERT-{year}-{short_id}"


from pydantic import BaseModel

class GenerateCertRequest(BaseModel):
    child_profile_id: UUID

@router.post("/generate/{course_id}")
async def generate_certificate(
    course_id: UUID,
    request: GenerateCertRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a certificate for a completed course.
    
    Requirements:
    - Child must be enrolled
    - All lessons must be completed (100% progress)
    """
    from app.models import ChildProfile

    # Verify child belongs to parent
    child_result = await db.execute(
        select(ChildProfile).where(
            ChildProfile.id == request.child_profile_id,
            ChildProfile.parent_id == user.id,
        )
    )
    child = child_result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    student_name = child.full_name_bn or child.full_name or "Student"

    # Check if already has certificate for THIS child
    existing = await db.execute(
        select(Certificate).where(
            Certificate.user_id == user.id,
            Certificate.course_id == course_id,
            Certificate.student_name == student_name,
        )
    )
    if existing_cert := existing.scalar_one_or_none():
        return {
            "id": str(existing_cert.id),
            "certificate_number": existing_cert.certificate_number,
            "student_name": existing_cert.student_name,
            "course_title": existing_cert.course_title,
            "issued_at": str(existing_cert.issued_at),
        }

    # Check enrollment
    enrollment = await db.execute(
        select(Enrollment).where(
            Enrollment.child_profile_id == child.id,
            Enrollment.course_id == course_id,
        )
    )
    enroll = enrollment.scalar_one_or_none()
    if not enroll:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")

    # Check completion — count total lessons vs completed
    total_result = await db.execute(
        select(func.count(Lesson.id))
        .join(Module)
        .where(Module.course_id == course_id)
    )
    total_lessons = total_result.scalar() or 0

    if total_lessons == 0:
        raise HTTPException(status_code=400, detail="Course has no lessons")

    completed_result = await db.execute(
        select(func.count(LessonProgress.id))
        .where(
            LessonProgress.enrollment_id == enroll.id,
            LessonProgress.is_completed == True,
        )
    )
    completed_lessons = completed_result.scalar() or 0

    if completed_lessons < total_lessons:
        raise HTTPException(
            status_code=400,
            detail=f"Course not fully completed ({completed_lessons}/{total_lessons} lessons done)",
        )

    # Get course info
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Get product title
    from app.models import Product
    product = await db.get(Product, course.product_id)
    course_title = product.title_bn or product.title if product else "Unknown Course"

    # Generate certificate
    cert = Certificate(
        user_id=user.id,
        course_id=course_id,
        certificate_number=_generate_cert_number(),
        student_name=student_name,
        course_title=course_title,
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)

    return {
        "id": str(cert.id),
        "certificate_number": cert.certificate_number,
        "student_name": cert.student_name,
        "course_title": cert.course_title,
        "issued_at": str(cert.issued_at),
    }


@router.get("/my")
async def get_my_certificates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all certificates for the current user."""
    result = await db.execute(
        select(Certificate)
        .where(Certificate.user_id == user.id)
        .order_by(Certificate.issued_at.desc())
    )
    certs = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "certificate_number": c.certificate_number,
            "student_name": c.student_name,
            "course_title": c.course_title,
            "issued_at": str(c.issued_at),
            "course_id": str(c.course_id),
        }
        for c in certs
    ]


@router.get("/verify/{cert_number}")
async def verify_certificate(
    cert_number: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — verify a certificate by its number.
    
    No auth required. Anyone with the certificate number can verify.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.certificate_number == cert_number)
    )
    cert = result.scalar_one_or_none()

    if not cert:
        return {
            "valid": False,
            "message": "Certificate not found",
        }

    return {
        "valid": True,
        "certificate_number": cert.certificate_number,
        "student_name": cert.student_name,
        "course_title": cert.course_title,
        "issued_at": str(cert.issued_at),
    }
