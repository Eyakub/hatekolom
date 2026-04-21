"""Child profile schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ChildCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    full_name_bn: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    grade: Optional[str] = None
    interests: list[str] = []


class ChildUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    full_name_bn: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    grade: Optional[str] = None
    interests: Optional[list[str]] = None
    avatar_url: Optional[str] = None


class ChildResponse(BaseModel):
    id: UUID
    parent_id: UUID
    full_name: str
    full_name_bn: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    grade: Optional[str] = None
    avatar_url: Optional[str] = None
    interests: list[str] = []
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
