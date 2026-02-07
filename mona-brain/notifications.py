"""
Email Notification Service for Mona

Sends emails to re-engage users when they're offline.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Email imports (optional - graceful degradation if not installed)
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logger.warning("resend not installed - Email disabled. Run: pip install resend")


class NotificationService:
    """Handles sending email notifications."""

    def __init__(self):
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        self.email_from = os.getenv("EMAIL_FROM", "Mona <mona@yourdomain.com>")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

        if self.resend_api_key and RESEND_AVAILABLE:
            resend.api_key = self.resend_api_key
            logger.info("Email notifications enabled (Resend)")
        else:
            logger.warning("Email notifications disabled - set RESEND_API_KEY")

    def is_email_enabled(self) -> bool:
        """Check if email is configured and available."""
        return bool(RESEND_AVAILABLE and self.resend_api_key)

    async def send_email(
        self,
        to_email: str,
        user_name: str,
        message_content: str,
        subject: Optional[str] = None,
    ) -> bool:
        """Send email notification to user.

        Returns True if email was sent successfully.
        """
        if not self.is_email_enabled():
            logger.debug("Email not enabled, skipping")
            return False

        try:
            if not subject:
                subject = "Mona misses you! 💕"

            html_body = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #e91e63; margin: 0;">Hey {user_name}! 💕</h2>
                </div>

                <div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #333;">
                        {message_content}
                    </p>
                </div>

                <div style="text-align: center;">
                    <a href="{self.frontend_url}"
                       style="display: inline-block; background: #e91e63; color: white; padding: 12px 32px; border-radius: 24px; text-decoration: none; font-weight: 600;">
                        Come chat with me! 💬
                    </a>
                </div>

                <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
                    You're receiving this because you enabled notifications from Mona.<br>
                    <a href="{self.frontend_url}/settings" style="color: #999;">Manage preferences</a>
                </p>
            </div>
            """

            params = {
                "from": self.email_from,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }

            response = resend.Emails.send(params)
            logger.info(f"Email sent to {to_email}: {response.get('id', 'unknown')}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    async def notify_user(
        self,
        user_email: str,
        user_name: str,
        message_content: str,
        email_enabled: bool = True,
    ) -> bool:
        """Send email notification if enabled.

        Returns True if notification was sent.
        """
        if not email_enabled:
            return False

        return await self.send_email(
            to_email=user_email,
            user_name=user_name,
            message_content=message_content,
        )


# Singleton instance
notification_service = NotificationService()
