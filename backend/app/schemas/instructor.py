from pydantic import BaseModel, HttpUrl, Field
from typing import Optional
from uuid import UUID

class InstructorBase(BaseModel):
    name: str = Field(..., max_length=255)
    name_bn: Optional[str] = Field(None, max_length=255)
    designation: Optional[str] = Field(None, max_length=255)
    designation_bn: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = None
    bio_bn: Optional[str] = None
    profile_image_url: Optional[str] = Field(None, max_length=1024)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    facebook_url: Optional[str] = Field(None, max_length=1024)
    linkedin_url: Optional[str] = Field(None, max_length=1024)

class InstructorCreate(InstructorBase):
    pass

class InstructorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    name_bn: Optional[str] = Field(None, max_length=255)
    designation: Optional[str] = Field(None, max_length=255)
    designation_bn: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = None
    bio_bn: Optional[str] = None
    profile_image_url: Optional[str] = Field(None, max_length=1024)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    facebook_url: Optional[str] = Field(None, max_length=1024)
    linkedin_url: Optional[str] = Field(None, max_length=1024)

class InstructorOut(InstructorBase):
    id: UUID

    class Config:
        from_attributes = True
