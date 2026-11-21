from datetime import datetime, date, timezone
from typing import Optional, List
import hashlib
import os
import shutil
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Form,
    status,
)
from sqlalchemy import and_, or_, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_permission, require_roles
from app.db.session import get_db
from app.models.user import User, UserStatus
from app.models.enums import UserRole
from app.models.expenses import AIProviderConfig, AIProviderType
from app.models.recruitment import (
    Candidate,
    CandidateAIEvaluation,
    CandidateDocument,
    CandidateStageHistory,
    HRAIUsageLog,
    HRSetting,
    Interview,
    InterviewStatus,
    JobApplication,
    JobPosting,
    JobRequisition,
    PostingStatus,
    RecruitmentStage,
    RequisitionStatus,
    OfferStatus,
)
from app.schemas.recruitment import (
    BulkResumeUploadResponse,
    CandidateAIEvaluationOut,
    CandidateAIFeedbackUpdate,
    CandidateCreate,
    CandidateDocumentOut,
    CandidateOut,
    CandidateStageHistoryOut,
    CandidateUpdate,
    HRAISettingsOut,
    HRAISettingsUpdate,
    HRAIUsageSummary,
    InterviewCreate,
    InterviewOut,
    InterviewUpdate,
    JobApplicationCreate,
    JobApplicationOut,
    JobApplicationStageTransition,
    JobApplicationUpdate,
    JobPostingCreate,
    JobPostingOut,
    JobPostingPublish,
    JobPostingUpdate,
    JobRequisitionApproveReject,
    JobRequisitionCreate,
    JobRequisitionOut,
    JobRequisitionUpdate,
    RecruitmentDashboardKPIs,
)
from app.services.recruitment_security import (
    encrypt_api_key,
    mask_api_key,
    validate_mime_sniffing,
)
from app.services.recruitment_ai_service import (
    draft_channel_job_posting,
    evaluate_application_ai,
    extract_and_cache_rubric,
    get_hr_setting,
    parse_resume_to_candidate_data,
    set_hr_setting,
    dispatch_interview_notifications,
)
from app.services.ai_vision_extractor import AIVisionExtractor

router = APIRouter(prefix="/hr/recruitment", tags=["hr-recruitment"])


def _format_candidate_out(cand: Candidate) -> CandidateOut:
    out = CandidateOut.model_validate(cand)
    if cand.job_requisition:
        out.job_title = cand.job_requisition.job_title
        out.job_department = cand.job_requisition.department
    if cand.applications:
        # Most recent application
        latest_app = cand.applications[-1]
        out.latest_application_id = latest_app.id
        out.ai_flagged = bool(latest_app.ai_flagged)
        out.ai_flag_reason = latest_app.ai_flag_reason
        if latest_app.latest_ai_score is not None:
            out.ai_match_score = latest_app.latest_ai_score
        if latest_app.latest_ai_category:
            out.ai_match_category = latest_app.latest_ai_category
    return out


def _format_application_out(app: JobApplication) -> JobApplicationOut:
    out = JobApplicationOut.model_validate(app)
    if app.candidate:
        out.candidate_name = app.candidate.name
        out.candidate_email = app.candidate.email
        out.candidate_mobile = app.candidate.mobile
        out.candidate_experience = app.candidate.experience
        out.candidate_qualification = app.candidate.qualification
        out.candidate_resume_url = app.candidate.resume_url
    if app.job_requisition:
        out.job_title = app.job_requisition.job_title
        out.job_department = app.job_requisition.department
    return out


