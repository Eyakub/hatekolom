import uuid
from sqlalchemy import Column, String, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.db import Base

class Instructor(Base):
    __tablename__ = "instructors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    name_bn = Column(String(255), nullable=True)
    designation = Column(String(255), nullable=True)
    designation_bn = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    bio_bn = Column(Text, nullable=True)
    profile_image_url = Column(String(1024), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    facebook_url = Column(String(1024), nullable=True)
    linkedin_url = Column(String(1024), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
