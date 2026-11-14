from datetime import datetime, timezone
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.document_sequence import DocumentSequence

router = APIRouter(prefix="/material-requirements", tags=["material-requirements"])

UPLOAD_BASE_DIR = os.path.join("uploads", "material_requirements")


def _ensure_upload_dir(request_no: str) -> str:
    upload_dir = os.path.join(UPLOAD_BASE_DIR, request_no)
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


@router.post("/{request_no}/upload", response_model=dict)
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


@router.get("/{request_no}/attachments", response_model=list[dict])
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


@router.delete("/{request_no}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
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
