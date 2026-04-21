"""Ebook and PhysicalBook models."""

import uuid

from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class Ebook(Base):
    __tablename__ = "ebooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True)
    author = Column(String(255), nullable=True)
    isbn = Column(String(20), nullable=True)
    pages = Column(Integer, nullable=True)
    b2_key = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    preview_pages = Column(Integer, default=5)

    product = relationship("Product", back_populates="ebook")
    category = relationship("Category")


class PhysicalBook(Base):
    __tablename__ = "physical_books"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True)
    author = Column(String(255), nullable=True)
    isbn = Column(String(20), nullable=True)
    weight_grams = Column(Integer, nullable=True)
    stock_quantity = Column(Integer, default=0)
    sku = Column(String(100), unique=True, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    product = relationship("Product", back_populates="physical_book")
    category = relationship("Category")
