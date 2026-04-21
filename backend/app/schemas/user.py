"""User schemas — responses and updates."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


class UserResponse(BaseModel):
    id: UUID
    phone: Optional[str] = None
    email: Optional[str] = None
    full_name: str
    full_name_bn: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    roles: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("roles", mode="before")
    @classmethod
    def extract_role_names(cls, v):
        if v and len(v) > 0 and hasattr(v[0], "name"):
            return [r.name.value if hasattr(r.name, "value") else r.name for r in v]
        return v


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    full_name_bn: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
