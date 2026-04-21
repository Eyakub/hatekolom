from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.db import get_db
from app.models import User, Role, RoleType
from app.schemas import UserResponse, UserUpdateRequest, MessageResponse
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    role: str = Query(None),
    user: User = Depends(PermissionChecker([Permission.USER_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    query = select(User).options(selectinload(User.roles))

    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") |
            User.phone.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%")
        )

    if role:
        query = query.join(User.roles).where(Role.name == role)

    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    return [UserResponse.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(PermissionChecker([Permission.USER_VIEW])),
    db: AsyncSession = Depends(get_db),
):
    """Get a user by ID (admin only)."""
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UserUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update own profile."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user, ["roles"])
    return UserResponse.model_validate(user)


@router.post("/{user_id}/ban", response_model=MessageResponse)
async def ban_user(
    user_id: UUID,
    current_user: User = Depends(PermissionChecker([Permission.USER_BAN])),
    db: AsyncSession = Depends(get_db),
):
    """Ban/deactivate a user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.commit()

    return MessageResponse(message=f"User {user.full_name} has been deactivated")


@router.post("/{user_id}/unban", response_model=MessageResponse)
async def unban_user(
    user_id: UUID,
    current_user: User = Depends(PermissionChecker([Permission.USER_BAN])),
    db: AsyncSession = Depends(get_db),
):
    """Unban/reactivate a user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    await db.commit()

    return MessageResponse(message=f"User {user.full_name} has been reactivated")


@router.post("/{user_id}/roles/{role_name}", response_model=MessageResponse)
async def assign_role(
    user_id: UUID,
    role_name: str,
    current_user: User = Depends(PermissionChecker([Permission.USER_ASSIGN_ROLE])),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user (admin only)."""
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        role_type = RoleType(role_name)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role_name}")

    role_result = await db.execute(select(Role).where(Role.name == role_type))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role not found: {role_name}")

    if role in user.roles:
        raise HTTPException(status_code=409, detail="User already has this role")

    user.roles.append(role)
    await db.commit()

    return MessageResponse(message=f"Role '{role_name}' assigned to {user.full_name}")
