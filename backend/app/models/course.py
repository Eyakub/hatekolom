"""Course, Module, Lesson, Video models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import CourseType, LessonType


class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True)
    course_type = Column(String(30), nullable=False, default=CourseType.RECORDED.value)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("instructors.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    level = Column(String(50), nullable=True)
    duration_months = Column(Integer, nullable=True)
    age_min = Column(Integer, nullable=True)
    age_max = Column(Integer, nullable=True)
    total_lessons = Column(Integer, default=0)
    total_quizzes = Column(Integer, default=0)
    preview_video_url = Column(String(500), nullable=True)
    is_featured = Column(Boolean, default=False)
    metadata_ = Column("metadata", JSONB, default=dict)

    product = relationship("Product", back_populates="course")
    category = relationship("Category", back_populates="courses")
    instructor = relationship("Instructor", lazy="selectin")
    modules = relationship("Module", back_populates="course", lazy="noload",
                           order_by="Module.sort_order")
    enrollments = relationship("Enrollment", back_populates="course", lazy="noload")


class Module(Base):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    is_free = Column(Boolean, default=False)

    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module", lazy="noload",
                           order_by="Lesson.sort_order")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    lesson_type = Column(String(30), nullable=False, default=LessonType.VIDEO_LECTURE.value)
    sort_order = Column(Integer, default=0)
    duration_seconds = Column(Integer, nullable=True)
    is_free = Column(Boolean, default=False)
    content = Column(Text, nullable=True)
    content_bn = Column(Text, nullable=True)
    attachment_key = Column(String(500), nullable=True)
    metadata_ = Column("metadata", JSONB, default=dict)

    # Assignment flags
    allow_submission = Column(Boolean, default=False)
    max_grade = Column(Integer, default=10)
    allow_image_upload = Column(Boolean, default=False)

    module = relationship("Module", back_populates="lessons")
    video = relationship("Video", back_populates="lesson", uselist=False, lazy="noload")
    progress_records = relationship("LessonProgress", back_populates="lesson", lazy="noload")
    submissions = relationship("AssignmentSubmission", back_populates="lesson", lazy="noload")


class Video(Base):
    __tablename__ = "videos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), unique=True)
    youtube_id = Column(String(20), nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    allowed_domains = Column(JSONB, default=list)
    watermark_enabled = Column(Boolean, default=True)

    lesson = relationship("Lesson", back_populates="video")
