"""Time and timezone utility helpers to ensure all times are captured in local time."""

from datetime import datetime, timezone, timedelta

# India Standard Time offset (+05:30)
DEFAULT_LOCAL_TZ = timezone(timedelta(hours=5, minutes=30))


def get_local_now() -> datetime:
    """Return current datetime in the local timezone (defaults to system local timezone, or IST +05:30 on UTC servers)."""
    local_now = datetime.now().astimezone()
    if local_now.utcoffset() == timedelta(0):
        return datetime.now(DEFAULT_LOCAL_TZ)
    return local_now


def to_local_datetime(dt: datetime | None) -> datetime | None:
    """Convert any datetime (aware or naive) into local timezone datetime."""
    if dt is None:
        return None
    target_tz = get_local_now().tzinfo or DEFAULT_LOCAL_TZ
    if dt.tzinfo is not None:
        return dt.astimezone(target_tz)
    return dt.replace(tzinfo=target_tz)
