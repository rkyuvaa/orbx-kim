from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    ApplicationStatus,
    DeliveryStatus,
    DisbursementStatus,
    DocStatus,
    FinanceStatus,
    LeadSource,
    VerificationStatus,
)

if TYPE_CHECKING:
    from app.models.finance_company import FinanceCompany
    from app.models.user import User
    from app.models.vehicle_model import VehicleModel


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    app_no: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    vehicle: Mapped[str | None] = mapped_column(String(120), nullable=True, default="")
    vehicle_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vehicle_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fuel_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lost_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True, default=0.0)
    vehicle_model_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicle_models.id"), nullable=True, index=True
    )
    vehicle_price: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    down_payment: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status"),
        default=ApplicationStatus.LEAD,
        index=True,
        nullable=False,
    )
    stage_key: Mapped[str | None] = mapped_column(
        String(40), default="new", server_default="new", index=True, nullable=True
    )
    finance_company_id: Mapped[int | None] = mapped_column(
        ForeignKey("finance_companies.id"), nullable=True
    )
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    lead_source: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    lead_score: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp(), index=True
    )

    finance_company: Mapped["FinanceCompany | None"] = relationship(lazy="joined")
    vehicle_model: Mapped["VehicleModel | None"] = relationship(lazy="joined")
    assigned_user: Mapped["User | None"] = relationship(lazy="joined")
    documents: Mapped[list["Document"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    verifications: Mapped[list["Verification"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    finance_submissions: Mapped[list["FinanceSubmission"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    sanctions: Mapped[list["Sanction"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    deliveries: Mapped[list["Delivery"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    disbursements: Mapped[list["Disbursement"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    doc_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[DocStatus] = mapped_column(
        Enum(DocStatus, name="doc_status"), default=DocStatus.PENDING, index=True
    )
    file_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped["Application"] = relationship(back_populates="documents")


class Verification(Base):
    __tablename__ = "verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status"), default=VerificationStatus.PENDING
    )
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped["Application"] = relationship(back_populates="verifications")


class FinanceSubmission(Base):
    __tablename__ = "finance_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("finance_companies.id"), index=True)
    status: Mapped[FinanceStatus] = mapped_column(
        Enum(FinanceStatus, name="finance_status"), default=FinanceStatus.PROCESSING
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    query_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    application: Mapped["Application"] = relationship(back_populates="finance_submissions")
    company: Mapped["FinanceCompany"] = relationship(lazy="joined")


class Sanction(Base):
    __tablename__ = "sanctions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="SANCTIONED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    sanctioned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped["Application"] = relationship(back_populates="sanctions")


class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="delivery_status"), default=DeliveryStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped["Application"] = relationship(back_populates="deliveries")


class Disbursement(Base):
    __tablename__ = "disbursements"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    status: Mapped[DisbursementStatus] = mapped_column(
        Enum(DisbursementStatus, name="disbursement_status"), default=DisbursementStatus.PENDING_UTR
    )
    utr_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    disbursed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped["Application"] = relationship(back_populates="disbursements")


class ApplicationSequence(Base):
    """Single-row table to track the last used application number."""
    __tablename__ = "application_sequences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_number: Mapped[int] = mapped_column(Integer, default=0)
