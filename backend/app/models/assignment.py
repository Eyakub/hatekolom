"""Assignment Submission model."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import SubmissionStatus


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)

    # Student's answer
    answer_text = Column(Text, nullable=True)
    file_urls = Column(JSONB, default=list)

    # Status & grading
    status = Column(String(30), default=SubmissionStatus.DRAFT.value, nullable=False)
    grade = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    graded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    graded_at = Column(DateTime(timezone=True), nullable=True)

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    lesson = relationship("Lesson", back_populates="submissions")
    child_profile = relationship("ChildProfile", lazy="selectin")
    grader = relationship("User", lazy="selectin")
