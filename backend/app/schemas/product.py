"""Product schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


class ProductCreateRequest(BaseModel):
    product_type: str = Field(..., pattern="^(course|ebook|physical_book|bundle)$")
    title: str = Field(..., min_length=2, max_length=500)
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal = Field(default=0, ge=0)
    compare_price: Optional[Decimal] = None
    is_free: bool = False


class ProductUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_free: Optional[bool] = None


class ProductResponse(BaseModel):
    id: UUID
    product_type: str
    title: str
    title_bn: Optional[str] = None
    slug: str
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal
    compare_price: Optional[Decimal] = None
    currency: str = "BDT"
    is_active: bool
    is_free: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    id: UUID
    product_type: str
    title: str
    title_bn: Optional[str] = None
    slug: str
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal
    compare_price: Optional[Decimal] = None
    is_free: bool
    is_active: bool

    model_config = {"from_attributes": True}
