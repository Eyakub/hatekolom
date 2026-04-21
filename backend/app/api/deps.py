from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.core.security import decode_token
from app.core.permissions import Permission, ROLE_PERMISSIONS
from app.models import User

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated user with roles loaded."""
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


class PermissionChecker:
    """Reusable dependency for permission-based access control."""

    def __init__(self, required_permissions: list[Permission]):
        self.required = set(required_permissions)

    async def __call__(self, user: User = Depends(get_current_user)) -> User:
        user_perms = set()
        for role in user.roles:
            role_name = role.name.value if hasattr(role.name, "value") else role.name
            perms = ROLE_PERMISSIONS.get(role_name, [])
            user_perms.update(perms)

        if not self.required.issubset(user_perms):
            missing = self.required - user_perms
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {[p.value for p in missing]}",
            )
        return user


def require_roles(*role_names: str):
    """Simple role-based check (no permission granularity)."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        user_role_names = {
            r.name.value if hasattr(r.name, "value") else r.name
            for r in user.roles
        }
        if not user_role_names.intersection(set(role_names)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required roles: {role_names}",
            )
        return user

    return checker
