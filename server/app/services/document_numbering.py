from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models.document_sequence import DocumentSequence


def resolve_tokens(pattern: str, now: Optional[datetime] = None) -> str:
    """Resolve dynamic date/time format tokens in prefix or suffix strings."""
    if not pattern:
        return ""
    if now is None:
        now = datetime.now(timezone.utc)

    token_map = {
        "{YYYYMMDD}": now.strftime("%Y%m%d"),
        "{YYYYMM}": now.strftime("%Y%m"),
        "{YYYY}": now.strftime("%Y"),
        "{YY}": now.strftime("%y"),
        "{MM}": now.strftime("%m"),
        "{DD}": now.strftime("%d"),
    }
    result = pattern
    for token, replacement in token_map.items():
        result = result.replace(token, replacement)
    return result


def format_document_number(
    prefix: str,
    padding: int,
    number: int,
    suffix: str = "",
    now: Optional[datetime] = None,
) -> str:
    """Format a document sequence number with prefix, zero-padding, and suffix."""
    resolved_prefix = resolve_tokens(prefix or "", now=now)
    resolved_suffix = resolve_tokens(suffix or "", now=now)
    safe_padding = max(1, min(12, int(padding) if padding else 4))
    safe_number = max(0, int(number) if number is not None else 1)
    padded_str = str(safe_number).zfill(safe_padding)
    return f"{resolved_prefix}{padded_str}{resolved_suffix}"


def preview_document_number(
    prefix: str,
    padding: int,
    next_number: int,
    suffix: str = "",
) -> str:
    """Generate a preview string for current or proposed configuration."""
    return format_document_number(prefix=prefix, padding=padding, number=next_number, suffix=suffix)


def get_or_create_sequence(
    db: Session,
    document_type: str,
    default_prefix: str = "DOC-",
    default_padding: int = 4,
    default_name: Optional[str] = None,
    default_description: Optional[str] = None,
) -> DocumentSequence:
    """Retrieve existing sequence definition or create a default record if absent."""
    clean_type = document_type.strip().lower()
    seq = db.query(DocumentSequence).filter(DocumentSequence.document_type == clean_type).first()
    if not seq:
        seq = DocumentSequence(
            document_type=clean_type,
            name=default_name or clean_type.replace("_", " ").title(),
            description=default_description,
            prefix=default_prefix,
            padding=default_padding,
            next_number=1,
            suffix="",
            is_active=True,
        )
        db.add(seq)
        db.flush()
    return seq


def generate_next_document_number(
    db: Session,
    document_type: str,
    default_prefix: str = "DOC-",
    default_padding: int = 4,
    default_name: Optional[str] = None,
    default_description: Optional[str] = None,
) -> str:
    """
    Atomically retrieve next sequence number for document_type,
    format the complete identifier string, increment counter, and return the formatted number.
    """
    clean_type = document_type.strip().lower()
    query = db.query(DocumentSequence).filter(DocumentSequence.document_type == clean_type)

    # Use FOR UPDATE on database dialects that support row locking
    bind = db.get_bind()
    if bind is not None and bind.dialect.name != "sqlite":
        query = query.with_for_update()

    seq = query.first()
    if not seq:
        seq = DocumentSequence(
            document_type=clean_type,
            name=default_name or clean_type.replace("_", " ").title(),
            description=default_description,
            prefix=default_prefix,
            padding=default_padding,
            next_number=1,
            suffix="",
            is_active=True,
        )
        db.add(seq)
        db.flush()

    current_number = seq.next_number
    formatted_number = format_document_number(
        prefix=seq.prefix,
        padding=seq.padding,
        number=current_number,
        suffix=seq.suffix,
    )

    # Increment counter
    seq.next_number = current_number + 1
    seq.updated_at = datetime.now(timezone.utc)
    db.add(seq)
    db.flush()

    return formatted_number
