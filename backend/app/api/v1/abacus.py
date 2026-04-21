"""
Abacus API — Admin CRUD + Student start/submit + public listing.
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
from app.models import User, Product, ProductType
from app.models.abacus import AbacusCourse, AbacusLevel, AbacusAttempt, ProductAbacus
from app.models.entitlement import Entitlement
from app.models.enums import EntitlementType
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from slugify import slugify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/abacus", tags=["Abacus"])


# ---- Default Curriculum ----

DEFAULT_CURRICULUM = [
    {"sort_order": 0, "title": "Counting 1-4", "title_bn": "১-৪ গণনা", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [1, 4], "num_rods": 1, "question_count": 4, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Push 1 earth bead up", "instruction_bn": "১টি গুটি উপরে তোলো", "target_value": 1, "highlight_rods": [0]},
         {"instruction": "Push 2 earth beads up", "instruction_bn": "২টি গুটি উপরে তোলো", "target_value": 2, "highlight_rods": [0]},
         {"instruction": "Push 3 earth beads up", "instruction_bn": "৩টি গুটি উপরে তোলো", "target_value": 3, "highlight_rods": [0]},
         {"instruction": "Push all 4 earth beads up", "instruction_bn": "৪টি গুটি উপরে তোলো", "target_value": 4, "highlight_rods": [0]},
     ]}},
    {"sort_order": 1, "title": "Counting 1-4 Test", "title_bn": "১-৪ গণনা পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [1, 4], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80}, "content": {}},
    {"sort_order": 2, "title": "Friends of 5 (5-9)", "title_bn": "৫ এর বন্ধু (৫-৯)", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [5, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Push the heaven bead down for 5", "instruction_bn": "স্বর্গ গুটি নামাও ৫ এর জন্য", "target_value": 5, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 1 earth = 6", "instruction_bn": "স্বর্গ গুটি + ১ = ৬", "target_value": 6, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 2 earth = 7", "instruction_bn": "স্বর্গ গুটি + ২ = ৭", "target_value": 7, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 3 earth = 8", "instruction_bn": "স্বর্গ গুটি + ৩ = ৮", "target_value": 8, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 4 earth = 9", "instruction_bn": "স্বর্গ গুটি + ৪ = ৯", "target_value": 9, "highlight_rods": [0]},
     ]}},
    {"sort_order": 3, "title": "Counting 5-9 Test", "title_bn": "৫-৯ গণনা পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [5, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80}, "content": {}},
    {"sort_order": 4, "title": "Simple Addition", "title_bn": "সাধারণ যোগ", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": ["+"], "number_range": [1, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Show 3", "instruction_bn": "৩ দেখাও", "target_value": 3, "highlight_rods": [0]},
         {"instruction": "Add 2 more (total 5)", "instruction_bn": "আরো ২ যোগ করো (মোট ৫)", "target_value": 5, "highlight_rods": [0]},
         {"instruction": "Reset. Show 4", "instruction_bn": "রিসেট। ৪ দেখাও", "target_value": 4, "highlight_rods": [0]},
         {"instruction": "Add 3 (use heaven bead!)", "instruction_bn": "৩ যোগ করো (স্বর্গ গুটি!)", "target_value": 7, "highlight_rods": [0]},
     ]}},
    {"sort_order": 5, "title": "Addition Test", "title_bn": "যোগ পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": ["+"], "number_range": [1, 9], "num_rods": 1, "question_count": 10, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80}, "content": {}},
    {"sort_order": 6, "title": "Simple Subtraction", "title_bn": "সাধারণ বিয়োগ", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": ["-"], "number_range": [1, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Show 7", "instruction_bn": "৭ দেখাও", "target_value": 7, "highlight_rods": [0]},
         {"instruction": "Remove 2 (total 5)", "instruction_bn": "২ সরাও (মোট ৫)", "target_value": 5, "highlight_rods": [0]},
         {"instruction": "Reset. Show 9", "instruction_bn": "রিসেট। ৯ দেখাও", "target_value": 9, "highlight_rods": [0]},
         {"instruction": "Remove 4 (total 5)", "instruction_bn": "৪ সরাও (মোট ৫)", "target_value": 5, "highlight_rods": [0]},
     ]}},
    {"sort_order": 7, "title": "Subtraction Test", "title_bn": "বিয়োগ পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": ["-"], "number_range": [1, 9], "num_rods": 1, "question_count": 10, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80}, "content": {}},
    {"sort_order": 8, "title": "Two-Digit Numbers", "title_bn": "দুই অঙ্কের সংখ্যা", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": ["+", "-"], "number_range": [10, 99], "num_rods": 2, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Show 10 — push 1 bead on tens rod", "instruction_bn": "১০ দেখাও — দশক রডে ১টি গুটি", "target_value": 10, "highlight_rods": [1]},
         {"instruction": "Show 15", "instruction_bn": "১৫ দেখাও", "target_value": 15, "highlight_rods": [0, 1]},
         {"instruction": "Show 23", "instruction_bn": "২৩ দেখাও", "target_value": 23, "highlight_rods": [0, 1]},
         {"instruction": "Show 47", "instruction_bn": "৪৭ দেখাও", "target_value": 47, "highlight_rods": [0, 1]},
     ]}},
    {"sort_order": 9, "title": "Two-Digit Test", "title_bn": "দুই অঙ্কের পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": ["+", "-"], "number_range": [10, 99], "num_rods": 2, "question_count": 10, "time_limit_seconds": 120, "flash_duration_ms": 3000, "pass_percentage": 80}, "content": {}},
    {"sort_order": 10, "title": "Mental Math Introduction", "title_bn": "মানসিক গণিত পরিচিতি", "level_type": "tutorial", "exercise_type": "mixed",
     "config": {"operations": ["+", "-"], "number_range": [1, 20], "num_rods": 2, "question_count": 6, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Solve with abacus: 8 + 5", "instruction_bn": "অ্যাবাকাসে: ৮ + ৫", "target_value": 13, "highlight_rods": [0, 1]},
         {"instruction": "Now visualize: 6 + 7", "instruction_bn": "কল্পনা করো: ৬ + ৭", "target_value": 13, "highlight_rods": []},
         {"instruction": "Solve with abacus: 15 - 8", "instruction_bn": "অ্যাবাকাসে: ১৫ - ৮", "target_value": 7, "highlight_rods": [0, 1]},
     ]}},
    {"sort_order": 11, "title": "Mental Math Test", "title_bn": "মানসিক গণিত পরীক্ষা", "level_type": "test", "exercise_type": "mental_math",
     "config": {"operations": ["+", "-"], "number_range": [1, 50], "num_rods": 0, "question_count": 10, "time_limit_seconds": 120, "flash_duration_ms": 3000, "pass_percentage": 80}, "content": {}},
]


# ---- Schemas ----

class AbacusCourseCreateRequest(BaseModel):
    title: str
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal = Decimal("0")
    compare_price: Optional[Decimal] = None
    is_free: bool = False


class AbacusCourseUpdateRequest(BaseModel):
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


class LevelCreateRequest(BaseModel):
    title: str
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    level_type: str = "test"
    exercise_type: str = "bead_slide"
    config: dict = {}
    content: dict = {}
    sort_order: int = 0


class LevelUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    level_type: Optional[str] = None
    exercise_type: Optional[str] = None
    config: Optional[dict] = None
    content: Optional[dict] = None
    sort_order: Optional[int] = None


class ReorderRequest(BaseModel):
    level_ids: list[str]


class LevelSubmitRequest(BaseModel):
    child_profile_id: str
    score: int = 0
    total_points: int = 0
    time_seconds: int = 0
    passed: bool = False
    stars: int = 0
    attempt_data: dict = {}


# ---- Helpers ----

async def _get_course_response(course_id: UUID, db: AsyncSession, admin: bool = False):
    """Serialize a course with product + levels."""
    result = await db.execute(
        select(AbacusCourse)
        .options(selectinload(AbacusCourse.product), selectinload(AbacusCourse.levels))
        .where(AbacusCourse.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    product = course.product

    resp = {
        "id": str(course.id),
        "product_id": str(course.product_id),
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
        "total_levels": course.total_levels,
        "created_at": str(course.created_at) if course.created_at else None,
    }

    levels = []
    for lv in course.levels:
        level_data = {
            "id": str(lv.id),
            "sort_order": lv.sort_order,
            "title": lv.title,
            "title_bn": lv.title_bn,
            "description": lv.description,
            "description_bn": lv.description_bn,
            "level_type": lv.level_type,
            "exercise_type": lv.exercise_type,
        }
        if admin:
            level_data["config"] = lv.config
            level_data["content"] = lv.content
        levels.append(level_data)

    resp["levels"] = levels
    return resp


async def _get_level_progress(course_id: UUID, child_profile_id: UUID, db: AsyncSession):
    """For each level in the course, return lock/complete/stars state."""
    result = await db.execute(
        select(AbacusCourse)
        .options(selectinload(AbacusCourse.levels))
        .where(AbacusCourse.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    # Get all attempts for this child in this course's levels
    level_ids = [lv.id for lv in course.levels]
    attempts_map: dict[UUID, list] = {}
    if level_ids:
        attempts_result = await db.execute(
            select(AbacusAttempt)
            .where(
                AbacusAttempt.level_id.in_(level_ids),
                AbacusAttempt.child_profile_id == child_profile_id,
            )
            .order_by(AbacusAttempt.started_at.desc())
        )
        for attempt in attempts_result.scalars().all():
            attempts_map.setdefault(attempt.level_id, []).append(attempt)

    progress = []
    sorted_levels = sorted(course.levels, key=lambda lv: lv.sort_order)

    for i, lv in enumerate(sorted_levels):
        level_attempts = attempts_map.get(lv.id, [])
        best_passing = None
        for a in level_attempts:
            if a.passed:
                if best_passing is None or a.stars > best_passing.stars:
                    best_passing = a

        completed = best_passing is not None
        stars = best_passing.stars if best_passing else 0

        # First level is always unlocked; others require previous level passed
        if i == 0:
            locked = False
        else:
            prev_level = sorted_levels[i - 1]
            prev_attempts = attempts_map.get(prev_level.id, [])
            prev_passed = any(a.passed for a in prev_attempts)
            locked = not prev_passed

        progress.append({
            "id": str(lv.id),
            "sort_order": lv.sort_order,
            "title": lv.title,
            "title_bn": lv.title_bn,
            "level_type": lv.level_type,
            "exercise_type": lv.exercise_type,
            "locked": locked,
            "completed": completed,
            "stars": stars,
            "attempts_count": len(level_attempts),
        })

    return progress


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.post("/", status_code=201)
async def create_course(
    data: AbacusCourseCreateRequest,
    load_defaults: bool = Query(False),
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create an abacus course with product record (admin)."""
    slug = data.slug or slugify(data.title)

    # Check slug uniqueness
    existing = await db.execute(select(Product).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' already exists")

    # Create product
    product = Product(
        product_type=ProductType.ABACUS,
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

    # Create course
    course = AbacusCourse(
        product_id=product.id,
    )
    db.add(course)
    await db.flush()

    # Optionally load default curriculum levels
    if load_defaults:
        for lv_data in DEFAULT_CURRICULUM:
            level = AbacusLevel(
                abacus_course_id=course.id,
                sort_order=lv_data["sort_order"],
                title=lv_data["title"],
                title_bn=lv_data.get("title_bn"),
                level_type=lv_data.get("level_type", "test"),
                exercise_type=lv_data.get("exercise_type", "bead_slide"),
                config=lv_data.get("config", {}),
                content=lv_data.get("content", {}),
            )
            db.add(level)
        course.total_levels = len(DEFAULT_CURRICULUM)

    await db.commit()

    return await _get_course_response(course.id, db, admin=True)


@router.put("/{course_id}", status_code=200)
async def update_course(
    course_id: UUID,
    data: AbacusCourseUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update abacus course + product fields (admin)."""
    result = await db.execute(
        select(AbacusCourse).options(selectinload(AbacusCourse.product)).where(AbacusCourse.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    update_data = data.model_dump(exclude_unset=True)

    # Product-level fields
    product_fields = {
        "title", "title_bn", "slug", "description", "description_bn",
        "thumbnail_url", "price", "compare_price", "is_free", "is_active",
    }
    for field in product_fields:
        if field in update_data:
            setattr(course.product, field, update_data.pop(field))

    # Course-level fields
    for field, value in update_data.items():
        setattr(course, field, value)

    await db.commit()
    return await _get_course_response(course.id, db, admin=True)


@router.get("/{course_id}/admin")
async def get_course_admin(
    course_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Get full course with configs (admin view)."""
    return await _get_course_response(course_id, db, admin=True)


@router.post("/{course_id}/levels", status_code=201)
async def add_level(
    course_id: UUID,
    data: LevelCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a level to a course (admin)."""
    course = await db.get(AbacusCourse, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    level = AbacusLevel(
        abacus_course_id=course.id,
        sort_order=data.sort_order,
        title=data.title,
        title_bn=data.title_bn,
        description=data.description,
        description_bn=data.description_bn,
        level_type=data.level_type,
        exercise_type=data.exercise_type,
        config=data.config,
        content=data.content,
    )
    db.add(level)

    # Update total_levels
    course.total_levels = (course.total_levels or 0) + 1

    await db.commit()

    return {
        "id": str(level.id),
        "abacus_course_id": str(level.abacus_course_id),
        "sort_order": level.sort_order,
        "title": level.title,
        "title_bn": level.title_bn,
        "description": level.description,
        "description_bn": level.description_bn,
        "level_type": level.level_type,
        "exercise_type": level.exercise_type,
        "config": level.config,
        "content": level.content,
    }


@router.put("/levels/{level_id}", status_code=200)
async def update_level(
    level_id: UUID,
    data: LevelUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update level config/content/metadata (admin)."""
    level = await db.get(AbacusLevel, level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(level, field, value)

    await db.commit()

    return {
        "id": str(level.id),
        "abacus_course_id": str(level.abacus_course_id),
        "sort_order": level.sort_order,
        "title": level.title,
        "title_bn": level.title_bn,
        "description": level.description,
        "description_bn": level.description_bn,
        "level_type": level.level_type,
        "exercise_type": level.exercise_type,
        "config": level.config,
        "content": level.content,
    }


@router.delete("/levels/{level_id}", status_code=204)
async def delete_level(
    level_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a level, update total_levels (admin)."""
    level = await db.get(AbacusLevel, level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    course = await db.get(AbacusCourse, level.abacus_course_id)
    await db.delete(level)

    if course:
        course.total_levels = max((course.total_levels or 1) - 1, 0)

    await db.commit()


@router.put("/{course_id}/reorder", status_code=200)
async def reorder_levels(
    course_id: UUID,
    data: ReorderRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Reorder levels in a course (admin)."""
    course = await db.get(AbacusCourse, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    for idx, level_id_str in enumerate(data.level_ids):
        level_id = UUID(level_id_str)
        level = await db.get(AbacusLevel, level_id)
        if level and level.abacus_course_id == course_id:
            level.sort_order = idx

    await db.commit()
    return await _get_course_response(course_id, db, admin=True)


@router.post("/{course_id}/attach/{product_id}", status_code=201)
async def attach_course_to_product(
    course_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Attach an abacus course to another product (ProductAbacus link)."""
    course = await db.get(AbacusCourse, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already attached
    existing = await db.execute(
        select(ProductAbacus).where(
            ProductAbacus.abacus_course_id == course_id,
            ProductAbacus.product_id == product_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Course already attached to this product")

    link = ProductAbacus(abacus_course_id=course_id, product_id=product_id)
    db.add(link)
    await db.commit()

    return {"message": "Abacus course attached to product", "course_id": str(course_id), "product_id": str(product_id)}


@router.delete("/{course_id}/attach/{product_id}", status_code=204)
async def detach_course_from_product(
    course_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Detach an abacus course from a product."""
    result = await db.execute(
        select(ProductAbacus).where(
            ProductAbacus.abacus_course_id == course_id,
            ProductAbacus.product_id == product_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await db.delete(link)
    await db.commit()


@router.get("/{course_id}/attempts")
async def list_course_attempts(
    course_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """View all attempts for a course's levels (admin)."""
    course = await db.get(AbacusCourse, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    # Get all level IDs for this course
    levels_result = await db.execute(
        select(AbacusLevel.id).where(AbacusLevel.abacus_course_id == course_id)
    )
    level_ids = [row[0] for row in levels_result.all()]

    if not level_ids:
        return []

    result = await db.execute(
        select(AbacusAttempt)
        .options(
            selectinload(AbacusAttempt.user),
            selectinload(AbacusAttempt.child),
            selectinload(AbacusAttempt.level),
        )
        .where(AbacusAttempt.level_id.in_(level_ids))
        .order_by(AbacusAttempt.started_at.desc())
    )
    attempts = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "level_id": str(a.level_id),
            "level_title": a.level.title if a.level else None,
            "user_id": str(a.user_id),
            "child_profile_id": str(a.child_profile_id),
            "child_name": a.child.full_name if a.child else None,
            "score": a.score,
            "total_points": a.total_points,
            "stars": a.stars,
            "time_seconds": a.time_seconds,
            "passed": a.passed,
            "started_at": str(a.started_at) if a.started_at else None,
            "completed_at": str(a.completed_at) if a.completed_at else None,
        }
        for a in attempts
    ]


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@router.get("/")
async def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active abacus courses with product info (public)."""
    query = (
        select(AbacusCourse)
        .options(selectinload(AbacusCourse.product))
        .join(AbacusCourse.product)
        .where(Product.is_active == True, AbacusCourse.is_active == True)
    )

    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.title_bn.ilike(f"%{search}%")
        )

    query = query.order_by(AbacusCourse.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    courses = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "product_id": str(c.product_id),
            "title": c.product.title,
            "title_bn": c.product.title_bn,
            "slug": c.product.slug,
            "description": c.product.description,
            "description_bn": c.product.description_bn,
            "thumbnail_url": c.product.thumbnail_url,
            "price": str(c.product.price) if c.product.price is not None else "0",
            "compare_price": str(c.product.compare_price) if c.product.compare_price else None,
            "is_free": c.product.is_free,
            "total_levels": c.total_levels,
            "created_at": str(c.created_at) if c.created_at else None,
        }
        for c in courses
    ]


@router.get("/slug/{slug}")
async def get_course_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get abacus course detail by product slug (no configs)."""
    result = await db.execute(
        select(AbacusCourse)
        .options(selectinload(AbacusCourse.product), selectinload(AbacusCourse.levels))
        .join(AbacusCourse.product)
        .where(Product.slug == slug)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Abacus course not found")

    product = course.product
    levels = [
        {
            "id": str(lv.id),
            "sort_order": lv.sort_order,
            "title": lv.title,
            "title_bn": lv.title_bn,
            "description": lv.description,
            "description_bn": lv.description_bn,
            "level_type": lv.level_type,
            "exercise_type": lv.exercise_type,
        }
        for lv in course.levels
    ]

    return {
        "id": str(course.id),
        "product_id": str(course.product_id),
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
        "total_levels": course.total_levels,
        "created_at": str(course.created_at) if course.created_at else None,
        "levels": levels,
    }


# ============================================
# STUDENT ENDPOINTS
# ============================================

@router.get("/{course_id}/progress")
async def get_course_progress(
    course_id: UUID,
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get level map with lock/complete state for a child."""
    return await _get_level_progress(course_id, child_profile_id, db)


@router.get("/levels/{level_id}/start")
async def start_level(
    level_id: UUID,
    child_profile_id: UUID = Query(None),
    preview: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get level config for a student.
    Checks: entitlement (or free) + unlock (previous level passed).
    preview=true skips all checks (admin only).
    """
    result = await db.execute(
        select(AbacusLevel)
        .options(selectinload(AbacusLevel.course).selectinload(AbacusCourse.product))
        .where(AbacusLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    course = level.course
    product = course.product

    # Admin preview — skip all access checks
    if preview:
        from app.core.permissions import Permission
        user_permissions = set()
        for role in (user.roles or []):
            for perm in (role.permissions or []):
                user_permissions.add(perm.name)
        if Permission.COURSE_CREATE in user_permissions:
            return {
                "id": str(level.id),
                "abacus_course_id": str(level.abacus_course_id),
                "sort_order": level.sort_order,
                "title": level.title,
                "title_bn": level.title_bn,
                "description": level.description,
                "description_bn": level.description_bn,
                "level_type": level.level_type,
                "exercise_type": level.exercise_type,
                "config": level.config,
                "content": level.content,
            }

    # Check access: free course OR has entitlement
    if not product.is_free:
        has_access = False

        # Child-level entitlement
        if child_profile_id:
            ent_result = await db.execute(
                select(Entitlement).where(
                    Entitlement.child_profile_id == child_profile_id,
                    Entitlement.product_id == product.id,
                    Entitlement.entitlement_type == EntitlementType.ABACUS_ACCESS,
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
                    Entitlement.product_id == product.id,
                    Entitlement.entitlement_type == EntitlementType.ABACUS_ACCESS,
                    Entitlement.is_active == True,
                )
            )
            if ent_result.scalar_one_or_none():
                has_access = True

        # Check via ProductAbacus attachments
        if not has_access:
            attached_product_ids = await db.execute(
                select(ProductAbacus.product_id).where(ProductAbacus.abacus_course_id == course.id)
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
                detail="You do not have access to this course. Please purchase it first.",
            )

    # Check unlock: previous level must be passed (unless first level)
    if child_profile_id:
        course_levels_result = await db.execute(
            select(AbacusLevel)
            .where(AbacusLevel.abacus_course_id == course.id)
            .order_by(AbacusLevel.sort_order)
        )
        course_levels = course_levels_result.scalars().all()

        current_index = None
        for i, lv in enumerate(course_levels):
            if lv.id == level.id:
                current_index = i
                break

        if current_index is not None and current_index > 0:
            prev_level = course_levels[current_index - 1]
            prev_attempt_result = await db.execute(
                select(AbacusAttempt).where(
                    AbacusAttempt.level_id == prev_level.id,
                    AbacusAttempt.child_profile_id == child_profile_id,
                    AbacusAttempt.passed == True,
                )
            )
            if not prev_attempt_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=403,
                    detail="Previous level must be completed first.",
                )

    return {
        "id": str(level.id),
        "abacus_course_id": str(level.abacus_course_id),
        "sort_order": level.sort_order,
        "title": level.title,
        "title_bn": level.title_bn,
        "description": level.description,
        "description_bn": level.description_bn,
        "level_type": level.level_type,
        "exercise_type": level.exercise_type,
        "config": level.config,
        "content": level.content,
    }


@router.post("/levels/{level_id}/submit")
async def submit_level(
    level_id: UUID,
    data: LevelSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit level attempt. Save AbacusAttempt."""
    child_profile_id = UUID(data.child_profile_id)

    level = await db.get(AbacusLevel, level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    # Save attempt
    attempt = AbacusAttempt(
        level_id=level.id,
        child_profile_id=child_profile_id,
        user_id=user.id,
        score=data.score,
        total_points=data.total_points,
        time_seconds=data.time_seconds,
        passed=data.passed,
        stars=data.stars,
        attempt_data=data.attempt_data,
        completed_at=datetime.now(timezone.utc) if data.passed else None,
    )
    db.add(attempt)
    await db.commit()

    return {
        "attempt_id": str(attempt.id),
        "level_id": str(attempt.level_id),
        "child_profile_id": str(attempt.child_profile_id),
        "score": attempt.score,
        "total_points": attempt.total_points,
        "time_seconds": attempt.time_seconds,
        "passed": attempt.passed,
        "stars": attempt.stars,
        "attempt_data": attempt.attempt_data,
        "started_at": str(attempt.started_at) if attempt.started_at else None,
        "completed_at": str(attempt.completed_at) if attempt.completed_at else None,
    }


@router.get("/my")
async def my_courses(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all abacus courses the child has access to:
    1. Direct abacus entitlements (ABACUS_ACCESS for this child/user)
    2. Courses attached via ProductAbacus to any product the child has access to
    3. Free courses (product.is_free = True)
    """

    # 1. Direct entitlements: get product IDs with ABACUS_ACCESS
    direct_ent_result = await db.execute(
        select(Entitlement.product_id).where(
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
            Entitlement.entitlement_type == EntitlementType.ABACUS_ACCESS,
            Entitlement.is_active == True,
        )
    )
    direct_product_ids = {row[0] for row in direct_ent_result.all()}

    # 2. Courses attached via ProductAbacus to products the child has access to
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

    # Get course IDs attached to those products
    attached_course_ids = set()
    if all_entitled_product_ids:
        attached_result = await db.execute(
            select(ProductAbacus.abacus_course_id).where(
                ProductAbacus.product_id.in_(all_entitled_product_ids)
            )
        )
        attached_course_ids = {row[0] for row in attached_result.all()}

    # 3. Build query
    query = (
        select(AbacusCourse)
        .options(selectinload(AbacusCourse.product))
        .join(AbacusCourse.product)
        .where(AbacusCourse.is_active == True)
    )

    conditions = [Product.is_free == True]
    if direct_product_ids:
        conditions.append(AbacusCourse.product_id.in_(direct_product_ids))
    if attached_course_ids:
        conditions.append(AbacusCourse.id.in_(attached_course_ids))

    query = query.where(or_(*conditions))
    query = query.order_by(AbacusCourse.created_at.desc())

    result = await db.execute(query)
    courses = result.scalars().unique().all()

    return [
        {
            "id": str(c.id),
            "product_id": str(c.product_id),
            "title": c.product.title,
            "title_bn": c.product.title_bn,
            "slug": c.product.slug,
            "thumbnail_url": c.product.thumbnail_url,
            "price": str(c.product.price) if c.product.price is not None else "0",
            "is_free": c.product.is_free,
            "total_levels": c.total_levels,
        }
        for c in courses
    ]
