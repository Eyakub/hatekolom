"""Quiz models — quizzes, questions, options, and attempts."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text,
    ForeignKey, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, unique=True)
    title = Column(String(255), nullable=False)
    title_bn = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    pass_percentage = Column(Integer, default=60)  # Minimum % to pass
    time_limit_seconds = Column(Integer, nullable=True)  # Optional time limit
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lesson = relationship("Lesson", backref="quiz_ref")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan",
                              order_by="QuizQuestion.sort_order")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_text_bn = Column(Text, nullable=True)
    question_type = Column(String(20), default="mcq")  # mcq, true_false
    sort_order = Column(Integer, default=0)
    points = Column(Integer, default=1)

    quiz = relationship("Quiz", back_populates="questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan",
                            order_by="QuizOption.sort_order")


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(String(500), nullable=False)
    option_text_bn = Column(String(500), nullable=True)
    is_correct = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    question = relationship("QuizQuestion", back_populates="options")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 2), default=0)  # Percentage score
    total_points = Column(Integer, default=0)
    earned_points = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    answers = Column(JSONB, default=dict)  # {question_id: selected_option_id}
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    quiz = relationship("Quiz")
    user = relationship("User")
