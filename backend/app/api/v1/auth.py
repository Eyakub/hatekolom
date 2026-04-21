from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field

from app.db import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.models import User, Role, RoleType, OTPVerification
from app.schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshTokenRequest, UserResponse, MessageResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---- OTP Schemas ----

class SendOTPRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=15)
    purpose: str = Field(default="registration", pattern="^(registration|login|password_reset)$")

class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=15)
    code: str = Field(..., min_length=4, max_length=6)

class PasswordResetRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=15)

class PasswordResetConfirm(BaseModel):
    phone: str = Field(..., min_length=11, max_length=15)
    code: str = Field(..., min_length=4, max_length=6)
    new_password: str = Field(..., min_length=6)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new parent account."""
    # Check if phone already exists
    existing = await db.execute(select(User).where(User.phone == data.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered",
        )

    # Create user
    user = User(
        phone=data.phone,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        full_name_bn=data.full_name_bn,
    )
    db.add(user)
    await db.flush()

    # Assign parent role via join table directly (avoids lazy load)
    parent_role = await db.execute(select(Role).where(Role.name == RoleType.PARENT))
    role = parent_role.scalar_one_or_none()
    if role:
        from app.models import UserRole
        db.add(UserRole(user_id=user.id, role_id=role.id))

    await db.commit()

    # Reload user with roles eagerly loaded
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user.id)
    )
    user = result.scalar_one()

    # Generate tokens
    role_names = [r.name for r in user.roles]
    access_token = create_access_token(subject=str(user.id), roles=role_names)
    refresh_token = create_refresh_token(subject=str(user.id))

    # Send welcome email (async, non-blocking)
    try:
        from app.services.email_service import EmailService
        if user.email:
            await EmailService.send_welcome_email(user.full_name, user.email, user.phone or "")
    except Exception:
        pass  # Don't fail registration if email fails

    # OTP verification on registration — paused for now
    # To re-enable: uncomment the block below
    # try:
    #     from app.services.sms_service import SMSService
    #     otp_code = SMSService.generate_otp()
    #     otp_record = OTPVerification(
    #         phone=data.phone,
    #         code=otp_code,
    #         purpose="registration",
    #         expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    #     )
    #     db.add(otp_record)
    #     await db.commit()
    #     await SMSService.send_otp(data.phone, otp_code)
    # except Exception:
    #     pass

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with phone + password."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.phone == data.phone)
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    role_names = [r.name for r in user.roles]
    access_token = create_access_token(subject=str(user.id), roles=role_names)
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Get new access token using refresh token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    role_names = [r.name for r in user.roles]
    access_token = create_access_token(subject=str(user.id), roles=role_names)
    new_refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return UserResponse.model_validate(user)


# ============================================
# OTP ENDPOINTS
# ============================================

@router.post("/send-otp", response_model=MessageResponse)
async def send_otp(data: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Send OTP to a phone number.
    
    Rate limited: max 5 OTPs per phone per hour.
    OTP expires in 5 minutes.
    """
    # Rate limit: count OTPs sent in last hour
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    count_result = await db.execute(
        select(func.count(OTPVerification.id)).where(
            OTPVerification.phone == data.phone,
            OTPVerification.created_at >= one_hour_ago,
        )
    )
    count = count_result.scalar() or 0

    if count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Try again later.",
        )

    # Generate OTP
    from app.services.sms_service import SMSService
    otp_code = SMSService.generate_otp()

    # Store OTP
    otp = OTPVerification(
        phone=data.phone,
        code=otp_code,
        purpose=data.purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()

    # Send SMS
    sent = await SMSService.send_otp(data.phone, otp_code)

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to send OTP. Please try again.",
        )

    return MessageResponse(message="OTP sent successfully")


