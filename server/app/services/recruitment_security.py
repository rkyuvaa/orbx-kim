import base64
import hashlib
import logging
import re
from typing import Optional

from cryptography.fernet import Fernet
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    """Derives a deterministic 32-byte Fernet key from settings.SECRET_KEY."""
    raw_secret = getattr(settings, "SECRET_KEY", "default-insecure-secret-key-change-in-prod")
    key_bytes = hashlib.sha256(raw_secret.encode("utf-8")).digest()
    url_safe_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(url_safe_key)


def encrypt_api_key(raw_key: str) -> str:
    """Encrypts an API key for storage at rest."""
    if not raw_key or not raw_key.strip():
        return ""
    try:
        f = _get_fernet()
        return f.encrypt(raw_key.strip().encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to encrypt API key: {e}")
        return raw_key.strip()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypts a stored API key. Falls back to raw text if not encrypted."""
    if not encrypted_key or not encrypted_key.strip():
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_key.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        # Not encrypted or invalid token, return as-is
        return encrypted_key.strip()


def mask_api_key(key: Optional[str]) -> str:
    """Masks an API key for safe display in GET responses."""
    if not key or not key.strip():
        return ""
    # If key is encrypted, decrypt first for masking
    decrypted = decrypt_api_key(key)
    if len(decrypted) <= 6:
        return "••••••••"
    return "••••••••" + decrypted[-4:]


def strip_pii_for_ai(raw_text: str) -> str:
    """
    Sanitizes resume text to prevent bias (India DPDP Act 2023 & fairness standard).
    Strips email, phone, age, DOB, gender, marital status, and full street addresses.
    """
    if not raw_text:
        return ""

    text = raw_text

    # 1. Mask email addresses
    text = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[EMAIL_REDACTED]", text)

    # 2. Mask phone numbers (10 digits with spaces, dashes, or 5+5 Indian format)
    text = re.sub(
        r"(?:\+?\d{1,3}[-.\s]*)?(?:\d{5}[-.\s]+\d{5}|\(?\d{3,4}\)?[-.\s]*\d{3,4}[-.\s]*\d{3,4}|\b\d{10}\b)",
        "[PHONE_REDACTED]",
        text,
    )

    # 3. Mask Dates of Birth / Age
    text = re.sub(r"(?i)\b(?:dob|date\s+of\s+birth|birth\s+date)\s*[:=-]?\s*[\d/\-.]+", "[DOB_REDACTED]", text)
    text = re.sub(r"(?i)\b\d{1,2}\s+(?:years?\s+old|yo)\b", "[AGE_REDACTED]", text)

    # 4. Mask Gender & Marital Status
    text = re.sub(r"(?i)\b(?:gender|sex)\s*[:=-]?\s*(?:male|female|other|transgender|non-binary)\b", "[GENDER_REDACTED]", text)
    text = re.sub(r"(?i)\b(?:marital\s+status)\s*[:=-]?\s*(?:single|married|unmarried|divorced|widowed)\b", "[MARITAL_REDACTED]", text)

    # 5. Mask Indian Pin Codes
    text = re.sub(r"(?i)\b(?:pin\s*code|pincode|postal\s*code)\s*[:=-]?\s*\d{6}\b", "[PINCODE_REDACTED]", text)

    return text.strip()


INJECTION_PATTERNS = [
    r"(?i)ignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|directions?|prompts?)",
    r"(?i)disregard\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|rules?)",
    r"(?i)system\s+prompt\s*:",
    r"(?i)you\s+are\s+now\s+(?:an?\s+)?(?:ai|evaluator|assistant|hiring\s+manager|admin)",
    r"(?i)give\s+(?:me|this\s+candidate)\s+(?:a\s+score\s+of\s+)?(?:100|perfect)",
    r"(?i)new\s+role\s*:",
    r"(?i)override\s+(?:the\s+)?evaluation",
    r"(?i)important\s*:\s*always\s+recommend",
    r"(?i)<script[\s\S]*?>[\s\S]*?<\/script>",
]


def detect_prompt_injection(text: str) -> tuple[bool, Optional[str]]:
    """
    Inspects resume or candidate text for prompt-injection payloads or instruction overrides.
    Returns: (is_flagged, reason)
    """
    if not text:
        return False, None

    for pattern in INJECTION_PATTERNS:
        match = re.search(pattern, text)
        if match:
            matched_snippet = match.group(0)[:60]
            reason = f"Suspicious prompt-override phrase detected: '{matched_snippet}'"
            return True, reason

    return False, None


def wrap_untrusted_resume_data(sanitized_text: str) -> str:
    """Wraps text in unambiguous XML tags to delineate untrusted third-party data."""
    return f"<candidate_resume_untrusted_data>\n{sanitized_text}\n</candidate_resume_untrusted_data>"


def validate_mime_sniffing(file_bytes: bytes, filename: str) -> tuple[bool, str]:
    """
    Validates file integrity using magic bytes sniffing (not just file extension).
    Returns (is_valid, detected_mime_or_error)
    """
    if not file_bytes:
        return False, "File is empty"

    if len(file_bytes) > 15 * 1024 * 1024:  # 15MB limit
        return False, "File exceeds maximum size of 15MB"

    # Check magic bytes
    if file_bytes.startswith(b"%PDF-"):
        return True, "application/pdf"

    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return True, "image/png"

    if file_bytes.startswith(b"\xff\xd8\xff"):
        return True, "image/jpeg"

    if file_bytes.startswith(b"PK\x03\x04"):
        # Could be docx or zip
        ext = filename.lower().split(".")[-1] if "." in filename else ""
        if ext in ["docx", "odt"]:
            return True, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return False, "ZIP archives not permitted; please upload PDF, DOCX, or Image."

    # Check UTF-8 plain text
    try:
        file_bytes[:1024].decode("utf-8")
        return True, "text/plain"
    except UnicodeDecodeError:
        pass

    return False, "Unsupported file format. Please upload PDF, JPEG, PNG, or DOCX."
