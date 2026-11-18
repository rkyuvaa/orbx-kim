from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RequirementApprovalToken(Base):
    """One-time signed link token used for email-based approve/reject of
    material / IT requirements stored in the app_data_documents JSON store."""

    __tablename__ = "requirement_approval_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    requirement_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    request_no: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    requirement_type: Mapped[str] = mapped_column(String(20), nullable=False)  # MATERIAL | IT
    approver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approver_name: Mapped[str] = mapped_column(String(120), nullable=False)
    approver_email: Mapped[str] = mapped_column(String(255), nullable=False)
    submitted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_by_name: Mapped[str] = mapped_column(String(120), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True, nullable=False)  # PENDING, APPROVED, REJECTED, EXPIRED, REVOKED
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_via: Mapped[str | None] = mapped_column(String(30), nullable=True)  # email_link | app
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), nullable=False)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False
    )

    approver: Mapped["User | None"] = relationship(foreign_keys=[approver_id])
    submitted_by: Mapped["User | None"] = relationship(foreign_keys=[submitted_by_user_id])


class RequirementApprovalAccessLog(Base):
    """Audit trail of every access to a requirement approval link."""

    __tablename__ = "requirement_approval_access_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_id: Mapped[int | None] = mapped_column(
        ForeignKey("requirement_approval_tokens.id", ondelete="CASCADE"), index=True, nullable=True
    )
    requirement_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # page_view, approve, reject, rejected
    ip_address: Mapped[str | None] = mapped_column(String(60), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
