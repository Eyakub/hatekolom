import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db import get_db
from app.models import User, ChildProfile, Entitlement, EntitlementType, Course, Enrollment, Product
from app.schemas import (
    ChildCreateRequest, ChildUpdateRequest, ChildResponse, MessageResponse,
)
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/children", tags=["Children"])

MAX_CHILDREN = 2


class UnassignedCourseItem(BaseModel):
    entitlement_id: str
    product_id: str
    product_title: Optional[str] = None
    product_title_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None


class ChildCreateResponse(BaseModel):
    id: str
    parent_id: str
    full_name: str
    full_name_bn: Optional[str] = None
    grade: Optional[str] = None
    avatar_url: Optional[str] = None
    interests: list = []
    is_active: bool
    created_at: datetime
    unassigned_courses: list[UnassignedCourseItem] = []  # For the modal


class AssignCoursesRequest(BaseModel):
    product_ids: list[UUID]  # Products to assign to this child


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_child(
    data: ChildCreateRequest,
    user: User = Depends(PermissionChecker([Permission.CHILD_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a child profile under the current parent (max 2 per account)."""
    # Enforce max children limit
    count_result = await db.execute(
        select(func.count(ChildProfile.id)).where(
            ChildProfile.parent_id == user.id,
            ChildProfile.is_active == True,
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= MAX_CHILDREN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_CHILDREN} child profiles allowed per account",
        )

    child = ChildProfile(
        parent_id=user.id,
        full_name=data.full_name,
        full_name_bn=data.full_name_bn,
        date_of_birth=data.date_of_birth,
        grade=data.grade,
        interests=data.interests,
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)

    # Find user-level (NULL child) entitlements — these are unassigned courses
    unassigned_result = await db.execute(
        select(Entitlement)
        .options(selectinload(Entitlement.product))
        .where(
            Entitlement.user_id == user.id,
            Entitlement.child_profile_id == None,
            Entitlement.is_active == True,
            Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
        )
    )
    unassigned = unassigned_result.scalars().all()

    unassigned_courses = []
    for ent in unassigned:
        product = ent.product
        if product:
            unassigned_courses.append(UnassignedCourseItem(
                entitlement_id=str(ent.id),
                product_id=str(product.id),
                product_title=product.title,
                product_title_bn=product.title_bn,
                thumbnail_url=product.thumbnail_url,
            ))

    logger.info(
        f"Child {child.id} created for user {user.id}. "
        f"Found {len(unassigned_courses)} unassigned courses."
    )

    return ChildCreateResponse(
        id=str(child.id),
        parent_id=str(child.parent_id),
        full_name=child.full_name,
        full_name_bn=child.full_name_bn,
        grade=child.grade,
        avatar_url=child.avatar_url,
        interests=child.interests or [],
        is_active=child.is_active,
        created_at=child.created_at,
        unassigned_courses=unassigned_courses,
    )


@router.get("/", response_model=list[ChildResponse])
async def list_children(
    user: User = Depends(PermissionChecker([Permission.CHILD_VIEW_PROGRESS])),
    db: AsyncSession = Depends(get_db),
):
    """List all children of the current parent."""
    result = await db.execute(
        select(ChildProfile)
        .where(ChildProfile.parent_id == user.id)
        .where(ChildProfile.is_active == True)
        .order_by(ChildProfile.created_at)
    )
    children = result.scalars().all()
    return [ChildResponse.model_validate(c) for c in children]


@router.get("/{child_id}", response_model=ChildResponse)
async def get_child(
    child_id: UUID,
    user: User = Depends(PermissionChecker([Permission.CHILD_VIEW_PROGRESS])),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific child profile."""
    result = await db.execute(
        select(ChildProfile)
        .where(ChildProfile.id == child_id)
        .where(ChildProfile.parent_id == user.id)
    )
    child = result.scalar_one_or_none()

    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child profile not found",
        )
    return ChildResponse.model_validate(child)


@router.patch("/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: UUID,
    data: ChildUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.CHILD_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a child profile."""
    result = await db.execute(
        select(ChildProfile)
        .where(ChildProfile.id == child_id)
        .where(ChildProfile.parent_id == user.id)
    )
    child = result.scalar_one_or_none()

    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child profile not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(child, field, value)

    await db.commit()
    await db.refresh(child)
    return ChildResponse.model_validate(child)


@router.post("/{child_id}/assign-courses", response_model=MessageResponse)
async def assign_courses_to_child(
    child_id: UUID,
    data: AssignCoursesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign selected courses to a specific child.
    Supports both unassigned (NULL child) entitlements and sharing a course
    already assigned to another child — the parent can assign the same
    purchased course to multiple children.
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
        raise HTTPException(status_code=404, detail="Child profile not found")

    assigned = 0
    for product_id in data.product_ids:
        # Check if child already has this entitlement
        existing = await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user.id,
                Entitlement.child_profile_id == child_id,
                Entitlement.product_id == product_id,
                Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
                Entitlement.is_active == True,
            )
        )
        if existing.scalar_one_or_none():
            continue  # Already assigned, skip

        # First try: NULL child entitlement (unassigned pool)
        ent_result = await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user.id,
                Entitlement.product_id == product_id,
                Entitlement.child_profile_id == None,
                Entitlement.is_active == True,
                Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
            )
        )
        source_ent = ent_result.scalar_one_or_none()

        # Fallback: any active entitlement for this product (already assigned to another child)
        if not source_ent:
            any_ent_result = await db.execute(
                select(Entitlement).where(
                    Entitlement.user_id == user.id,
                    Entitlement.product_id == product_id,
                    Entitlement.is_active == True,
                    Entitlement.entitlement_type == EntitlementType.COURSE_ACCESS,
                ).limit(1)
            )
            source_ent = any_ent_result.scalar_one_or_none()

        if not source_ent:
            continue  # Skip — user doesn't own this product at all

        # Create child-specific entitlement
        new_ent = Entitlement(
            user_id=user.id,
            child_profile_id=child_id,
            product_id=product_id,
            order_item_id=source_ent.order_item_id,
            entitlement_type=EntitlementType.COURSE_ACCESS.value,
            metadata_={"assigned_from": str(source_ent.id)},
        )
        db.add(new_ent)

        # Create enrollment
        course_result = await db.execute(
            select(Course).where(Course.product_id == product_id)
        )
        course = course_result.scalar_one_or_none()
        if course:
            enroll_check = await db.execute(
                select(Enrollment).where(
                    Enrollment.child_profile_id == child_id,
                    Enrollment.course_id == course.id,
                )
            )
            if not enroll_check.scalar_one_or_none():
                db.add(Enrollment(child_profile_id=child_id, course_id=course.id))

        assigned += 1

    await db.commit()
    logger.info(f"Assigned {assigned} courses to child {child_id}")
    return MessageResponse(message=f"{assigned} course(s) assigned successfully")


@router.delete("/{child_id}", response_model=MessageResponse)
async def delete_child(
    child_id: UUID,
    user: User = Depends(PermissionChecker([Permission.CHILD_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a child profile."""
    result = await db.execute(
        select(ChildProfile)
        .where(ChildProfile.id == child_id)
        .where(ChildProfile.parent_id == user.id)
    )
    child = result.scalar_one_or_none()

    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child profile not found",
        )

    child.is_active = False
    await db.commit()

    return MessageResponse(message="Child profile deactivated")
