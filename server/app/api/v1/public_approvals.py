import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import (
    AppDataDocument,
    Notification,
    RequirementApprovalAccessLog,
    RequirementApprovalToken,
    User,
)
from app.models.enums import UserRole
from app.services.email_service import (
    resolve_client_app_url,
    schedule_requirement_decision_notifications,
    schedule_requirement_submission_notification,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public/approvals", tags=["public-approvals"])


# --- Schemas ---

class SubmitRequirementRequest(BaseModel):
    requirement: dict[str, Any]


class SubmitRequirementResponse(BaseModel):
    ok: bool
    request_no: str
    approval_sent: bool
    message: Optional[str] = None


# --- Helpers ---

def _requirement_items_key() -> str:
    return "crm_requirements_items_data"


def _get_requirements_array(db: Session) -> list[dict]:
    """Get the requirements array from app_data, creating if not exists."""
    record = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
    if record is None:
        return []
    value = record.value
    if not isinstance(value, list):
        return []
    return value


def _find_requirement(requirements: list[dict], requirement_id: str) -> tuple[dict | None, int]:
    """Find a requirement by id, return (item, index) or (None, -1)."""
    for idx, item in enumerate(requirements):
        if item.get("id") == requirement_id:
            return item, idx
    return None, -1


def _update_requirement_in_db(
    db: Session,
    requirements: list[dict],
    index: int,
    expected_revision: int,
) -> tuple[bool, Optional[AppDataDocument]]:
    """Update the requirements array in app_data with optimistic locking."""
    record = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
    if record is None:
        # A non-admin requester cannot PUT app-data directly, so the first
        # submitted requirement may also be the first persisted record.
        record = AppDataDocument(
            key=_requirement_items_key(),
            value=requirements,
            revision=1,
        )
        db.add(record)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            latest = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
            return False, latest
        db.refresh(record)
        return True, record

    if record.revision != expected_revision:
        return False, record
    
    result = db.execute(
        update(AppDataDocument)
        .where(
            AppDataDocument.key == _requirement_items_key(),
            AppDataDocument.revision == expected_revision,
        )
        .values(
            value=requirements,
            revision=AppDataDocument.revision + 1,
            updated_at=func.now(),
        )
    )
    
    if result.rowcount != 1:
        db.rollback()
        latest = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
        return False, latest
    
    db.commit()
    db.refresh(record)
    return True, record


def _resolve_approver(current_user: User, db: Session) -> tuple[Optional[User], str, str]:
    """Resolve the approver for the current user.
    Returns (approver_user, approver_name, approver_email) or (None, "", "")
    """
    if current_user.reporting_manager_id:
        approver = db.get(User, current_user.reporting_manager_id)
        if approver and approver.email:
            return approver, approver.full_name, approver.email
        elif approver:
            return approver, approver.full_name, ""
    return None, "", ""


def _generate_items_summary(item: dict) -> str:
    """Generate a human-readable summary of requirement items."""
    req_type = item.get("type", "MATERIAL")
    if req_type == "MATERIAL":
        material_items = item.get("material_items", [])
        if not material_items:
            return "No items"
        lines = []
        for mi in material_items:
            desc = mi.get("item_description", "Unknown")
            qty = mi.get("qty", 0)
            uom = mi.get("uom", "")
            rate = mi.get("rate", 0)
            amount = mi.get("amount", 0)
            lines.append(f"  • {desc} - Qty: {qty} {uom} @ ₹{rate:,.2f} = ₹{amount:,.2f}")
        return "\n".join(lines)
    else:
        # IT requirement
        cat = item.get("category", "")
        urgency = item.get("urgency", "")
        details = []
        if cat:
            details.append(f"Category: {cat}")
        if urgency:
            details.append(f"Urgency: {urgency}")
        biz_problem = item.get("business_problem", "")
        if biz_problem:
            details.append(f"Problem: {biz_problem[:150]}...")
        return "\n".join(details) if details else "No details provided"


def _queue_requirement_decision_notifications(
    token_rec: RequirementApprovalToken,
    req_item: Optional[dict],
    decision: str,
    request: Request,
    background_tasks: BackgroundTasks,
    decision_reason: str = "",
):
    """Queue decision emails after the token and requirement updates commit."""
    schedule_requirement_decision_notifications(
        token_id=token_rec.id,
        decision=decision,
        title=(req_item.get("title") if req_item else "") or token_rec.request_no,
        total_cost=req_item.get("total_cost") if req_item else None,
        items_summary=_generate_items_summary(req_item) if req_item else "No items",
        client_base_url=resolve_client_app_url(request),
        decision_reason=decision_reason,
        background_tasks=background_tasks,
    )


def _resolve_active_token(token: str, db: Session, request: Request, action: str) -> tuple[RequirementApprovalToken, str]:
    """Validate and resolve an approval token, logging access."""
    now = datetime.now(timezone.utc)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    token_rec = (
        db.query(RequirementApprovalToken)
        .filter(RequirementApprovalToken.token_hash == token_hash)
        .first()
    )

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    if not token_rec or token_rec.status != "PENDING" or token_rec.expires_at.replace(tzinfo=timezone.utc) < now:
        # Log rejected attempt
        log_entry = RequirementApprovalAccessLog(
            token_id=token_rec.id if token_rec else None,
            requirement_id=token_rec.requirement_id if token_rec else None,
            action="rejected",
            ip_address=client_ip,
            user_agent=user_agent,
            accessed_at=now,
            success=False,
            failure_reason="Invalid, expired, or revoked token",
        )
        db.add(log_entry)
        db.commit()

        # Generic 404 to prevent enumeration
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This approval link is invalid, expired, or has been revoked. Please contact the sender for a new link.",
        )

    # Log successful access
    token_rec.last_accessed_at = now
    token_rec.access_count += 1

    log_entry = RequirementApprovalAccessLog(
        token_id=token_rec.id,
        requirement_id=token_rec.requirement_id,
        action=action,
        ip_address=client_ip,
        user_agent=user_agent,
        accessed_at=now,
        success=True,
    )
    db.add(log_entry)
    db.commit()

    return token_rec, token_hash


