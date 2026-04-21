from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slugify import slugify

from app.db import get_db
from app.models import Category
from app.schemas import (
    CategoryCreateRequest, CategoryUpdateRequest, CategoryResponse, MessageResponse,
)
from app.api.deps import PermissionChecker, get_current_user
from app.core.permissions import Permission
from app.models import User

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    category_type: str = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
):
    """List categories. Optional ?type=course|shop filter."""
    query = select(Category).order_by(Category.sort_order, Category.name)
    if category_type:
        query = query.where(Category.category_type == category_type)
    result = await db.execute(query)
    categories = result.scalars().all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single category by ID."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryResponse.model_validate(category)


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new category (admin/instructor only)."""
    base_slug = data.slug or slugify(data.name)
    # Ensure unique slug — append category_type if conflict
    slug = base_slug
    existing = await db.execute(select(Category).where(Category.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{base_slug}-{data.category_type}"
        existing2 = await db.execute(select(Category).where(Category.slug == slug))
        if existing2.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category with slug '{slug}' already exists",
            )

    category = Category(
        name=data.name,
        name_bn=data.name_bn,
        slug=slug,
        icon_url=data.icon_url,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
        category_type=data.category_type,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)

    return CategoryResponse.model_validate(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a category."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = data.model_dump(exclude_unset=True)
    if "slug" in update_data and update_data["slug"]:
        existing = await db.execute(
            select(Category).where(
                Category.slug == update_data["slug"],
                Category.id != category_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Slug already in use")

    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", response_model=MessageResponse)
async def delete_category(
    category_id: int,
    user: User = Depends(PermissionChecker([Permission.COURSE_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a category."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()

    return MessageResponse(message="Category deleted")
