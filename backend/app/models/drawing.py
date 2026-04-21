"""Drawing models — canvas drawings and likes."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class Drawing(Base):
    __tablename__ = "drawings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=True)
    title_bn = Column(String(500), nullable=True)
    challenge_id = Column(UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="pending")  # pending | approved | rejected
    is_featured = Column(Boolean, default=False)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    child = relationship("ChildProfile")
    user = relationship("User")
    likes = relationship("DrawingLike", back_populates="drawing", lazy="noload")
    challenge = relationship("Challenge", back_populates="drawings")


class DrawingLike(Base):
    __tablename__ = "drawing_likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drawing_id = Column(UUID(as_uuid=True), ForeignKey("drawings.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    drawing = relationship("Drawing", back_populates="likes")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("drawing_id", "user_id", name="uq_drawing_like"),
    )
