from datetime import datetime, date
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator


# ============================================================================
# Job Requisition Schemas
# ============================================================================

class JobRequisitionBase(BaseModel):
    job_title: str = Field(..., min_length=2, max_length=150)
    department: str = Field(..., min_length=2, max_length=100)
    vacancies: int = Field(1, ge=1)
    employment_type: str = Field("Full Time", max_length=50)
    required_qualification: Optional[str] = "Not Specified"
    required_experience: Optional[str] = "Not Specified"
    skills: Optional[str] = "General"
    salary_range: Optional[str] = "Competitive"
    preferred_joining_date: Optional[date] = None
    job_description: Optional[str] = ""
    requesting_department: Optional[str] = None

    @field_validator("preferred_joining_date", mode="before")
    @classmethod
    def parse_preferred_joining_date(cls, v: Any) -> Optional[date]:
        if not v or v == "":
            return None
        if isinstance(v, str):
            try:
                return date.fromisoformat(v[:10])
            except Exception:
                return None
        return v

    @field_validator("requesting_department", mode="before")
    @classmethod
    def parse_requesting_department(cls, v: Any, info) -> str:
        if not v:
            return (info.data.get("department") if info.data else None) or "HR"
        return str(v)


class JobRequisitionCreate(JobRequisitionBase):
    pass


class JobRequisitionUpdate(BaseModel):
    job_title: Optional[str] = None
    department: Optional[str] = None
    vacancies: Optional[int] = None
    employment_type: Optional[str] = None
    required_qualification: Optional[str] = None
    required_experience: Optional[str] = None
    skills: Optional[str] = None
    salary_range: Optional[str] = None
    preferred_joining_date: Optional[date] = None
    job_description: Optional[str] = None
    requesting_department: Optional[str] = None

    @field_validator("preferred_joining_date", mode="before")
    @classmethod
    def parse_preferred_joining_date(cls, v: Any) -> Optional[date]:
        if not v or v == "":
            return None
        if isinstance(v, str):
            try:
                return date.fromisoformat(v[:10])
            except Exception:
                return None
        return v


class JobRequisitionApproveReject(BaseModel):
    action: str = Field(..., pattern="^(Approve|Reject)$")
    rejection_reason: Optional[str] = None


class JobRequisitionOut(JobRequisitionBase):
    id: int
    req_code: str
    requester_id: Optional[int] = None
    requester_name: str
    status: str
    rejection_reason: Optional[str] = None
    jd_attachment_url: Optional[str] = None
    jd_attachment_name: Optional[str] = None
    extracted_jd_text: Optional[str] = None
    scoring_rubric: Optional[Dict[str, Any]] = None
    rubric_version: int = 1
    rubric_generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    candidate_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Job Posting Schemas (Multi-Channel, Indeed, LinkedIn, etc.)
# ============================================================================

class JobPostingCreate(BaseModel):
    channel: str = Field("indeed", max_length=50)
    draft_content: str


class JobPostingUpdate(BaseModel):
    draft_content: Optional[str] = None
    status: Optional[str] = None
    external_job_id: Optional[str] = None
    external_post_url: Optional[str] = None


class JobPostingPublish(BaseModel):
    external_job_id: Optional[str] = None
    external_post_url: Optional[str] = None


class JobPostingOut(BaseModel):
    id: int
    requisition_id: int
    channel: str
    draft_content: str
    status: str
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    external_job_id: Optional[str] = None
    external_post_url: Optional[str] = None
    posted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Candidate Schemas (Person Master)
# ============================================================================

class CandidateBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    mobile: str = Field(..., min_length=5, max_length=20)
    email: EmailStr
    resume_url: Optional[str] = None
    experience: str = Field("", max_length=100)
    qualification: str = Field("", max_length=200)
    current_company: Optional[str] = None
    current_salary: Optional[str] = None
    expected_salary: Optional[str] = None
    notice_period: Optional[str] = None
    candidate_source: str = Field("Direct", max_length=100)
    consent_captured: bool = False