@router.post("/verify-otp")
async def verify_otp(data: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify an OTP code.
    
    Returns success if code matches and hasn't expired.
    Max 3 verification attempts per OTP.
    """
    # Find latest unused OTP for this phone
    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.phone == data.phone,
            OTPVerification.is_used == False,
            OTPVerification.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp = result.scalar_one_or_none()

    if not otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired or not found. Request a new one.",
        )

    # Check attempts
    if otp.attempts >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Request a new OTP.",
        )

    # Verify code
    if otp.code != data.code:
        otp.attempts += 1
        await db.commit()
        remaining = 3 - otp.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempts remaining.",
        )

    # Mark as used
    otp.is_used = True
    await db.commit()

    # If registration purpose, mark user as verified
    user_result = await db.execute(
        select(User).where(User.phone == data.phone)
    )
    user = user_result.scalar_one_or_none()
    if user:
        user.is_verified = True
        await db.commit()

    return {
        "success": True,
        "message": "Phone verified successfully",
        "verified": True,
    }


# ============================================
# PASSWORD RESET
# ============================================

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Send password reset OTP to phone.
    
    Works even if phone doesn't exist (to prevent enumeration).
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.phone == data.phone))
    user = result.scalar_one_or_none()

    if not user:
        # Don't reveal if phone exists or not
        return MessageResponse(message="If this phone is registered, you will receive an OTP.")

    # Rate limit
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    count_result = await db.execute(
        select(func.count(OTPVerification.id)).where(
            OTPVerification.phone == data.phone,
            OTPVerification.purpose == "password_reset",
            OTPVerification.created_at >= one_hour_ago,
        )
    )
    count = count_result.scalar() or 0
    if count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many reset requests. Try again later.",
        )

    # Generate and send OTP
    from app.services.sms_service import SMSService
    otp_code = SMSService.generate_otp()

    otp = OTPVerification(
        phone=data.phone,
        code=otp_code,
        purpose="password_reset",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()

    await SMSService.send_sms(data.phone, f"আপনার পাসওয়ার্ড রিসেট কোড: {otp_code}। ৫ মিনিটের মধ্যে ব্যবহার করুন।")

    return MessageResponse(message="If this phone is registered, you will receive an OTP.")


@router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    """
    Verify OTP and set new password.
    """
    # Find valid OTP
    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.phone == data.phone,
            OTPVerification.purpose == "password_reset",
            OTPVerification.is_used == False,
            OTPVerification.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp = result.scalar_one_or_none()

    if not otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired or not found. Request a new one.",
        )

    if otp.attempts >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Request a new OTP.",
        )

    if otp.code != data.code:
        otp.attempts += 1
        await db.commit()
        remaining = 3 - otp.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempts remaining.",
        )

    # Mark OTP as used
    otp.is_used = True

    # Update password
    user_result = await db.execute(select(User).where(User.phone == data.phone))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(data.new_password)
    await db.commit()

    return {
        "success": True,
        "message": "Password reset successfully. You can now login.",
    }

@router.get("/make-me-admin/{phone}")
async def make_me_admin(phone: str, db: AsyncSession = Depends(get_db)):
    """Temporary endpoint to grant superadmin role."""
    from app.models import Role, RoleType, UserRole
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if not user:
        return {"error": "User not found"}
    
    role_result = await db.execute(select(Role).where(Role.name == RoleType.SUPER_ADMIN))
    admin_role = role_result.scalar_one_or_none()
    
    # clear existing roles just in case
    await db.execute(UserRole.__table__.delete().where(UserRole.user_id == user.id))
    
    db.add(UserRole(user_id=user.id, role_id=admin_role.id))
    await db.commit()
    return {"success": f"Granted super_admin to {phone}"}

@router.get("/update-thumbnails")
async def update_thumbnails(db: AsyncSession = Depends(get_db)):
    from app.models import Course
    urls = {
        "abacus-level-1-basic": "https://images.unsplash.com/photo-1596461404969-9ce20c71c471?q=80&w=800&auto=format&fit=crop",
        "live-english-speaking-class": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=800&auto=format&fit=crop",
        "kids-islamic-education": "https://images.unsplash.com/photo-1584281722883-9b870e28f148?q=80&w=800&auto=format&fit=crop",
        "kids-coding-scratch": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop"
    }

    updated = []
    for slug, url in urls.items():
        result = await db.execute(select(Course).where(Course.slug == slug))
        course = result.scalar_one_or_none()
        if course:
            course.thumbnail_url = url
            updated.append(slug)
    await db.commit()
    return {"success": updated}
