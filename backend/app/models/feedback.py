"""Course Feedback model — guardian feedback, complaints, suggestions on courses."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean, Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class CourseFeedback(Base):
    __tablename__ = "course_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Type: review, complaint, suggestion, improvement
    feedback_type = Column(String(30), nullable=False, default="review")
    rating = Column(Integer, nullable=True)  # 1-5 stars, only for reviews
    message = Column(Text, nullable=False)

    # Admin response
    admin_response = Column(Text, nullable=True)
    responded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Status tracking
    is_resolved = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    responder = relationship("User", foreign_keys=[responded_by], lazy="selectin")
    course = relationship("Course")
