import os
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.branch import Branch
from app.models.expenses import (
    AIProviderConfig,
    AIProviderType,
    Bill,
    Claim,
    ClaimCycle,
    ClaimStatus,
    ClaimStatusHistory,
    CycleFrequency,
    CycleStatus,
    EmployeeConfirmationStatus,
    ExpenseCategory,
    ExpensePolicy,
    ExtractionStatus,
    Payout,
    PayoutClaim,
    PayoutEmployeeStatus,
    PayoutStatus,
)
from app.models.user import User
from app.schemas.expenses import (
    AIProviderConfigCreate,
    AIProviderConfigResponse,
    AIProviderConfigUpdate,
    AIProviderTestRequest,
    AIProviderTestResponse,
    BillResponse,
    BillUpdate,
    ClaimApprovalAction,
    ClaimCycleCreate,
    ClaimCycleResponse,
    ClaimCycleUpdate,
    ClaimDetailResponse,
    ClaimRejectAction,
    ClaimResponse,
    ClaimStatusHistoryResponse,
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryUpdate,
    ExpensePolicyResponse,
    ExpensePolicyUpdate,
    PayoutBatchCreate,
    PayoutEmployeeStatusResponse,
    PayoutResponse,
    PayoutTransferRecord,
    UserBranchAssignment,
)
from app.services.ai_vision_extractor import AIVisionExtractor
from app.services.expense_service import (
    ExpenseService,
    get_policy_value,
    set_policy_value,
)

router = APIRouter()


def _bill_to_response(bill: Bill) -> BillResponse:
    return BillResponse(
        id=bill.id,
        bill_number=bill.bill_number,
        bill_date=bill.bill_date,
        supplier_name=bill.supplier_name,
        category_id=bill.category_id,
        category_name=bill.category.name if bill.category else None,
        uploaded_by_id=bill.uploaded_by_id,
        uploaded_by_name=bill.uploaded_by.full_name if bill.uploaded_by else None,
        branch_id=bill.branch_id,
        branch_name=bill.branch.name if bill.branch else None,
        claim_id=bill.claim_id,
        source_file_path=bill.source_file_path,
        source_mime=bill.source_mime,
        source_hash=bill.source_hash,
        taxable_amount=float(bill.taxable_amount or 0.0),
        cgst_pct=float(bill.cgst_pct or 0.0),
        cgst_amount=float(bill.cgst_amount or 0.0),
        sgst_pct=float(bill.sgst_pct or 0.0),
        sgst_amount=float(bill.sgst_amount or 0.0),
        igst_pct=float(bill.igst_pct or 0.0),
        igst_amount=float(bill.igst_amount or 0.0),
        gst_total=float(bill.gst_total or 0.0),
        total_amount=float(bill.total_amount or 0.0),
        extraction_status=bill.extraction_status.value,
        extraction_confidence=float(bill.extraction_confidence or 0.0),
        extraction_raw=bill.extraction_raw,
        is_duplicate=bill.is_duplicate,
        duplicate_of_bill_id=bill.duplicate_of_bill_id,
        notes=bill.notes,
        created_at=bill.created_at,
        updated_at=bill.updated_at,
    )


def _claim_to_response(claim: Claim) -> ClaimResponse:
    return ClaimResponse(
        id=claim.id,
        claim_no=claim.claim_no,
        employee_user_id=claim.employee_user_id,
        employee_name=claim.employee.full_name if claim.employee else None,
        employee_email=claim.employee.email if claim.employee else None,
        branch_id=claim.branch_id,
        branch_name=claim.branch.name if claim.branch else None,
        claim_cycle_id=claim.claim_cycle_id,
        cycle_name=claim.cycle.name if claim.cycle else None,
        status=claim.status.value,
        total_amount=float(claim.total_amount or 0.0),
        submitted_at=claim.submitted_at,
        line_manager_id=claim.line_manager_id,
        line_manager_name=claim.employee.reporting_manager.full_name if (claim.employee and claim.employee.reporting_manager) else None,
        line_manager_action_at=claim.line_manager_action_at,
        cfo_id=claim.cfo_id,
        cfo_name=None,
        cfo_action_at=claim.cfo_action_at,
        accountant_id=claim.accountant_id,
        accountant_name=None,
        accountant_action_at=claim.accountant_action_at,
        rejection_reason=claim.rejection_reason,
        bills_count=len(claim.bills),
        created_at=claim.created_at,
        updated_at=claim.updated_at,
    )


