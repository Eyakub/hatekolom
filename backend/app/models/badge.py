"""Badge models — platform-wide badge system."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Badge(Base):
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(300), nullable=False)
    name_bn = Column(String(300), nullable=True)
    description = Column(String(1000), nullable=True)
    description_bn = Column(String(1000), nullable=True)
    icon_url = Column(String(1000), nullable=True)
    category = Column(String(30), default="general")  # art | games | exams | abacus | courses | general
    criteria = Column(JSONB, default=dict)  # { trigger, threshold, description }
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    child_badges = relationship("ChildBadge", back_populates="badge", lazy="noload")


class ChildBadge(Base):
    __tablename__ = "child_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    earned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    child = relationship("ChildProfile")
    badge = relationship("Badge", back_populates="child_badges")

    __table_args__ = (
        UniqueConstraint("child_profile_id", "badge_id", name="uq_child_badge"),
    )
