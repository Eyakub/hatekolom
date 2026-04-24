"""
Exam API — Admin CRUD + Student start/submit/grade + public listing.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional

from app.db import get_db
from app.models import User, Product, ProductType, OrderItem, Order, Payment, PaymentStatus
from app.models.exam import (
    Exam, ExamSection, ExamQuestion, ExamOption, ExamAttempt, ProductExam,
)
from app.models.entitlement import Entitlement
from app.models.enums import EntitlementType
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from slugify import slugify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exams", tags=["Exams"])


# ---- Schemas ----

class OptionSchema(BaseModel):
    option_text: Optional[str] = None
    option_text_bn: Optional[str] = None
    image_url: Optional[str] = None
    is_correct: bool = False
    sort_order: int = 0


class QuestionSchema(BaseModel):
    question_text: Optional[str] = None
    question_text_bn: Optional[str] = None
    image_url: Optional[str] = None
    question_type: str = "mcq"
    sort_order: int = 0
    points: int = 1
    options: list[OptionSchema] = []


class SectionSchema(BaseModel):
    title: str
    title_bn: Optional[str] = None
    sort_order: int = 0
    time_limit_seconds: Optional[int] = None
    questions: list[QuestionSchema] = []


class ExamCreateRequest(BaseModel):
    title: str
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal = Decimal("0")
    compare_price: Optional[Decimal] = None
    is_free: bool = False
    exam_type: str = "anytime"
    pass_percentage: int = 60
    max_attempts: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    sections: list[SectionSchema] = []


class ExamUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    is_free: Optional[bool] = None
    is_active: Optional[bool] = None
    exam_type: Optional[str] = None
    pass_percentage: Optional[int] = None
    max_attempts: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None


class SubmitAnswer(BaseModel):
    question_id: str
    selected_option_id: str


class ExamSubmitRequest(BaseModel):
    child_profile_id: str
    answers: list[SubmitAnswer]


# ---- Helper ----

async def _get_exam_response(exam_id: UUID, db: AsyncSession, admin: bool = False):
    """Serialize exam with sections/questions/options. If admin=False, omit is_correct."""
    result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.product),
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.options),
        )
        .where(Exam.id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    product = exam.product
    return {
        "id": str(exam.id),
        "product_id": str(exam.product_id),
        "title": product.title,
        "title_bn": product.title_bn,
        "slug": product.slug,
        "description": product.description,
        "description_bn": product.description_bn,
        "thumbnail_url": product.thumbnail_url,
        "price": str(product.price) if product.price is not None else "0",
        "compare_price": str(product.compare_price) if product.compare_price else None,
        "is_free": product.is_free,
        "is_active": product.is_active,
        "exam_type": exam.exam_type,
        "pass_percentage": exam.pass_percentage,
        "max_attempts": exam.max_attempts,
        "time_limit_seconds": exam.time_limit_seconds,
        "scheduled_start": str(exam.scheduled_start) if exam.scheduled_start else None,
        "scheduled_end": str(exam.scheduled_end) if exam.scheduled_end else None,
        "total_sections": exam.total_sections,
        "total_questions": exam.total_questions,
        "created_at": str(exam.created_at) if exam.created_at else None,
        "sections": [
            {
                "id": str(s.id),
                "title": s.title,
                "title_bn": s.title_bn,
                "sort_order": s.sort_order,
                "time_limit_seconds": s.time_limit_seconds,
                "questions": [
                    {
                        "id": str(q.id),
                        "question_text": q.question_text,
                        "question_text_bn": q.question_text_bn,
                        "image_url": q.image_url,
                        "question_type": q.question_type,
                        "sort_order": q.sort_order,
                        "points": q.points,
                        "options": [
                            {
                                "id": str(o.id),
                                "option_text": o.option_text,
                                "option_text_bn": o.option_text_bn,
                                "image_url": o.image_url,
                                **({"is_correct": o.is_correct} if admin else {}),
                            }
                            for o in sorted(q.options, key=lambda x: x.sort_order)
                        ],
                    }
                    for q in sorted(s.questions, key=lambda x: x.sort_order)
                ],
            }
            for s in sorted(exam.sections, key=lambda x: x.sort_order)
        ],
    }


def _count_questions(sections: list[SectionSchema]) -> tuple[int, int]:
    """Return (total_sections, total_questions) from schema data."""
    total_q = sum(len(s.questions) for s in sections)
    return len(sections), total_q


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.post("/", status_code=201)
async def create_exam(
    data: ExamCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create an exam with product + sections + questions + options (admin)."""
    slug = data.slug or slugify(data.title)

    # Check slug uniqueness
    existing = await db.execute(select(Product).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' already exists")

    # Create product
    product = Product(
        product_type=ProductType.EXAM,
        title=data.title,
        title_bn=data.title_bn,
        slug=slug,
        description=data.description,
        description_bn=data.description_bn,
        thumbnail_url=data.thumbnail_url,
        price=data.price,
        compare_price=data.compare_price,
        is_free=data.is_free,
    )
    db.add(product)
    await db.flush()

    # Parse scheduled dates
    scheduled_start = None
    scheduled_end = None
    if data.scheduled_start:
        scheduled_start = datetime.fromisoformat(data.scheduled_start)
    if data.scheduled_end:
        scheduled_end = datetime.fromisoformat(data.scheduled_end)

    total_sections, total_questions = _count_questions(data.sections)

    # Create exam
    exam = Exam(
        product_id=product.id,
        exam_type=data.exam_type,
        pass_percentage=data.pass_percentage,
        max_attempts=data.max_attempts,
        time_limit_seconds=data.time_limit_seconds,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        total_sections=total_sections,
        total_questions=total_questions,
    )
    db.add(exam)
    await db.flush()

    # Create sections, questions, options
    for s_data in data.sections:
        section = ExamSection(
            exam_id=exam.id,
            title=s_data.title,
            title_bn=s_data.title_bn,
            sort_order=s_data.sort_order,
            time_limit_seconds=s_data.time_limit_seconds,
        )
        db.add(section)
        await db.flush()

        for q_data in s_data.questions:
            question = ExamQuestion(
                section_id=section.id,
                question_text=q_data.question_text,
                question_text_bn=q_data.question_text_bn,
                image_url=q_data.image_url,
                question_type=q_data.question_type,
                sort_order=q_data.sort_order,
                points=q_data.points,
            )
            db.add(question)
            await db.flush()

            for o_data in q_data.options:
                option = ExamOption(
                    question_id=question.id,
                    option_text=o_data.option_text,
                    option_text_bn=o_data.option_text_bn,
                    image_url=o_data.image_url,
                    is_correct=o_data.is_correct,
                    sort_order=o_data.sort_order,
                )
                db.add(option)

    await db.commit()
    return await _get_exam_response(exam.id, db, admin=True)


@router.put("/{exam_id}", status_code=200)
async def update_exam(
    exam_id: UUID,
    data: ExamUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update exam metadata + product fields (admin)."""
    result = await db.execute(
        select(Exam).options(selectinload(Exam.product)).where(Exam.id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    update_data = data.model_dump(exclude_unset=True)

    # Product-level fields
    product_fields = {
        "title", "title_bn", "slug", "description", "description_bn",
        "thumbnail_url", "price", "compare_price", "is_free", "is_active",
    }
    for field in product_fields:
        if field in update_data:
            setattr(exam.product, field, update_data.pop(field))

    # Exam-level fields
    for field, value in update_data.items():
        if field in ("scheduled_start", "scheduled_end") and value is not None:
            setattr(exam, field, datetime.fromisoformat(value))
        else:
            setattr(exam, field, value)

    await db.commit()
    return await _get_exam_response(exam.id, db, admin=True)


@router.get("/{exam_id}/admin")
async def get_exam_admin(
    exam_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Get full exam with correct answers (admin view)."""
    return await _get_exam_response(exam_id, db, admin=True)


@router.post("/{exam_id}/sections", status_code=201)
async def add_section(
    exam_id: UUID,
    data: SectionSchema,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a section with questions to an existing exam (admin)."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    section = ExamSection(
        exam_id=exam.id,
        title=data.title,
        title_bn=data.title_bn,
        sort_order=data.sort_order,
        time_limit_seconds=data.time_limit_seconds,
    )
    db.add(section)
    await db.flush()

    for q_data in data.questions:
        question = ExamQuestion(
            section_id=section.id,
            question_text=q_data.question_text,
            question_text_bn=q_data.question_text_bn,
            image_url=q_data.image_url,
            question_type=q_data.question_type,
            sort_order=q_data.sort_order,
            points=q_data.points,
        )
        db.add(question)
        await db.flush()

        for o_data in q_data.options:
            option = ExamOption(
                question_id=question.id,
                option_text=o_data.option_text,
                option_text_bn=o_data.option_text_bn,
                image_url=o_data.image_url,
                is_correct=o_data.is_correct,
                sort_order=o_data.sort_order,
            )
            db.add(option)

    # Update exam totals
    exam.total_sections = (exam.total_sections or 0) + 1
    exam.total_questions = (exam.total_questions or 0) + len(data.questions)

    await db.commit()
    return await _get_exam_response(exam.id, db, admin=True)


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(
    section_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete an exam section (admin)."""
    result = await db.execute(
        select(ExamSection)
        .options(selectinload(ExamSection.questions))
        .where(ExamSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Update exam totals
    exam = await db.get(Exam, section.exam_id)
    if exam:
        exam.total_sections = max((exam.total_sections or 0) - 1, 0)
        exam.total_questions = max(
            (exam.total_questions or 0) - len(section.questions), 0
        )

    await db.delete(section)
    await db.commit()


@router.post("/{exam_id}/attach/{product_id}", status_code=201)
async def attach_exam_to_product(
    exam_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Attach an exam to another product (ProductExam link)."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already attached
    existing = await db.execute(
        select(ProductExam).where(
            ProductExam.exam_id == exam_id,
            ProductExam.product_id == product_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Exam already attached to this product")

    link = ProductExam(exam_id=exam_id, product_id=product_id)
    db.add(link)
    await db.commit()

    return {"message": "Exam attached to product", "exam_id": str(exam_id), "product_id": str(product_id)}


@router.delete("/{exam_id}/attach/{product_id}", status_code=204)
async def detach_exam_from_product(
    exam_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Detach an exam from a product."""
    result = await db.execute(
        select(ProductExam).where(
            ProductExam.exam_id == exam_id,
            ProductExam.product_id == product_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await db.delete(link)
    await db.commit()


@router.get("/product/{product_id}/attached")
async def get_attached_exams(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all exams attached to a product (public)."""
    result = await db.execute(
        select(ProductExam)
        .where(ProductExam.product_id == product_id)
    )
    links = result.scalars().all()
    if not links:
        return []

    exam_ids = [link.exam_id for link in links]
    exams_result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.product))
        .where(Exam.id.in_(exam_ids))
    )
    exams = exams_result.scalars().all()

    return [
        {
            "id": str(link.id),
            "exam_id": str(e.id),
            "product_id": str(e.product_id),
            "title": e.product.title,
            "title_bn": e.product.title_bn,
            "slug": e.product.slug,
            "thumbnail_url": e.product.thumbnail_url,
            "price": float(e.product.price),
            "is_free": e.product.is_free,
            "exam_type": e.exam_type,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "time_limit_seconds": e.time_limit_seconds,
        }
        for link in links
        for e in exams
        if e.id == link.exam_id
    ]


@router.get("/{exam_id}/attached-products")
async def get_attached_products(
    exam_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Get all products attached to a specific exam (admin)."""
    result = await db.execute(
        select(ProductExam).where(ProductExam.exam_id == exam_id)
    )
    links = result.scalars().all()
    if not links:
        return []

    product_ids = [link.product_id for link in links]
    products_result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = products_result.scalars().all()

    return [
        {
            "id": str(p.id),
            "title": p.title,
            "title_bn": p.title_bn,
            "slug": p.slug,
            "thumbnail_url": p.thumbnail_url,
        }
        for p in products
    ]


@router.post("/sections/{section_id}/questions", status_code=201)
async def add_question_to_section(
    section_id: UUID,
    data: QuestionSchema,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a single question to an existing section (admin)."""
    result = await db.execute(
        select(ExamSection).where(ExamSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    question = ExamQuestion(
        section_id=section.id,
        question_text=data.question_text,
        question_text_bn=data.question_text_bn,
        image_url=data.image_url,
        question_type=data.question_type,
        sort_order=data.sort_order,
        points=data.points,
    )
    db.add(question)
    await db.flush()

    for o_data in data.options:
        option = ExamOption(
            question_id=question.id,
            option_text=o_data.option_text,
            option_text_bn=o_data.option_text_bn,
            image_url=o_data.image_url,
            is_correct=o_data.is_correct,
            sort_order=o_data.sort_order,
        )
        db.add(option)

    # Update exam totals
    exam = await db.get(Exam, section.exam_id)
    if exam:
        exam.total_questions = (exam.total_questions or 0) + 1

    await db.commit()
    return await _get_exam_response(section.exam_id, db, admin=True)


@router.put("/questions/{question_id}")
async def update_question(
    question_id: UUID,
    data: QuestionSchema,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a question and replace its options (admin)."""
    question = await db.get(ExamQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    question.question_text = data.question_text
    question.question_text_bn = data.question_text_bn
    question.points = data.points
    question.sort_order = data.sort_order
    question.image_url = data.image_url

    # Delete existing options and recreate
    await db.execute(ExamOption.__table__.delete().where(ExamOption.question_id == question_id))
    await db.flush()

    for o_data in data.options:
        option = ExamOption(
            question_id=question.id,
            option_text=o_data.option_text,
            option_text_bn=o_data.option_text_bn,
            image_url=o_data.image_url,
            is_correct=o_data.is_correct,
            sort_order=o_data.sort_order,
        )
        db.add(option)

    await db.commit()
    return {"message": "Question updated"}


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(
    question_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete an exam question (admin)."""
    question = await db.get(ExamQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(question)
    await db.commit()


@router.get("/{exam_id}/attempts")
async def list_exam_attempts(
    exam_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """View all attempts for an exam (admin)."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    from app.models.child import ChildProfile

    result = await db.execute(
        select(ExamAttempt)
        .options(
            selectinload(ExamAttempt.user),
            selectinload(ExamAttempt.child),
        )
        .where(ExamAttempt.exam_id == exam_id)
        .order_by(ExamAttempt.completed_at.desc())
    )
    attempts = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "exam_id": str(a.exam_id),
            "user_id": str(a.user_id),
            "child_profile_id": str(a.child_profile_id),
            "guardian_name": a.user.full_name if a.user else None,
            "child_name": a.child.full_name if a.child else None,
            "child_name_bn": a.child.full_name_bn if a.child else None,
            "score": str(a.score) if a.score is not None else None,
            "total_points": a.total_points,
            "earned_points": a.earned_points,
            "passed": a.passed,
            "section_scores": a.section_scores,
            "started_at": str(a.started_at) if a.started_at else None,
            "completed_at": str(a.completed_at) if a.completed_at else None,
        }
        for a in attempts
    ]


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@router.get("/admin")
async def list_all_exams_admin(
    search: str = Query(None),
    exam_type: str = Query(None, pattern="^(anytime|scheduled)$"),
    status_filter: str = Query(None, alias="status", pattern="^(active|inactive|free|paid|empty|ready)$"),
    sort: str = Query("newest", pattern="^(newest|oldest|price_asc|price_desc|name_asc|attempts_desc|questions_desc)$"),
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Admin listing — returns ALL exams (active + inactive) plus stats & attempt counts."""

    # --- Aggregate stats (across all exams) ---
    total = (await db.execute(
        select(func.count(Exam.id))
    )).scalar() or 0

    active_count = (await db.execute(
        select(func.count(Exam.id))
        .join(Exam.product)
        .where(Product.is_active == True, Exam.is_active == True)
    )).scalar() or 0

    anytime_count = (await db.execute(
        select(func.count(Exam.id)).where(Exam.exam_type == "anytime")
    )).scalar() or 0

    scheduled_count = (await db.execute(
        select(func.count(Exam.id)).where(Exam.exam_type == "scheduled")
    )).scalar() or 0

    free_count = (await db.execute(
        select(func.count(Exam.id))
        .join(Exam.product)
        .where(Product.is_free == True)
    )).scalar() or 0

    empty_count = (await db.execute(
        select(func.count(Exam.id)).where(Exam.total_questions == 0)
    )).scalar() or 0

    total_attempts = (await db.execute(
        select(func.count(ExamAttempt.id))
    )).scalar() or 0

    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(OrderItem.total_price), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Product.product_type == ProductType.EXAM,
            Payment.status == PaymentStatus.SUCCESS,
        )
    )).scalar() or 0

    # Per-exam attempt counts
    attempt_rows = (await db.execute(
        select(ExamAttempt.exam_id, func.count(ExamAttempt.id))
        .group_by(ExamAttempt.exam_id)
    )).all()
    attempts_map = {row[0]: row[1] for row in attempt_rows}

    # Per-exam revenue (via product_id)
    rev_rows = (await db.execute(
        select(OrderItem.product_id, func.coalesce(func.sum(OrderItem.total_price), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .where(Payment.status == PaymentStatus.SUCCESS)
        .group_by(OrderItem.product_id)
    )).all()
    revenue_map = {row[0]: float(row[1] or 0) for row in rev_rows}

    # --- Filtered list ---
    query = (
        select(Exam)
        .options(selectinload(Exam.product))
        .join(Exam.product)
    )

    if search:
        term = f"%{search}%"
        query = query.where(Product.title.ilike(term) | Product.title_bn.ilike(term))

    if exam_type:
        query = query.where(Exam.exam_type == exam_type)

    if status_filter == "active":
        query = query.where(Product.is_active == True, Exam.is_active == True)
    elif status_filter == "inactive":
        query = query.where((Product.is_active == False) | (Exam.is_active == False))
    elif status_filter == "free":
        query = query.where(Product.is_free == True)
    elif status_filter == "paid":
        query = query.where(Product.is_free == False)
    elif status_filter == "empty":
        query = query.where(Exam.total_questions == 0)
    elif status_filter == "ready":
        query = query.where(Exam.total_questions > 0)

    if sort == "newest":
        query = query.order_by(Exam.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Exam.created_at.asc())
    elif sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "name_asc":
        query = query.order_by(Product.title.asc())
    elif sort == "questions_desc":
        query = query.order_by(Exam.total_questions.desc())
    # attempts_desc sorted in Python after enrichment

    exams = (await db.execute(query)).scalars().unique().all()

    items = []
    for e in exams:
        p = e.product
        items.append({
            "id": str(e.id),
            "product_id": str(e.product_id),
            "title": p.title,
            "title_bn": p.title_bn,
            "slug": p.slug,
            "description": p.description,
            "description_bn": p.description_bn,
            "thumbnail_url": p.thumbnail_url,
            "price": float(p.price) if p.price is not None else 0.0,
            "compare_price": float(p.compare_price) if p.compare_price else None,
            "is_free": p.is_free,
            "is_active": bool(p.is_active and e.is_active),
            "product_is_active": p.is_active,
            "exam_is_active": e.is_active,
            "exam_type": e.exam_type,
            "pass_percentage": e.pass_percentage,
            "max_attempts": e.max_attempts,
            "time_limit_seconds": e.time_limit_seconds,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "scheduled_start": e.scheduled_start.isoformat() if e.scheduled_start else None,
            "scheduled_end": e.scheduled_end.isoformat() if e.scheduled_end else None,
            "attempt_count": attempts_map.get(e.id, 0),
            "revenue": revenue_map.get(e.product_id, 0.0),
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    if sort == "attempts_desc":
        items.sort(key=lambda x: x["attempt_count"], reverse=True)

    return {
        "stats": {
            "total": total,
            "active": active_count,
            "inactive": total - active_count,
            "anytime": anytime_count,
            "scheduled": scheduled_count,
            "free": free_count,
            "paid": total - free_count,
            "empty": empty_count,
            "ready": total - empty_count,
            "total_attempts": total_attempts,
            "total_revenue": float(total_revenue),
        },
        "items": items,
    }


@router.get("/")
async def list_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active exams with product info (public)."""
    query = (
        select(Exam)
        .options(selectinload(Exam.product))
        .join(Exam.product)
        .where(Product.is_active == True, Exam.is_active == True)
    )

    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.title_bn.ilike(f"%{search}%")
        )

    query = query.order_by(Exam.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    exams = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "product_id": str(e.product_id),
            "title": e.product.title,
            "title_bn": e.product.title_bn,
            "slug": e.product.slug,
            "description": e.product.description,
            "description_bn": e.product.description_bn,
            "thumbnail_url": e.product.thumbnail_url,
            "price": str(e.product.price) if e.product.price is not None else "0",
            "compare_price": str(e.product.compare_price) if e.product.compare_price else None,
            "is_free": e.product.is_free,
            "exam_type": e.exam_type,
            "pass_percentage": e.pass_percentage,
            "max_attempts": e.max_attempts,
            "time_limit_seconds": e.time_limit_seconds,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "scheduled_start": str(e.scheduled_start) if e.scheduled_start else None,
            "scheduled_end": str(e.scheduled_end) if e.scheduled_end else None,
            "created_at": str(e.created_at) if e.created_at else None,
        }
        for e in exams
    ]


@router.get("/slug/{slug}")
async def get_exam_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get exam detail by product slug (sections preview, question counts, no answers)."""
    result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.product),
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions),
        )
        .join(Exam.product)
        .where(Product.slug == slug)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    product = exam.product
    return {
        "id": str(exam.id),
        "product_id": str(exam.product_id),
        "title": product.title,
        "title_bn": product.title_bn,
        "slug": product.slug,
        "description": product.description,
        "description_bn": product.description_bn,
        "thumbnail_url": product.thumbnail_url,
        "price": str(product.price) if product.price is not None else "0",
        "compare_price": str(product.compare_price) if product.compare_price else None,
        "is_free": product.is_free,
        "is_active": product.is_active,
        "exam_type": exam.exam_type,
        "pass_percentage": exam.pass_percentage,
        "max_attempts": exam.max_attempts,
        "time_limit_seconds": exam.time_limit_seconds,
        "scheduled_start": str(exam.scheduled_start) if exam.scheduled_start else None,
        "scheduled_end": str(exam.scheduled_end) if exam.scheduled_end else None,
        "total_sections": exam.total_sections,
        "total_questions": exam.total_questions,
        "created_at": str(exam.created_at) if exam.created_at else None,
        "sections": [
            {
                "id": str(s.id),
                "title": s.title,
                "title_bn": s.title_bn,
                "sort_order": s.sort_order,
                "time_limit_seconds": s.time_limit_seconds,
                "question_count": len(s.questions),
                "total_points": sum(q.points for q in s.questions),
            }
            for s in sorted(exam.sections, key=lambda x: x.sort_order)
        ],
    }


# ============================================
# STUDENT ENDPOINTS
# ============================================

@router.get("/{exam_id}/start")
async def start_exam(
    exam_id: UUID,
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get full exam questions (no correct answers) for a student.
    Checks: entitlement (or free), schedule window, attempt limit.
    """
    result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.product),
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.options),
        )
        .where(Exam.id == exam_id, Exam.is_active == True)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # 1. Check access: free exam OR has entitlement
    if not exam.product.is_free:
        # Check EXAM_ACCESS entitlement for the exam's own product
        has_access = False

        # Child-level entitlement
        ent_result = await db.execute(
            select(Entitlement).where(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.product_id == exam.product_id,
                Entitlement.entitlement_type == EntitlementType.EXAM_ACCESS,
                Entitlement.is_active == True,
            )
        )
        if ent_result.scalar_one_or_none():
            has_access = True

        # Parent-level entitlement fallback
        if not has_access:
            ent_result = await db.execute(
                select(Entitlement).where(
                    Entitlement.user_id == user.id,
                    Entitlement.product_id == exam.product_id,
                    Entitlement.entitlement_type == EntitlementType.EXAM_ACCESS,
                    Entitlement.is_active == True,
                )
            )
            if ent_result.scalar_one_or_none():
                has_access = True

        # Check via ProductExam attachments: if the child has access to any
        # product that this exam is attached to
        if not has_access:
            attached_product_ids = await db.execute(
                select(ProductExam.product_id).where(ProductExam.exam_id == exam_id)
            )
            for (pid,) in attached_product_ids.all():
                ent_check = await db.execute(
                    select(Entitlement).where(
                        or_(
                            Entitlement.child_profile_id == child_profile_id,
                            Entitlement.user_id == user.id,
                        ),
                        Entitlement.product_id == pid,
                        Entitlement.is_active == True,
                    )
                )
                if ent_check.scalar_one_or_none():
                    has_access = True
                    break

        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this exam. Please purchase it first.",
            )

    # 2. Check schedule window for scheduled exams
    if exam.exam_type == "scheduled":
        now = datetime.now(timezone.utc)
        if exam.scheduled_start and now < exam.scheduled_start:
            raise HTTPException(
                status_code=403,
                detail=f"This exam has not started yet. It starts at {exam.scheduled_start.isoformat()}",
            )
        if exam.scheduled_end and now > exam.scheduled_end:
            raise HTTPException(
                status_code=403,
                detail="This exam has ended.",
            )

    # 3. Check attempt limit
    if exam.max_attempts is not None:
        attempt_count_result = await db.execute(
            select(func.count()).select_from(ExamAttempt).where(
                ExamAttempt.exam_id == exam_id,
                ExamAttempt.child_profile_id == child_profile_id,
                ExamAttempt.completed_at.isnot(None),
            )
        )
        attempt_count = attempt_count_result.scalar() or 0
        if attempt_count >= exam.max_attempts:
            raise HTTPException(
                status_code=403,
                detail=f"Maximum attempts ({exam.max_attempts}) reached for this exam.",
            )

    # Return exam without correct answers
    return await _get_exam_response(exam.id, db, admin=False)


@router.post("/{exam_id}/submit")
async def submit_exam(
    exam_id: UUID,
    data: ExamSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit exam answers, grade, compute section scores, save attempt, return result."""
    child_profile_id = UUID(data.child_profile_id)

    result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.options),
        )
        .where(Exam.id == exam_id, Exam.is_active == True)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Build answer map: question_id -> selected_option_id
    answer_map = {a.question_id: a.selected_option_id for a in data.answers}

    total_points = 0
    earned_points = 0
    section_scores = []
    results = []

    for section in sorted(exam.sections, key=lambda x: x.sort_order):
        section_earned = 0
        section_total = 0

        for question in sorted(section.questions, key=lambda x: x.sort_order):
            section_total += question.points
            total_points += question.points
            selected_id = answer_map.get(str(question.id))

            # Find correct option
            correct_option = next(
                (o for o in question.options if o.is_correct), None
            )
            is_correct = (
                selected_id
                and correct_option
                and selected_id == str(correct_option.id)
            )

            if is_correct:
                earned_points += question.points
                section_earned += question.points

            results.append({
                "question_id": str(question.id),
                "section_id": str(section.id),
                "question_text": question.question_text,
                "question_text_bn": question.question_text_bn,
                "image_url": question.image_url,
                "selected_option_id": selected_id,
                "correct_option_id": str(correct_option.id) if correct_option else None,
                "is_correct": bool(is_correct),
                "points": question.points,
                "options": [
                    {
                        "id": str(o.id),
                        "option_text": o.option_text,
                        "option_text_bn": o.option_text_bn,
                        "image_url": o.image_url,
                        "is_correct": o.is_correct,
                    }
                    for o in sorted(question.options, key=lambda x: x.sort_order)
                ],
            })

        section_scores.append({
            "section_id": str(section.id),
            "title": section.title,
            "title_bn": section.title_bn,
            "earned": section_earned,
            "total": section_total,
        })

    score = Decimal(str((earned_points / total_points * 100) if total_points > 0 else 0))
    passed = score >= exam.pass_percentage

    # Save attempt
    attempt = ExamAttempt(
        exam_id=exam.id,
        child_profile_id=child_profile_id,
        user_id=user.id,
        score=score,
        total_points=total_points,
        earned_points=earned_points,
        passed=passed,
        answers=answer_map,
        section_scores=section_scores,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    await db.commit()

    return {
        "attempt_id": str(attempt.id),
        "score": str(score),
        "earned_points": earned_points,
        "total_points": total_points,
        "passed": passed,
        "pass_percentage": exam.pass_percentage,
        "section_scores": section_scores,
        "results": results,
    }


@router.get("/my")
async def my_exams(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all exams the child has access to:
    1. Direct exam entitlements (EXAM_ACCESS for this child/user)
    2. Exams attached via ProductExam to any product the child has access to
    3. Free exams (product.is_free = True)
    Include past attempts.
    """

    # 1. Direct entitlements: get product IDs with EXAM_ACCESS
    direct_ent_result = await db.execute(
        select(Entitlement.product_id).where(
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
            Entitlement.entitlement_type == EntitlementType.EXAM_ACCESS,
            Entitlement.is_active == True,
        )
    )
    direct_product_ids = {row[0] for row in direct_ent_result.all()}

    # 2. Exams attached via ProductExam to products the child has access to
    # First get all product IDs the child has any entitlement for
    all_ent_result = await db.execute(
        select(Entitlement.product_id).where(
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
            Entitlement.is_active == True,
        )
    )
    all_entitled_product_ids = {row[0] for row in all_ent_result.all()}

    # Get exam IDs attached to those products
    attached_exam_ids = set()
    if all_entitled_product_ids:
        attached_result = await db.execute(
            select(ProductExam.exam_id).where(
                ProductExam.product_id.in_(all_entitled_product_ids)
            )
        )
        attached_exam_ids = {row[0] for row in attached_result.all()}

    # 3. Build query: exams where product_id in direct_product_ids
    #    OR exam.id in attached_exam_ids
    #    OR product.is_free = True
    query = (
        select(Exam)
        .options(selectinload(Exam.product))
        .join(Exam.product)
        .where(Exam.is_active == True)
    )

    conditions = [Product.is_free == True]
    if direct_product_ids:
        conditions.append(Exam.product_id.in_(direct_product_ids))
    if attached_exam_ids:
        conditions.append(Exam.id.in_(attached_exam_ids))

    query = query.where(or_(*conditions))
    query = query.order_by(Exam.created_at.desc())

    result = await db.execute(query)
    exams = result.scalars().unique().all()

    # Get all attempts for this child across these exams
    exam_ids = [e.id for e in exams]
    attempts_map: dict[UUID, list] = {}
    if exam_ids:
        attempts_result = await db.execute(
            select(ExamAttempt)
            .where(
                ExamAttempt.exam_id.in_(exam_ids),
                ExamAttempt.child_profile_id == child_profile_id,
            )
            .order_by(ExamAttempt.completed_at.desc())
        )
        for attempt in attempts_result.scalars().all():
            attempts_map.setdefault(attempt.exam_id, []).append({
                "id": str(attempt.id),
                "score": str(attempt.score) if attempt.score is not None else None,
                "total_points": attempt.total_points,
                "earned_points": attempt.earned_points,
                "passed": attempt.passed,
                "section_scores": attempt.section_scores,
                "completed_at": str(attempt.completed_at) if attempt.completed_at else None,
            })

    return [
        {
            "id": str(e.id),
            "product_id": str(e.product_id),
            "title": e.product.title,
            "title_bn": e.product.title_bn,
            "slug": e.product.slug,
            "thumbnail_url": e.product.thumbnail_url,
            "price": str(e.product.price) if e.product.price is not None else "0",
            "is_free": e.product.is_free,
            "exam_type": e.exam_type,
            "pass_percentage": e.pass_percentage,
            "max_attempts": e.max_attempts,
            "time_limit_seconds": e.time_limit_seconds,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "scheduled_start": str(e.scheduled_start) if e.scheduled_start else None,
            "scheduled_end": str(e.scheduled_end) if e.scheduled_end else None,
            "attempts": attempts_map.get(e.id, []),
        }
        for e in exams
    ]
