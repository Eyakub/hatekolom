"""Child profile model — managed by parent users."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class ChildProfile(Base):
    __tablename__ = "child_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    full_name_bn = Column(String(255), nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    grade = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    interests = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    parent = relationship("User", back_populates="children")
    enrollments = relationship("Enrollment", back_populates="child", lazy="noload")
    entitlements = relationship("Entitlement", back_populates="child", lazy="noload")
