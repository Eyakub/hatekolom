"""Abacus models — courses, levels, attempts, and product-abacus links."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class AbacusCourse(Base):
    __tablename__ = "abacus_courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    total_levels = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="abacus_course")
    levels = relationship("AbacusLevel", back_populates="course", cascade="all, delete-orphan", order_by="AbacusLevel.sort_order")


class AbacusLevel(Base):
    __tablename__ = "abacus_levels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    abacus_course_id = Column(UUID(as_uuid=True), ForeignKey("abacus_courses.id", ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, default=0)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    level_type = Column(String(20), default="test")
    exercise_type = Column(String(20), default="bead_slide")
    config = Column(JSONB, default=dict)
    content = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    course = relationship("AbacusCourse", back_populates="levels")
    attempts = relationship("AbacusAttempt", back_populates="level", lazy="noload")


class AbacusAttempt(Base):
    __tablename__ = "abacus_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level_id = Column(UUID(as_uuid=True), ForeignKey("abacus_levels.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, default=0)
    total_points = Column(Integer, default=0)
    time_seconds = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    stars = Column(Integer, default=0)
    attempt_data = Column(JSONB, default=dict)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    level = relationship("AbacusLevel", back_populates="attempts")
    user = relationship("User")
    child = relationship("ChildProfile")


class ProductAbacus(Base):
    __tablename__ = "product_abacus"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    abacus_course_id = Column(UUID(as_uuid=True), ForeignKey("abacus_courses.id", ondelete="CASCADE"), nullable=False)
