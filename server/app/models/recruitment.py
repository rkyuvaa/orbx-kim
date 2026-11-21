from datetime import datetime, date
from typing import TYPE_CHECKING, Any
import enum

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
    Date,
    Float,
    Boolean,
    Integer,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class RecruitmentStage(enum.StrEnum):
    JOB_REQUISITION = "Job Requisition"
    APPROVAL = "Approval"
    SOURCING = "Sourcing"
    SCREENING = "Screening"
    INTERVIEW = "Interview"
    SELECTED = "Selected"
    OFFER_JOINING = "Offer & Joining"
    JOINED = "Joined"
    ON_HOLD = "On Hold"
    REJECTED = "Rejected"


class RequisitionStatus(enum.StrEnum):
    JOB_REQUISITION = "Job Requisition"
    APPROVAL = "Approval"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    CLOSED = "Closed"


class OfferStatus(enum.StrEnum):
    DRAFT = "Offer Draft"
    RELEASED = "Offer Released"
    ACCEPTED = "Offer Accepted"
    DECLINED = "Offer Declined"


class PostingStatus(enum.StrEnum):
    DRAFTED = "DRAFTED"
    HR_APPROVED = "HR_APPROVED"
    POSTED = "POSTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class InterviewStatus(enum.StrEnum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    RESCHEDULED = "RESCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class JobRequisition(Base):
    """Manpower Job Requisition model with cached rubric & JD metadata"""
    __tablename__ = "hr_job_requisitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    req_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    job_title: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    vacancies: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    employment_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Full Time")
    required_qualification: Mapped[str] = mapped_column(String(200), nullable=False)
    required_experience: Mapped[str] = mapped_column(String(100), nullable=False)
    skills: Mapped[str] = mapped_column(String(500), nullable=False)
    salary_range: Mapped[str] = mapped_column(String(100), nullable=False)
    preferred_joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    requesting_department: Mapped[str] = mapped_column(String(100), nullable=False)
    requester_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    requester_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Job Requisition", nullable=False, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Job Description Attachment & Extraction
    jd_attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    jd_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extracted_jd_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cached AI Scoring Rubric (Generated once per requisition)
    scoring_rubric: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    rubric_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    rubric_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    requester: Mapped["User | None"] = relationship("User", foreign_keys=[requester_id], lazy="joined")
    postings: Mapped[list["JobPosting"]] = relationship("JobPosting", back_populates="requisition", cascade="all, delete-orphan")
    applications: Mapped[list["JobApplication"]] = relationship("JobApplication", back_populates="job_requisition", cascade="all, delete-orphan")
    candidates: Mapped[list["Candidate"]] = relationship("Candidate", back_populates="job_requisition")


class JobPosting(Base):
    """Multi-channel job posting (Indeed, Naukri, LinkedIn, etc.)"""
    __tablename__ = "hr_job_postings"

    id: Mapped[int] = mapped_column(primary_key=True)
    requisition_id: Mapped[int] = mapped_column(
        ForeignKey("hr_job_requisitions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(50), default="indeed", nullable=False, index=True)
    draft_content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="DRAFTED", nullable=False, index=True)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_job_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    external_post_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    requisition: Mapped["JobRequisition"] = relationship("JobRequisition", back_populates="postings")
    approved_by: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by_id], lazy="joined")


