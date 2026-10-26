import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import User
from app.models.user import UserStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth import authenticate_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.refresh_token_cookie_name,
        value=token,
        max_age=int(settings.refresh_token_hours * 3600),
        path=settings.api_v1_prefix + "/auth",
        httponly=True,
        secure=settings.enable_ssl,
        samesite="lax",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_token_cookie_name,
        path=settings.api_v1_prefix + "/auth",
    )
    response.delete_cookie(
        key=settings.refresh_token_cookie_name,
        path=settings.api_v1_prefix,
    )
    response.delete_cookie(
        key=settings.refresh_token_cookie_name,
        path="/",
    )


@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    user = authenticate_user(db, payload, client_ip=client_ip)
    refresh = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh)
    access = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=access, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.refresh_token_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token provided"
        )
    try:
        payload = decode_token(token, expected_type="refresh")
    except (jwt.PyJWTError, Exception):
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        ) from None

    sub = payload.get("sub")
    if not sub:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = db.get(User, user_id)
    if user is None:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if user.status != UserStatus.ACTIVE:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive or locked"
        )

    new_refresh = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh)
    access = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=access, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    _clear_refresh_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.patch("/users/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.full_name = payload.full_name.strip()
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
