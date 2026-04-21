"""
Email Service — SMTP-based email sending for notifications.

Supports:
- Welcome emails after registration
- Order confirmation emails
- Password reset emails
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Send transactional emails via SMTP."""

    @staticmethod
    def _create_connection():
        """Create SMTP connection."""
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        return server

    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: Optional[str] = None,
    ) -> bool:
        """
        Send an email.
        
        Returns True if sent successfully.
        Fails silently if SMTP is not configured (logs warning).
        """
        if not settings.SMTP_USER:
            logger.warning(f"[MOCK EMAIL] To: {to_email} | Subject: {subject}")
            logger.info(f"[MOCK EMAIL BODY]\n{plain_body or html_body[:200]}")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            msg["To"] = to_email

            if plain_body:
                msg.attach(MIMEText(plain_body, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            server = EmailService._create_connection()
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
            server.quit()

            logger.info(f"Email sent to {to_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Email failed to {to_email}: {e}")
            return False

    @staticmethod
    async def send_welcome_email(name: str, email: str, phone: str) -> bool:
        """Send welcome email after registration."""
        subject = "স্বাগতম — Happy Baby-এ যোগ দেওয়ার জন্য ধন্যবাদ!"
        html = f"""
        <div style="font-family: 'Noto Sans Bengali', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 30px; border-radius: 16px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">স্বাগতম, {name}!</h1>
                <p style="margin: 10px 0 0; opacity: 0.9;">Happy Baby-এ তোমার অ্যাকাউন্ট তৈরি হয়েছে।</p>
            </div>
            <div style="padding: 24px 0;">
                <p>প্রিয় {name},</p>
                <p>আমাদের প্ল্যাটফর্মে যোগ দেওয়ার জন্য ধন্যবাদ! এখন তুমি:</p>
                <ul>
                    <li>তোমার সন্তানের প্রোফাইল তৈরি করতে পারো</li>
                    <li>মজার কোর্সে ভর্তি করাতে পারো</li>
                    <li>শেখার অগ্রগতি ট্র্যাক করতে পারো</li>
                </ul>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/dashboard"
                       style="background: #7c3aed; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: bold;">
                        ড্যাশবোর্ডে যাও
                    </a>
                </div>
            </div>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
                <p>এই ইমেইল Happy Baby থেকে পাঠানো হয়েছে।</p>
            </div>
        </div>
        """
        return await EmailService.send_email(email, subject, html, f"স্বাগতম {name}! Happy Baby-এ তোমার অ্যাকাউন্ট তৈরি হয়েছে।")

    @staticmethod
    async def send_order_confirmation(
        email: str,
        name: str,
        order_number: str,
        total: str,
        items_summary: str = "",
    ) -> bool:
        """Send order confirmation email."""
        subject = f"অর্ডার নিশ্চিত — #{order_number}"
        html = f"""
        <div style="font-family: 'Noto Sans Bengali', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #059669, #34d399); padding: 30px; border-radius: 16px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">✓ অর্ডার সফল!</h1>
                <p style="margin: 10px 0 0; font-size: 18px;">#{order_number}</p>
            </div>
            <div style="padding: 24px 0;">
                <p>প্রিয় {name},</p>
                <p>তোমার অর্ডার সফলভাবে সম্পন্ন হয়েছে!</p>
                
                <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 16px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">অর্ডার নম্বর</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold;">{order_number}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">মোট</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #7c3aed;">৳{total}</td>
                        </tr>
                    </table>
                </div>

                {f'<p style="color: #6b7280; font-size: 14px;">{items_summary}</p>' if items_summary else ''}
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/dashboard"
                       style="background: #7c3aed; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: bold;">
                        ড্যাশবোর্ডে যাও
                    </a>
                </div>
            </div>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
                <p>এই ইমেইল Happy Baby থেকে পাঠানো হয়েছে।</p>
            </div>
        </div>
        """
        plain = f"অর্ডার সফল! অর্ডার #{order_number}, মোট: ৳{total}"
        return await EmailService.send_email(email, subject, html, plain)

    @staticmethod
    async def send_password_reset(email: str, name: str, reset_token: str) -> bool:
        """Send password reset email with token link."""
        subject = "পাসওয়ার্ড রিসেট — Happy Baby"
        reset_url = f"http://localhost:3000/reset-password?token={reset_token}"
        html = f"""
        <div style="font-family: 'Noto Sans Bengali', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #dc2626, #f87171); padding: 30px; border-radius: 16px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">পাসওয়ার্ড রিসেট</h1>
            </div>
            <div style="padding: 24px 0;">
                <p>প্রিয় {name},</p>
                <p>তোমার পাসওয়ার্ড রিসেট করতে নিচের বাটনে ক্লিক করো:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}"
                       style="background: #dc2626; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: bold;">
                        পাসওয়ার্ড রিসেট করো
                    </a>
                </div>
                <p style="color: #9ca3af; font-size: 12px;">এই লিঙ্ক ৩০ মিনিটের মধ্যে মেয়াদোত্তীর্ণ হবে।</p>
            </div>
        </div>
        """
        return await EmailService.send_email(email, subject, html, f"পাসওয়ার্ড রিসেট লিঙ্ক: {reset_url}")
