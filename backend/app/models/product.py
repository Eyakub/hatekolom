"""Product, Bundle, Category models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import ProductType


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_type = Column(String(30), nullable=False)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    slug = Column(String(500), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    compare_price = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(3), default="BDT")
    is_active = Column(Boolean, default=True)
    is_free = Column(Boolean, default=False)
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Polymorphic relations
    course = relationship("Course", back_populates="product", uselist=False, lazy="noload")
    ebook = relationship("Ebook", back_populates="product", uselist=False, lazy="noload")
    physical_book = relationship("PhysicalBook", back_populates="product", uselist=False, lazy="noload")
    bundle = relationship("Bundle", back_populates="product", uselist=False, lazy="noload")
    exam = relationship("Exam", back_populates="product", uselist=False, lazy="noload")
    game = relationship("Game", back_populates="product", uselist=False, lazy="noload")
    abacus_course = relationship("AbacusCourse", back_populates="product", uselist=False, lazy="noload")
    images = relationship("ProductImage", back_populates="product", lazy="noload", order_by="ProductImage.sort_order")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    name_bn = Column(String(255), nullable=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    icon_url = Column(String(500), nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    category_type = Column(String(20), nullable=False, default="course")  # "course" or "shop"

    parent = relationship("Category", remote_side=[id], backref="children")
    courses = relationship("Course", back_populates="category", lazy="noload")


class Bundle(Base):
    __tablename__ = "bundles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True)
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    product = relationship("Product", back_populates="bundle")
    items = relationship("BundleItem", back_populates="bundle", lazy="noload")


class BundleItem(Base):
    __tablename__ = "bundle_items"

    bundle_id = Column(UUID(as_uuid=True), ForeignKey("bundles.id", ondelete="CASCADE"), primary_key=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    sort_order = Column(Integer, default=0)

    bundle = relationship("Bundle", back_populates="items")
    product = relationship("Product")
