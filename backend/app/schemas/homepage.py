"""Homepage content schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ---- Testimonials ----

class TestimonialCreateRequest(BaseModel):
    quote: str = Field(..., min_length=5)
    quote_bn: Optional[str] = None
    author_name: str = Field(..., min_length=2)
    author_role: Optional[str] = None
    author_role_bn: Optional[str] = None
    photo_url: Optional[str] = None
    video_url: Optional[str] = None
    video_type: str = "upload"  # "upload", "youtube", "vimeo"
    gradient_color: str = "from-primary-700"
    sort_order: int = 0
    is_active: bool = True


class TestimonialUpdateRequest(BaseModel):
    quote: Optional[str] = None
    quote_bn: Optional[str] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    author_role_bn: Optional[str] = None
    photo_url: Optional[str] = None
    video_url: Optional[str] = None
    video_type: Optional[str] = None
    gradient_color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class TestimonialResponse(BaseModel):
    id: UUID
    photo_url: Optional[str] = None
    video_url: Optional[str] = None
    video_type: str = "upload"
    quote: str
    quote_bn: Optional[str] = None
    author_name: str
    author_role: Optional[str] = None
    author_role_bn: Optional[str] = None
    gradient_color: str = "from-primary-700"
    sort_order: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---- Stats ----

class StatCreateRequest(BaseModel):
    label: str = Field(..., min_length=1)
    label_bn: Optional[str] = None
    value: str = Field(..., min_length=1)
    value_en: Optional[str] = None
    auto_calculate: bool = False
    auto_source: Optional[str] = None  # "courses", "users", "enrollments", "instructors"
    sort_order: int = 0
    is_active: bool = True


class StatUpdateRequest(BaseModel):
    label: Optional[str] = None
    label_bn: Optional[str] = None
    value: Optional[str] = None
    value_en: Optional[str] = None
    auto_calculate: Optional[bool] = None
    auto_source: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class StatResponse(BaseModel):
    id: UUID
    label: str
    label_bn: Optional[str] = None
    value: str
    value_en: Optional[str] = None
    computed_value: Optional[str] = None  # filled when auto_calculate=True
    auto_calculate: bool = False
    auto_source: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

    model_config = {"from_attributes": True}


# ---- Gallery ----

class GalleryCreateRequest(BaseModel):
    image_url: str
    title: Optional[str] = None
    title_bn: Optional[str] = None
    label: Optional[str] = None
    label_bn: Optional[str] = None
    column_group: int = 1  # 1 or 2
    sort_order: int = 0
    is_active: bool = True


class GalleryUpdateRequest(BaseModel):
    image_url: Optional[str] = None
    title: Optional[str] = None
    title_bn: Optional[str] = None
    label: Optional[str] = None
    label_bn: Optional[str] = None
    column_group: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class GalleryResponse(BaseModel):
    id: UUID
    image_url: str
    title: Optional[str] = None
    title_bn: Optional[str] = None
    label: Optional[str] = None
    label_bn: Optional[str] = None
    column_group: int = 1
    sort_order: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---- Activities ----

class ActivityCreateRequest(BaseModel):
    title: str = Field(..., min_length=2)
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    image_url: Optional[str] = None
    icon_name: str = "Palette"
    border_color: str = "border-primary-500"
    time_label: Optional[str] = None
    xp_label: Optional[str] = None
    cta_text: Optional[str] = None
    cta_text_bn: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ActivityUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    image_url: Optional[str] = None
    icon_name: Optional[str] = None
    border_color: Optional[str] = None
    time_label: Optional[str] = None
    xp_label: Optional[str] = None
    cta_text: Optional[str] = None
    cta_text_bn: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ActivityResponse(BaseModel):
    id: UUID
    title: str
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    image_url: Optional[str] = None
    icon_name: str = "Palette"
    border_color: str = "border-primary-500"
    time_label: Optional[str] = None
    xp_label: Optional[str] = None
    cta_text: Optional[str] = None
    cta_text_bn: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---- Aggregated Response ----

class HomepageContentResponse(BaseModel):
    testimonials: list[TestimonialResponse] = []
    stats: list[StatResponse] = []
    gallery: list[GalleryResponse] = []
    activities: list[ActivityResponse] = []
