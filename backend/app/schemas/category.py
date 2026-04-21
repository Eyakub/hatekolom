"""Category schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class CategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    name_bn: Optional[str] = None
    slug: Optional[str] = None
    icon_url: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0
    category_type: str = Field(default="course", pattern="^(course|shop)$")


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    name_bn: Optional[str] = None
    slug: Optional[str] = None
    icon_url: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    category_type: Optional[str] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    name_bn: Optional[str] = None
    slug: str
    icon_url: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int
    category_type: str = "course"

    model_config = {"from_attributes": True}