class Candidate(Base):
    """Candidate Person master record (reusable across multiple job applications)"""
    __tablename__ = "hr_candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    
    # Resume & Document Reference
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)  # SHA-256 for duplicate detection
    resume_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resume_file_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resume_extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_extraction_status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)

    experience: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    qualification: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    current_company: Mapped[str | None] = mapped_column(String(150), nullable=True)
    current_salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notice_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    candidate_source: Mapped[str] = mapped_column(String(100), nullable=False, default="Direct", index=True)

    # India DPDP Act 2023 Compliance
    consent_captured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_anonymized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Legacy compatibility fields
    job_requisition_id: Mapped[int | None] = mapped_column(
        ForeignKey("hr_job_requisitions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    stage: Mapped[str] = mapped_column(String(50), default="Sourcing", nullable=False, index=True)
    previous_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    on_hold_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    interview_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    interviewer_panel: Mapped[str | None] = mapped_column(String(255), nullable=True)
    interview_round: Mapped[str | None] = mapped_column(String(100), nullable=True)
    interview_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    interview_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    selected_department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proposed_salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    selected_employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    offer_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed_joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_employee_created: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    joined_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    job_requisition: Mapped["JobRequisition | None"] = relationship("JobRequisition", back_populates="candidates", lazy="joined")
    created_employee: Mapped["User | None"] = relationship("User", foreign_keys=[created_employee_id], lazy="joined")
    applications: Mapped[list["JobApplication"]] = relationship("JobApplication", back_populates="candidate", cascade="all, delete-orphan")
    stage_history: Mapped[list["CandidateStageHistory"]] = relationship(
        "CandidateStageHistory", back_populates="candidate", cascade="all, delete-orphan", order_by="CandidateStageHistory.changed_at.desc()"
    )
    documents: Mapped[list["CandidateDocument"]] = relationship(
        "CandidateDocument", back_populates="candidate", cascade="all, delete-orphan"
    )


class JobApplication(Base):
    """Transactional junction: Candidate applying to a specific Job Requisition"""
    __tablename__ = "hr_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("hr_candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_requisition_id: Mapped[int] = mapped_column(
        ForeignKey("hr_job_requisitions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_source: Mapped[str] = mapped_column(String(100), default="Direct", nullable=False, index=True)

    stage: Mapped[str] = mapped_column(String(50), default="Sourcing", nullable=False, index=True)
    previous_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    on_hold_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Advisory AI Evaluation Snapshot (Advisory only - never auto-rejects)
    ai_evaluation_status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False) # PENDING, EVALUATING, EVALUATED, FAILED
    latest_ai_score: Mapped[float | None] = mapped_column(Float, nullable=True) # 0.0 - 100.0 (code-computed)
    latest_ai_category: Mapped[str | None] = mapped_column(String(50), nullable=True) # High Match, Medium Match, Low Match
    
    # Prompt injection and suspicious resume flag
    ai_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Selection & Offer Details
    selected_designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    selected_department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proposed_salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    selected_employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    offer_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed_joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_employee_created: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    joined_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="applications", lazy="joined")
    job_requisition: Mapped["JobRequisition"] = relationship("JobRequisition", back_populates="applications", lazy="joined")
    evaluations: Mapped[list["CandidateAIEvaluation"]] = relationship(
        "CandidateAIEvaluation", back_populates="application", cascade="all, delete-orphan", order_by="CandidateAIEvaluation.created_at.desc()"
    )
    interviews: Mapped[list["Interview"]] = relationship(
        "Interview", back_populates="application", cascade="all, delete-orphan", order_by="Interview.scheduled_at.desc()"
    )
    created_employee: Mapped["User | None"] = relationship("User", foreign_keys=[created_employee_id], lazy="joined")

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_requisition_id", name="uq_candidate_requisition_app"),
    )


class CandidateAIEvaluation(Base):
    """Historical audit of candidate evaluations with model provenance & sub-scores"""
    __tablename__ = "hr_candidate_ai_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("hr_applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rubric_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # LLM Sub-Scores (0 - 100)
    skills_score: Mapped[float] = mapped_column(Float, nullable=False)
    experience_score: Mapped[float] = mapped_column(Float, nullable=False)
    education_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Configured Weights (sum to 100)
    skills_weight: Mapped[float] = mapped_column(Float, nullable=False)
    experience_weight: Mapped[float] = mapped_column(Float, nullable=False)
    education_weight: Mapped[float] = mapped_column(Float, nullable=False)

    # Code-computed deterministic weighted score
    total_weighted_score: Mapped[float] = mapped_column(Float, nullable=False)
    fit_category: Mapped[str] = mapped_column(String(50), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)

    # Evidence-backed skills (skills without verifiable quotes are discarded by code)
    matched_skills: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    missing_skills: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    knockout_results: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)

    # HR Calibration Feedback
    hr_feedback: Mapped[str | None] = mapped_column(String(50), nullable=True) # AGREE, TOO_HIGH, TOO_LOW
    hr_feedback_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    application: Mapped["JobApplication"] = relationship("JobApplication", back_populates="evaluations")


class Interview(Base):
    """Structured Interview Rounds with Panel, Mode & Dual DLT Notification Tracking"""
    __tablename__ = "hr_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("hr_applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_name: Mapped[str] = mapped_column(String(100), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(50), default="Online (Google Meet)", nullable=False)
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    panel: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED", nullable=False, index=True)

    # Dual notification tracking
    invite_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invite_status: Mapped[str | None] = mapped_column(String(50), default="PENDING", nullable=True)
    requester_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requester_notify_status: Mapped[str | None] = mapped_column(String(50), default="PENDING", nullable=True)

    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    application: Mapped["JobApplication"] = relationship("JobApplication", back_populates="interviews")


class CandidateStageHistory(Base):
    """Audit history of recruitment stage changes"""
    __tablename__ = "hr_candidate_stage_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("hr_candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[int | None] = mapped_column(
        ForeignKey("hr_applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    previous_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_by_name: Mapped[str] = mapped_column(String(120), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="stage_history")
    application: Mapped["JobApplication | None"] = relationship("JobApplication", foreign_keys=[application_id])


class CandidateDocument(Base):
    """Candidate uploaded documents and resumes"""
    __tablename__ = "hr_candidate_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("hr_candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="documents")


class HRAIUsageLog(Base):
    """Token usage, model latency, and call tracking for HR AI features"""
    __tablename__ = "hr_ai_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    call_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # JD_RUBRIC, INDEED_POST, RESUME_OCR, CAND_SCORE
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class HRSetting(Base):
    """Persistent HR & Recruitment AI settings, prompts, weights & DLT policies"""
    __tablename__ = "hr_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    setting_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    setting_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_type: Mapped[str] = mapped_column(String(20), default="STRING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
