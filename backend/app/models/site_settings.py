import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db import Base

DEFAULT_FEATURE_FLAGS = {
    "games": True,
    "abacus": True,
    "badges": True,
    "gallery": True,
    "challenges": True,
}

class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform_name = Column(String, default="Hate Kolom", nullable=False)
    logo_url = Column(String, default="", nullable=True)
    favicon_url = Column(String, default="", nullable=True)

    # Contact info
    support_phone = Column(String, default="09610990880", nullable=True)
    support_email = Column(String, default="support@hatekolom.com", nullable=True)
    office_address = Column(String, default="Dhaka, Bangladesh", nullable=True)

    # Socials
    facebook_url = Column(String, default="https://facebook.com", nullable=True)
    youtube_url = Column(String, default="https://youtube.com", nullable=True)
    linkedin_url = Column(String, default="https://linkedin.com", nullable=True)
    instagram_url = Column(String, default="https://instagram.com", nullable=True)

    # Content
    footer_description_en = Column(Text, default="A new era of joyful learning. Learn abacus, math, coding and more from home.", nullable=True)
    footer_description_bn = Column(Text, default="আনন্দের সাথে শেখার নতুন যুগ। ঘরে বসে শিখুন অ্যাবাকাস, ম্যাথ, কোডিং ও আরও অনেক কিছু।", nullable=True)

    # Feature flags — single JSON field, add new keys without migrations
    feature_flags = Column(JSONB, default=lambda: dict(DEFAULT_FEATURE_FLAGS), nullable=True)

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
