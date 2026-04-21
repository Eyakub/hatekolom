"""Exam models — exams, sections, questions, options, attempts, and product-exam links."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text,
    ForeignKey, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Exam(Base):
    __tablename__ = "exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    exam_type = Column(String(30), default="anytime")  # anytime | scheduled
    pass_percentage = Column(Integer, default=60)
    max_attempts = Column(Integer, nullable=True)  # null = unlimited
    time_limit_seconds = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    total_sections = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="exam")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan",
                            order_by="ExamSection.sort_order")
    attempts = relationship("ExamAttempt", back_populates="exam", lazy="noload")


class ExamSection(Base):
    __tablename__ = "exam_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    time_limit_seconds = Column(Integer, nullable=True)

    exam = relationship("Exam", back_populates="sections")
    questions = relationship("ExamQuestion", back_populates="section", cascade="all, delete-orphan",
                             order_by="ExamQuestion.sort_order")


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("exam_sections.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=True)
    question_text_bn = Column(Text, nullable=True)
    question_type = Column(String(20), default="mcq")
    sort_order = Column(Integer, default=0)
    points = Column(Integer, default=1)
    image_url = Column(String(1000), nullable=True)

    section = relationship("ExamSection", back_populates="questions")
    options = relationship("ExamOption", back_populates="question", cascade="all, delete-orphan",
                           order_by="ExamOption.sort_order")


class ExamOption(Base):
    __tablename__ = "exam_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(String(1000), nullable=True)
    option_text_bn = Column(String(1000), nullable=True)
    is_correct = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    image_url = Column(String(1000), nullable=True)

    question = relationship("ExamQuestion", back_populates="options")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 2), nullable=True)
    total_points = Column(Integer, default=0)
    earned_points = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    answers = Column(JSONB, default=dict)
    section_scores = Column(JSONB, default=list)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    exam = relationship("Exam", back_populates="attempts")
    user = relationship("User")
    child = relationship("ChildProfile")


class ProductExam(Base):
    __tablename__ = "product_exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
