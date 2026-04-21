# Exam System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flexible exam system for kids — multi-section MCQ exams that can be standalone (free/paid), attached to products (courses/books), anytime or scheduled, with configurable retakes, section-wise scoring, and certificate generation.

**Architecture:** Exams are products (like courses) — linked one-to-one via `product_id`. Each exam has sections, each section has MCQ questions. The existing payment/cart/entitlement system handles purchases. Exam attempts track per-child scores with section-wise JSONB breakdown. A join table `ProductExam` links exams to other products for bundling.

**Tech Stack:** FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic migrations, Next.js 15 + Tailwind CSS + Zustand stores.

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/exam.py` | Exam, ExamSection, ExamQuestion, ExamOption, ExamAttempt, ProductExam models |
| `backend/app/api/v1/exams.py` | All exam API endpoints (admin CRUD, public list/detail, student start/submit/my-exams) |
| `backend/alembic/versions/*_add_exam_system.py` | Migration (auto-generated) |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/enums.py` | Add `EXAM` to ProductType, `EXAM_ACCESS` to EntitlementType |
| `backend/app/models/__init__.py` | Re-export exam models |
| `backend/app/models/product.py` | Add `exam` relationship |
| `backend/app/main.py` | Register exams router |
| `backend/app/services/entitlement_service.py` | Handle EXAM product type in `_grant_for_product` |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/app/exams/page.tsx` | Public exam catalog/listing page |
| `frontend/src/app/exams/[slug]/page.tsx` | Public exam detail page (sections preview, price, schedule, buy/start) |
| `frontend/src/app/exams/[id]/take/page.tsx` | Exam player (section tabs, questions, timer, submit, results) |
| `frontend/src/components/exam/ExamCard.tsx` | Reusable exam card for catalog and dashboard |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/stores/cart-store.ts` | Add `"exam"` to productType union |
| `frontend/src/app/dashboard/page.tsx` | Add "আমার পরীক্ষাসমূহ" section |
| `frontend/src/app/admin/page.tsx` | Add "পরীক্ষা" tab with list + create/edit |
| `frontend/src/app/admin/courses/[id]/page.tsx` | Add exam attachment UI in course detail |

---

## Task 1: Backend Models + Enums

**Files:**
- Create: `backend/app/models/exam.py`
- Modify: `backend/app/models/enums.py:15-19` (ProductType), `enums.py:66-69` (EntitlementType)
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/product.py` (add exam relationship)

- [ ] **Step 1: Add EXAM to ProductType and EntitlementType enums**

In `backend/app/models/enums.py`, add to `ProductType`:
```python
class ProductType(str, enum.Enum):
    COURSE = "course"
    EBOOK = "ebook"
    PHYSICAL_BOOK = "physical_book"
    BUNDLE = "bundle"
    EXAM = "exam"  # NEW
```

Add to `EntitlementType`:
```python
EXAM_ACCESS = "exam_access"  # NEW — add after PHYSICAL_SHIPMENT
```

- [ ] **Step 2: Create exam models**

Create `backend/app/models/exam.py`:
```python
"""Exam system models — exams, sections, questions, options, attempts."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey,
    Boolean, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Exam(Base):
    __tablename__ = "exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True)

    exam_type = Column(String(30), nullable=False, default="anytime")  # anytime | scheduled
    pass_percentage = Column(Integer, default=60)
    max_attempts = Column(Integer, nullable=True)  # null = unlimited
    time_limit_seconds = Column(Integer, nullable=True)  # overall timer
    is_active = Column(Boolean, default=True)

    # Scheduled exam fields
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    total_sections = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    product = relationship("Product", back_populates="exam")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan",
                           order_by="ExamSection.sort_order")
    attempts = relationship("ExamAttempt", back_populates="exam", lazy="noload")


class ExamSection(Base):
    __tablename__ = "exam_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    time_limit_seconds = Column(Integer, nullable=True)  # optional per-section timer

    exam = relationship("Exam", back_populates="sections")
    questions = relationship("ExamQuestion", back_populates="section", cascade="all, delete-orphan",
                            order_by="ExamQuestion.sort_order")


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("exam_sections.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_text_bn = Column(Text, nullable=True)
    question_type = Column(String(20), default="mcq")
    sort_order = Column(Integer, default=0)
    points = Column(Integer, default=1)

    section = relationship("ExamSection", back_populates="questions")
    options = relationship("ExamOption", back_populates="question", cascade="all, delete-orphan",
                          order_by="ExamOption.sort_order")


class ExamOption(Base):
    __tablename__ = "exam_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(String(1000), nullable=False)
    option_text_bn = Column(String(1000), nullable=True)
    is_correct = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    question = relationship("ExamQuestion", back_populates="options")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    score = Column(Numeric(5, 2), nullable=True)
    total_points = Column(Integer, default=0)
    earned_points = Column(Integer, default=0)
    passed = Column(Boolean, default=False)

    answers = Column(JSONB, default=dict)          # {question_id: selected_option_id}
    section_scores = Column(JSONB, default=list)   # [{section_id, title, title_bn, earned, total}]

    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    exam = relationship("Exam", back_populates="attempts")
    user = relationship("User")
    child = relationship("ChildProfile")


class ProductExam(Base):
    """Join table: attach an exam to any product (course, ebook, physical book)."""
    __tablename__ = "product_exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
```

- [ ] **Step 3: Add exam relationship to Product model**

In `backend/app/models/product.py`, add after the `bundle` relationship:
```python
exam = relationship("Exam", back_populates="product", uselist=False, lazy="noload")
```

- [ ] **Step 4: Register models in `__init__.py`**

In `backend/app/models/__init__.py`, add at the bottom:
```python
# Exams
from app.models.exam import (  # noqa: F401
    Exam, ExamSection, ExamQuestion, ExamOption, ExamAttempt, ProductExam,
)
```

- [ ] **Step 5: Generate and run migration**

```bash
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "add_exam_system"
alembic upgrade head
```

Expected: Tables `exams`, `exam_sections`, `exam_questions`, `exam_options`, `exam_attempts`, `product_exams` created.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/exam.py backend/app/models/enums.py backend/app/models/__init__.py backend/app/models/product.py backend/alembic/versions/*_add_exam_system.py
git commit -m "feat(exam): add exam system database models and migration"
```

---

## Task 2: Entitlement Service — Handle Exam Product Type

**Files:**
- Modify: `backend/app/services/entitlement_service.py:148-178`

- [ ] **Step 1: Add EXAM_ACCESS grant in `_grant_for_product`**

In `backend/app/services/entitlement_service.py`, after the `if product.product_type == ProductType.COURSE:` block (around line 178), add:

```python
        elif product.product_type == ProductType.EXAM:
            if not await _exists(EntitlementType.EXAM_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.EXAM_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)
```

Also update the `physical_only` skip check to include EXAM:
```python
if physical_only and product.product_type in (ProductType.COURSE, ProductType.EBOOK, ProductType.EXAM):
    return created
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/entitlement_service.py
git commit -m "feat(exam): handle exam entitlement in payment flow"
```

---

## Task 3: Backend API — Admin CRUD Endpoints

**Files:**
- Create: `backend/app/api/v1/exams.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create exams API router with schemas and admin CRUD**

Create `backend/app/api/v1/exams.py`:

```python
"""
Exam API — admin CRUD, public catalog, student exam flow.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.db import get_db
from app.models import User, Product, ProductType
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
    option_text: str
    option_text_bn: Optional[str] = None
    is_correct: bool = False
    sort_order: int = 0

class QuestionSchema(BaseModel):
    question_text: str
    question_text_bn: Optional[str] = None
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
    # Product fields
    title: str
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal = Decimal("0")
    compare_price: Optional[Decimal] = None
    is_free: bool = False
    # Exam fields
    exam_type: str = "anytime"  # anytime | scheduled
    pass_percentage: int = 60
    max_attempts: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    category_id: Optional[int] = None
    # Sections with questions
    sections: list[SectionSchema] = []

class ExamUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    is_free: Optional[bool] = None
    exam_type: Optional[str] = None
    pass_percentage: Optional[int] = None
    max_attempts: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    is_active: Optional[bool] = None

class SubmitAnswer(BaseModel):
    question_id: str
    selected_option_id: str

class ExamSubmitRequest(BaseModel):
    child_profile_id: str
    answers: list[SubmitAnswer]


# ---- Admin CRUD ----

@router.post("/", status_code=201)
async def create_exam(
    data: ExamCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create an exam with sections and questions (admin)."""
    slug = data.slug or slugify(data.title)
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
    if data.exam_type == "scheduled":
        if data.scheduled_start:
            scheduled_start = datetime.fromisoformat(data.scheduled_start)
        if data.scheduled_end:
            scheduled_end = datetime.fromisoformat(data.scheduled_end)

    # Create exam
    total_questions = sum(len(s.questions) for s in data.sections)
    exam = Exam(
        product_id=product.id,
        exam_type=data.exam_type,
        pass_percentage=data.pass_percentage,
        max_attempts=data.max_attempts,
        time_limit_seconds=data.time_limit_seconds,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        total_sections=len(data.sections),
        total_questions=total_questions,
    )
    db.add(exam)
    await db.flush()

    # Create sections with questions
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
                    is_correct=o_data.is_correct,
                    sort_order=o_data.sort_order,
                )
                db.add(option)

    await db.commit()
    return await _get_exam_response(exam.id, db, admin=True)


@router.put("/{exam_id}")
async def update_exam(
    exam_id: UUID,
    data: ExamUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update exam metadata (admin)."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    product = await db.get(Product, exam.product_id)

    # Update product fields
    for field in ["title", "title_bn", "description", "description_bn", "thumbnail_url", "price", "compare_price", "is_free"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(product, field, val)

    # Update exam fields
    for field in ["exam_type", "pass_percentage", "max_attempts", "time_limit_seconds", "is_active"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(exam, field, val)

    if data.scheduled_start is not None:
        exam.scheduled_start = datetime.fromisoformat(data.scheduled_start) if data.scheduled_start else None
    if data.scheduled_end is not None:
        exam.scheduled_end = datetime.fromisoformat(data.scheduled_end) if data.scheduled_end else None

    await db.commit()
    return await _get_exam_response(exam.id, db, admin=True)


@router.get("/{exam_id}/admin")
async def get_exam_admin(
    exam_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Get exam with full details including correct answers (admin)."""
    return await _get_exam_response(exam_id, db, admin=True)


@router.post("/{exam_id}/sections", status_code=201)
async def add_section(
    exam_id: UUID,
    data: SectionSchema,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a section with questions to an exam (admin)."""
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
                is_correct=o_data.is_correct,
                sort_order=o_data.sort_order,
            )
            db.add(option)

    # Update counts
    exam.total_sections += 1
    exam.total_questions += len(data.questions)

    await db.commit()
    return {"id": str(section.id), "message": "Section added"}


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(
    section_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete an exam section and its questions (admin)."""
    section = await db.get(ExamSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()


@router.post("/{exam_id}/attach/{product_id}", status_code=201)
async def attach_to_product(
    exam_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Attach an exam to another product (course, ebook, etc.)."""
    link = ProductExam(product_id=product_id, exam_id=exam_id)
    db.add(link)
    await db.commit()
    return {"message": "Exam attached"}


@router.delete("/{exam_id}/attach/{product_id}", status_code=204)
async def detach_from_product(
    exam_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
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
    if link:
        await db.delete(link)
        await db.commit()


@router.get("/{exam_id}/attempts")
async def get_exam_attempts(
    exam_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Admin: view all attempts for an exam."""
    result = await db.execute(
        select(ExamAttempt)
        .where(ExamAttempt.exam_id == exam_id)
        .order_by(ExamAttempt.completed_at.desc())
    )
    attempts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "child_name": a.child.full_name_bn or a.child.full_name if a.child else None,
            "score": str(a.score) if a.score else None,
            "total_points": a.total_points,
            "earned_points": a.earned_points,
            "passed": a.passed,
            "section_scores": a.section_scores,
            "started_at": a.started_at.isoformat() if a.started_at else None,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        }
        for a in attempts
    ]


# ---- Public Endpoints ----

@router.get("/")
async def list_exams(
    db: AsyncSession = Depends(get_db),
):
    """Public: list all active exams."""
    result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.product))
        .where(Exam.is_active == True)
        .order_by(Exam.created_at.desc())
    )
    exams = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "product": {
                "id": str(e.product.id),
                "title": e.product.title,
                "title_bn": e.product.title_bn,
                "slug": e.product.slug,
                "thumbnail_url": e.product.thumbnail_url,
                "price": float(e.product.price),
                "compare_price": float(e.product.compare_price) if e.product.compare_price else None,
                "is_free": e.product.is_free,
            },
            "exam_type": e.exam_type,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "time_limit_seconds": e.time_limit_seconds,
            "pass_percentage": e.pass_percentage,
            "scheduled_start": e.scheduled_start.isoformat() if e.scheduled_start else None,
            "scheduled_end": e.scheduled_end.isoformat() if e.scheduled_end else None,
        }
        for e in exams
    ]


@router.get("/slug/{slug}")
async def get_exam_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: get exam detail by product slug (sections preview, no answers)."""
    result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.product),
            selectinload(Exam.sections).selectinload(ExamSection.questions),
        )
        .join(Product, Exam.product_id == Product.id)
        .where(Product.slug == slug, Exam.is_active == True)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    return {
        "id": str(exam.id),
        "product": {
            "id": str(exam.product.id),
            "title": exam.product.title,
            "title_bn": exam.product.title_bn,
            "slug": exam.product.slug,
            "description": exam.product.description,
            "description_bn": exam.product.description_bn,
            "thumbnail_url": exam.product.thumbnail_url,
            "price": float(exam.product.price),
            "compare_price": float(exam.product.compare_price) if exam.product.compare_price else None,
            "is_free": exam.product.is_free,
        },
        "exam_type": exam.exam_type,
        "pass_percentage": exam.pass_percentage,
        "max_attempts": exam.max_attempts,
        "time_limit_seconds": exam.time_limit_seconds,
        "total_sections": exam.total_sections,
        "total_questions": exam.total_questions,
        "scheduled_start": exam.scheduled_start.isoformat() if exam.scheduled_start else None,
        "scheduled_end": exam.scheduled_end.isoformat() if exam.scheduled_end else None,
        "sections": [
            {
                "id": str(s.id),
                "title": s.title,
                "title_bn": s.title_bn,
                "question_count": len(s.questions),
                "total_points": sum(q.points for q in s.questions),
                "time_limit_seconds": s.time_limit_seconds,
            }
            for s in sorted(exam.sections, key=lambda x: x.sort_order)
        ],
    }


# ---- Student Endpoints ----

@router.get("/{exam_id}/start")
async def start_exam(
    exam_id: UUID,
    child_profile_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an exam — checks entitlement, schedule, attempt limits. Returns full questions (no answers)."""
    exam_result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.product),
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.options),
        )
        .where(Exam.id == exam_id, Exam.is_active == True)
    )
    exam = exam_result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Check access (free or has entitlement)
    if not exam.product.is_free:
        from app.services.entitlement_service import EntitlementService
        has_access = await EntitlementService.has_course_access(
            user_id=user.id,
            product_id=exam.product_id,
            child_profile_id=child_profile_id,
            db=db,
        )
        if not has_access:
            raise HTTPException(status_code=403, detail="No access to this exam. Purchase required.")

    # Check schedule
    now = datetime.now(timezone.utc)
    if exam.exam_type == "scheduled":
        if exam.scheduled_start and now < exam.scheduled_start:
            raise HTTPException(status_code=400, detail="Exam has not started yet")
        if exam.scheduled_end and now > exam.scheduled_end:
            raise HTTPException(status_code=400, detail="Exam time window has ended")

    # Check attempt limit
    attempts_result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.child_profile_id == child_profile_id,
            ExamAttempt.completed_at.isnot(None),
        )
    )
    past_attempts = attempts_result.scalars().all()
    if exam.max_attempts and len(past_attempts) >= exam.max_attempts:
        raise HTTPException(status_code=400, detail=f"Maximum attempts ({exam.max_attempts}) reached")

    # Return exam data (without correct answers)
    return {
        "id": str(exam.id),
        "title": exam.product.title,
        "title_bn": exam.product.title_bn,
        "time_limit_seconds": exam.time_limit_seconds,
        "pass_percentage": exam.pass_percentage,
        "attempt_number": len(past_attempts) + 1,
        "max_attempts": exam.max_attempts,
        "sections": [
            {
                "id": str(s.id),
                "title": s.title,
                "title_bn": s.title_bn,
                "time_limit_seconds": s.time_limit_seconds,
                "questions": [
                    {
                        "id": str(q.id),
                        "question_text": q.question_text,
                        "question_text_bn": q.question_text_bn,
                        "points": q.points,
                        "options": [
                            {
                                "id": str(o.id),
                                "option_text": o.option_text,
                                "option_text_bn": o.option_text_bn,
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


@router.post("/{exam_id}/submit")
async def submit_exam(
    exam_id: UUID,
    data: ExamSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit exam answers. Returns graded result with section-wise breakdown."""
    child_profile_id = UUID(data.child_profile_id)

    exam_result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.options),
        )
        .where(Exam.id == exam_id)
    )
    exam = exam_result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    answer_map = {a.question_id: a.selected_option_id for a in data.answers}

    total_points = 0
    earned_points = 0
    section_scores = []
    results = []

    for section in sorted(exam.sections, key=lambda x: x.sort_order):
        sec_total = 0
        sec_earned = 0

        for question in sorted(section.questions, key=lambda x: x.sort_order):
            total_points += question.points
            sec_total += question.points
            selected_id = answer_map.get(str(question.id))

            correct_option = next((o for o in question.options if o.is_correct), None)
            is_correct = selected_id and correct_option and selected_id == str(correct_option.id)

            if is_correct:
                earned_points += question.points
                sec_earned += question.points

            results.append({
                "question_id": str(question.id),
                "section_id": str(section.id),
                "selected_option_id": selected_id,
                "correct_option_id": str(correct_option.id) if correct_option else None,
                "is_correct": bool(is_correct),
                "points": question.points,
            })

        section_scores.append({
            "section_id": str(section.id),
            "title": section.title,
            "title_bn": section.title_bn,
            "earned": sec_earned,
            "total": sec_total,
        })

    score = Decimal(str((earned_points / total_points * 100) if total_points > 0 else 0))
    passed = score >= exam.pass_percentage

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
    child_profile_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all exams a child has access to (purchased standalone + bundled via products)."""
    # 1. Direct exam entitlements
    ent_result = await db.execute(
        select(Entitlement)
        .where(
            Entitlement.entitlement_type == EntitlementType.EXAM_ACCESS.value,
            Entitlement.is_active == True,
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
        )
    )
    direct_product_ids = [e.product_id for e in ent_result.scalars().all()]

    # 2. Exams attached to products the child has access to (via ProductExam)
    all_ent_result = await db.execute(
        select(Entitlement.product_id)
        .where(
            Entitlement.is_active == True,
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
        )
    )
    all_product_ids = [row[0] for row in all_ent_result.all()]

    attached_result = await db.execute(
        select(ProductExam.exam_id)
        .where(ProductExam.product_id.in_(all_product_ids))
    )
    attached_exam_ids = [row[0] for row in attached_result.all()]

    # 3. Direct exam IDs
    direct_exam_result = await db.execute(
        select(Exam.id).where(Exam.product_id.in_(direct_product_ids))
    )
    direct_exam_ids = [row[0] for row in direct_exam_result.all()]

    all_exam_ids = list(set(direct_exam_ids + attached_exam_ids))

    # 4. Also include free exams
    free_result = await db.execute(
        select(Exam.id)
        .join(Product, Exam.product_id == Product.id)
        .where(Product.is_free == True, Exam.is_active == True)
    )
    free_exam_ids = [row[0] for row in free_result.all()]
    all_exam_ids = list(set(all_exam_ids + free_exam_ids))

    if not all_exam_ids:
        return []

    # Load exams with products
    exams_result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.product))
        .where(Exam.id.in_(all_exam_ids), Exam.is_active == True)
        .order_by(Exam.created_at.desc())
    )
    exams = exams_result.scalars().all()

    # Load attempts for this child
    attempts_result = await db.execute(
        select(ExamAttempt)
        .where(
            ExamAttempt.child_profile_id == child_profile_id,
            ExamAttempt.exam_id.in_(all_exam_ids),
        )
        .order_by(ExamAttempt.completed_at.desc())
    )
    attempts = attempts_result.scalars().all()
    attempts_by_exam = {}
    for a in attempts:
        attempts_by_exam.setdefault(a.exam_id, []).append(a)

    return [
        {
            "id": str(e.id),
            "product": {
                "title": e.product.title,
                "title_bn": e.product.title_bn,
                "slug": e.product.slug,
                "thumbnail_url": e.product.thumbnail_url,
            },
            "exam_type": e.exam_type,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "time_limit_seconds": e.time_limit_seconds,
            "pass_percentage": e.pass_percentage,
            "max_attempts": e.max_attempts,
            "scheduled_start": e.scheduled_start.isoformat() if e.scheduled_start else None,
            "scheduled_end": e.scheduled_end.isoformat() if e.scheduled_end else None,
            "attempts": [
                {
                    "id": str(a.id),
                    "score": str(a.score) if a.score else None,
                    "passed": a.passed,
                    "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                }
                for a in attempts_by_exam.get(e.id, [])
            ],
        }
        for e in exams
    ]


# ---- Helper ----

async def _get_exam_response(exam_id: UUID, db: AsyncSession, admin: bool = False):
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
    exam = result.scalar_one()
    return {
        "id": str(exam.id),
        "product_id": str(exam.product_id),
        "product": {
            "id": str(exam.product.id),
            "title": exam.product.title,
            "title_bn": exam.product.title_bn,
            "slug": exam.product.slug,
            "description": exam.product.description,
            "description_bn": exam.product.description_bn,
            "thumbnail_url": exam.product.thumbnail_url,
            "price": float(exam.product.price),
            "compare_price": float(exam.product.compare_price) if exam.product.compare_price else None,
            "is_free": exam.product.is_free,
        },
        "exam_type": exam.exam_type,
        "pass_percentage": exam.pass_percentage,
        "max_attempts": exam.max_attempts,
        "time_limit_seconds": exam.time_limit_seconds,
        "is_active": exam.is_active,
        "scheduled_start": exam.scheduled_start.isoformat() if exam.scheduled_start else None,
        "scheduled_end": exam.scheduled_end.isoformat() if exam.scheduled_end else None,
        "total_sections": exam.total_sections,
        "total_questions": exam.total_questions,
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
                        "question_type": q.question_type,
                        "sort_order": q.sort_order,
                        "points": q.points,
                        "options": [
                            {
                                "id": str(o.id),
                                "option_text": o.option_text,
                                "option_text_bn": o.option_text_bn,
                                "is_correct": o.is_correct if admin else None,
                                "sort_order": o.sort_order,
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
```

Note: `or_` is already imported from sqlalchemy at the top. Also need `from decimal import Decimal`.

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add import and include:
```python
from app.api.v1.exams import router as exams_router
# ...
app.include_router(exams_router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/exams.py backend/app/main.py
git commit -m "feat(exam): add exam API with admin CRUD, public catalog, student flow"
```

---

## Task 4: Cart Store — Add Exam Product Type

**Files:**
- Modify: `frontend/src/stores/cart-store.ts:5`

- [ ] **Step 1: Add "exam" to CartItem productType**

Change:
```typescript
productType: "physical_book" | "ebook" | "course";
```
To:
```typescript
productType: "physical_book" | "ebook" | "course" | "exam";
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/cart-store.ts
git commit -m "feat(exam): add exam product type to cart store"
```

---

## Task 5: Admin Dashboard — পরীক্ষা Tab

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Add "exams" to Tab type and validTabs**

Update the Tab type (line 15):
```typescript
type Tab = "dashboard" | "users" | "courses" | "orders" | "shipments" | "coupons" | "ebooks" | "physical-items" | "homepage" | "settings" | "instructors" | "exams";
```

Update validTabs (line 16):
```typescript
const validTabs: Tab[] = ["dashboard", "users", "courses", "orders", "shipments", "coupons", "ebooks", "physical-items", "homepage", "settings", "instructors", "exams"];
```

Add tab to navigation array (after the courses tab entry):
```typescript
{ id: "exams", label: "পরীক্ষা", icon: GraduationCap },
```

Import `GraduationCap` from lucide-react.

- [ ] **Step 2: Add data loading for exams tab**

In the useEffect tab loading chain, add:
```typescript
else if (activeTab === "exams") {
    const data: any = await api.get("/exams/", accessToken);
    setListData(Array.isArray(data) ? data : []);
}
```

- [ ] **Step 3: Add exams tab content rendering**

Add exam list rendering in the tab content section (similar to the courses tab pattern — a grid of cards showing exam title, type, sections count, price, with a link to a dedicated exam editor page or inline create/edit modal).

This task is large — the specific UI for the admin exam management (create/edit forms, section/question management) should follow the pattern used in the course detail page (`/admin/courses/[id]/page.tsx`) and the `QuizEditorModal` component.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat(exam): add exams tab to admin dashboard"
```

---

## Task 6: Frontend — Exam Catalog Page

**Files:**
- Create: `frontend/src/app/exams/page.tsx`
- Create: `frontend/src/components/exam/ExamCard.tsx`

- [ ] **Step 1: Create ExamCard component**

Create `frontend/src/components/exam/ExamCard.tsx` — a card component showing exam title, thumbnail, sections count, questions count, price, exam type badge (anytime/scheduled), and scheduled date if applicable. Follow the same visual style as course cards on `/courses`.

- [ ] **Step 2: Create exam catalog page**

Create `frontend/src/app/exams/page.tsx` — follows the exact pattern of `frontend/src/app/courses/page.tsx`:
- Fetches from `GET /exams/`
- Grid of ExamCard components
- Filter by exam_type (anytime/scheduled)
- Search by title

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/exams/page.tsx frontend/src/components/exam/ExamCard.tsx
git commit -m "feat(exam): add public exam catalog page"
```

---

## Task 7: Frontend — Exam Detail Page

**Files:**
- Create: `frontend/src/app/exams/[slug]/page.tsx`

- [ ] **Step 1: Create exam detail page**

Create `frontend/src/app/exams/[slug]/page.tsx` — follows the pattern of `frontend/src/app/courses/[slug]/page.tsx`:
- Fetches from `GET /exams/slug/{slug}`
- Hero section with title, description, thumbnail
- Sections preview (title + question count per section)
- Exam info: time limit, pass percentage, max attempts, exam type
- Schedule info for scheduled exams (countdown or "সময় শেষ")
- Price + "পরীক্ষায় অংশ নাও" button (or "কিনুন" for paid)
- Add to cart flow for paid exams (same as course purchase)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/exams/[slug]/page.tsx
git commit -m "feat(exam): add public exam detail page"
```

---

## Task 8: Frontend — Exam Player

**Files:**
- Create: `frontend/src/app/exams/[id]/take/page.tsx`

- [ ] **Step 1: Create exam player page**

Create `frontend/src/app/exams/[id]/take/page.tsx` — the full-screen exam experience:
- Fetches from `GET /exams/{id}/start?child_profile_id={id}`
- **Section tabs** at the top — one tab per section
- **Question navigation** within each section — numbered buttons
- **Timer** — exam-level or per-section, auto-submit on timeout
- **Answer selection** — MCQ option grid (reuse the QuizPlayer option styles)
- **Submit button** — sends to `POST /exams/{id}/submit`
- **Result screen:**
  - Overall score with circular donut (reuse from QuizPlayer)
  - Section-wise breakdown pills (section title + earned/total)
  - Pass/fail message
  - Certificate generation if passed (call `POST /certificates/generate-exam/{exam_id}` — to be added)
  - "আবার চেষ্টা করো" if attempts remaining

This is the largest frontend task. The exam player should be a standalone full-screen page (like QuizPlayer) but with section navigation added.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/exams/[id]/take/page.tsx
git commit -m "feat(exam): add exam player with section navigation and results"
```

---

## Task 9: Frontend — Dashboard Exam Section

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add exam state and loading**

Add state:
```typescript
const [exams, setExams] = useState<any[]>([]);
```

Add useEffect to load exams when activeChild changes:
```typescript
useEffect(() => {
    if (!activeChild || !accessToken) return;
    api.get(`/exams/my?child_profile_id=${activeChild.id}`, accessToken)
      .then((data: any) => setExams(Array.isArray(data) ? data : []))
      .catch(() => setExams([]));
}, [activeChild, accessToken]);
```

- [ ] **Step 2: Add "আমার পরীক্ষাসমূহ" section**

Add after the courses section in the left column — a section with header "আমার পরীক্ষাসমূহ" and a grid of exam cards showing:
- Exam title, type badge
- Scheduled date/time (if scheduled)
- Past attempts (best score)
- "পরীক্ষা দাও" button linking to `/exams/{id}/take?child={childId}`

Also show exams attached to purchased products under those product cards (via the `ProductExam` data returned in the my-exams endpoint).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat(exam): add exams section to student dashboard"
```

---

## Task 10: Admin — Exam Editor Page

**Files:**
- Create: `frontend/src/app/admin/exams/[id]/page.tsx`

- [ ] **Step 1: Create exam editor page**

Create `frontend/src/app/admin/exams/[id]/page.tsx` — follows the pattern of `frontend/src/app/admin/courses/[id]/page.tsx`:
- Header with back button to `/admin?tab=exams`
- Exam metadata form (title, type, schedule, pass %, max attempts, time limit, price)
- Sections list — each expandable with questions
- Add section / add question forms
- Inline question editor (question text, options with is_correct toggle)
- Product attachment section — search products and attach/detach exams
- Attempts/results section at bottom

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/exams/[id]/page.tsx
git commit -m "feat(exam): add admin exam editor page"
```

---

## Implementation Notes

- **Reuse patterns:** The exam models mirror the quiz models (Question + Option + Attempt). The API patterns mirror the courses API. The frontend pages mirror the course pages.
- **Certificate for exams:** The existing certificate model has `course_id`. For exam certificates, either: (a) add nullable `exam_id` to the Certificate model, or (b) create a separate endpoint that generates a certificate record with the exam's product title. Option (a) is simpler — add it in Task 1 as a nullable FK.
- **Free exams:** Listed in the `my_exams` endpoint for all children automatically (no purchase required).
- **Entitlement reuse:** The `has_course_access` method works for exams too since it checks `product_id` — no name change needed, just ensure EXAM products create `EXAM_ACCESS` entitlements.
