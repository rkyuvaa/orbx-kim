from datetime import datetime, date, timezone
from typing import Optional, List
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.user import User, UserStatus
from app.models.enums import UserRole
from app.models.recruitment import (
    JobRequisition,
    Candidate,
    CandidateStageHistory,
    CandidateDocument,
    RecruitmentStage,
    RequisitionStatus,
    OfferStatus,
)
from app.schemas.recruitment import (
    JobRequisitionCreate,
    JobRequisitionUpdate,
    JobRequisitionApproveReject,
    JobRequisitionOut,
    CandidateCreate,
    CandidateUpdate,
    CandidateStageTransition,
    CandidateInterviewSchedule,
    CandidateOfferUpdate,
    CandidateCreateEmployee,
    CandidateOut,
    CandidateStageHistoryOut,
    CandidateDocumentOut,
    RecruitmentDashboardKPIs,
)

router = APIRouter(prefix="/hr/recruitment", tags=["hr-recruitment"], dependencies=[Depends(require_permission("view", "hr_recruitment"))])


def _format_candidate_out(cand: Candidate) -> CandidateOut:
    out = CandidateOut.model_validate(cand)
    if cand.job_requisition:
        out.job_title = cand.job_requisition.job_title
        out.job_department = cand.job_requisition.department
    return out


# ============================================================================
# Dashboard KPIs Endpoint
# ============================================================================

@router.get("/kpis", response_model=RecruitmentDashboardKPIs)
def get_recruitment_kpis(db: Session = Depends(get_db)):
    """Fetch recruitment overview stats and KPI counters"""
    open_reqs = db.query(JobRequisition).filter(
        JobRequisition.status.in_(["Job Requisition", "Approval", "Approved"])
    ).count()

    total_cands = db.query(Candidate).count()

    # Stage counts
    requisition_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.JOB_REQUISITION).count()
    approval_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.APPROVAL).count()
    sourcing_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.SOURCING).count()
    screening_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.SCREENING).count()
    interview_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.INTERVIEW).count()
    selected_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.SELECTED).count()
    offer_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.OFFER_JOINING).count()
    
    joining_pending_cnt = db.query(Candidate).filter(
        and_(
            Candidate.stage == RecruitmentStage.OFFER_JOINING,
            Candidate.offer_status == OfferStatus.ACCEPTED
        )
    ).count()

    joined_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.JOINED).count()
    on_hold_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.ON_HOLD).count()
    rejected_cnt = db.query(Candidate).filter(Candidate.stage == RecruitmentStage.REJECTED).count()

    return RecruitmentDashboardKPIs(
        open_requisitions=open_reqs,
        total_candidates=total_cands,
        job_requisition=requisition_cnt,
        approval=approval_cnt,
        sourcing=sourcing_cnt,
        screening=screening_cnt,
        interviews=interview_cnt,
        selected=selected_cnt,
        offers=offer_cnt,
        joining_pending=joining_pending_cnt,
        joined=joined_cnt,
        on_hold=on_hold_cnt,
        rejected=rejected_cnt,
    )


# ============================================================================
# Job Requisitions Endpoints
# ============================================================================