# --- Public Endpoints (no auth) ---

@router.get("/{token}")
def get_public_approval_page(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Show the approval page with Approve/Reject buttons."""
    token_rec, _ = _resolve_active_token(token, db, request, action="page_view")

    # Get requirement details for display
    requirements = _get_requirements_array(db)
    req_item, _ = _find_requirement(requirements, token_rec.requirement_id)

    expires_str = token_rec.expires_at.strftime("%d %b %Y at %I:%M %p") if token_rec.expires_at else "Unknown"
    req_type = token_rec.requirement_type or "Requirement"
    title = req_item.get("title") if req_item else token_rec.request_no
    requester = token_rec.submitted_by_name or "Unknown"
    total_cost = req_item.get("total_cost") if req_item else None
    cost_str = f"₹{total_cost:,.2f}" if total_cost else "Not specified"
    items_summary = _generate_items_summary(req_item) if req_item else "No items"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Required - {token_rec.request_no}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f4f6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05);">
    
    <!-- Header Banner -->
    <div style="background-color: #023020; padding: 22px 28px; border-bottom: 3px solid #087a3d;">
      <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">KIM Work Management</div>
      <div style="font-size: 12px; color: #a7f3d0; margin-top: 3px;">Work Management & Collaboration</div>
    </div>

    <div style="padding: 28px;">
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 22px;">
        <span style="font-size: 14px; color: #92400e; font-weight: 600;">
          Approval required for <strong>{token_rec.request_no}</strong>
        </span>
      </div>

      <!-- Requirement Card -->
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px 20px; background-color: #fafafa;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="background-color: #023020; color: #ffffff; font-family: monospace; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-right: 8px;">
            {token_rec.request_no}
          </span>
          <span style="background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">
            {req_type}
          </span>
        </div>

        <h3 style="margin: 0 0 14px 0; font-size: 16px; font-weight: 700; color: #111827; line-height: 1.4;">
          {title}
        </h3>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 140px;">Submitted By:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{requester}</td>
          </tr>
          <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 140px;">Approver:</td>
                    <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{token_rec.approver_name}</td>
                  </tr>
                  <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 140px;">Total Estimated Cost:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{cost_str}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 140px;">Link Expires:</td>
            <td style="padding: 6px 0; color: #dc2626; font-size: 13.5px; font-weight: 600;">{expires_str}</td>
          </tr>
        </table>

        <div style="margin-top: 16px; padding: 12px 16px; background-color: #f8faf8; border-left: 3px solid #087a3d; border-radius: 4px; font-size: 13.5px; color: #374151; line-height: 1.5; white-space: pre-wrap;">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; margin-bottom: 4px; letter-spacing: 0.5px;">Items</div>
          {items_summary}
        </div>
      </div>

      <!-- Action Forms -->
      <div style="text-align: center; margin-top: 26px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px; align-items: center;">
        <form action="/api/v1/public/approvals/{token}/approve" method="POST" style="width: 100%; max-width: 300px;">
          <button type="submit" style="background-color: #087a3d; color: #ffffff; border: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; width: 100%; cursor: pointer; box-shadow: 0 2px 6px rgba(8,122,61,0.25);">
            Approve
          </button>
        </form>
        <form action="/api/v1/public/approvals/{token}/reject" method="POST" style="width: 100%; max-width: 300px;">
          <input type="hidden" name="reason" value="">
          <button type="submit" style="background-color: #dc2626; color: #ffffff; border: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; width: 100%; cursor: pointer; box-shadow: 0 2px 6px rgba(220,38,38,0.25);">
            Reject
          </button>
        </form>
      </div>

      <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
        These are one-time secure links that expire on {expires_str}.
      </p>
    </div>
  </div>
</body>
</html>
"""

    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)