class CandidateCreate(CandidateBase):
    job_requisition_id: Optional[int] = None
    stage: Optional[str] = "Sourcing"


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    resume_url: Optional[str] = None
    experience: Optional[str] = None
    qualification: Optional[str] = None
    current_company: Optional[str] = None
    current_salary: Optional[str] = None
    expected_salary: Optional[str] = None
    notice_period: Optional[str] = None
    candidate_source: Optional[str] = None
    consent_captured: Optional[bool] = None


class CandidateOut(CandidateBase):
    id: int
    candidate_code: str
    file_hash: Optional[str] = None
    resume_file_type: Optional[str] = None
    resume_extracted_text: Optional[str] = None
    resume_extraction_status: str = "PENDING"
    consent_timestamp: Optional[datetime] = None
    is_anonymized: bool = False

    # Legacy/compatibility fields
    job_requisition_id: Optional[int] = None
    job_title: Optional[str] = None
    job_department: Optional[str] = None
    stage: str = "Sourcing"
    previous_stage: Optional[str] = None
    on_hold_reason: Optional[str] = None
    rejection_reason: Optional[str] = None
    ai_match_score: Optional[float] = None
    ai_match_category: Optional[str] = None
    ai_flagged: bool = False
    ai_flag_reason: Optional[str] = None
    latest_application_id: Optional[int] = None
    interview_type: Optional[str] = None
    interview_date: Optional[datetime] = None
    interviewer_panel: Optional[str] = None
    interview_round: Optional[str] = None
    interview_feedback: Optional[str] = None
    interview_rating: Optional[float] = None
    interview_remarks: Optional[str] = None
    selected_designation: Optional[str] = None
    selected_department: Optional[str] = None
    proposed_salary: Optional[str] = None
    expected_joining_date: Optional[date] = None
    selected_employment_type: Optional[str] = None
    offer_status: Optional[str] = None
    confirmed_joining_date: Optional[date] = None
    is_employee_created: bool = False
    created_employee_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Job Application Schemas (Candidate x Requisition Transaction)
# ============================================================================

class JobApplicationCreate(BaseModel):
    candidate_id: int
    job_requisition_id: int
    candidate_source: str = "Direct"
    stage: str = "Sourcing"


class JobApplicationUpdate(BaseModel):
    stage: Optional[str] = None
    candidate_source: Optional[str] = None
    selected_designation: Optional[str] = None
    selected_department: Optional[str] = None
    proposed_salary: Optional[str] = None
    expected_joining_date: Optional[date] = None
    offer_status: Optional[str] = None
    confirmed_joining_date: Optional[date] = None


class JobApplicationStageTransition(BaseModel):
    new_stage: str
    remarks: Optional[str] = None
    rejection_reason: Optional[str] = None
    on_hold_reason: Optional[str] = None
    selected_designation: Optional[str] = None
    selected_department: Optional[str] = None
    proposed_salary: Optional[str] = None
    expected_joining_date: Optional[date] = None
    selected_employment_type: Optional[str] = None
    offer_status: Optional[str] = None
    confirmed_joining_date: Optional[date] = None


class JobApplicationOut(BaseModel):
    id: int
    application_no: str
    candidate_id: int
    job_requisition_id: int
    candidate_source: str
    stage: str
    previous_stage: Optional[str] = None
    on_hold_reason: Optional[str] = None
    rejection_reason: Optional[str] = None
    ai_evaluation_status: str
    latest_ai_score: Optional[float] = None
    latest_ai_category: Optional[str] = None
    ai_flagged: bool = False
    ai_flag_reason: Optional[str] = None

    # Joined Candidate Info
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_mobile: Optional[str] = None
    candidate_experience: Optional[str] = None
    candidate_qualification: Optional[str] = None
    candidate_resume_url: Optional[str] = None

    # Joined Requisition Info
    job_title: Optional[str] = None
    job_department: Optional[str] = None

    # Offer details
    selected_designation: Optional[str] = None
    selected_department: Optional[str] = None
    proposed_salary: Optional[str] = None
    expected_joining_date: Optional[date] = None
    offer_status: Optional[str] = None
    confirmed_joining_date: Optional[date] = None
    is_employee_created: bool = False
    created_employee_id: Optional[int] = None
    applied_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Candidate AI Evaluation Schemas
# ============================================================================