def _format_interview_out(inv: Interview) -> InterviewOut:
    out = InterviewOut.model_validate(inv)
    if inv.application and inv.application.candidate:
        out.candidate_name = inv.application.candidate.name
    if inv.application and inv.application.job_requisition:
        out.job_title = inv.application.job_requisition.job_title
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
    total_apps = db.query(JobApplication).count()

    # Stage counts from applications (or candidates fallback)
    sourcing_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.SOURCING).count()
    screening_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.SCREENING).count()
    interview_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.INTERVIEW).count()
    selected_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.SELECTED).count()
    offer_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.OFFER_JOINING).count()
    joined_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.JOINED).count()
    on_hold_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.ON_HOLD).count()
    rejected_cnt = db.query(JobApplication).filter(JobApplication.stage == RecruitmentStage.REJECTED).count()

    # AI Stats
    ai_evaluated = db.query(JobApplication).filter(JobApplication.ai_evaluation_status == "EVALUATED").count()
    ai_high_match = db.query(JobApplication).filter(JobApplication.latest_ai_category == "High Match").count()

    return RecruitmentDashboardKPIs(
        open_requisitions=open_reqs,
        total_candidates=total_cands,
        job_requisition=open_reqs,
        approval=db.query(JobRequisition).filter(JobRequisition.status == "Approval").count(),
        sourcing=sourcing_cnt,
        screening=screening_cnt,
        interviews=interview_cnt,
        selected=selected_cnt,
        offers=offer_cnt,
        joining_pending=db.query(JobApplication).filter(
            and_(JobApplication.stage == RecruitmentStage.OFFER_JOINING, JobApplication.offer_status == OfferStatus.ACCEPTED)
        ).count(),
        joined=joined_cnt,
        on_hold=on_hold_cnt,
        rejected=rejected_cnt,
        total_applications=total_apps,
        ai_evaluated_count=ai_evaluated,
        ai_high_match_count=ai_high_match,
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
        app_count = db.query(JobApplication).filter(JobApplication.job_requisition_id == req.id).count()
        req_out = JobRequisitionOut.model_validate(req)
        req_out.candidate_count = app_count
        results.append(req_out)

    return results


@router.post("/requisitions", response_model=JobRequisitionOut, status_code=status.HTTP_201_CREATED)
def create_job_requisition(
    payload: JobRequisitionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a new Job Requisition for Approval"""
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
        status="Approval",
        rubric_version=1,
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
    req = db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")
    app_count = db.query(JobApplication).filter(JobApplication.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = app_count
    return out


@router.put("/requisitions/{req_id}", response_model=JobRequisitionOut)
def update_job_requisition(
    req_id: int,
    payload: JobRequisitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update job requisition details"""
    req = db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(req, field, value)

    # Invalidate rubric if skills or JD changed
    if "skills" in update_data or "job_description" in update_data or "required_experience" in update_data:
        req.rubric_version = (req.rubric_version or 1) + 1
        req.scoring_rubric = None

    db.commit()
    db.refresh(req)
    app_count = db.query(JobApplication).filter(JobApplication.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = app_count
    return out


@router.post("/requisitions/{req_id}/upload-jd", response_model=JobRequisitionOut)
async def upload_job_description(
    req_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload JD document (PDF/Image/Doc), validates MIME sniffing, extracts text & caches rubric."""
    req = db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")

    file_bytes = await file.read()
    is_valid, detected_mime = validate_mime_sniffing(file_bytes, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=detected_mime)

    upload_dir = os.path.join("uploads", "recruitment", "jd", str(req_id))
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes)

    file_url = f"/uploads/recruitment/jd/{req_id}/{safe_filename}"
    req.jd_attachment_url = file_url
    req.jd_attachment_name = file.filename

    # Extract text from uploaded document
    extracted_text = ""
    if detected_mime == "application/pdf":
        from app.services.recruitment_ai_service import extract_text_from_pdf_bytes
        extracted_text = extract_text_from_pdf_bytes(file_bytes)
    else:
        try:
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = ""

    req.extracted_jd_text = extracted_text or req.job_description
    req.rubric_version = (req.rubric_version or 1) + 1

    # Generate and cache rubric with new JD
    try:
        await extract_and_cache_rubric(req.id, db)
    except Exception as e:
        logger.warning(f"Could not immediately cache rubric: {e}")

    db.commit()
    db.refresh(req)
    app_count = db.query(JobApplication).filter(JobApplication.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = app_count
    return out


@router.post("/requisitions/{req_id}/generate-rubric", response_model=dict)
async def generate_requisition_rubric(req_id: int, db: Session = Depends(get_db)):
    """Forces AI extraction and caching of the Job Scoring Rubric."""
    rubric = await extract_and_cache_rubric(req_id, db)
    return rubric


@router.post("/requisitions/{req_id}/approve-reject", response_model=JobRequisitionOut)
def approve_or_reject_job_requisition(
    req_id: int,
    payload: JobRequisitionApproveReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve or Reject a Job Requisition"""
    req = db.get(JobRequisition, req_id)
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
    app_count = db.query(JobApplication).filter(JobApplication.job_requisition_id == req.id).count()
    out = JobRequisitionOut.model_validate(req)
    out.candidate_count = app_count
    return out


@router.delete("/requisitions/{req_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job_requisition(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a job requisition"""
    req = db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Job Requisition not found")

    db.delete(req)
    db.commit()
    return None


# ============================================================================
# Multi-Channel Job Postings (Indeed, LinkedIn, etc.)
# ============================================================================

@router.get("/requisitions/{req_id}/postings", response_model=List[JobPostingOut])
def list_requisition_postings(req_id: int, db: Session = Depends(get_db)):
    """List job postings for this requisition"""
    return db.scalars(select(JobPosting).where(JobPosting.requisition_id == req_id)).all()


@router.post("/requisitions/{req_id}/postings/draft", response_model=JobPostingOut)
async def draft_job_posting(
    req_id: int,
    channel: str = Query("indeed", description="Posting channel, e.g. indeed, linkedin, naukri"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI drafts an Indeed-optimized job posting from the requisition specs."""
    posting = await draft_channel_job_posting(requisition_id=req_id, channel=channel, db=db)
    return posting


@router.put("/postings/{posting_id}/approve", response_model=JobPostingOut)
def approve_job_posting(
    posting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HR reviews and approves the AI job posting."""
    posting = db.get(JobPosting, posting_id)
    if not posting:
        raise HTTPException(status_code=404, detail="Job Posting not found")

    posting.status = PostingStatus.HR_APPROVED
    posting.approved_by_id = current_user.id
    posting.approved_at = datetime.now()
    db.commit()
    db.refresh(posting)
    return posting


@router.post("/postings/{posting_id}/publish", response_model=JobPostingOut)
def publish_job_posting(
    posting_id: int,
    payload: JobPostingPublish,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks post as published to Indeed and stores external posting URL/ID."""
    posting = db.get(JobPosting, posting_id)
    if not posting:
        raise HTTPException(status_code=404, detail="Job Posting not found")

    posting.status = PostingStatus.POSTED
    posting.external_job_id = payload.external_job_id
    posting.external_post_url = payload.external_post_url
    posting.posted_at = datetime.now()
    db.commit()
    db.refresh(posting)
    return posting


# ============================================================================
# Candidate Person Records & Resume Parsing
# ============================================================================

@router.get("/candidates", response_model=List[CandidateOut])
def list_candidates(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Filter and search candidate person directory"""
    query = db.query(Candidate)
    if search:
        st = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Candidate.name.ilike(st),
                Candidate.mobile.ilike(st),
                Candidate.email.ilike(st),
                Candidate.candidate_code.ilike(st),
            )
        )
    return [_format_candidate_out(c) for c in query.order_by(Candidate.id.desc()).all()]


@router.post("/candidates", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add new candidate person record with duplicate detection"""
    existing = db.query(Candidate).filter(
        or_(Candidate.email == payload.email, Candidate.mobile == payload.mobile)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Candidate with email {payload.email} or mobile {payload.mobile} already exists ({existing.candidate_code})"
        )

    year = datetime.now().year
    count = db.query(Candidate).count() + 1
    code = f"CAND-{year}-{count:04d}"

    cand = Candidate(
        candidate_code=code,
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
        consent_captured=payload.consent_captured,
        consent_timestamp=datetime.now() if payload.consent_captured else None,
        job_requisition_id=payload.job_requisition_id,
        stage=payload.stage or "Sourcing",
    )
    db.add(cand)
    db.flush()

    # Automatically create application if job_requisition_id is provided
    if payload.job_requisition_id:
        app_count = db.query(JobApplication).count() + 1
        app_no = f"APP-{year}-{app_count:04d}"
        app = JobApplication(
            application_no=app_no,
            candidate_id=cand.id,
            job_requisition_id=payload.job_requisition_id,
            candidate_source=payload.candidate_source,
            stage=payload.stage or "Sourcing",
        )
        db.add(app)

    db.commit()
    db.refresh(cand)
    return _format_candidate_out(cand)


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """Fetch single candidate person profile"""
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _format_candidate_out(cand)


@router.put("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update candidate person details"""
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(cand, k, v)

    db.commit()
    db.refresh(cand)
    return _format_candidate_out(cand)


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete candidate and associated records (DPDP Act right-to-be-forgotten action)"""
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    db.delete(cand)
    db.commit()
    return None


@router.post("/candidates/upload-resume-and-parse")
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Uploads resume file (PDF/Image), sniffs magic bytes, extracts text,
    computes SHA-256 file hash for duplicate detection, and pre-fills candidate details.
    """
    file_bytes = await file.read()
    is_valid, detected_mime = validate_mime_sniffing(file_bytes, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=detected_mime)

    file_hash = hashlib.sha256(file_bytes).hexdigest()

    # Check duplicate resume hash
    existing_cand = db.scalar(select(Candidate).where(Candidate.file_hash == file_hash))
    duplicate_info = None
    if existing_cand:
        duplicate_info = {
            "candidate_id": existing_cand.id,
            "candidate_code": existing_cand.candidate_code,
            "name": existing_cand.name,
            "email": existing_cand.email,
        }

    # Store file
    upload_dir = os.path.join("uploads", "recruitment", "resumes")
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    resume_url = f"/uploads/recruitment/resumes/{safe_name}"

    # Parse resume with AI
    parsed_data = await parse_resume_to_candidate_data(
        file_bytes=file_bytes,
        filename=file.filename,
        mime_type=detected_mime,
        db=db,
    )

    return {
        "file_hash": file_hash,
        "resume_url": resume_url,
        "resume_file_type": detected_mime,
        "raw_text": parsed_data.get("raw_text", ""),
        "parsed_candidate": {
            "name": parsed_data.get("name") or "",
            "email": parsed_data.get("email") or "",
            "mobile": parsed_data.get("mobile") or "",
            "experience": parsed_data.get("experience_years") or "",
            "qualification": parsed_data.get("qualification") or "",
            "current_company": parsed_data.get("current_company") or "",
            "current_salary": parsed_data.get("current_salary") or "",
            "expected_salary": parsed_data.get("expected_salary") or "",
            "notice_period": parsed_data.get("notice_period") or "",
            "skills": parsed_data.get("skills") or "",
        },
        "duplicate_candidate": duplicate_info,
    }


@router.post("/candidates/bulk-upload", response_model=BulkResumeUploadResponse)
async def bulk_upload_resumes(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    job_requisition_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Supports bulk resume upload (20-30 files) with background OCR and batch scoring.
    """
    processed = 0
    failed = 0
    apps_created = []
    errors = []

    year = datetime.now().year

    for file in files:
        try:
            file_bytes = await file.read()
            is_valid, detected_mime = validate_mime_sniffing(file_bytes, file.filename)
            if not is_valid:
                errors.append(f"{file.filename}: {detected_mime}")
                failed += 1
                continue

            file_hash = hashlib.sha256(file_bytes).hexdigest()
            safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
            upload_dir = os.path.join("uploads", "recruitment", "resumes")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, safe_name)

            with open(file_path, "wb") as f:
                f.write(file_bytes)

            resume_url = f"/uploads/recruitment/resumes/{safe_name}"

            # Extract basic text
            from app.services.recruitment_ai_service import extract_text_from_pdf_bytes
            raw_text = extract_text_from_pdf_bytes(file_bytes) if detected_mime == "application/pdf" else ""

            # Check if candidate exists
            cand = db.scalar(select(Candidate).where(Candidate.file_hash == file_hash))
            if not cand:
                cand_code = f"CAND-{year}-{db.query(Candidate).count() + 1:04d}"
                # Guess name from filename
                base_name = file.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
                cand = Candidate(
                    candidate_code=cand_code,
                    name=base_name[:120],
                    mobile="N/A",
                    email=f"candidate_{uuid.uuid4().hex[:6]}@orbx-applicant.local",
                    file_hash=file_hash,
                    resume_url=resume_url,
                    resume_file_type=detected_mime,
                    resume_extracted_text=raw_text,
                    resume_extraction_status="EXTRACTED" if raw_text else "PENDING",
                    candidate_source="Bulk Upload",
                )
                db.add(cand)
                db.flush()

            # Create Application if requisition specified
            if job_requisition_id:
                existing_app = db.scalar(
                    select(JobApplication).where(
                        JobApplication.candidate_id == cand.id,
                        JobApplication.job_requisition_id == job_requisition_id,
                    )
                )
                if not existing_app:
                    app_no = f"APP-{year}-{db.query(JobApplication).count() + 1:04d}"
                    app = JobApplication(
                        application_no=app_no,
                        candidate_id=cand.id,
                        job_requisition_id=job_requisition_id,
                        candidate_source="Bulk Upload",
                        stage="Sourcing",
                        ai_evaluation_status="PENDING",
                    )
                    db.add(app)
                    db.flush()
                    apps_created.append(_format_application_out(app))

            processed += 1
            db.commit()

        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")
            failed += 1

    return BulkResumeUploadResponse(
        total_uploaded=len(files),
        processed=processed,
        failed=failed,
        applications=apps_created,
        errors=errors,
    )


# ============================================================================
# Job Applications Endpoints (Candidate x Requisition Transaction)
# ============================================================================

@router.get("/applications", response_model=List[JobApplicationOut])
def list_job_applications(
    job_requisition_id: Optional[int] = Query(None),
    stage: Optional[str] = Query(None),
    candidate_source: Optional[str] = Query(None),
    ai_category: Optional[str] = Query(None),
    ai_flagged: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List and filter candidate job applications"""
    query = db.query(JobApplication).options(
        joinedload(JobApplication.candidate),
        joinedload(JobApplication.job_requisition),
    )

    if job_requisition_id:
        query = query.filter(JobApplication.job_requisition_id == job_requisition_id)

    if stage and stage != "All":
        query = query.filter(JobApplication.stage == stage)

    if candidate_source and candidate_source != "All":
        query = query.filter(JobApplication.candidate_source == candidate_source)

    if ai_category and ai_category != "All":
        query = query.filter(JobApplication.latest_ai_category == ai_category)

    if ai_flagged is not None:
        query = query.filter(JobApplication.ai_flagged == ai_flagged)

    if search:
        st = f"%{search.strip()}%"
        query = query.join(JobApplication.candidate).filter(
            or_(
                Candidate.name.ilike(st),
                Candidate.mobile.ilike(st),
                Candidate.email.ilike(st),
                JobApplication.application_no.ilike(st),
            )
        )

    apps = query.order_by(JobApplication.id.desc()).all()
    return [_format_application_out(a) for a in apps]


@router.post("/applications", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
def submit_job_application(
    payload: JobApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Link candidate to a job requisition"""
    existing = db.scalar(
        select(JobApplication).where(
            JobApplication.candidate_id == payload.candidate_id,
            JobApplication.job_requisition_id == payload.job_requisition_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Candidate has already applied for this job requisition")

    year = datetime.now().year
    app_no = f"APP-{year}-{db.query(JobApplication).count() + 1:04d}"
    app = JobApplication(
        application_no=app_no,
        candidate_id=payload.candidate_id,
        job_requisition_id=payload.job_requisition_id,
        candidate_source=payload.candidate_source,
        stage=payload.stage,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return _format_application_out(app)


@router.get("/applications/{app_id}", response_model=JobApplicationOut)
def get_job_application(app_id: int, db: Session = Depends(get_db)):
    """Fetch single application detail"""
    app = db.get(JobApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return _format_application_out(app)


@router.post("/applications/{app_id}/transition-stage", response_model=JobApplicationOut)
def transition_application_stage(
    app_id: int,
    payload: JobApplicationStageTransition,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition application to a new recruitment stage with mandatory validations"""
    app = db.get(JobApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    valid_stages = [e.value for e in RecruitmentStage]
    if payload.new_stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid stage '{payload.new_stage}'")

    prev_stage = app.stage
    new_stage = payload.new_stage

    if new_stage == RecruitmentStage.ON_HOLD:
        if not payload.on_hold_reason and not payload.remarks:
            raise HTTPException(status_code=400, detail="On Hold reason is mandatory")
        app.previous_stage = prev_stage
        app.on_hold_reason = payload.on_hold_reason or payload.remarks

    if new_stage == RecruitmentStage.REJECTED:
        if not payload.rejection_reason and not payload.remarks:
            raise HTTPException(status_code=400, detail="Rejection reason is mandatory")
        app.rejection_reason = payload.rejection_reason or payload.remarks

    if payload.selected_designation: app.selected_designation = payload.selected_designation
    if payload.selected_department: app.selected_department = payload.selected_department
    if payload.proposed_salary: app.proposed_salary = payload.proposed_salary
    if payload.expected_joining_date: app.expected_joining_date = payload.expected_joining_date
    if payload.offer_status: app.offer_status = payload.offer_status
    if payload.confirmed_joining_date: app.confirmed_joining_date = payload.confirmed_joining_date

    app.stage = new_stage

    # Log Stage History
    history = CandidateStageHistory(
        candidate_id=app.candidate_id,
        application_id=app.id,
        previous_stage=prev_stage,
        new_stage=new_stage,
        changed_by_id=current_user.id,
        changed_by_name=current_user.full_name or "HR User",
        remarks=payload.remarks or f"Stage updated from {prev_stage} to {new_stage}",
    )
    db.add(history)
    db.commit()
    db.refresh(app)
    return _format_application_out(app)


@router.post("/applications/{app_id}/evaluate-ai", response_model=CandidateAIEvaluationOut)
async def evaluate_application_with_ai(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates candidate against the requisition's cached rubric.
    Deterministic weighted scoring in Python code. Strictly ADVISORY.
    """
    app = db.get(JobApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.ai_evaluation_status = "EVALUATING"
    db.commit()

    try:
        evaluation = await evaluate_application_ai(app_id, db)
        return evaluation
    except Exception as e:
        app.ai_evaluation_status = "FAILED"
        db.commit()
        raise HTTPException(status_code=500, detail=f"AI evaluation failed: {str(e)}")


@router.get("/applications/{app_id}/evaluations", response_model=List[CandidateAIEvaluationOut])
def get_application_evaluations(app_id: int, db: Session = Depends(get_db)):
    """Fetch historical AI evaluations for this application"""
    return db.scalars(
        select(CandidateAIEvaluation).where(CandidateAIEvaluation.application_id == app_id).order_by(CandidateAIEvaluation.created_at.desc())
    ).all()


@router.post("/candidates/{candidate_id}/evaluate-ai", response_model=CandidateAIEvaluationOut)
async def evaluate_candidate_with_ai(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convenience endpoint to trigger AI evaluation directly on a candidate profile."""
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not cand.job_requisition_id:
        raise HTTPException(status_code=400, detail="Candidate is not linked to a Job Requisition. Please link a requisition first.")

    app = db.query(JobApplication).filter(
        JobApplication.candidate_id == cand.id,
        JobApplication.job_requisition_id == cand.job_requisition_id
    ).first()

    if not app:
        year = datetime.now().year
        app_count = db.query(JobApplication).count() + 1
        app = JobApplication(
            application_no=f"APP-{year}-{app_count:04d}",
            candidate_id=cand.id,
            job_requisition_id=cand.job_requisition_id,
            candidate_source=cand.candidate_source,
            stage=cand.stage,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

    return await evaluate_application_with_ai(app.id, db, current_user)


@router.get("/candidates/{candidate_id}/evaluations", response_model=List[CandidateAIEvaluationOut])
def get_candidate_ai_evaluations(candidate_id: int, db: Session = Depends(get_db)):
    """Fetch AI evaluation history directly for a candidate."""
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    app_ids = [a.id for a in cand.applications]
    if not app_ids:
        return []
    return db.scalars(
        select(CandidateAIEvaluation).where(CandidateAIEvaluation.application_id.in_(app_ids)).order_by(CandidateAIEvaluation.created_at.desc())
    ).all()


@router.get("/candidates/{candidate_id}/interviews", response_model=List[InterviewOut])
def list_candidate_interviews(candidate_id: int, db: Session = Depends(get_db)):
    """Fetch scheduled interview rounds for a candidate."""
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    app_ids = [a.id for a in cand.applications]
    if not app_ids:
        return []
    return [_format_interview_out(i) for i in db.scalars(
        select(Interview).where(Interview.application_id.in_(app_ids)).order_by(Interview.scheduled_at.desc())
    ).all()]


@router.post("/evaluations/{eval_id}/feedback", response_model=CandidateAIEvaluationOut)
def submit_ai_evaluation_feedback(
    eval_id: int,
    payload: CandidateAIFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recruiter submits calibration feedback on AI score (AGREE, TOO_HIGH, TOO_LOW)"""
    eval_rec = db.get(CandidateAIEvaluation, eval_id)
    if not eval_rec:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    eval_rec.hr_feedback = payload.hr_feedback
    eval_rec.hr_feedback_notes = payload.hr_feedback_notes
    db.commit()
    db.refresh(eval_rec)
    return eval_rec


# ============================================================================
# Interviews & Dual Notifications (DLT SMS + Email)
# ============================================================================

@router.get("/applications/{app_id}/interviews", response_model=List[InterviewOut])
def list_application_interviews(app_id: int, db: Session = Depends(get_db)):
    """List all interview rounds for an application"""
    interviews = db.scalars(
        select(Interview).where(Interview.application_id == app_id).order_by(Interview.scheduled_at.desc())
    ).all()
    return [_format_interview_out(i) for i in interviews]


@router.post("/interviews", response_model=InterviewOut, status_code=status.HTTP_201_CREATED)
def schedule_interview(
    payload: InterviewCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Schedules an interview round and asynchronously dispatches:
    1. Candidate Interview Invitation (Email + DLT SMS)
    2. Job Requester In-App Alert and Email
    """
    app = db.get(JobApplication, payload.application_id)
    if not app:
        # Graceful fallback: check if candidate_id was passed
        cand = db.get(Candidate, payload.application_id)
        if cand:
            if cand.applications:
                app = cand.applications[-1]
            elif cand.job_requisition_id:
                year = datetime.now().year
                app_count = db.query(JobApplication).count() + 1
                app = JobApplication(
                    application_no=f"APP-{year}-{app_count:04d}",
                    candidate_id=cand.id,
                    job_requisition_id=cand.job_requisition_id,
                    candidate_source=cand.candidate_source,
                    stage="Interview",
                )
                db.add(app)
                db.flush()
        if not app:
            raise HTTPException(status_code=404, detail="Application or candidate not found")

    interview = Interview(
        application_id=app.id,
        round_name=payload.round_name,
        scheduled_at=payload.scheduled_at,
        mode=payload.mode,
        meeting_link=payload.meeting_link,
        location=payload.location,
        panel=payload.panel,
        remarks=payload.remarks,
        status="SCHEDULED",
    )
    db.add(interview)

    # Transition application stage to Interview if not already there
    if app.stage != RecruitmentStage.INTERVIEW:
        app.stage = RecruitmentStage.INTERVIEW
        history = CandidateStageHistory(
            candidate_id=app.candidate_id,
            application_id=app.id,
            previous_stage=app.stage,
            new_stage=RecruitmentStage.INTERVIEW,
            changed_by_id=current_user.id,
            changed_by_name=current_user.full_name or "HR User",
            remarks=f"Scheduled {payload.round_name} ({payload.mode})",
        )
        db.add(history)

    db.commit()
    db.refresh(interview)

    # Dispatch dual notifications in background
    background_tasks.add_task(dispatch_interview_notifications, interview.id, db)

    return _format_interview_out(interview)


@router.put("/interviews/{interview_id}", response_model=InterviewOut)
def update_interview(
    interview_id: int,
    payload: InterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update interview details, panel feedback, rating, or status"""
    interview = db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(interview, k, v)

    db.commit()
    db.refresh(interview)
    return _format_interview_out(interview)


@router.post("/interviews/{interview_id}/resend-notifications", response_model=dict)
def resend_interview_notifications(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-dispatches candidate invitation and requester alerts"""
    return dispatch_interview_notifications(interview_id, db)


# ============================================================================
# HR AI Configuration & Settings (Restricted to Admins)
# ============================================================================

@router.get("/configuration/ai-settings", response_model=HRAISettingsOut)
def get_hr_ai_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves HR AI configuration parameters (weights, DLT parameters, prompts, local AI only)"""
    return HRAISettingsOut(
        skills_weight=float(get_hr_setting(db, "skills_weight", "50.0")),
        experience_weight=float(get_hr_setting(db, "experience_weight", "30.0")),
        education_weight=float(get_hr_setting(db, "education_weight", "20.0")),
        auto_match_threshold=float(get_hr_setting(db, "auto_match_threshold", "70.0")),
        local_ai_only=get_hr_setting(db, "local_ai_only", "false").lower() == "true",
        provider_fallback_chain=["GOOGLE", "OPENROUTER", "LOCAL"],
        indeed_prompt_template=get_hr_setting(db, "indeed_prompt_template", "Standard Indeed high-conversion template v1.0"),
        resume_ocr_prompt_template=get_hr_setting(db, "resume_ocr_prompt_template", "Standard Resume OCR and structuring prompt v1.0"),
        candidate_matching_prompt_template=get_hr_setting(db, "candidate_matching_prompt_template", "Objective Rubric-based candidate scoring prompt v1.0"),
        sms_dlt_template_id=get_hr_setting(db, "sms_dlt_template_id", "1107161829304910293"),
        sms_dlt_header=get_hr_setting(db, "sms_dlt_header", "ORBXHR"),
        data_retention_days=int(get_hr_setting(db, "data_retention_days", "180")),
    )


@router.put("/configuration/ai-settings", response_model=HRAISettingsOut)
def update_hr_ai_settings(
    payload: HRAISettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates HR AI configuration parameters.
    Validates that skills_weight + experience_weight + education_weight = 100.0.
    """
    # Enforce admin role check safely
    user_role_str = str(current_user.role).upper()
    if "ADMIN" not in user_role_str:
        raise HTTPException(status_code=403, detail="Only administrators can modify HR AI configuration settings")

    # Validate weights if provided
    cur_skills = payload.skills_weight if payload.skills_weight is not None else float(get_hr_setting(db, "skills_weight", "50.0"))
    cur_exp = payload.experience_weight if payload.experience_weight is not None else float(get_hr_setting(db, "experience_weight", "30.0"))
    cur_edu = payload.education_weight if payload.education_weight is not None else float(get_hr_setting(db, "education_weight", "20.0"))

    total = cur_skills + cur_exp + cur_edu
    if abs(total - 100.0) > 0.1:
        raise HTTPException(
            status_code=422,
            detail=f"Scoring weights must sum exactly to 100%. Currently: skills({cur_skills}) + experience({cur_exp}) + education({cur_edu}) = {total}%",
        )

    if payload.skills_weight is not None:
        set_hr_setting(db, "skills_weight", str(payload.skills_weight), "Weight for skills sub-score")
    if payload.experience_weight is not None:
        set_hr_setting(db, "experience_weight", str(payload.experience_weight), "Weight for experience sub-score")
    if payload.education_weight is not None:
        set_hr_setting(db, "education_weight", str(payload.education_weight), "Weight for education sub-score")
    if payload.auto_match_threshold is not None:
        set_hr_setting(db, "auto_match_threshold", str(payload.auto_match_threshold), "Minimum passing score")
    if payload.local_ai_only is not None:
        set_hr_setting(db, "local_ai_only", str(payload.local_ai_only).lower(), "Enforce Local AI Only (block cloud LLMs)")
    if payload.sms_dlt_template_id is not None:
        set_hr_setting(db, "sms_dlt_template_id", payload.sms_dlt_template_id, "DLT Registered Template ID")
    if payload.sms_dlt_header is not None:
        set_hr_setting(db, "sms_dlt_header", payload.sms_dlt_header, "DLT Approved Sender Header")
    if payload.data_retention_days is not None:
        set_hr_setting(db, "data_retention_days", str(payload.data_retention_days), "DPDP Act retention days")

    return get_hr_ai_settings(db, current_user)


@router.get("/configuration/ai-providers")
def list_ai_providers(db: Session = Depends(get_db)):
    """List configured AI providers with masked API keys for secure display"""
    providers = db.scalars(select(AIProviderConfig).order_by(AIProviderConfig.id.asc())).all()
    results = []
    for p in providers:
        results.append({
            "id": p.id,
            "provider": p.provider,
            "label": p.label,
            "model_name": p.model_name,
            "api_endpoint": p.api_endpoint,
            "api_key_override": mask_api_key(p.api_key_override) if p.api_key_override else None,
            "is_default": p.is_default,
            "is_active": p.is_active,
        })
    return results


@router.put("/configuration/ai-providers/{provider_id}")
def update_ai_provider(
    provider_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update AI provider. Encrypts API key override at rest."""
    user_role_str = str(current_user.role).upper()
    if "ADMIN" not in user_role_str:
        raise HTTPException(status_code=403, detail="Admin role required")

    prov = db.get(AIProviderConfig, provider_id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")

    if payload.get("is_default"):
        db.query(AIProviderConfig).update({"is_default": False})

    for k, v in payload.items():
        if k == "api_key_override" and v:
            # If user entered a new key (not the masked one)
            if not str(v).startswith("••••"):
                prov.api_key_override = encrypt_api_key(str(v))
        elif hasattr(prov, k):
            setattr(prov, k, v)

    db.commit()
    db.refresh(prov)
    return {
        "id": prov.id,
        "provider": prov.provider,
        "label": prov.label,
        "model_name": prov.model_name,
        "api_endpoint": prov.api_endpoint,
        "api_key_override": mask_api_key(prov.api_key_override) if prov.api_key_override else None,
        "is_default": prov.is_default,
        "is_active": prov.is_active,
    }


@router.post("/configuration/ai-providers/test")
async def test_ai_provider_connection(payload: dict, db: Session = Depends(get_db)):
    """Tests live connectivity and credentials for specified provider."""
    provider_type = payload.get("provider", "GOOGLE")
    model_name = payload.get("model_name", "gemini-2.0-flash")
    endpoint = payload.get("api_endpoint")
    key = payload.get("api_key")

    # If key is masked or absent, fetch decrypted key from DB
    if not key or key.startswith("••••"):
        prov_row = db.scalar(select(AIProviderConfig).where(AIProviderConfig.provider == provider_type))
        if prov_row and prov_row.api_key_override:
            from app.services.recruitment_security import decrypt_api_key
            key = decrypt_api_key(prov_row.api_key_override)

    return await AIVisionExtractor.test_connection(
        provider_type=provider_type,
        model_name=model_name,
        api_endpoint=endpoint,
        api_key=key,
    )


@router.get("/configuration/ai-usage-summary", response_model=HRAIUsageSummary)
def get_ai_usage_summary(db: Session = Depends(get_db)):
    """Monthly summary of AI tokens, latency, call types, and success counts"""
    logs = db.scalars(select(HRAIUsageLog).order_by(HRAIUsageLog.id.desc()).limit(1000)).all()

    total_calls = len(logs)
    total_prompt = sum(l.prompt_tokens for l in logs)
    total_comp = sum(l.completion_tokens for l in logs)
    avg_latency = (sum(l.latency_ms for l in logs) / total_calls) if total_calls > 0 else 0.0

    prov_breakdown = {}
    call_breakdown = {}
    for l in logs:
        prov_breakdown[l.provider] = prov_breakdown.get(l.provider, 0) + 1
        call_breakdown[l.call_type] = call_breakdown.get(l.call_type, 0) + 1

    return HRAIUsageSummary(
        total_calls=total_calls,
        total_prompt_tokens=total_prompt,
        total_completion_tokens=total_comp,
        avg_latency_ms=round(avg_latency, 1),
        provider_breakdown=prov_breakdown,
        call_type_breakdown=call_breakdown,
    )
