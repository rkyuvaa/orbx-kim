import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission, require_roles
from app.db.session import get_db
from app.models import SmsSetting, User, UserRole
from app.services.sms_service import (
    DEFAULT_OTP_TEMPLATE,
    DEFAULT_REGISTRATION_TEMPLATE,
    dispatch_sms,
    get_effective_sms_config,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sms-settings",
    tags=["sms"],
    dependencies=[Depends(require_permission("view", "settings"))],
)


# --- Schemas ---

class SmsSettingOut(BaseModel):
    provider: str = "textguru"
    api_url: str = "https://www.textguru.in/api/v22.0/"
    api_method: str = "GET"
    username: str | None = None
    has_password: bool = False
    sender_id: str | None = "KIMEV"
    entity_id: str | None = None
    registration_template_id: str | None = None
    registration_message_template: str | None = None
    otp_template_id: str | None = None
    otp_message_template: str | None = None
    is_enabled: bool = True


class SmsSettingInput(BaseModel):
    provider: str | None = "textguru"
    api_url: str | None = "https://www.textguru.in/api/v22.0/"
    api_method: str | None = "GET"
    username: str | None = None
    password: str | None = None  # None/empty string preserves existing password
    sender_id: str | None = "KIMEV"
    entity_id: str | None = None
    registration_template_id: str | None = None
    registration_message_template: str | None = None
    otp_template_id: str | None = None
    otp_message_template: str | None = None
    is_enabled: bool = True


class SmsTestInput(BaseModel):
    test_phone: str = Field(..., min_length=10, max_length=15)
    message: str | None = None
    template_id: str | None = None
    provider: str | None = None
    api_url: str | None = None
    api_method: str | None = None
    username: str | None = None
    password: str | None = None
    sender_id: str | None = None
    entity_id: str | None = None


class SmsTestResponse(BaseModel):
    success: bool
    message: str


# --- Endpoints ---

@router.get("", response_model=SmsSettingOut)
def get_sms_settings(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    rec = db.query(SmsSetting).first()
    if not rec:
        rec = SmsSetting(
            id=1,
            provider="textguru",
            api_url="https://www.textguru.in/api/v22.0/",
            api_method="GET",
            sender_id="KIMEV",
            registration_message_template=DEFAULT_REGISTRATION_TEMPLATE,
            otp_message_template=DEFAULT_OTP_TEMPLATE,
            is_enabled=True,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

    effective = get_effective_sms_config(db=db)
    return SmsSettingOut(
        provider=rec.provider or effective["provider"],
        api_url=rec.api_url or effective["api_url"],
        api_method=rec.api_method or effective["api_method"],
        username=rec.username or effective["username"],
        has_password=bool(rec.password or effective["password"]),
        sender_id=rec.sender_id or effective["sender_id"],
        entity_id=rec.entity_id or effective["entity_id"],
        registration_template_id=rec.registration_template_id or effective["registration_template_id"],
        registration_message_template=rec.registration_message_template or effective["registration_message_template"],
        otp_template_id=rec.otp_template_id or effective["otp_template_id"],
        otp_message_template=rec.otp_message_template or effective["otp_message_template"],
        is_enabled=rec.is_enabled,
    )


@router.post("", response_model=SmsSettingOut)
def update_sms_settings(
    payload: SmsSettingInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    rec = db.query(SmsSetting).first()
    if not rec:
        rec = SmsSetting(id=1)
        db.add(rec)

    rec.provider = payload.provider.strip() if payload.provider else "textguru"
    rec.api_url = payload.api_url.strip() if payload.api_url else "https://www.textguru.in/api/v22.0/"
    rec.api_method = payload.api_method.strip().upper() if payload.api_method else "GET"
    rec.username = payload.username.strip() if payload.username else None
    rec.sender_id = payload.sender_id.strip() if payload.sender_id else "KIMEV"
    rec.entity_id = payload.entity_id.strip() if payload.entity_id else None
    rec.registration_template_id = payload.registration_template_id.strip() if payload.registration_template_id else None
    rec.registration_message_template = payload.registration_message_template.strip() if payload.registration_message_template else DEFAULT_REGISTRATION_TEMPLATE
    rec.otp_template_id = payload.otp_template_id.strip() if payload.otp_template_id else None
    rec.otp_message_template = payload.otp_message_template.strip() if payload.otp_message_template else DEFAULT_OTP_TEMPLATE
    rec.is_enabled = payload.is_enabled

    # Only update password if non-empty string provided
    if payload.password is not None and payload.password.strip() != "":
        rec.password = payload.password.strip()

    db.commit()
    db.refresh(rec)

    return SmsSettingOut(
        provider=rec.provider,
        api_url=rec.api_url,
        api_method=rec.api_method,
        username=rec.username,
        has_password=bool(rec.password),
        sender_id=rec.sender_id,
        entity_id=rec.entity_id,
        registration_template_id=rec.registration_template_id,
        registration_message_template=rec.registration_message_template,
        otp_template_id=rec.otp_template_id,
        otp_message_template=rec.otp_message_template,
        is_enabled=rec.is_enabled,
    )


@router.post("/test", response_model=SmsTestResponse)
def test_sms_configuration(
    payload: SmsTestInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    msg = payload.message.strip() if payload.message and payload.message.strip() else "Konwert India Motors SMS Gateway Connection Test: SMS service is configured successfully."
    override = {
        "provider": payload.provider,
        "api_url": payload.api_url,
        "api_method": payload.api_method,
        "username": payload.username,
        "password": payload.password,
        "sender_id": payload.sender_id,
        "entity_id": payload.entity_id,
        "is_enabled": True,
    }

    success, message = dispatch_sms(
        phone=payload.test_phone,
        message=msg,
        template_id=payload.template_id,
        db=db,
        override=override,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    return SmsTestResponse(success=True, message=message)
