"""OTP verification model."""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, func
from app.db import Base


class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(15), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    purpose = Column(String(50), nullable=False, default="registration")  # registration, login, password_reset
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)  # Failed verification attempts
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