@router.get("/requisitions", response_model=List[JobRequisitionOut])
def list_job_requisitions(
    status_filter: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all job requisitions with candidate counts"""
    query = db.query(JobRequisition)
    if status_filter and status_filter != "All":
        query = query.filter(JobRequisition.status == status_filter)
    if department and department != "All":
        query = query.filter(JobRequisition.department == department)

    requisitions = query.order_by(JobRequisition.id.desc()).all()
    results = []
    for req in requisitions:
        cand_count = db.query(Candidate).filter(Candidate.job_requisition_id == req.id).count()
        req_out = JobRequisitionOut.model_validate(req)
        req_out.candidate_count = cand_count
        results.append(req_out)

    return results


@router.post("/requisitions", response_model=JobRequisitionOut, status_code=status.HTTP_201_CREATED)
def create_job_requisition(
    payload: JobRequisitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a new Job Requisition for Approval"""
    # Auto generate req_code REQ-YYYY-XXX
    year = datetime.now().year
    count = db.query(JobRequisition).count() + 1
    req_code = f"REQ-{year}-{count:03d}"

    req = JobRequisition(
        req_code=req_code,
        job_title=payload.job_title,
        department=payload.department,
        vacancies=payload.vacancies,
        employment_type=payload.employment_type,
        required_qualification=payload.required_qualification,
        required_experience=payload.required_experience,
        skills=payload.skills,
        salary_range=payload.salary_range,
        preferred_joining_date=payload.preferred_joining_date,
        job_description=payload.job_description,
        requesting_department=payload.requesting_department,
        requester_id=current_user.id,
        requester_name=current_user.full_name or "HR User",
        status="Approval",  # Submit directly for approval flow
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = 0
    return out


@router.get("/requisitions/{req_id}", response_model=JobRequisitionOut)
def get_job_requisition(req_id: int, db: Session = Depends(get_db)):
    """Fetch single job requisition detail"""
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")
    cand_count = db.query(Candidate).filter(Candidate.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = cand_count
    return out


@router.put("/requisitions/{req_id}", response_model=JobRequisitionOut)
def update_job_requisition(
    req_id: int,
    payload: JobRequisitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update job requisition details"""
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(req, field, value)

    db.commit()
    db.refresh(req)
    cand_count = db.query(Candidate).filter(Candidate.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = cand_count
    return out


@router.post("/requisitions/{req_id}/approve-reject", response_model=JobRequisitionOut)
def approve_or_reject_job_requisition(
    req_id: int,
    payload: JobRequisitionApproveReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve or Reject a Job Requisition"""
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")

    if payload.action == "Approve":
        req.status = "Approved"
        req.rejection_reason = None
    else:
        if not payload.rejection_reason:
            raise HTTPException(status_code=400, detail="Rejection reason is mandatory when rejecting a requisition")
        req.status = "Rejected"
        req.rejection_reason = payload.rejection_reason

    db.commit()
    db.refresh(req)
    cand_count = db.query(Candidate).filter(Candidate.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = cand_count
    return out


@router.delete("/requisitions/{req_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job_requisition(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a job requisition"""
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")

    # Set candidates' job_requisition_id to None
    db.query(Candidate).filter(Candidate.job_requisition_id == req.id).update(
        {Candidate.job_requisition_id: None}, synchronize_session=False
    )
    db.delete(req)
    db.commit()
    return None


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a candidate record"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    db.delete(candidate)
    db.commit()
    return None


# ============================================================================
# Candidate Endpoints
# ============================================================================

@router.get("/candidates", response_model=List[CandidateOut])
def list_candidates(
    search: Optional[str] = Query(None, description="Search by name, mobile, email"),
    job_requisition_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    candidate_source: Optional[str] = Query(None),
    interview_date: Optional[str] = Query(None),
    joining_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Filter and search recruitment candidates"""
    query = db.query(Candidate).options(
        joinedload(Candidate.job_requisition),
        joinedload(Candidate.stage_history),
        joinedload(Candidate.documents),
    )

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Candidate.name.ilike(search_term),
                Candidate.mobile.ilike(search_term),
                Candidate.email.ilike(search_term),
                Candidate.candidate_code.ilike(search_term),
            )
        )

    if job_requisition_id:
        query = query.filter(Candidate.job_requisition_id == job_requisition_id)

    if stage and stage != "All":
        query = query.filter(Candidate.stage == stage)

    if candidate_source and candidate_source != "All":
        query = query.filter(Candidate.candidate_source == candidate_source)

    if department and department != "All":
        query = query.join(Candidate.job_requisition).filter(JobRequisition.department == department)

    candidates = query.order_by(Candidate.id.desc()).all()
    return [_format_candidate_out(c) for c in candidates]


@router.post("/candidates", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add new candidate against job requisition (or general pool)"""
    # Prevent duplicate candidate using email or mobile
    existing = db.query(Candidate).filter(
        or_(Candidate.email == payload.email, Candidate.mobile == payload.mobile)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Candidate with email {payload.email} or mobile {payload.mobile} already exists ({existing.candidate_code})"
        )

    year = datetime.now().year
    count = db.query(Candidate).count() + 1
    candidate_code = f"CAND-{year}-{count:04d}"

    cand_stage = payload.stage or "Sourcing"
    candidate = Candidate(
        candidate_code=candidate_code,
        job_requisition_id=payload.job_requisition_id,
        name=payload.name,
        mobile=payload.mobile,
        email=payload.email,
        resume_url=payload.resume_url,
        experience=payload.experience,
        qualification=payload.qualification,
        current_company=payload.current_company,
        current_salary=payload.current_salary,
        expected_salary=payload.expected_salary,
        notice_period=payload.notice_period,
        candidate_source=payload.candidate_source,
        stage=cand_stage,
    )
    db.add(candidate)
    db.flush()

    # Log initial stage history
    history = CandidateStageHistory(
        candidate_id=candidate.id,
        previous_stage=None,
        new_stage=cand_stage,
        changed_by_id=current_user.id,
        changed_by_name=current_user.full_name or "HR User",
        remarks=f"Candidate added to pipeline in {cand_stage} stage",
    )
    db.add(history)
    db.commit()

    db.refresh(candidate)
    return _format_candidate_out(candidate)


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """Get single candidate detail with full history and documents"""
    candidate = db.query(Candidate).options(
        joinedload(Candidate.job_requisition),
        joinedload(Candidate.stage_history),
        joinedload(Candidate.documents),
    ).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _format_candidate_out(candidate)


@router.put("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update candidate profile details"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(candidate, field, value)

    db.commit()
    db.refresh(candidate)
    return _format_candidate_out(candidate)


@router.post("/candidates/{candidate_id}/transition-stage", response_model=CandidateOut)
def transition_candidate_stage(
    candidate_id: int,
    payload: CandidateStageTransition,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition candidate to new stage with mandatory validations & history logging"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    valid_stages = [e.value for e in RecruitmentStage]
    if payload.new_stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid stage '{payload.new_stage}'. Must be one of {valid_stages}")

    prev_stage = candidate.stage
    new_stage = payload.new_stage

    if prev_stage == new_stage and new_stage not in [RecruitmentStage.INTERVIEW, RecruitmentStage.OFFER_JOINING]:
        return _format_candidate_out(candidate)

    # Mandatory validations per stage
    if new_stage == RecruitmentStage.ON_HOLD:
        if not payload.on_hold_reason and not payload.remarks:
            raise HTTPException(status_code=400, detail="On Hold reason is mandatory when placing candidate on hold")
        candidate.previous_stage = prev_stage
        candidate.on_hold_reason = payload.on_hold_reason or payload.remarks

    if new_stage == RecruitmentStage.REJECTED:
        if not payload.rejection_reason and not payload.remarks:
            raise HTTPException(status_code=400, detail="Rejection reason is mandatory when rejecting candidate")
        candidate.rejection_reason = payload.rejection_reason or payload.remarks

    # Interview updates
    if payload.interview_type or payload.interview_date:
        if payload.interview_type: candidate.interview_type = payload.interview_type
        if payload.interview_date: candidate.interview_date = payload.interview_date
        if payload.interviewer_panel: candidate.interviewer_panel = payload.interviewer_panel
        if payload.interview_round: candidate.interview_round = payload.interview_round
        if payload.interview_feedback: candidate.interview_feedback = payload.interview_feedback
        if payload.interview_rating: candidate.interview_rating = payload.interview_rating

    # Selected updates
    if payload.selected_designation: candidate.selected_designation = payload.selected_designation
    if payload.selected_department: candidate.selected_department = payload.selected_department
    if payload.proposed_salary: candidate.proposed_salary = payload.proposed_salary
    if payload.expected_joining_date: candidate.expected_joining_date = payload.expected_joining_date
    if payload.selected_employment_type: candidate.selected_employment_type = payload.selected_employment_type

    # Offer updates
    if payload.offer_status: candidate.offer_status = payload.offer_status
    if payload.confirmed_joining_date: candidate.confirmed_joining_date = payload.confirmed_joining_date

    # Update candidate stage
    candidate.stage = new_stage

    # Build audit remarks
    audit_remarks = payload.remarks or ""
    if new_stage == RecruitmentStage.REJECTED and candidate.rejection_reason:
        audit_remarks = f"Rejection Reason: {candidate.rejection_reason}. {audit_remarks}".strip()
    elif new_stage == RecruitmentStage.ON_HOLD and candidate.on_hold_reason:
        audit_remarks = f"On Hold Reason: {candidate.on_hold_reason}. {audit_remarks}".strip()

    # Log Stage History
    history = CandidateStageHistory(
        candidate_id=candidate.id,
        previous_stage=prev_stage,
        new_stage=new_stage,
        changed_by_id=current_user.id,
        changed_by_name=current_user.full_name or "HR User",
        remarks=audit_remarks or f"Stage updated from {prev_stage} to {new_stage}",
    )
    db.add(history)
    db.commit()
    db.refresh(candidate)

    return _format_candidate_out(candidate)


@router.post("/candidates/{candidate_id}/resume", response_model=CandidateOut)
def resume_candidate_recruitment(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resume candidate from On Hold stage to their previous active stage"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.stage != RecruitmentStage.ON_HOLD:
        raise HTTPException(status_code=400, detail="Candidate is not currently On Hold")

    target_stage = candidate.previous_stage or RecruitmentStage.SOURCING
    prev_stage = candidate.stage

    candidate.stage = target_stage
    candidate.previous_stage = None

    history = CandidateStageHistory(
        candidate_id=candidate.id,
        previous_stage=prev_stage,
        new_stage=target_stage,
        changed_by_id=current_user.id,
        changed_by_name=current_user.full_name or "HR User",
        remarks=f"Resumed recruitment from On Hold back to {target_stage}",
    )
    db.add(history)
    db.commit()
    db.refresh(candidate)

    return _format_candidate_out(candidate)


@router.post("/candidates/{candidate_id}/schedule-interview", response_model=CandidateOut)
def schedule_candidate_interview(
    candidate_id: int,
    payload: CandidateInterviewSchedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule or update interview details for candidate"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    prev_stage = candidate.stage
    candidate.interview_type = payload.interview_type
    candidate.interview_date = payload.interview_date
    candidate.interviewer_panel = payload.interviewer_panel
    candidate.interview_round = payload.interview_round
    if payload.interview_feedback: candidate.interview_feedback = payload.interview_feedback
    if payload.interview_rating: candidate.interview_rating = payload.interview_rating
    if payload.interview_remarks: candidate.interview_remarks = payload.interview_remarks

    if candidate.stage != RecruitmentStage.INTERVIEW:
        candidate.stage = RecruitmentStage.INTERVIEW
        history = CandidateStageHistory(
            candidate_id=candidate.id,
            previous_stage=prev_stage,
            new_stage=RecruitmentStage.INTERVIEW,
            changed_by_id=current_user.id,
            changed_by_name=current_user.full_name or "HR User",
            remarks=f"Scheduled {payload.interview_round} ({payload.interview_type}) with {payload.interviewer_panel}",
        )
        db.add(history)

    db.commit()
    db.refresh(candidate)
    return _format_candidate_out(candidate)


@router.post("/candidates/{candidate_id}/update-offer", response_model=CandidateOut)
def update_candidate_offer(
    candidate_id: int,
    payload: CandidateOfferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update offer status (Draft, Released, Accepted, Declined)"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    prev_stage = candidate.stage
    candidate.offer_status = payload.offer_status
    if payload.confirmed_joining_date:
        candidate.confirmed_joining_date = payload.confirmed_joining_date

    # If offer declined, move candidate to Rejected
    if payload.offer_status == OfferStatus.DECLINED:
        candidate.stage = RecruitmentStage.REJECTED
        candidate.rejection_reason = payload.rejection_reason or "Candidate declined the job offer"
        history = CandidateStageHistory(
            candidate_id=candidate.id,
            previous_stage=prev_stage,
            new_stage=RecruitmentStage.REJECTED,
            changed_by_id=current_user.id,
            changed_by_name=current_user.full_name or "HR User",
            remarks=f"Offer Declined. Reason: {candidate.rejection_reason}",
        )
        db.add(history)
    else:
        if candidate.stage != RecruitmentStage.OFFER_JOINING:
            candidate.stage = RecruitmentStage.OFFER_JOINING
            history = CandidateStageHistory(
                candidate_id=candidate.id,
                previous_stage=prev_stage,
                new_stage=RecruitmentStage.OFFER_JOINING,
                changed_by_id=current_user.id,
                changed_by_name=current_user.full_name or "HR User",
                remarks=f"Offer status updated to {payload.offer_status}",
            )
            db.add(history)

    db.commit()
    db.refresh(candidate)
    return _format_candidate_out(candidate)


@router.post("/candidates/{candidate_id}/create-employee", response_model=CandidateOut)
def create_employee_from_candidate(
    candidate_id: int,
    payload: CandidateCreateEmployee,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert Joined candidate to Employee record in User/Employee module (preventing duplicates)"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.is_employee_created and candidate.created_employee_id:
        raise HTTPException(status_code=400, detail="Employee record has already been created for this candidate")

    # Check if user with candidate email already exists
    existing_user = db.query(User).filter(User.email == candidate.email).first()
    if existing_user:
        candidate.is_employee_created = True
        candidate.created_employee_id = existing_user.id
        candidate.stage = RecruitmentStage.JOINED
        db.commit()
        db.refresh(candidate)
        return _format_candidate_out(candidate)

    # Generate employee code EMP-XXX
    emp_code = payload.emp_id
    if not emp_code:
        user_count = db.query(User).count() + 1
        emp_code = f"EMP-{user_count:04d}"

    designation = payload.designation or candidate.selected_designation or "Employee"

    # Create new User record
    from app.core.security import hash_password
    hashed_pwd = hash_password(payload.password or "Employee@123")

    new_employee = User(
        email=candidate.email,
        password_hash=hashed_pwd,
        full_name=candidate.name,
        username=candidate.email.split("@")[0],
        mobile=candidate.mobile,
        employee_id=emp_code,
        designation=designation,
        role=UserRole.EMPLOYEE,
        status=UserStatus.ACTIVE,
    )
    db.add(new_employee)
    db.flush()

    candidate.is_employee_created = True
    candidate.created_employee_id = new_employee.id
    candidate.stage = RecruitmentStage.JOINED
    candidate.joined_date = date.today()

    # Log history
    history = CandidateStageHistory(
        candidate_id=candidate.id,
        previous_stage=candidate.stage,
        new_stage=RecruitmentStage.JOINED,
        changed_by_id=current_user.id,
        changed_by_name=current_user.full_name or "HR User",
        remarks=f"Employee record created successfully ({emp_code})",
    )
    db.add(history)
    db.commit()

    db.refresh(candidate)
    return _format_candidate_out(candidate)


@router.post("/candidates/{candidate_id}/upload-document", response_model=CandidateDocumentOut)
async def upload_candidate_document(
    candidate_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload resume or document attachment for candidate"""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    upload_dir = os.path.join("uploads", "recruitment", str(candidate_id))
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/uploads/recruitment/{candidate_id}/{safe_filename}"
    doc = CandidateDocument(
        candidate_id=candidate.id,
        file_name=file.filename,
        file_path=file_url,
        file_type=file.content_type,
    )
    db.add(doc)

    if not candidate.resume_url:
        candidate.resume_url = file_url

    db.commit()
    db.refresh(doc)
    return doc