class CandidateAIEvaluationOut(BaseModel):
    id: int
    application_id: int
    rubric_version: int
    prompt_version: str
    provider: str
    model_name: str
    skills_score: float
    experience_score: float
    education_score: float
    skills_weight: float
    experience_weight: float
    education_weight: float
    total_weighted_score: float
    fit_category: str
    explanation: str
    matched_skills: List[Dict[str, Any]]
    missing_skills: List[str]
    knockout_results: Optional[Dict[str, Any]] = None
    recommendation: str
    hr_feedback: Optional[str] = None
    hr_feedback_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CandidateAIFeedbackUpdate(BaseModel):
    hr_feedback: str = Field(..., pattern="^(AGREE|TOO_HIGH|TOO_LOW)$")
    hr_feedback_notes: Optional[str] = None


# ============================================================================
# Interview Schemas
# ============================================================================

class InterviewCreate(BaseModel):
    application_id: int
    round_name: str = Field(..., max_length=100)
    scheduled_at: datetime
    mode: str = Field("Online (Google Meet)", max_length=50)
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    panel: Optional[str] = None
    remarks: Optional[str] = None


class InterviewUpdate(BaseModel):
    round_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    mode: Optional[str] = None
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    panel: Optional[str] = None
    status: Optional[str] = None
    feedback: Optional[str] = None
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    remarks: Optional[str] = None


class InterviewOut(BaseModel):
    id: int
    application_id: int
    round_name: str
    scheduled_at: datetime
    mode: str
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    panel: Optional[str] = None
    status: str
    invite_sent_at: Optional[datetime] = None
    invite_status: Optional[str] = None
    requester_notified_at: Optional[datetime] = None
    requester_notify_status: Optional[str] = None
    feedback: Optional[str] = None
    rating: Optional[float] = None
    remarks: Optional[str] = None
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# HR Stage History & Documents
# ============================================================================

class CandidateStageHistoryOut(BaseModel):
    id: int
    candidate_id: int
    application_id: Optional[int] = None
    previous_stage: Optional[str] = None
    new_stage: str
    changed_by_id: Optional[int] = None
    changed_by_name: str
    changed_at: datetime
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CandidateDocumentOut(BaseModel):
    id: int
    candidate_id: int
    file_name: str
    file_path: str
    file_type: Optional[str] = None
    file_hash: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# HR AI Configuration & Settings Schemas
# ============================================================================

class HRAISettingsOut(BaseModel):
    skills_weight: float
    experience_weight: float
    education_weight: float
    auto_match_threshold: float
    local_ai_only: bool
    provider_fallback_chain: List[str]
    indeed_prompt_template: str
    resume_ocr_prompt_template: str
    candidate_matching_prompt_template: str
    sms_dlt_template_id: str
    sms_dlt_header: str
    data_retention_days: int


class HRAISettingsUpdate(BaseModel):
    skills_weight: Optional[float] = None
    experience_weight: Optional[float] = None
    education_weight: Optional[float] = None
    auto_match_threshold: Optional[float] = None
    local_ai_only: Optional[bool] = None
    provider_fallback_chain: Optional[List[str]] = None
    indeed_prompt_template: Optional[str] = None
    resume_ocr_prompt_template: Optional[str] = None
    candidate_matching_prompt_template: Optional[str] = None
    sms_dlt_template_id: Optional[str] = None
    sms_dlt_header: Optional[str] = None
    data_retention_days: Optional[int] = None


class HRAIUsageSummary(BaseModel):
    total_calls: int
    total_prompt_tokens: int
    total_completion_tokens: int
    avg_latency_ms: float
    provider_breakdown: Dict[str, int]
    call_type_breakdown: Dict[str, int]


class BulkResumeUploadResponse(BaseModel):
    total_uploaded: int
    processed: int
    failed: int
    applications: List[JobApplicationOut]
    errors: List[str]


class RecruitmentDashboardKPIs(BaseModel):
    open_requisitions: int
    total_candidates: int
    job_requisition: int
    approval: int
    sourcing: int
    screening: int
    interviews: int
    selected: int
    offers: int
    joining_pending: int
    joined: int
    on_hold: int
    rejected: int

    # Application level KPIs
    total_applications: int = 0
    ai_evaluated_count: int = 0
    ai_high_match_count: int = 0
