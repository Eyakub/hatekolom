"""Homepage dynamic content CRUD router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.models.homepage import (
    HomepageTestimonial, HomepageStat, HomepageGallery, HomepageActivity,
)
from app.models import Product, ProductType, Enrollment, Instructor
from app.schemas.homepage import (
    TestimonialCreateRequest, TestimonialUpdateRequest, TestimonialResponse,
    StatCreateRequest, StatUpdateRequest, StatResponse,
    GalleryCreateRequest, GalleryUpdateRequest, GalleryResponse,
    ActivityCreateRequest, ActivityUpdateRequest, ActivityResponse,
    HomepageContentResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/homepage-content", tags=["Homepage Content"])


def _require_admin(user: User):
    roles = {r.name.value if hasattr(r.name, "value") else r.name for r in user.roles}
    if not roles.intersection({"super_admin", "admin"}):
        raise HTTPException(status_code=403, detail="Admin access required")


async def _auto_compute(source: str, db: AsyncSession) -> str:
    """Compute stat value from real DB data."""
    if source == "courses":
        result = await db.execute(
            select(func.count()).where(Product.product_type == ProductType.COURSE, Product.is_active == True)
        )
        return f"{result.scalar() or 0}+"
    elif source == "users":
        result = await db.execute(select(func.count(User.id)).where(User.is_active == True))
        return f"{result.scalar() or 0}+"
    elif source == "enrollments":
        result = await db.execute(select(func.count(Enrollment.id)))
        return f"{result.scalar() or 0}+"
    elif source == "instructors":
        result = await db.execute(select(func.count(Instructor.id)))
        return f"{result.scalar() or 0}+"
    return "0"


# ──────────────────────────────────────────────
# PUBLIC: Get all homepage content
# ──────────────────────────────────────────────

@router.get("/", response_model=HomepageContentResponse)
async def get_homepage_content(db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns all active homepage content."""
    # Testimonials
    result = await db.execute(
        select(HomepageTestimonial)
        .where(HomepageTestimonial.is_active == True)
        .order_by(HomepageTestimonial.sort_order)
    )
    testimonials = [TestimonialResponse.model_validate(t) for t in result.scalars().all()]

    # Stats (with auto-compute)
    result = await db.execute(
        select(HomepageStat)
        .where(HomepageStat.is_active == True)
        .order_by(HomepageStat.sort_order)
    )
    stats = []
    for s in result.scalars().all():
        stat = StatResponse.model_validate(s)
        if s.auto_calculate and s.auto_source:
            stat.computed_value = await _auto_compute(s.auto_source, db)
        stats.append(stat)

    # Gallery
    result = await db.execute(
        select(HomepageGallery)
        .where(HomepageGallery.is_active == True)
        .order_by(HomepageGallery.sort_order)
    )
    gallery = [GalleryResponse.model_validate(g) for g in result.scalars().all()]

    # Activities
    result = await db.execute(
        select(HomepageActivity)
        .where(HomepageActivity.is_active == True)
        .order_by(HomepageActivity.sort_order)
    )
    activities = [ActivityResponse.model_validate(a) for a in result.scalars().all()]

    return HomepageContentResponse(
        testimonials=testimonials, stats=stats, gallery=gallery, activities=activities,
    )


# ──────────────────────────────────────────────
# ADMIN: Testimonials CRUD
# ──────────────────────────────────────────────

@router.get("/testimonials/", response_model=list[TestimonialResponse])
async def list_testimonials(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageTestimonial).order_by(HomepageTestimonial.sort_order))
    return [TestimonialResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/testimonials/", response_model=TestimonialResponse, status_code=201)
async def create_testimonial(
    data: TestimonialCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    item = HomepageTestimonial(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return TestimonialResponse.model_validate(item)


@router.patch("/testimonials/{item_id}", response_model=TestimonialResponse)
async def update_testimonial(
    item_id: UUID, data: TestimonialUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageTestimonial).where(HomepageTestimonial.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return TestimonialResponse.model_validate(item)


@router.delete("/testimonials/{item_id}")
async def delete_testimonial(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageTestimonial).where(HomepageTestimonial.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Testimonial deleted"}


# ──────────────────────────────────────────────
# ADMIN: Stats CRUD
# ──────────────────────────────────────────────

@router.get("/stats/", response_model=list[StatResponse])
async def list_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageStat).order_by(HomepageStat.sort_order))
    stats = []
    for s in result.scalars().all():
        stat = StatResponse.model_validate(s)
        if s.auto_calculate and s.auto_source:
            stat.computed_value = await _auto_compute(s.auto_source, db)
        stats.append(stat)
    return stats


@router.post("/stats/", response_model=StatResponse, status_code=201)
async def create_stat(
    data: StatCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    item = HomepageStat(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return StatResponse.model_validate(item)


@router.patch("/stats/{item_id}", response_model=StatResponse)
async def update_stat(
    item_id: UUID, data: StatUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageStat).where(HomepageStat.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Stat not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return StatResponse.model_validate(item)


@router.delete("/stats/{item_id}")
async def delete_stat(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageStat).where(HomepageStat.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Stat not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Stat deleted"}


# ──────────────────────────────────────────────
# ADMIN: Gallery CRUD
# ──────────────────────────────────────────────

@router.get("/gallery/", response_model=list[GalleryResponse])
async def list_gallery(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageGallery).order_by(HomepageGallery.sort_order))
    return [GalleryResponse.model_validate(g) for g in result.scalars().all()]


@router.post("/gallery/", response_model=GalleryResponse, status_code=201)
async def create_gallery(
    data: GalleryCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    item = HomepageGallery(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return GalleryResponse.model_validate(item)


@router.patch("/gallery/{item_id}", response_model=GalleryResponse)
async def update_gallery(
    item_id: UUID, data: GalleryUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageGallery).where(HomepageGallery.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Gallery item not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return GalleryResponse.model_validate(item)


@router.delete("/gallery/{item_id}")
async def delete_gallery(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageGallery).where(HomepageGallery.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Gallery item not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Gallery item deleted"}


# ──────────────────────────────────────────────
# ADMIN: Activities CRUD
# ──────────────────────────────────────────────

@router.get("/activities/", response_model=list[ActivityResponse])
async def list_activities(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageActivity).order_by(HomepageActivity.sort_order))
    return [ActivityResponse.model_validate(a) for a in result.scalars().all()]


@router.post("/activities/", response_model=ActivityResponse, status_code=201)
async def create_activity(
    data: ActivityCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    item = HomepageActivity(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ActivityResponse.model_validate(item)


@router.patch("/activities/{item_id}", response_model=ActivityResponse)
async def update_activity(
    item_id: UUID, data: ActivityUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageActivity).where(HomepageActivity.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Activity not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return ActivityResponse.model_validate(item)


@router.delete("/activities/{item_id}")
async def delete_activity(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    result = await db.execute(select(HomepageActivity).where(HomepageActivity.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Activity deleted"}
