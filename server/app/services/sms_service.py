import logging
import re
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.sms_setting import SmsSetting

logger = logging.getLogger(__name__)

DEFAULT_REGISTRATION_TEMPLATE = (
    "Dear Customer, your vehicle service complaint has been registered successfully. "
    "Service ID: {#alphanumeric#} Date: {#alphanumeric#} Our support team will contact you shortly. "
    "KIM EV Service: Your service request {complaint_no} for vehicle {vehicle_number} has been registered. "
    "Our technician will contact you shortly."
)

DEFAULT_OTP_TEMPLATE = (
    "Dear Customer, Your vehicle service has been completed successfully. "
    "Service ID: {#alphanumeric#} OTP: {#numeric#} Please share this OTP with our technician to confirm service completion. "
    "Thank you, Konwert India Motors."
)


def clean_phone_number(phone: str) -> str:
    """Normalize phone number to 10 digits for Indian SMS gateways."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def format_registration_message(
    template: str,
    complaint_no: str,
    vehicle_number: str = "",
    date_str: str = "",
) -> str:
    if not date_str:
        date_str = datetime.now().strftime("%d-%m-%Y")

    text = template or DEFAULT_REGISTRATION_TEMPLATE
    # Named replacements
    text = text.replace("{complaint_no}", complaint_no)
    text = text.replace("{vehicle_number}", vehicle_number)
    text = text.replace("{date}", date_str)

    # DLT positional variable replacements
    if "{#alphanumeric#}" in text:
        text = text.replace("{#alphanumeric#}", complaint_no, 1)
    if "{#alphanumeric#}" in text:
        text = text.replace("{#alphanumeric#}", date_str, 1)
    if "{#alphanumeric#}" in text:
        text = text.replace("{#alphanumeric#}", vehicle_number, 1)
    if "{#numeric#}" in text:
        text = text.replace("{#numeric#}", date_str, 1)

    return " ".join(text.split())


def format_otp_message(
    template: str,
    complaint_no: str,
    otp_code: str,
) -> str:
    text = template or DEFAULT_OTP_TEMPLATE
    # Named replacements
    text = text.replace("{complaint_no}", complaint_no)
    text = text.replace("{otp_code}", otp_code)

    # DLT positional variable replacements
    if "{#alphanumeric#}" in text:
        text = text.replace("{#alphanumeric#}", complaint_no, 1)
    if "{#numeric#}" in text:
        text = text.replace("{#numeric#}", otp_code, 1)

    return " ".join(text.split())


def get_effective_sms_config(
    db: Session | None = None,
    override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Resolve SMS configuration from override, database SmsSetting, or .env settings."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        rec = db.query(SmsSetting).first()
        ov = override or {}

        provider = ov.get("provider") or (rec.provider if rec and rec.provider else getattr(settings, "sms_provider", "textguru"))
        api_url = ov.get("api_url") or (rec.api_url if rec and rec.api_url else getattr(settings, "sms_api_url", "https://www.textguru.in/api/v22.0/"))
        api_method = (ov.get("api_method") or (rec.api_method if rec and rec.api_method else getattr(settings, "sms_api_method", "GET"))).upper()
        username = ov.get("username") or (rec.username if rec and rec.username else getattr(settings, "sms_username", None))

        pwd_input = ov.get("password")
        if pwd_input is not None and str(pwd_input).strip() != "":
            password = str(pwd_input).strip()
        else:
            password = rec.password if rec and rec.password else getattr(settings, "sms_password", None)

        sender_id = ov.get("sender_id") or (rec.sender_id if rec and rec.sender_id else getattr(settings, "sms_sender_id", "KIMEV"))
        entity_id = ov.get("entity_id") or (rec.entity_id if rec and rec.entity_id else getattr(settings, "sms_entity_id", None))
        reg_template_id = ov.get("registration_template_id") or (rec.registration_template_id if rec and rec.registration_template_id else getattr(settings, "sms_registration_template_id", None))
        reg_msg_template = ov.get("registration_message_template") or (rec.registration_message_template if rec and rec.registration_message_template else DEFAULT_REGISTRATION_TEMPLATE)
        otp_template_id = ov.get("otp_template_id") or (rec.otp_template_id if rec and rec.otp_template_id else getattr(settings, "sms_otp_template_id", None))
        otp_msg_template = ov.get("otp_message_template") or (rec.otp_message_template if rec and rec.otp_message_template else DEFAULT_OTP_TEMPLATE)
        is_enabled = ov.get("is_enabled", rec.is_enabled if rec else getattr(settings, "sms_is_enabled", True))

        return {
            "provider": provider,
            "api_url": api_url,
            "api_method": api_method,
            "username": username,
            "password": password,
            "sender_id": sender_id,
            "entity_id": entity_id,
            "registration_template_id": reg_template_id,
            "registration_message_template": reg_msg_template,
            "otp_template_id": otp_template_id,
            "otp_message_template": otp_msg_template,
            "is_enabled": is_enabled,
        }
    finally:
        if close_db:
            db.close()


def dispatch_sms(
    phone: str,
    message: str,
    template_id: str | None = None,
    config: dict[str, Any] | None = None,
    db: Session | None = None,
    override: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """
    Dispatches SMS to recipient phone using configured provider (TextGuru).
    Returns (success: bool, response_or_error: str).
    """
    cfg = config or get_effective_sms_config(db=db, override=override)
    clean_phone = clean_phone_number(phone)

    if not clean_phone or len(clean_phone) < 10:
        return False, f"Invalid recipient phone number: '{phone}'"

    is_enabled = cfg.get("is_enabled", True)
    username = cfg.get("username")
    password = cfg.get("password")
    sender_id = cfg.get("sender_id")

    # If SMS is disabled or credentials are not yet entered, simulate delivery
    if not is_enabled or not username or not password:
        logger.info(
            f"[SMS SIMULATION] To: {clean_phone} | Template: {template_id} | Message: {message}"
        )
        return True, f"Simulated dispatch to {clean_phone} (SMS service disabled or credentials not set)"

    api_url = cfg.get("api_url") or "https://www.textguru.in/api/v22.0/"
    api_method = (cfg.get("api_method") or "GET").upper()
    entity_id = cfg.get("entity_id")

    # TextGuru v22.0 API parameters
    dmobile_val = f"91{clean_phone}" if len(clean_phone) == 10 else clean_phone
    params: dict[str, str] = {
        "username": str(username),
        "password": str(password),
        "source": str(sender_id or "KIMEV"),
        "dmobile": dmobile_val,
        "message": message,
        # Backward/generic aliases
        "sender": str(sender_id or "KIMEV"),
        "sendto": dmobile_val,
    }
    if template_id:
        params["dlttempid"] = str(template_id)
        params["templateid"] = str(template_id)
    if entity_id:
        params["entityid"] = str(entity_id)

    try:
        if httpx is not None:
            with httpx.Client(timeout=10.0) as client:
                if api_method == "POST":
                    resp = client.post(api_url, data=params)
                else:
                    resp = client.get(api_url, params=params)
                resp_text = resp.text.strip()
                status_code = resp.status_code
        else:
            if api_method == "POST":
                post_data = urllib.parse.urlencode(params).encode("utf-8")
                req = urllib.request.Request(
                    api_url, data=post_data, headers={"User-Agent": "KIM-ERP/2.0 (SMS Gateway)"}
                )
            else:
                sep = "&" if "?" in api_url else "?"
                query_url = f"{api_url}{sep}{urllib.parse.urlencode(params)}"
                req = urllib.request.Request(
                    query_url, headers={"User-Agent": "KIM-ERP/2.0 (SMS Gateway)"}
                )
            with urllib.request.urlopen(req, timeout=10.0) as response:
                resp_text = response.read().decode("utf-8", errors="replace").strip()
                status_code = response.status

        logger.info(f"[SMS DISPATCH] URL: {api_url} | Status: {status_code} | Response: {resp_text}")

        if status_code != 200:
            return False, f"SMS gateway returned HTTP {status_code}: {resp_text}"

        # TextGuru error responses check
        resp_lower = resp_text.lower()
        if any(err in resp_lower for err in ["invalid", "error", "fail", "unauthorized", "insufficient"]):
            return False, f"SMS gateway error: {resp_text}"

        return True, resp_text or "SMS dispatched successfully"
    except Exception as exc:
        logger.error(f"[SMS ERROR] Failed to dispatch SMS to {clean_phone}: {exc}", exc_info=True)
        return False, f"Failed to connect to SMS gateway: {str(exc)}"


def send_registration_sms(
    phone: str,
    complaint_no: str,
    vehicle_number: str = "",
    date_str: str = "",
    db: Session | None = None,
) -> tuple[bool, str]:
    """Send complaint registration confirmation SMS."""
    cfg = get_effective_sms_config(db=db)
    msg = format_registration_message(
        template=cfg.get("registration_message_template") or DEFAULT_REGISTRATION_TEMPLATE,
        complaint_no=complaint_no,
        vehicle_number=vehicle_number,
        date_str=date_str,
    )
    template_id = cfg.get("registration_template_id")
    return dispatch_sms(phone=phone, message=msg, template_id=template_id, config=cfg, db=db)


def send_closure_otp_sms(
    phone: str,
    complaint_no: str,
    otp_code: str,
    db: Session | None = None,
) -> tuple[bool, str]:
    """Send complaint closure verification OTP SMS."""
    cfg = get_effective_sms_config(db=db)
    msg = format_otp_message(
        template=cfg.get("otp_message_template") or DEFAULT_OTP_TEMPLATE,
        complaint_no=complaint_no,
        otp_code=otp_code,
    )
    template_id = cfg.get("otp_template_id")
    return dispatch_sms(phone=phone, message=msg, template_id=template_id, config=cfg, db=db)
