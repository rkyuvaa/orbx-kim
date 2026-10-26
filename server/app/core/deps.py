from collections.abc import Callable
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Application, ApplicationStatus, User, UserRole
from app.models.user import UserStatus

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except (jwt.PyJWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from None

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject"
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive or locked"
        )

    return user


def require_roles(*roles: Any) -> Callable:
    flat_roles: list[Any] = []
    for r in roles:
        if isinstance(r, (list, tuple, set)):
            flat_roles.extend(r)
        else:
            flat_roles.append(r)

    def dependency(
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> User:
        if user.role in flat_roles or user.role == UserRole.ADMIN:
            return user

        from app.services.rbac_service import get_user_active_roles
        active_roles = get_user_active_roles(db, user)
        role_codes = {r.code.lower() for r in active_roles if r and r.code}

        if "super_admin" in role_codes or "admin" in role_codes:
            return user

        target_codes = {r.value.lower() if hasattr(r, "value") else str(r).lower() for r in flat_roles}
        if role_codes.intersection(target_codes):
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )

    return dependency


def require_permission(action: str, resource: str) -> Callable:
    """Dependency that evaluates dynamic RBAC permission."""
    from app.services.rbac_service import can_user

    def dependency(
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> User:
        if not can_user(db, user, action, resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: require {resource}:{action}",
            )
        return user

    return dependency


def can_access_application(user: User, app: Application, db: Session | None = None) -> bool:
    """Check if user can access a specific application based on role and assignment."""
    if user.role == UserRole.ADMIN:
        return True

    if db is not None:
        from app.services.rbac_service import get_user_active_roles
        active_roles = get_user_active_roles(db, user)
        if any(r.code.lower() in ["super_admin", "admin"] for r in active_roles if r and r.code):
            return True

    # Sales executives can access their assigned applications
    if user.role == UserRole.SALES_EXECUTIVE:
        return app.assigned_to == user.id

    # Finance officers can access applications in finance-related stages
    if user.role == UserRole.FINANCE_OFFICER:
        finance_stages = {
            ApplicationStatus.FINANCE,
            ApplicationStatus.QUERY,
            ApplicationStatus.SANCTIONED,
        }
        return app.status in finance_stages

    # Delivery team can access applications in delivery/disbursement stages
    if user.role == UserRole.DELIVERY_TEAM:
        delivery_stages = {
            ApplicationStatus.DELIVERY,
            ApplicationStatus.DISBURSEMENT,
            ApplicationStatus.COMPLETED,
        }
        return app.status in delivery_stages

    return False


def require_application_access(
    app_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Application:
    """Load an application from the route path and enforce object-level access."""
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    if not can_access_application(user, app, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this application",
        )
    return app
