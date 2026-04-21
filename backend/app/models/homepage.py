"""Homepage dynamic content models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class HomepageTestimonial(Base):
    """Voices/testimonials section — parent reviews with photo + video."""
    __tablename__ = "homepage_testimonials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)
    video_type = Column(String(20), default="upload")        # "upload", "youtube", "vimeo"
    quote = Column(Text, nullable=False)
    quote_bn = Column(Text, nullable=True)
    author_name = Column(String(255), nullable=False)
    author_role = Column(String(255), nullable=True)
    author_role_bn = Column(String(255), nullable=True)
    gradient_color = Column(String(50), default="from-primary-700")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HomepageStat(Base):
    """Achievement stats section — numbers with auto/manual toggle."""
    __tablename__ = "homepage_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String(100), nullable=False)
    label_bn = Column(String(100), nullable=True)
    value = Column(String(50), nullable=False)
    value_en = Column(String(50), nullable=True)
    auto_calculate = Column(Boolean, default=False)
    auto_source = Column(String(50), nullable=True)          # "courses", "users", "enrollments", "instructors"
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class HomepageGallery(Base):
    """Success gallery — student work / success photos."""
    __tablename__ = "homepage_gallery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_url = Column(String(500), nullable=False)
    title = Column(String(255), nullable=True)
    title_bn = Column(String(255), nullable=True)
    label = Column(String(255), nullable=True)
    label_bn = Column(String(255), nullable=True)
    column_group = Column(Integer, default=1)                # 1 or 2 for scrolling columns
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HomepageActivity(Base):
    """Activities section — promotional cards."""
    __tablename__ = "homepage_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    title_bn = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    icon_name = Column(String(50), default="Palette")
    border_color = Column(String(50), default="border-primary-500")
    time_label = Column(String(50), nullable=True)
    xp_label = Column(String(50), nullable=True)
    cta_text = Column(String(100), nullable=True)
    cta_text_bn = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
