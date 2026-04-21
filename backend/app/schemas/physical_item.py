"""Physical item (shop product) schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


# ---- Product Images ----

class ProductImageCreateRequest(BaseModel):
    image_url: str
    alt_text: Optional[str] = None
    alt_text_bn: Optional[str] = None
    sort_order: int = 0


class ProductImageSchema(BaseModel):
    id: UUID
    image_url: str
    alt_text: Optional[str] = None
    alt_text_bn: Optional[str] = None
    sort_order: int = 0

    model_config = {"from_attributes": True}


# ---- Physical Items ----

class PhysicalItemCreateRequest(BaseModel):
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
    # Physical book fields
    author: Optional[str] = None
    isbn: Optional[str] = None
    weight_grams: Optional[int] = None
    stock_quantity: int = 0
    sku: Optional[str] = None
    category_id: Optional[int] = None
    # Images
    images: list[ProductImageCreateRequest] = []


class PhysicalItemUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_free: Optional[bool] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    weight_grams: Optional[int] = None
    stock_quantity: Optional[int] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    images: Optional[list[ProductImageCreateRequest]] = None


class PhysicalItemResponse(BaseModel):
    id: UUID
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
    # Physical book fields
    author: Optional[str] = None
    isbn: Optional[str] = None
    weight_grams: Optional[int] = None
    stock_quantity: int = 0
    sku: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_name_bn: Optional[str] = None
    # Images
    images: list[ProductImageSchema] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhysicalItemListResponse(BaseModel):
    id: UUID
    title: str
    title_bn: Optional[str] = None
    slug: str
    thumbnail_url: Optional[str] = None
    price: Decimal
    compare_price: Optional[Decimal] = None
    is_free: bool
    is_active: bool
    stock_quantity: int = 0
    category_name: Optional[str] = None
    category_name_bn: Optional[str] = None
    images: list[ProductImageSchema] = []

    model_config = {"from_attributes": True}
