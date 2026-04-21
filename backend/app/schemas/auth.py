"""Auth schemas — login, register, token."""

from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


class RegisterRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=15)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    full_name_bn: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[^0-9+]", "", v)
        if cleaned.startswith("+880"):
            cleaned = "0" + cleaned[4:]
        if not re.match(r"^01[3-9]\d{8}$", cleaned):
            raise ValueError("Invalid Bangladesh phone number")
        return cleaned


class LoginRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=15)
    password: str = Field(..., min_length=1)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[^0-9+]", "", v)
        if cleaned.startswith("+880"):
            cleaned = "0" + cleaned[4:]
        return cleaned


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# Forward ref resolved at bottom
from app.schemas.user import UserResponse  # noqa: E402, F401
TokenResponse.model_rebuild()