@router.post("/{token}/approve")
def approve_requirement(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Approve a requirement via email link."""
    token_rec, _ = _resolve_active_token(token, db, request, action="approve")

    # Update token status
    token_rec.status = "APPROVED"
    token_rec.decided_at = datetime.now(timezone.utc)
    token_rec.decided_via = "email_link"

    # Update requirement status in app_data
    requirements = _get_requirements_array(db)
    req_item, idx = _find_requirement(requirements, token_rec.requirement_id)
    if req_item:
        req_item["status"] = "APPROVED"
        req_item["approved_at"] = datetime.now(timezone.utc).isoformat()
        req_item["approved_by"] = token_rec.approver_name
        
        # Update with optimistic locking
        record = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
        if record:
            success, _ = _update_requirement_in_db(db, requirements, idx, record.revision)
            if not success:
                db.rollback()
                raise HTTPException(status_code=409, detail="Concurrent modification, please try again")

    db.commit()
    # Notify Store Managers that an approved requirement is ready for processing
    try:
        store_incharge_ids = (
            db.query(AppDataDocument)
            .filter(AppDataDocument.key == "crm_requirements_store_incharges")
            .first()
        )
        if store_incharge_ids and isinstance(store_incharge_ids.value, list):
            for uid in store_incharge_ids.value:
                db.add(
                    Notification(
                        user_id=int(uid),
                        message=f"Requirement {token_rec.request_no} ({token_rec.requirement_type}) has been approved and is ready for Store processing.",
                        link=f"/requirements/material?requestNo={quote(token_rec.request_no, safe='')}",
                    )
                )
            db.commit()
    except Exception:
        db.rollback()
    _queue_requirement_decision_notifications(
        token_rec=token_rec,
        req_item=req_item,
        decision="APPROVED",
        request=request,
        background_tasks=background_tasks,
    )

    # Success page
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approved - {token_rec.request_no}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f4f6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05);">
    <div style="background-color: #087a3d; padding: 22px 28px; border-bottom: 3px solid #065f46;">
      <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">KIM Work Management</div>
    </div>
    <div style="padding: 40px 28px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
      <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #059669;">Approved Successfully</h2>
      <p style="font-size: 16px; color: #374151; margin: 0 0 8px 0;">Requirement <strong>{token_rec.request_no}</strong> has been approved.</p>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">Thank you for your action.</p>
    </div>
  </div>
</body>
</html>
"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)


@router.post("/{token}/reject")
def reject_requirement(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    reason: str = Form(default=""),
    db: Session = Depends(get_db),
):
    """Reject a requirement via email link."""
    token_rec, _ = _resolve_active_token(token, db, request, action="reject")

    # Update token status
    token_rec.status = "REJECTED"
    token_rec.decided_at = datetime.now(timezone.utc)
    token_rec.decision_reason = reason.strip() or "No reason provided"
    token_rec.decided_via = "email_link"

    # Update requirement status in app_data
    requirements = _get_requirements_array(db)
    req_item, idx = _find_requirement(requirements, token_rec.requirement_id)
    if req_item:
        req_item["status"] = "REJECTED"
        req_item["rejected_at"] = datetime.now(timezone.utc).isoformat()
        req_item["rejected_by"] = token_rec.approver_name
        req_item["rejection_reason"] = token_rec.decision_reason
        
        record = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
        if record:
            success, _ = _update_requirement_in_db(db, requirements, idx, record.revision)
            if not success:
                db.rollback()
                raise HTTPException(status_code=409, detail="Concurrent modification, please try again")

    db.commit()
    _queue_requirement_decision_notifications(
        token_rec=token_rec,
        req_item=req_item,
        decision="REJECTED",
        request=request,
        background_tasks=background_tasks,
        decision_reason=token_rec.decision_reason or "",
    )

    # Success page
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rejected - {token_rec.request_no}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f4f6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05);">
    <div style="background-color: #dc2626; padding: 22px 28px; border-bottom: 3px solid #b91c1c;">
      <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">KIM Work Management</div>
    </div>
    <div style="padding: 40px 28px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">✕</div>
      <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #dc2626;">Rejected</h2>
      <p style="font-size: 16px; color: #374151; margin: 0 0 8px 0;">Requirement <strong>{token_rec.request_no}</strong> has been rejected.</p>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">Reason: {token_rec.decision_reason}</p>
    </div>
  </div>
</body>
</html>
"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)


# --- Authenticated Endpoints ---

@router.post("/submit", response_model=SubmitRequirementResponse)
def submit_requirement_for_approval(
    payload: SubmitRequirementRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(lambda: None),  # Will be replaced by get_current_user
):
    """Submit a requirement for approval - creates token and sends email to approver."""
    # This endpoint will be properly wired with get_current_user
    # The actual implementation is in material_requirements.py
    raise HTTPException(status_code=501, detail="Use /material-requirements/submit endpoint")


# For dependency injection
from app.core.deps import get_current_user


@router.post("/material-requirements/submit", response_model=SubmitRequirementResponse)
def submit_material_requirement(
    payload: SubmitRequirementRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a material/IT requirement for approval."""
    req_data = payload.requirement
    req_type = req_data.get("type", "MATERIAL")
    req_id = req_data.get("id", "")
    request_no = req_data.get("request_no", "")
    title = req_data.get("title", request_no)
    total_cost = req_data.get("total_cost")
    
    if not req_id or not request_no:
        raise HTTPException(status_code=400, detail="Requirement ID and request number are required")

    # Resolve approver
    approver, approver_name, approver_email = _resolve_approver(current_user, db)
    if not approver or not approver_email:
        raise HTTPException(
            status_code=400,
            detail="No approver configured for your account. Please contact your administrator to set a reporting manager with a valid email.",
        )

    # Persist the submitted payload as well as its status. New requirements may
    # exist only in the browser because non-admin users cannot PUT app-data.
    requirements = _get_requirements_array(db)
    req_item, idx = _find_requirement(requirements, req_id)
    if req_item is None:
        req_item = dict(req_data)
        requirements.insert(0, req_item)
        idx = 0
    else:
        req_item.update(req_data)

    # Check if there's already a pending token for this requirement (before any updates)
    existing_token = (
        db.query(RequirementApprovalToken)
        .filter(
            RequirementApprovalToken.requirement_id == req_id,
            RequirementApprovalToken.status == "PENDING",
        )
        .first()
    )
    if existing_token:
        raise HTTPException(
            status_code=409,
                detail="Concurrent submission: This requirement already has a pending approval request. Please wait for the approver to act on it.",
        )

    req_item["status"] = "SUBMITTED"
    req_item["submitted_at"] = datetime.now(timezone.utc).isoformat()
    req_item["submitted_by"] = current_user.full_name
    req_item["approver"] = approver_name
    
    record = db.query(AppDataDocument).filter(AppDataDocument.key == _requirement_items_key()).first()
    expected_revision = record.revision if record else 0
    success, updated_record = _update_requirement_in_db(db, requirements, idx, expected_revision)
    if not success:
        raise HTTPException(status_code=409, detail="Concurrent modification, please try again and resubmit")

    # Create approval token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc).replace(microsecond=0)
    # Add 7 days
    from datetime import timedelta
    expires_at += timedelta(days=7)

    token_rec = RequirementApprovalToken(
        token_hash=token_hash,
        requirement_id=req_id,
        request_no=request_no,
        requirement_type=req_type,
        approver_id=approver.id,
        approver_name=approver_name,
        approver_email=approver_email,
        submitted_by_user_id=current_user.id,
        submitted_by_name=current_user.full_name,
        expires_at=expires_at,
        status="PENDING",
    )
    db.add(token_rec)
    requirement_path = "/requirements/it" if req_type == "IT" else "/requirements/material"
    db.add(
        Notification(
            user_id=approver.id,
            message=f"{current_user.full_name} submitted {req_type} requirement {request_no} for your approval.",
            link=f"{requirement_path}?requestNo={quote(request_no, safe='')}",
        )
    )
    db.commit()
    db.refresh(token_rec)

    # Generate items summary
    items_summary = _generate_items_summary(req_item)

    # Schedule email
    expires_str = expires_at.strftime("%d %b %Y at %I:%M %p")
    client_base_url = ""
    # Get client base URL from request
    origin = request.headers.get("origin")
    if origin:
        client_base_url = origin.rstrip("/")

    schedule_requirement_submission_notification(
        token_id=token_rec.id,
        raw_token=raw_token,
        approver_email=approver_email,
        approver_name=approver_name,
        requester_name=current_user.full_name,
        request_no=request_no,
        requirement_type=req_type,
        title=title,
        total_cost=total_cost,
        items_summary=items_summary,
        expires_at_str=expires_str,
        background_tasks=background_tasks,
        client_base_url=client_base_url,
    )

    return SubmitRequirementResponse(
        ok=True,
        request_no=request_no,
        approval_sent=True,
        message=f"Requirement submitted for approval. {approver_name} has been notified in-app; approval email is being sent to {approver_email}.",
    )


# Register this endpoint also under material-requirements prefix for backward compat
# (This is handled by including the router in api.py)