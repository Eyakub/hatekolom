"""
SMS Service — BulkSMSBD integration with mock mode for development.

In mock mode, OTPs are logged to console instead of actually sent.
"""

import logging
import random
import string
from datetime import datetime, timezone, timedelta

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SMSService:
    """Send SMS via BulkSMSBD or mock in development."""

    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Generate a numeric OTP."""
        return "".join(random.choices(string.digits, k=length))

    @staticmethod
    async def send_sms(phone: str, message: str) -> bool:
        """
        Send SMS to a Bangladeshi phone number.
        
        In mock mode, logs the message instead of sending.
        Returns True if sent successfully.
        """
        # Normalize phone number
        normalized = phone.strip()
        if normalized.startswith("+88"):
            normalized = normalized[3:]
        elif normalized.startswith("88"):
            normalized = normalized[2:]

        if settings.SMS_MOCK:
            logger.info(f"[MOCK SMS] To: {normalized} | Message: {message}")
            return True

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    settings.SMS_API_URL,
                    data={
                        "api_key": settings.SMS_API_KEY,
                        "senderid": settings.SMS_SENDER_ID,
                        "number": normalized,
                        "message": message,
                    },
                )
                data = response.json()
                success = data.get("response_code") == 202
                if success:
                    logger.info(f"SMS sent to {normalized}")
                else:
                    logger.error(f"SMS failed to {normalized}: {data}")
                return success
        except Exception as e:
            logger.error(f"SMS error for {normalized}: {e}")
            return False

    @staticmethod
    async def send_otp(phone: str, otp: str) -> bool:
        """Send OTP verification SMS."""
        message = f"আপনার Hate Kolom যাচাইকরণ কোড: {otp}। ৫ মিনিটের মধ্যে ব্যবহার করুন।"
        return await SMSService.send_sms(phone, message)

    @staticmethod
    async def send_order_confirmation(phone: str, order_number: str, amount: str) -> bool:
        """Send order confirmation SMS."""
        message = f"অর্ডার সফল! অর্ডার নম্বর: {order_number}, মোট: ৳{amount}। ধন্যবাদ!"
        return await SMSService.send_sms(phone, message)