# ==========================================
# BILL ENDPOINTS
# ==========================================

@router.post("/bills/upload", response_model=BillResponse)
async def upload_bill(
    file: UploadFile = File(...),
    category_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Uploads a receipt image/PDF, saves locally, computes hash, runs AI extraction."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "receipt.jpg"

    bill = await ExpenseService.create_bill_and_extract(
        db=db,
        uploaded_by_id=current_user.id,
        branch_id=current_user.branch_id,
        file_bytes=content,
        filename=filename,
        mime_type=mime_type,
        category_id=category_id,
        notes=notes,
    )
    return _bill_to_response(bill)


@router.get("/bills/my-bills", response_model=list[BillResponse])
def get_my_bills(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List bills uploaded by current user."""
    query = select(Bill).where(Bill.uploaded_by_id == current_user.id)
    if status_filter:
        query = query.where(Bill.extraction_status == status_filter)
    bills = db.scalars(query.order_by(desc(Bill.created_at))).all()
    return [_bill_to_response(b) for b in bills]


@router.get("/bills/all", response_model=list[BillResponse])
def get_all_bills(
    branch_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin/Accountant view of all bills across branches."""
    query = select(Bill)
    if branch_id:
        query = query.where(Bill.branch_id == branch_id)
    bills = db.scalars(query.order_by(desc(Bill.created_at))).all()
    return [_bill_to_response(b) for b in bills]


@router.get("/bills/{bill_id}", response_model=BillResponse)
def get_bill(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = db.scalar(select(Bill).where(Bill.id == bill_id))
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _bill_to_response(bill)


@router.put("/bills/{bill_id}", response_model=BillResponse)
def update_bill(
    bill_id: int,
    payload: BillUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update bill fields.
    Does NOT block or force calculations: user has full flexibility to adjust fields.
    """
    bill = db.scalar(select(Bill).where(Bill.id == bill_id))
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.claim_id:
        claim = db.scalar(select(Claim).where(Claim.id == bill.claim_id))
        if claim and claim.status not in (ClaimStatus.DRAFT, ClaimStatus.REJECTED):
            raise HTTPException(status_code=400, detail="Cannot edit a bill that is locked in a submitted claim.")

    if payload.bill_number is not None:
        bill.bill_number = payload.bill_number
    if payload.bill_date is not None:
        bill.bill_date = payload.bill_date
    if payload.supplier_name is not None:
        bill.supplier_name = payload.supplier_name
    if payload.category_id is not None:
        bill.category_id = payload.category_id
    if payload.taxable_amount is not None:
        bill.taxable_amount = payload.taxable_amount
    if payload.cgst_pct is not None:
        bill.cgst_pct = payload.cgst_pct
    if payload.cgst_amount is not None:
        bill.cgst_amount = payload.cgst_amount
    if payload.sgst_pct is not None:
        bill.sgst_pct = payload.sgst_pct
    if payload.sgst_amount is not None:
        bill.sgst_amount = payload.sgst_amount
    if payload.igst_pct is not None:
        bill.igst_pct = payload.igst_pct
    if payload.igst_amount is not None:
        bill.igst_amount = payload.igst_amount
    if payload.gst_total is not None:
        bill.gst_total = payload.gst_total
    if payload.total_amount is not None:
        bill.total_amount = payload.total_amount
    if payload.notes is not None:
        bill.notes = payload.notes
    if payload.extraction_status is not None:
        bill.extraction_status = ExtractionStatus(payload.extraction_status)

    db.commit()
    db.refresh(bill)
    return _bill_to_response(bill)


@router.post("/bills/{bill_id}/confirm", response_model=BillResponse)
def confirm_bill_ready(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark bill as READY for claim cycle aggregation."""
    bill = db.scalar(select(Bill).where(Bill.id == bill_id))
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    bill.extraction_status = ExtractionStatus.READY
    db.commit()
    db.refresh(bill)
    return _bill_to_response(bill)


@router.post("/bills/{bill_id}/re-extract", response_model=BillResponse)
async def re_extract_bill(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-runs AI Vision extraction on the bill's stored document file."""
    try:
        bill = await ExpenseService.re_extract_bill(db, bill_id)
        return _bill_to_response(bill)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Extraction failed: {str(e)}")


@router.delete("/bills/{bill_id}")
def delete_bill(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = db.scalar(select(Bill).where(Bill.id == bill_id))
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.claim_id:
        raise HTTPException(status_code=400, detail="Cannot delete bill linked to a claim.")

    db.delete(bill)
    db.commit()
    return {"message": "Bill deleted successfully"}


@router.get("/files/{bill_id}")
def serve_bill_file(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = db.scalar(select(Bill).where(Bill.id == bill_id))
    if not bill or not os.path.exists(bill.source_file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(bill.source_file_path, media_type=bill.source_mime)


# ==========================================
# CLAIM & APPROVAL ENDPOINTS
# ==========================================

@router.get("/claims/my-claims", response_model=list[ClaimResponse])
def get_my_claims(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    claims = db.scalars(
        select(Claim).where(Claim.employee_user_id == current_user.id).order_by(desc(Claim.created_at))
    ).all()
    return [_claim_to_response(c) for c in claims]


@router.get("/claims/all", response_model=list[ClaimResponse])
def get_all_claims(
    branch_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(Claim)
    if branch_id:
        query = query.where(Claim.branch_id == branch_id)
    if status_filter:
        query = query.where(Claim.status == status_filter)
    claims = db.scalars(query.order_by(desc(Claim.created_at))).all()
    return [_claim_to_response(c) for c in claims]


@router.get("/claims/{claim_id}", response_model=ClaimDetailResponse)
def get_claim_detail(
    claim_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    claim = db.scalar(select(Claim).where(Claim.id == claim_id))
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    res = _claim_to_response(claim)
    history_res = [
        ClaimStatusHistoryResponse(
            id=h.id,
            from_status=h.from_status,
            to_status=h.to_status,
            actor_user_id=h.actor_user_id,
            actor_name=h.actor.full_name if h.actor else None,
            note=h.note,
            created_at=h.created_at,
        )
        for h in claim.status_history
    ]
    bills_res = [_bill_to_response(b) for b in claim.bills]

    return ClaimDetailResponse(
        **res.model_dump(),
        bills=bills_res,
        status_history=history_res,
    )


@router.post("/claims/submit-manual", response_model=ClaimResponse)
def submit_claim_manually(
    bill_ids: list[int],
    cycle_id: Optional[int] = None,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual submission option when manual claim toggle is active in configuration."""
    bills = db.scalars(
        select(Bill).where(
            and_(
                Bill.id.in_(bill_ids),
                Bill.uploaded_by_id == current_user.id,
                Bill.claim_id.is_(None),
            )
        )
    ).all()
    if not bills:
        raise HTTPException(status_code=400, detail="No eligible unsubmitted bills found.")

    claim = ExpenseService.submit_claim_for_bills(
        db=db,
        employee_user_id=current_user.id,
        branch_id=current_user.branch_id,
        cycle_id=cycle_id,
        bills=bills,
        actor_user_id=current_user.id,
        notes=notes,
    )
    return _claim_to_response(claim)


@router.post("/claims/trigger-auto-bundle")
def trigger_auto_bundle(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger the automatic cycle claim bundler for ready bills."""
    created = ExpenseService.auto_bundle_cycle_claims(db)
    return {"message": f"Auto-bundled {len(created)} claim(s)", "claim_ids": [c.id for c in created]}


@router.get("/claims/approvals/pending", response_model=list[ClaimResponse])
def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns actionable claims for the logged-in user:
    - Line Manager: sees direct subordinates' SUBMITTED claims.
    - CFO / Admin: sees LINE_MANAGER_APPROVED claims.
    - Accountant / Admin: sees CFO_APPROVED claims.
    """
    queries = []

    # 1. Check if user is a Line Manager for someone
    subordinates = db.scalars(select(User).where(User.reporting_manager_id == current_user.id)).all()
    if subordinates:
        sub_ids = [s.id for s in subordinates]
        queries.append(
            select(Claim).where(and_(Claim.employee_user_id.in_(sub_ids), Claim.status == ClaimStatus.SUBMITTED))
        )

    # 2. Check if user is Admin / CFO
    if current_user.role in ("ADMIN", "SALES_EXECUTIVE"):  # Admin handles CFO approval
        queries.append(select(Claim).where(Claim.status == ClaimStatus.LINE_MANAGER_APPROVED))

    # 3. Check if user is Accountant / Finance Officer
    if current_user.role in ("ADMIN", "FINANCE_OFFICER"):
        queries.append(select(Claim).where(Claim.status == ClaimStatus.CFO_APPROVED))

    claims_dict: dict[int, Claim] = {}
    for q in queries:
        for c in db.scalars(q).all():
            claims_dict[c.id] = c

    sorted_claims = sorted(claims_dict.values(), key=lambda x: x.created_at, reverse=True)
    return [_claim_to_response(c) for c in sorted_claims]


@router.post("/claims/{claim_id}/approve", response_model=ClaimResponse)
def approve_claim(
    claim_id: int,
    action: ClaimApprovalAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    claim = db.scalar(select(Claim).where(Claim.id == claim_id))
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    try:
        updated = ExpenseService.approve_claim(db, claim, current_user, note=action.note)
        return _claim_to_response(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/claims/{claim_id}/reject", response_model=ClaimResponse)
def reject_claim(
    claim_id: int,
    action: ClaimRejectAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    claim = db.scalar(select(Claim).where(Claim.id == claim_id))
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    try:
        updated = ExpenseService.reject_claim(db, claim, current_user, reason=action.reason)
        return _claim_to_response(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# PAYOUT BATCH & TRANSFER ENDPOINTS
# ==========================================

@router.get("/payouts", response_model=list[PayoutResponse])
def get_payouts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payouts = db.scalars(select(Payout).order_by(desc(Payout.created_at))).all()
    results = []
    for p in payouts:
        emp_statuses = [
            PayoutEmployeeStatusResponse(
                id=s.id,
                payout_id=s.payout_id,
                employee_user_id=s.employee_user_id,
                employee_name=s.employee.full_name if s.employee else None,
                amount=float(s.amount),
                status=s.status.value,
                confirmed_at=s.confirmed_at,
                confirmation_method=s.confirmation_method,
                notes=s.notes,
                reminder_count=s.reminder_count,
                last_reminder_at=s.last_reminder_at,
                created_at=s.created_at,
            )
            for s in p.employee_statuses
        ]
        results.append(
            PayoutResponse(
                id=p.id,
                batch_no=p.batch_no,
                created_by_id=p.created_by_id,
                created_by_name=p.created_by.full_name if p.created_by else None,
                status=p.status.value,
                total_amount=float(p.total_amount),
                claim_count=p.claim_count,
                payment_date=p.payment_date,
                utr_number=p.utr_number,
                bank_ref=p.bank_ref,
                notes=p.notes,
                transferred_at=p.transferred_at,
                created_at=p.created_at,
                employee_statuses=emp_statuses,
            )
        )
    return results


@router.post("/payouts/create-batch", response_model=PayoutResponse)
def create_payout_batch(
    payload: PayoutBatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        payout = ExpenseService.create_payout_batch(
            db=db,
            claim_ids=payload.claim_ids,
            accountant=current_user,
            notes=payload.notes,
        )
        return PayoutResponse(
            id=payout.id,
            batch_no=payout.batch_no,
            created_by_id=payout.created_by_id,
            created_by_name=current_user.full_name,
            status=payout.status.value,
            total_amount=float(payout.total_amount),
            claim_count=payout.claim_count,
            created_at=payout.created_at,
            employee_statuses=[],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payouts/{payout_id}/record-transfer", response_model=PayoutResponse)
def record_payout_transfer(
    payout_id: int,
    payload: PayoutTransferRecord,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payout = db.scalar(select(Payout).where(Payout.id == payout_id))
    if not payout:
        raise HTTPException(status_code=404, detail="Payout batch not found")

    try:
        updated = ExpenseService.record_bank_transfer(
            db=db,
            payout=payout,
            accountant=current_user,
            utr_number=payload.utr_number,
            payment_date=payload.payment_date,
            bank_ref=payload.bank_ref,
            notes=payload.notes,
        )
        return get_payouts(current_user=current_user, db=db)[0]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payouts/my-confirmations", response_model=list[PayoutEmployeeStatusResponse])
def get_my_pending_confirmations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns payouts transferred to the logged-in employee awaiting receipt confirmation."""
    rows = db.scalars(
        select(PayoutEmployeeStatus)
        .where(PayoutEmployeeStatus.employee_user_id == current_user.id)
        .order_by(desc(PayoutEmployeeStatus.created_at))
    ).all()
    return [
        PayoutEmployeeStatusResponse(
            id=r.id,
            payout_id=r.payout_id,
            employee_user_id=r.employee_user_id,
            employee_name=current_user.full_name,
            amount=float(r.amount),
            status=r.status.value,
            confirmed_at=r.confirmed_at,
            confirmation_method=r.confirmation_method,
            notes=r.notes,
            reminder_count=r.reminder_count,
            last_reminder_at=r.last_reminder_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/payouts/{payout_id}/confirm-receipt")
def confirm_receipt(
    payout_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        status_row = ExpenseService.confirm_employee_receipt(
            db=db,
            payout_id=payout_id,
            employee_user_id=current_user.id,
            confirmation_method="IN_APP",
            notes=notes,
        )
        return {"message": "Receipt confirmed successfully", "status": status_row.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payouts/run-followup")
def run_payout_followup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    res = ExpenseService.process_payout_reminders_and_reconciliation(db)
    return res


# ==========================================
# CONFIGURATION & MASTERS ENDPOINTS
# ==========================================

# 1. Categories
@router.get("/configuration/categories", response_model=list[ExpenseCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    cats = db.scalars(select(ExpenseCategory).order_by(ExpenseCategory.name.asc())).all()
    return cats


@router.post("/configuration/categories", response_model=ExpenseCategoryResponse)
def create_category(payload: ExpenseCategoryCreate, db: Session = Depends(get_db)):
    cat = ExpenseCategory(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/configuration/categories/{category_id}", response_model=ExpenseCategoryResponse)
def update_category(category_id: int, payload: ExpenseCategoryUpdate, db: Session = Depends(get_db)):
    cat = db.scalar(select(ExpenseCategory).where(ExpenseCategory.id == category_id))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


# 2. Cycles
@router.get("/configuration/cycles", response_model=list[ClaimCycleResponse])
def list_cycles(db: Session = Depends(get_db)):
    cycles = db.scalars(select(ClaimCycle).order_by(desc(ClaimCycle.period_start))).all()
    return cycles


@router.post("/configuration/cycles", response_model=ClaimCycleResponse)
def create_cycle(payload: ClaimCycleCreate, db: Session = Depends(get_db)):
    cycle = ClaimCycle(**payload.model_dump())
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.put("/configuration/cycles/{cycle_id}", response_model=ClaimCycleResponse)
def update_cycle(cycle_id: int, payload: ClaimCycleUpdate, db: Session = Depends(get_db)):
    cycle = db.scalar(select(ClaimCycle).where(ClaimCycle.id == cycle_id))
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cycle, k, v)
    db.commit()
    db.refresh(cycle)
    return cycle


# 3. AI Providers
@router.get("/configuration/ai-providers", response_model=list[AIProviderConfigResponse])
def list_ai_providers(db: Session = Depends(get_db)):
    providers = db.scalars(select(AIProviderConfig).order_by(AIProviderConfig.id.asc())).all()
    if not providers:
        default_providers = [
            AIProviderConfig(
                provider=AIProviderType.GOOGLE,
                label="Google Gemini API",
                model_name="gemini-1.5-flash",
                api_endpoint="https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                api_key_env_var="GEMINI_API_KEY",
                is_default=True,
                is_active=True,
            ),
            AIProviderConfig(
                provider=AIProviderType.NVIDIA,
                label="Nvidia NIM",
                model_name="meta/llama-3.2-11b-vision-instruct",
                api_endpoint="https://integrate.api.nvidia.com/v1/chat/completions",
                api_key_env_var="NVIDIA_API_KEY",
                is_default=False,
                is_active=True,
            ),
            AIProviderConfig(
                provider=AIProviderType.OPENROUTER,
                label="OpenRouter",
                model_name="google/gemini-flash-1.5",
                api_endpoint="https://openrouter.ai/api/v1/chat/completions",
                api_key_env_var="OPENROUTER_API_KEY",
                is_default=False,
                is_active=True,
            ),
            AIProviderConfig(
                provider=AIProviderType.KILO,
                label="Kilo AI",
                model_name="kilo-vision-1",
                api_endpoint="https://api.kilo.ai/v1/chat/completions",
                api_key_env_var="KILO_API_KEY",
                is_default=False,
                is_active=True,
            ),
            AIProviderConfig(
                provider=AIProviderType.LOCAL,
                label="Local Ollama",
                model_name="llama3.2-vision",
                api_endpoint="http://localhost:11434/api/generate",
                api_key_env_var=None,
                is_default=False,
                is_active=True,
            ),
        ]
        db.add_all(default_providers)
        db.commit()
        providers = db.scalars(select(AIProviderConfig).order_by(AIProviderConfig.id.asc())).all()
    return providers


@router.post("/configuration/ai-providers", response_model=AIProviderConfigResponse)
def create_ai_provider(payload: AIProviderConfigCreate, db: Session = Depends(get_db)):
    if payload.is_default:
        db.query(AIProviderConfig).update({"is_default": False})
    provider = AIProviderConfig(**payload.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.put("/configuration/ai-providers/{provider_id}", response_model=AIProviderConfigResponse)
def update_ai_provider(provider_id: int, payload: AIProviderConfigUpdate, db: Session = Depends(get_db)):
    prov = db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == provider_id))
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default"):
        db.query(AIProviderConfig).update({"is_default": False})
    for k, v in data.items():
        setattr(prov, k, v)
    db.commit()
    db.refresh(prov)
    return prov


@router.post("/configuration/ai-providers/test", response_model=AIProviderTestResponse)
async def test_ai_provider(payload: AIProviderTestRequest, db: Session = Depends(get_db)):
    result = await AIVisionExtractor.test_connection(
        provider_type=payload.provider,
        model_name=payload.model_name,
        api_endpoint=payload.api_endpoint,
        api_key=payload.api_key,
    )
    return AIProviderTestResponse(
        success=result.get("success", False),
        message=result.get("message", "Test completed"),
    )


# 4. Policies
@router.get("/configuration/policies", response_model=list[ExpensePolicyResponse])
def list_policies(db: Session = Depends(get_db)):
    policies = db.scalars(select(ExpensePolicy).order_by(ExpensePolicy.policy_key.asc())).all()
    if not policies:
        default_pols = [
            ("manual_claim_submission_enabled", "false", "Enable manual claim submission by employees instead of automatic cycle bundling", "BOOLEAN"),
            ("accountant_escalation_hours", "72", "Hours before escalating unconfirmed payout to accountant reminder queue", "INTEGER"),
            ("auto_reconcile_days", "7", "Days before auto-reconciling unconfirmed payout", "INTEGER"),
            ("auto_reconcile_enabled", "true", "Enable automatic reconciliation after N days of no dispute", "BOOLEAN"),
            ("max_bill_age_days", "90", "Maximum allowed age of expense receipt in days", "INTEGER"),
            ("gst_is_mandatory", "false", "Whether GST split is strictly required on all bills", "BOOLEAN"),
        ]
        for k, v, d, t in default_pols:
            db.add(ExpensePolicy(policy_key=k, policy_value=v, description=d, data_type=t))
        db.commit()
        policies = db.scalars(select(ExpensePolicy).order_by(ExpensePolicy.policy_key.asc())).all()
    return policies


@router.put("/configuration/policies/{policy_key}", response_model=ExpensePolicyResponse)
def update_policy(policy_key: str, payload: ExpensePolicyUpdate, db: Session = Depends(get_db)):
    policy = set_policy_value(db, policy_key, payload.policy_value, description=payload.description)
    return policy


# 5. Branches & Users
@router.get("/configuration/branches")
def list_branches(db: Session = Depends(get_db)):
    branches = db.scalars(select(Branch).where(Branch.is_active == True)).all()
    return [{"id": b.id, "code": b.code, "name": b.name, "address": b.address} for b in branches]


@router.post("/configuration/branches/create")
def create_branch(
    code: str = Form(...),
    name: str = Form(...),
    address: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    branch = Branch(code=code.strip().upper(), name=name.strip(), address=address, is_active=True)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return {"id": branch.id, "code": branch.code, "name": branch.name}


@router.post("/configuration/branches/assign-user")
def assign_user_branch_and_manager(
    payload: UserBranchAssignment,
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == payload.user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.branch_id is not None:
        user.branch_id = payload.branch_id
    if payload.reporting_manager_id is not None:
        user.reporting_manager_id = payload.reporting_manager_id
    db.commit()
    return {"message": "User branch and reporting manager updated successfully"}


@router.get("/configuration/users")
def list_users_for_assignment(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.full_name.asc())).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "branch_id": u.branch_id,
            "branch_name": u.branch.name if u.branch else None,
            "reporting_manager_id": u.reporting_manager_id,
            "reporting_manager_name": u.reporting_manager.full_name if u.reporting_manager else None,
        }
        for u in users
    ]
