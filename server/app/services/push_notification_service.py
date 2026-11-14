import base64
from datetime import datetime
import json
import logging
import os
from pathlib import Path
from typing import Any
import zoneinfo

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid
from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

# Fallback persistent file for generated VAPID keys if not specified in env
VAPID_CACHE_FILE = Path(__file__).resolve().parent.parent / "vapid_keys.json"

_CACHED_VAPID_KEYS: dict[str, str] | None = None


def get_or_create_vapid_keys() -> tuple[str, str]:
    """
    Returns (public_key_b64, private_key_pem).
    Uses settings.vapid_public_key/vapid_private_key if provided,
    otherwise retrieves or generates and stores them in VAPID_CACHE_FILE.
    """
    global _CACHED_VAPID_KEYS

    if settings.vapid_public_key and settings.vapid_private_key:
        return settings.vapid_public_key, settings.vapid_private_key

    if _CACHED_VAPID_KEYS is not None:
        return _CACHED_VAPID_KEYS["public_key"], _CACHED_VAPID_KEYS["private_key"]

    if VAPID_CACHE_FILE.exists():
        try:
            with open(VAPID_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("public_key") and data.get("private_key"):
                    _CACHED_VAPID_KEYS = data
                    return data["public_key"], data["private_key"]
        except Exception as e:
            logger.warning(f"Could not read {VAPID_CACHE_FILE}: {e}")

    # Generate new VAPID keypair
    v = Vapid()
    v.generate_keys()
    raw_pub = v.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    b64_pub = base64.urlsafe_b64encode(raw_pub).decode("utf-8").rstrip("=")
    priv_pem = v.private_pem().decode("utf-8")

    key_data = {
        "public_key": b64_pub,
        "private_key": priv_pem,
    }

    try:
        with open(VAPID_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(key_data, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not write {VAPID_CACHE_FILE}: {e}")

    _CACHED_VAPID_KEYS = key_data
    return b64_pub, priv_pem


def get_vapid_public_key() -> str:
    pub, _ = get_or_create_vapid_keys()
    return pub


def is_push_category_enabled(db: Session, user_id: int, category: str) -> bool:
    """
    Checks if a user has enabled a specific push notification category in PersonalSettings.
    Supported categories:
      - 'push_task_assigned'
      - 'push_task_due_today'
      - 'push_log_note_update'
      - 'push_task_completed'
      - 'push_task_comments'
    Returns True by default if settings do not exist yet.
    """
    try:
        from app.models.personal_settings import PersonalSettings

        settings_rec = db.query(PersonalSettings).filter(PersonalSettings.user_id == user_id).first()
        if settings_rec is None:
            return True
        val = getattr(settings_rec, category, None)
        return True if val is None else bool(val)
    except Exception as e:
        logger.warning(f"Error checking push category {category} for user {user_id}: {e}")
        return True


def is_in_quiet_hours(db: Session, user_id: int) -> bool:
    """
    Checks if current local time for the user falls within their configured quiet hours.
    Returns True if current time is within quiet hours (so notifications should be suppressed).
    """
    try:
        from app.models.personal_settings import PersonalSettings

        settings_rec = db.query(PersonalSettings).filter(PersonalSettings.user_id == user_id).first()
        if not settings_rec or not settings_rec.quiet_hours_start or not settings_rec.quiet_hours_end:
            return False

        start_str = settings_rec.quiet_hours_start.strip()
        end_str = settings_rec.quiet_hours_end.strip()
        if not start_str or not end_str:
            return False

        # Determine user's local time based on their timezone
        tz_str = settings_rec.timezone or "Asia/Kolkata"
        try:
            tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            tz = zoneinfo.ZoneInfo("Asia/Kolkata")

        now_local = datetime.now(tz)
        current_time_str = now_local.strftime("%H:%M")

        if start_str <= end_str:
            # Same-day range (e.g. "13:00" to "15:00")
            return start_str <= current_time_str < end_str
        else:
            # Overnight range (e.g. "22:00" to "08:00")
            return current_time_str >= start_str or current_time_str < end_str
    except Exception as e:
        logger.warning(f"Error checking quiet hours for user {user_id}: {e}")
        return False


def send_push_to_user(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    url: str | None = None,
    tag: str | None = None,
    data: dict[str, Any] | None = None,
    ignore_quiet_hours: bool = False,
) -> int:
    """
    Dispatches a Web Push notification to all active devices of a user.
    Suppresses dispatch if user is currently in Quiet Hours (unless ignore_quiet_hours=True).
    Removes invalid/expired endpoints automatically.
    Returns the count of successfully delivered push notifications.
    """
    if not ignore_quiet_hours and is_in_quiet_hours(db, user_id):
        logger.info(f"Push notification for user {user_id} suppressed due to active Quiet Hours.")
        return 0

    subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subscriptions:
        return 0

    _, priv_pem = get_or_create_vapid_keys()

    payload = {
        "title": title,
        "body": body,
        "url": url or "/",
        "tag": tag or "kim-notification",
        "data": data or {"url": url or "/"},
    }
    payload_str = json.dumps(payload)

    claim_email = settings.vapid_claim_email or "mailto:admin@konwertindiamotors.com"
    claims = {"sub": claim_email}

    delivered = 0
    expired_ids = []

    for sub in subscriptions:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            },
        }

        try:
            vapid_obj = Vapid.from_pem(priv_pem.encode("utf-8"))
            webpush(
                subscription_info=sub_info,
                data=payload_str,
                vapid_private_key=vapid_obj,
                vapid_claims=claims,
                ttl=3600,
            )
            delivered += 1
        except WebPushException as ex:
            # 404 or 410 indicates endpoint is no longer valid / user unsubscribed
            status_code = getattr(ex.response, "status_code", None) if hasattr(ex, "response") else None
            if status_code in (404, 410):
                expired_ids.append(sub.id)
            else:
                logger.warning(f"WebPush failed for endpoint {sub.endpoint[:40]}...: {ex}")
        except Exception as ex:
            logger.warning(f"Unexpected error sending web push: {ex}")

    if expired_ids:
        db.query(PushSubscription).filter(PushSubscription.id.in_(expired_ids)).delete(synchronize_session=False)
        db.commit()

    return delivered


def create_and_push_notification(
    db: Session,
    user_id: int,
    message: str,
    link: str | None = None,
    title: str = "KIM Notification",
) -> Notification:
    """
    Creates an in-app database Notification and dispatches a Web Push notification.
    """
    notif = Notification(user_id=user_id, message=message, link=link)
    db.add(notif)
    db.commit()
    db.refresh(notif)

    try:
        send_push_to_user(
            db=db,
            user_id=user_id,
            title=title,
            body=message,
            url=link or "/notifications",
        )
    except Exception as e:
        logger.error(f"Failed to send push notification to user {user_id}: {e}")

    return notif
