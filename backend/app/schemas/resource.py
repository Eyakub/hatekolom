"""Pydantic schemas for Resource CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ResourceCreateLink(BaseModel):
    """JSON body for creating an external-link resource."""
    title: str = Field(..., min_length=1, max_length=255)
    title_bn: Optional[str] = Field(None, max_length=255)
    module_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    external_url: str = Field(..., min_length=1, max_length=1000)
    sort_order: int = 0


class ResourceUpdate(BaseModel):
    """PATCH body — all fields optional."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    title_bn: Optional[str] = Field(None, max_length=255)
    module_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    is_downloadable: Optional[bool] = None
    sort_order: Optional[int] = None


class ResourceResponse(BaseModel):
    """Public response — never exposes file_key."""
    id: uuid.UUID
    course_id: uuid.UUID
    module_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    title: str
    title_bn: Optional[str] = None
    resource_type: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    external_url: Optional[str] = None
    is_downloadable: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
