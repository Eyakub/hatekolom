"""Course, Module, Lesson schemas."""

from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.product import ProductResponse, ProductListResponse
from app.schemas.instructor import InstructorOut


class VideoBriefResponse(BaseModel):
    youtube_id: str

    model_config = {"from_attributes": True}


class LessonBriefResponse(BaseModel):
    id: UUID
    title: str
    title_bn: Optional[str] = None
    lesson_type: str
    sort_order: int
    duration_seconds: Optional[int] = None
    is_free: bool
    content: Optional[str] = None
    content_bn: Optional[str] = None
    allow_submission: bool = False
    allow_image_upload: bool = False
    max_grade: int = 10
    video: Optional[VideoBriefResponse] = None

    model_config = {"from_attributes": True}


class ModuleBriefResponse(BaseModel):
    id: UUID
    title: str
    title_bn: Optional[str] = None
    sort_order: int
    is_free: bool
    lessons: list[LessonBriefResponse] = []

    model_config = {"from_attributes": True}


class CourseCreateRequest(BaseModel):
    # Product fields
    title: str = Field(..., min_length=2, max_length=500)
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal = Field(default=0, ge=0)
    compare_price: Optional[Decimal] = None
    is_free: bool = False
    # Course-specific
    course_type: str = "recorded"
    instructor_id: Optional[UUID] = None
    category_id: Optional[int] = None
    level: Optional[str] = None
    duration_months: Optional[int] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    preview_video_url: Optional[str] = None
    is_featured: bool = False


class CourseUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    is_free: Optional[bool] = None
    is_active: Optional[bool] = None
    course_type: Optional[str] = None
    instructor_id: Optional[UUID] = None
    category_id: Optional[int] = None
    level: Optional[str] = None
    duration_months: Optional[int] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    preview_video_url: Optional[str] = None
    is_featured: Optional[bool] = None


class CourseResponse(BaseModel):
    id: UUID
    product_id: UUID
    course_type: str
    instructor_id: Optional[UUID] = None
    category_id: Optional[int] = None
    level: Optional[str] = None
    duration_months: Optional[int] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    total_lessons: int
    total_quizzes: int
    preview_video_url: Optional[str] = None
    is_featured: bool
    product: ProductResponse
    instructor: Optional[InstructorOut] = None
    modules: list[ModuleBriefResponse] = []

    model_config = {"from_attributes": True}


class CourseListItem(BaseModel):
    id: UUID
    course_type: str
    category_id: Optional[int] = None
    level: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    total_lessons: int
    is_featured: bool
    product: ProductListResponse
    instructor: Optional[InstructorOut] = None

    model_config = {"from_attributes": True}


# Module schemas

class ModuleCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=500)
    title_bn: Optional[str] = None
    sort_order: int = 0
    is_free: bool = False


class ModuleUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    sort_order: Optional[int] = None
    is_free: Optional[bool] = None


class ModuleResponse(BaseModel):
    id: UUID
    course_id: UUID
    title: str
    title_bn: Optional[str] = None
    sort_order: int
    is_free: bool
    lessons: list[LessonBriefResponse] = []

    model_config = {"from_attributes": True}


# Lesson schemas

class LessonCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=500)
    title_bn: Optional[str] = None
    lesson_type: str = "video_lecture"
    sort_order: int = 0
    duration_seconds: Optional[int] = None
    is_free: bool = False
    content: Optional[str] = None
    content_bn: Optional[str] = None
    youtube_id: Optional[str] = None
    allow_submission: bool = False
    allow_image_upload: bool = False
    max_grade: int = 10


class LessonUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    lesson_type: Optional[str] = None
    sort_order: Optional[int] = None
    duration_seconds: Optional[int] = None
    is_free: Optional[bool] = None
    content: Optional[str] = None
    content_bn: Optional[str] = None
    youtube_id: Optional[str] = None
    allow_submission: Optional[bool] = None
    allow_image_upload: Optional[bool] = None
    max_grade: Optional[int] = None


class VideoResponse(BaseModel):
    id: UUID
    youtube_id: str
    duration_seconds: Optional[int] = None
    thumbnail_url: Optional[str] = None

    model_config = {"from_attributes": True}


class LessonResponse(BaseModel):
    id: UUID
    module_id: UUID
    title: str
    title_bn: Optional[str] = None
    lesson_type: str
    sort_order: int
    duration_seconds: Optional[int] = None
    is_free: bool
    content: Optional[str] = None
    content_bn: Optional[str] = None
    allow_submission: bool = False
    allow_image_upload: bool = False
    max_grade: int = 10
    video: Optional[VideoResponse] = None

    model_config = {"from_attributes": True}
