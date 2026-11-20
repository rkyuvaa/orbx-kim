from datetime import date, datetime
import enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.user import User


class LimitPeriod(enum.StrEnum):
    PER_EXPENSE = "PER_EXPENSE"
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"


class CycleFrequency(enum.StrEnum):
    DAILY = "DAILY"
    TWO_DAYS = "TWO_DAYS"
    THREE_DAYS = "THREE_DAYS"
    WEEKLY = "WEEKLY"
    FORTNIGHTLY = "FORTNIGHTLY"
    MONTHLY = "MONTHLY"
    CUSTOM = "CUSTOM"


class CycleStatus(enum.StrEnum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class ExtractionStatus(enum.StrEnum):
    PROCESSING = "PROCESSING"
    EXTRACTED = "EXTRACTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    FAILED = "FAILED"
    READY = "READY"


class ClaimStatus(enum.StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    LINE_MANAGER_APPROVED = "LINE_MANAGER_APPROVED"
    CFO_APPROVED = "CFO_APPROVED"
    ACCOUNTANT_APPROVED = "ACCOUNTANT_APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"


class PayoutStatus(enum.StrEnum):
    PENDING_TRANSFER = "PENDING_TRANSFER"
    TRANSFERRED = "TRANSFERRED"
    CONFIRMED = "CONFIRMED"


class EmployeeConfirmationStatus(enum.StrEnum):
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    DISPUTED = "DISPUTED"
    AUTO_RECONCILED = "AUTO_RECONCILED"


class AIProviderType(enum.StrEnum):
    GOOGLE = "GOOGLE"
    NVIDIA = "NVIDIA"
    OPENROUTER = "OPENROUTER"
    KILO = "KILO"
    LOCAL = "LOCAL"


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    limit_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    limit_period: Mapped[LimitPeriod] = mapped_column(
        Enum(LimitPeriod, name="expense_limit_period"), default=LimitPeriod.PER_EXPENSE, nullable=False
    )
    gl_account_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    bills: Mapped[list["Bill"]] = relationship("Bill", back_populates="category")


class ClaimCycle(Base):
    __tablename__ = "claim_cycles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[CycleFrequency] = mapped_column(
        Enum(CycleFrequency, name="claim_cycle_frequency"), default=CycleFrequency.FORTNIGHTLY, nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[CycleStatus] = mapped_column(
        Enum(CycleStatus, name="claim_cycle_status"), default=CycleStatus.OPEN, nullable=False
    )
    auto_submit_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    claims: Mapped[list["Claim"]] = relationship("Claim", back_populates="cycle")


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(primary_key=True)
    bill_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    bill_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("expense_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    uploaded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    claim_id: Mapped[int | None] = mapped_column(
        ForeignKey("claims.id", ondelete="SET NULL"), nullable=True, index=True
    )

    source_file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    source_mime: Mapped[str] = mapped_column(String(100), default="application/octet-stream", nullable=False)
    source_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    taxable_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    cgst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    sgst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    igst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    gst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    extraction_status: Mapped[ExtractionStatus] = mapped_column(
        Enum(ExtractionStatus, name="bill_extraction_status"),
        default=ExtractionStatus.PROCESSING,
        nullable=False,
    )
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    extraction_raw: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    duplicate_of_bill_id: Mapped[int | None] = mapped_column(
        ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped["ExpenseCategory | None"] = relationship("ExpenseCategory", back_populates="bills")
    uploaded_by: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by_id], lazy="joined")
    branch: Mapped["Branch | None"] = relationship("Branch", foreign_keys=[branch_id], lazy="joined")
    claim: Mapped["Claim | None"] = relationship("Claim", back_populates="bills")


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    employee_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    claim_cycle_id: Mapped[int | None] = mapped_column(
        ForeignKey("claim_cycles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[ClaimStatus] = mapped_column(
        Enum(ClaimStatus, name="claim_status"), default=ClaimStatus.DRAFT, nullable=False, index=True
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    line_manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    line_manager_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cfo_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    cfo_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    accountant_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    accountant_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["User"] = relationship("User", foreign_keys=[employee_user_id], lazy="joined")
    branch: Mapped["Branch | None"] = relationship("Branch", foreign_keys=[branch_id], lazy="joined")
    cycle: Mapped["ClaimCycle | None"] = relationship("ClaimCycle", back_populates="claims", lazy="joined")
    bills: Mapped[list["Bill"]] = relationship("Bill", back_populates="claim")
    status_history: Mapped[list["ClaimStatusHistory"]] = relationship(
        "ClaimStatusHistory", back_populates="claim", cascade="all, delete-orphan", order_by="ClaimStatusHistory.created_at"
    )
    payout_links: Mapped[list["PayoutClaim"]] = relationship("PayoutClaim", back_populates="claim")


class ClaimStatusHistory(Base):
    __tablename__ = "claim_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(
        ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str] = mapped_column(String(50), nullable=False)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    claim: Mapped["Claim"] = relationship("Claim", back_populates="status_history")
    actor: Mapped["User | None"] = relationship("User", foreign_keys=[actor_user_id], lazy="joined")


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[PayoutStatus] = mapped_column(
        Enum(PayoutStatus, name="payout_status"), default=PayoutStatus.PENDING_TRANSFER, nullable=False, index=True
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    claim_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    utr_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    bank_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    transferred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id], lazy="joined")
    payout_claims: Mapped[list["PayoutClaim"]] = relationship(
        "PayoutClaim", back_populates="payout", cascade="all, delete-orphan"
    )
    employee_statuses: Mapped[list["PayoutEmployeeStatus"]] = relationship(
        "PayoutEmployeeStatus", back_populates="payout", cascade="all, delete-orphan"
    )


class PayoutClaim(Base):
    __tablename__ = "payout_claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    payout_id: Mapped[int] = mapped_column(
        ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    claim_id: Mapped[int] = mapped_column(
        ForeignKey("claims.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payout: Mapped["Payout"] = relationship("Payout", back_populates="payout_claims")
    claim: Mapped["Claim"] = relationship("Claim", back_populates="payout_links")


class PayoutEmployeeStatus(Base):
    __tablename__ = "payout_employee_status"

    id: Mapped[int] = mapped_column(primary_key=True)
    payout_id: Mapped[int] = mapped_column(
        ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[EmployeeConfirmationStatus] = mapped_column(
        Enum(EmployeeConfirmationStatus, name="employee_confirmation_status"),
        default=EmployeeConfirmationStatus.PENDING_CONFIRMATION,
        nullable=False,
        index=True,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmation_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    payout: Mapped["Payout"] = relationship("Payout", back_populates="employee_statuses")
    employee: Mapped["User"] = relationship("User", foreign_keys=[employee_user_id], lazy="joined")


class ExpensePolicy(Base):
    __tablename__ = "expense_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    policy_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    policy_value: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_type: Mapped[str] = mapped_column(String(20), default="STRING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AIProviderConfig(Base):
    __tablename__ = "ai_providers"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[AIProviderType] = mapped_column(
        Enum(AIProviderType, name="ai_provider_type"), unique=True, nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    api_key_env_var: Mapped[str | None] = mapped_column(String(100), nullable=True)
    api_key_override: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
