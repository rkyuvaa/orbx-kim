from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.document_sequence import DocumentSequence
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.document_sequence import (
    DocumentNumberPreviewRequest,
    DocumentNumberPreviewResponse,
    DocumentSequenceCreate,
    DocumentSequenceOut,
    DocumentSequenceUpdate,
)
from app.services.document_numbering import format_document_number, preview_document_number

router = APIRouter(prefix="/document-numbering", tags=["document-numbering"])

PROTECTED_TYPES = {"complaint"}


def _verify_settings_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure user has admin or settings viewing/editing privileges."""
    if current_user.role == UserRole.ADMIN:
        return current_user

    from app.services.rbac_service import can_user, get_user_active_roles

    if can_user(db, current_user, "view", "settings") or can_user(db, current_user, "edit", "settings"):
        return current_user

    active_roles = get_user_active_roles(db, current_user)
    if any(r.code in ("super_admin", "admin") for r in active_roles if r and r.code):
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to manage document numbering settings",
    )


def _to_out_schema(seq: DocumentSequence) -> DocumentSequenceOut:
    preview = format_document_number(
        prefix=seq.prefix,
        padding=seq.padding,
        number=seq.next_number,
        suffix=seq.suffix,
    )
    return DocumentSequenceOut(
        id=seq.id,
        document_type=seq.document_type,
        name=seq.name,
        description=seq.description,
        prefix=seq.prefix,
        padding=seq.padding,
        next_number=seq.next_number,
        suffix=seq.suffix,
        is_active=seq.is_active,
        sample_preview=preview,
        created_at=seq.created_at,
        updated_at=seq.updated_at,
    )


@router.get("", response_model=List[DocumentSequenceOut])
def list_document_sequences(
    db: Session = Depends(get_db),
    _: User = Depends(_verify_settings_access),
):
    """List all configured document numbering sequences with live sample previews."""
    sequences = db.query(DocumentSequence).order_by(DocumentSequence.name.asc()).all()
    return [_to_out_schema(s) for s in sequences]


@router.get("/{document_type}", response_model=DocumentSequenceOut)
def get_document_sequence(
    document_type: str,
    db: Session = Depends(get_db),
    _: User = Depends(_verify_settings_access),
):
    """Get single document sequence configuration by document type."""
    clean_type = document_type.strip().lower()
    seq = db.query(DocumentSequence).filter(DocumentSequence.document_type == clean_type).first()
    if not seq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document sequence for '{document_type}' not found",
        )
    return _to_out_schema(seq)


@router.post("", response_model=DocumentSequenceOut, status_code=status.HTTP_201_CREATED)
def create_document_sequence(
    payload: DocumentSequenceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(_verify_settings_access),
):
    """Create a new document numbering sequence definition."""
    clean_type = payload.document_type.strip().lower()
    existing = db.query(DocumentSequence).filter(DocumentSequence.document_type == clean_type).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document sequence for '{clean_type}' already exists",
        )

    seq = DocumentSequence(
        document_type=clean_type,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        prefix=payload.prefix.strip() if payload.prefix else "",
        padding=payload.padding,
        next_number=payload.next_number,
        suffix=payload.suffix.strip() if payload.suffix else "",
        is_active=payload.is_active,
    )
    db.add(seq)
    db.commit()
    db.refresh(seq)
    return _to_out_schema(seq)


@router.put("/{document_type}", response_model=DocumentSequenceOut)
def update_document_sequence(
    document_type: str,
    payload: DocumentSequenceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_verify_settings_access),
):
    """Update settings (prefix, padding, next_number, etc.) for a document sequence."""
    clean_type = document_type.strip().lower()
    seq = db.query(DocumentSequence).filter(DocumentSequence.document_type == clean_type).first()
    if not seq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document sequence for '{document_type}' not found",
        )

    if payload.name is not None:
        seq.name = payload.name.strip()
    if payload.description is not None:
        seq.description = payload.description.strip() if payload.description else None
    if payload.prefix is not None:
        seq.prefix = payload.prefix.strip()
    if payload.padding is not None:
        seq.padding = payload.padding
    if payload.next_number is not None:
        seq.next_number = payload.next_number
    if payload.suffix is not None:
        seq.suffix = payload.suffix.strip()
    if payload.is_active is not None:
        seq.is_active = payload.is_active

    db.add(seq)
    db.commit()
    db.refresh(seq)
    return _to_out_schema(seq)


@router.post("/preview", response_model=DocumentNumberPreviewResponse)
def preview_sequence_format(
    payload: DocumentNumberPreviewRequest,
    _: User = Depends(_verify_settings_access),
):
    """Compute and preview document format from provided prefix, padding, next_number, and suffix."""
    preview = preview_document_number(
        prefix=payload.prefix,
        padding=payload.padding,
        next_number=payload.next_number,
        suffix=payload.suffix,
    )
    return DocumentNumberPreviewResponse(preview=preview)


@router.delete("/{document_type}")
def delete_document_sequence(
    document_type: str,
    db: Session = Depends(get_db),
    _: User = Depends(_verify_settings_access),
):
    """Delete a custom document sequence definition."""
    clean_type = document_type.strip().lower()
    if clean_type in PROTECTED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"System document sequence '{clean_type}' is protected and cannot be deleted. You may deactivate it instead.",
        )

    seq = db.query(DocumentSequence).filter(DocumentSequence.document_type == clean_type).first()
    if not seq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document sequence for '{document_type}' not found",
        )

    db.delete(seq)
    db.commit()
    return {"success": True, "message": f"Document sequence '{clean_type}' deleted successfully"}
