from datetime import UTC, timedelta
import threading
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.core.security import DUMMY_ARGON2_HASH, verify_password
from app.models import ApplicationSequence, User
from app.models.user import UserStatus
from app.schemas.auth import LoginRequest
from app.services.aging import utcnow

logger = get_logger("auth")

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15
IP_RATE_LIMIT_MAX_ATTEMPTS = 15
IP_RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes

_ip_lock = threading.Lock()
_ip_failed_attempts: dict[str, list] = {}


def _to_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _record_ip_failed_attempt(ip: str | None) -> None:
    if not ip:
        return
    now = utcnow()
    with _ip_lock:
        cutoff = now - timedelta(seconds=IP_RATE_LIMIT_WINDOW_SECONDS)
        attempts = [t for t in _ip_failed_attempts.get(ip, []) if t > cutoff]
        attempts.append(now)
        _ip_failed_attempts[ip] = attempts


def _check_ip_rate_limit(ip: str | None) -> bool:
    """Returns True if rate limited, False otherwise."""
    if not ip:
        return False
    now = utcnow()
    with _ip_lock:
        cutoff = now - timedelta(seconds=IP_RATE_LIMIT_WINDOW_SECONDS)
        attempts = [t for t in _ip_failed_attempts.get(ip, []) if t > cutoff]
        _ip_failed_attempts[ip] = attempts
        return len(attempts) >= IP_RATE_LIMIT_MAX_ATTEMPTS


def _clear_ip_failed_attempts(ip: str | None) -> None:
    if not ip:
        return
    with _ip_lock:
        _ip_failed_attempts.pop(ip, None)


def authenticate_user(db: Session, payload: LoginRequest, client_ip: str | None = None) -> User:
    """
    Authenticate user by email, username, or employee_id with Argon2 password verification.
    Enforces strict rate limiting, account lockout, constant-time timing protection,
    and unified generic error messages to prevent account enumeration.
    """
    # 1. Check IP-level rate limiting
    if _check_ip_rate_limit(client_ip):
        logger.warning("IP rate limit exceeded for authentication", extra={"client_ip": client_ip})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )

    ident = payload.email.strip() if payload.email else ""
    raw_password = payload.password if payload.password else ""

    if not ident or not raw_password or not raw_password.strip():
        _record_ip_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    try:
        user = (
            db.query(User)
            .filter(
                or_(
                    func.lower(User.email) == ident.lower(),
                    func.lower(User.username) == ident.lower(),
                    func.lower(User.employee_id) == ident.lower(),
                )
            )
            .first()
        )
    except Exception as exc:
        logger.error("Database error during user query", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from None

    # Constant-time mitigation against account enumeration:
    if not user:
        verify_password(raw_password, DUMMY_ARGON2_HASH)
        _record_ip_failed_attempt(client_ip)
        logger.warning("Login failed: account not found", extra={"client_ip": client_ip})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    now = utcnow()
    user_locked_until = _to_utc(user.locked_until)

    # 2. Check if account is locked
    if user_locked_until and user_locked_until > now:
        logger.warning("Login failed: account locked", extra={"user_id": user.id, "client_ip": client_ip})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account is temporarily locked due to multiple failed login attempts. Please try again later.",
        )

    # If lockout time expired, auto-unlock
    if user_locked_until and user_locked_until <= now:
        user.locked_until = None
        user.failed_login_attempts = 0
        if user.status == UserStatus.LOCKED:
            user.status = UserStatus.ACTIVE

    # 3. Check account status
    if user.status == UserStatus.INACTIVE or user.status == UserStatus.LOCKED:
        _record_ip_failed_attempt(client_ip)
        logger.warning("Login failed: inactive or locked status", extra={"user_id": user.id, "client_ip": client_ip})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 4. Verify password with Argon2
    is_valid = False
    try:
        is_valid = verify_password(raw_password, user.password_hash)
    except Exception as exc:
        logger.error("Password verification error", exc_info=exc)
        is_valid = False

    if not is_valid:
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            user.status = UserStatus.LOCKED
            logger.warning(
                "Account locked due to exceeding maximum failed login attempts",
                extra={"user_id": user.id, "attempts": user.failed_login_attempts, "client_ip": client_ip},
            )

        db.add(user)
        try:
            db.commit()
        except Exception:
            db.rollback()

        _record_ip_failed_attempt(client_ip)

        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Account is temporarily locked due to multiple failed login attempts. Please try again later.",
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 5. Successful login: reset failed counters and update last_login_at
    user.failed_login_attempts = 0
    user.locked_until = None
    user.status = UserStatus.ACTIVE
    user.last_login_at = now
    db.add(user)
    try:
        db.commit()
    except Exception:
        db.rollback()

    _clear_ip_failed_attempts(client_ip)
    logger.info("User authenticated successfully", extra={"user_id": user.id, "client_ip": client_ip})
    return user


def mark_user_activity(db: Session, user: User) -> None:
    db.add(user)


def next_app_no(db: Session) -> str:
    """
    Generate the next application number using a database sequence table.
    Includes automatic fallback if sequence table is not present.
    """
    from app.models import Application

    try:
        seq = db.query(ApplicationSequence).first()
        if seq is None:
            seq = ApplicationSequence(last_number=0)
            db.add(seq)
            db.flush()

        max_id = db.query(func.max(Application.id)).scalar() or 0
        if seq.last_number < max_id:
            seq.last_number = max_id

        while True:
            seq.last_number += 1
            candidate = f"APP-{seq.last_number}"
            exists = db.query(Application).filter(Application.app_no == candidate).first()
            if not exists:
                db.flush()
                return candidate
    except Exception:
        db.rollback()
        max_id = db.query(func.max(Application.id)).scalar() or 0
        current = max_id
        while True:
            current += 1
            candidate = f"APP-{current}"
            exists = db.query(Application).filter(Application.app_no == candidate).first()
            if not exists:
                return candidate


def touch_application(db: Session, app) -> None:
    app.updated_at = utcnow()
    db.add(app)
