"""Enrollment and LessonProgress models — per-child course tracking."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Boolean, DateTime, ForeignKey, Integer,
    Numeric, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"),
                              nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    progress_pct = Column(Numeric(5, 2), default=0)

    child = relationship("ChildProfile", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    progress_records = relationship("LessonProgress", back_populates="enrollment", lazy="noload")

    __table_args__ = (
        UniqueConstraint("child_profile_id", "course_id", name="uq_enrollment_child_course"),
    )


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    is_completed = Column(Boolean, default=False)
    watch_seconds = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    last_position = Column(Integer, default=0)

    enrollment = relationship("Enrollment", back_populates="progress_records")
    lesson = relationship("Lesson", back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint("enrollment_id", "lesson_id", name="uq_progress_enrollment_lesson"),
    )
