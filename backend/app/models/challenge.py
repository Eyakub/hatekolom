"""Challenge models — daily/weekly drawing challenges."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    reference_image_url = Column(String(1000), nullable=True)
    challenge_type = Column(String(20), default="drawing")  # drawing | text | both
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)  # null = no end
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    drawings = relationship("Drawing", back_populates="challenge", lazy="noload")
