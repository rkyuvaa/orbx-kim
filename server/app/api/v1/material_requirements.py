from datetime import datetime, timezone
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Optional

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.document_sequence import DocumentSequence
from app.models import AppDataDocument

router = APIRouter(prefix="/material-requirements", tags=["material-requirements"])

UPLOAD_BASE_DIR = os.path.join("uploads", "material_requirements")


def _ensure_upload_dir(request_no: str) -> str:
    upload_dir = os.path.join(UPLOAD_BASE_DIR, request_no)
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def _requirement_items_key() -> str:
    return "crm_requirements_items_data"


def _update_requirement_in_db_from_record(
    db: Session,
    requirements: list[dict],
    index: int,
    expected_revision: int,
    record: AppDataDocument,
) -> tuple[bool, Optional[AppDataDocument]]:
    """Update the requirements array in app_data with optimistic locking (record bound)."""
    if record.revision != expected_revision:
        return False, record

    record.value = requirements
    record.revision = AppDataDocument.revision + 1
    record.updated_at = func.now()
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        latest = (
            db.query(AppDataDocument)
            .filter(AppDataDocument.key == _requirement_items_key())
            .first()
        )
        return False, latest
    db.refresh(record)
    return True, record


@router.post("/{request_no:path}/upload", response_model=dict)
async def upload_material_requirement_attachment(
    request_no: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an attachment for a material requirement.

    Files are stored under uploads/material_requirements/{request_no}/
    and a public URL is returned for download.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    upload_dir = _ensure_upload_dir(request_no)
    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/uploads/material_requirements/{request_no}/{safe_filename}"

    return {
        "id": str(uuid.uuid4()),
        "name": file.filename,
        "size": file.size or 0,
        "type": file.content_type or "application/octet-stream",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.full_name or current_user.email or "Current User",
        "data_url": file_url,
        "file_path": file_path,
    }


@router.get("/{request_no:path}/attachments", response_model=list[dict])
def list_material_requirement_attachments(
    request_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List attachments for a material requirement."""
    upload_dir = os.path.join(UPLOAD_BASE_DIR, request_no)
    if not os.path.isdir(upload_dir):
        return []

    attachments = []
    for filename in sorted(os.listdir(upload_dir)):
        file_path = os.path.join(upload_dir, filename)
        if not os.path.isfile(file_path):
            continue
        stat = os.stat(file_path)
        # Extract original name: strip the uuid prefix (8 hex chars + _)
        parts = filename.split("_", 1)
        original_name = parts[1] if len(parts) > 1 else filename
        attachments.append(
            {
                "id": filename,
                "name": original_name,
                "size": stat.st_size,
                "type": None,
                "uploaded_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "uploaded_by": current_user.full_name or current_user.email or "Current User",
                "data_url": f"/uploads/material_requirements/{request_no}/{filename}",
                "file_path": file_path,
            }
        )
    return attachments


@router.delete("/{request_no:path}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material_requirement_attachment(
    request_no: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an attachment file for a material requirement."""
    file_path = os.path.join(UPLOAD_BASE_DIR, request_no, attachment_id)
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )
    os.remove(file_path)
    return None


# --- Store Manager post-approval status flow ---

STORE_MANAGER_STATUS_ORDER = ["NEW", "IN_PROGRESS", "SOURCING", "COMPLETED", "CLOSED"]

STORE_INCHARGE_CONFIG_KEY = "crm_requirements_store_incharges"


def _get_store_incharge_user_ids(db: Session) -> list[str]:
    """Read configured Store Incharge user IDs from app_data config."""
    record = (
        db.query(AppDataDocument)
        .filter(AppDataDocument.key == STORE_INCHARGE_CONFIG_KEY)
        .first()
    )
    if record is None:
        return []
    value = record.value
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, dict):
        # Stored as {"user_ids": [...]} by the Settings → Users UI
        user_ids = value.get("user_ids", [])
        return [str(v) for v in user_ids]
    if isinstance(value, str):
        # Comma-separated ids
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


def _is_store_manager(current_user: User, db: Session) -> bool:
    """A Store Manager is a user listed in the Store Incharge config."""
    return str(current_user.id) in _get_store_incharge_user_ids(db)


def _find_requirement_index(requirements: list[dict], requirement_id: str) -> int:
    for idx, item in enumerate(requirements):
        if item.get("id") == requirement_id or item.get("request_no") == requirement_id:
            return idx
    return -1


class StoreManagerStatusUpdate(BaseModel):
    status: str


@router.post(
    "/{request_no:path}/store-manager/status",
    response_model=dict,
    tags=["material-requirements"],
)
def update_store_manager_status(
    request_no: str,
    payload: StoreManagerStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow a Store Manager to advance a requirement's post-approval status.

    Allowed progression: NEW -> IN_PROGRESS -> SOURCING -> COMPLETED -> CLOSED.
    The entry point after manager APPROVED is NEW.
    """
    if not _is_store_manager(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a Store Manager can update this status.",
        )

    target_status = payload.status.upper()
    if target_status not in STORE_MANAGER_STATUS_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(STORE_MANAGER_STATUS_ORDER)}",
        )

    key = _requirement_items_key()
    record = db.query(AppDataDocument).filter(AppDataDocument.key == key).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )

    requirements = record.value
    if not isinstance(requirements, list):
        raise HTTPException(status_code=400, detail="Requirement data is corrupt")

    idx = _find_requirement_index(requirements, request_no)
    if idx == -1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")

    req_item = requirements[idx]
    current_status = str(req_item.get("status", "")).upper()

    # Determine allowed previous statuses for the target
    if target_status == "NEW":
        allowed_previous = {"APPROVED"}
    else:
        try:
            target_pos = STORE_MANAGER_STATUS_ORDER.index(target_status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid target status")
        allowed_previous = {STORE_MANAGER_STATUS_ORDER[target_pos - 1]}

    if current_status not in allowed_previous:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot transition from '{current_status}' to '{target_status}'. "
                f"Expected previous status: {', '.join(sorted(allowed_previous))}"
            ),
        )

    req_item["status"] = target_status
    req_item["status_updated_at"] = datetime.now(timezone.utc).isoformat()
    req_item["status_updated_by"] = current_user.full_name or current_user.email

    success, _ = _update_requirement_in_db_from_record(
        db, requirements, idx, record.revision, record
    )
    if not success:
        db.rollback()
        raise HTTPException(status_code=409, detail="Concurrent modification, please try again")

    db.commit()
    return {
        "ok": True,
        "request_no": req_item.get("request_no") or request_no,
        "status": target_status,
        "message": f"Status updated to {target_status}",
    }
