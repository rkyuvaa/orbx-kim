from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class VSKit(Base):
    __tablename__ = "vs_kits"

    id: Mapped[int] = mapped_column(primary_key=True)
    kit_number: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    kit_name: Mapped[str] = mapped_column(String(120), nullable=False)
    customer_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(40), index=True, nullable=True)
    installed_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    component_types: Mapped[List["VSKitComponentType"]] = relationship(
        "VSKitComponentType", back_populates="kit", cascade="all, delete-orphan", lazy="selectin"
    )
    vehicles: Mapped[List["VSVehicle"]] = relationship("VSVehicle", back_populates="kit")


class VSKitComponentType(Base):
    __tablename__ = "vs_kit_component_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    kit_id: Mapped[int] = mapped_column(ForeignKey("vs_kits.id", ondelete="CASCADE"), index=True, nullable=False)
    component_type: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    kit: Mapped["VSKit"] = relationship("VSKit", back_populates="component_types")


class VSVehicle(Base):
    __tablename__ = "vs_vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    chassis_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    kit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vs_kits.id", ondelete="SET NULL"), index=True, nullable=True)
    retrofit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    owner_name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    owner_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warranty_expiry: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_service_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_mileage_km: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0", nullable=False)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    kit: Mapped[Optional["VSKit"]] = relationship("VSKit", back_populates="vehicles", lazy="joined")
    components: Mapped[List["VSVehicleComponent"]] = relationship(
        "VSVehicleComponent", back_populates="vehicle", cascade="all, delete-orphan", lazy="selectin"
    )
    complaints: Mapped[List["VSComplaint"]] = relationship("VSComplaint", back_populates="vehicle")
    maintenance_schedules: Mapped[List["VSMaintenanceSchedule"]] = relationship(
        "VSMaintenanceSchedule", back_populates="vehicle"
    )


class VSVehicleComponent(Base):
    __tablename__ = "vs_vehicle_components"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vs_vehicles.id", ondelete="CASCADE"), index=True, nullable=False)
    component_type_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_kit_component_types.id", ondelete="SET NULL"), nullable=True
    )
    component_type: Mapped[str] = mapped_column(String(50), nullable=False)
    component_label: Mapped[str] = mapped_column(String(120), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    installed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    vehicle: Mapped["VSVehicle"] = relationship("VSVehicle", back_populates="components")
    component_type_def: Mapped[Optional["VSKitComponentType"]] = relationship("VSKitComponentType", lazy="joined")
    history: Mapped[List["VSComponentHistory"]] = relationship(
        "VSComponentHistory", back_populates="component", cascade="all, delete-orphan", lazy="selectin"
    )


class VSComponentHistory(Base):
    __tablename__ = "vs_component_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_component_id: Mapped[int] = mapped_column(
        ForeignKey("vs_vehicle_components.id", ondelete="CASCADE"), index=True, nullable=False
    )
    old_serial_number: Mapped[str] = mapped_column(String(100), nullable=False)
    new_serial_number: Mapped[str] = mapped_column(String(100), nullable=False)
    replaced_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    replaced_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    complaint_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_complaints.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    component: Mapped["VSVehicleComponent"] = relationship("VSVehicleComponent", back_populates="history")
    replaced_by: Mapped[Optional["User"]] = relationship("User", lazy="joined")


class VSComplaint(Base):
    __tablename__ = "vs_complaints"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_no: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vs_vehicles.id", ondelete="CASCADE"), index=True, nullable=False)
    affected_component_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_vehicle_components.id", ondelete="SET NULL"), nullable=True
    )
    reported_by: Mapped[str] = mapped_column(String(120), nullable=False)
    reported_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="BREAKDOWN", nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    gps_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gps_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gps_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    registered_via: Mapped[str] = mapped_column(String(20), default="STAFF", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="OPEN", nullable=False, index=True)
    assigned_to_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    vehicle: Mapped["VSVehicle"] = relationship("VSVehicle", back_populates="complaints", lazy="joined")
    affected_component: Mapped[Optional["VSVehicleComponent"]] = relationship("VSVehicleComponent", lazy="joined")
    assigned_to: Mapped[Optional["User"]] = relationship("User", lazy="joined")
    notes: Mapped[List["VSComplaintNote"]] = relationship(
        "VSComplaintNote", back_populates="complaint", cascade="all, delete-orphan", lazy="selectin"
    )
    feedback: Mapped[Optional["VSCustomerFeedback"]] = relationship(
        "VSCustomerFeedback", back_populates="complaint", uselist=False, lazy="joined"
    )
    costs: Mapped[List["VSServiceCost"]] = relationship(
        "VSServiceCost", back_populates="complaint", cascade="all, delete-orphan", lazy="selectin"
    )


class VSComplaintNote(Base):
    __tablename__ = "vs_complaint_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("vs_complaints.id", ondelete="CASCADE"), index=True, nullable=False
    )
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    is_status_change: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    complaint: Mapped["VSComplaint"] = relationship("VSComplaint", back_populates="notes")
    author: Mapped[Optional["User"]] = relationship("User", lazy="joined")


class VSMaintenanceSchedule(Base):
    __tablename__ = "vs_maintenance_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vs_vehicles.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    service_type: Mapped[str] = mapped_column(String(60), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="SCHEDULED", nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technician_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cost: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    vehicle: Mapped["VSVehicle"] = relationship("VSVehicle", back_populates="maintenance_schedules", lazy="joined")
    technician: Mapped[Optional["User"]] = relationship("User", lazy="joined")
    costs: Mapped[List["VSServiceCost"]] = relationship("VSServiceCost", back_populates="maintenance")


class VSCustomerFeedback(Base):
    __tablename__ = "vs_customer_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("vs_complaints.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    complaint: Mapped["VSComplaint"] = relationship("VSComplaint", back_populates="feedback")


class VSServiceCost(Base):
    __tablename__ = "vs_service_costs"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_complaints.id", ondelete="CASCADE"), nullable=True, index=True
    )
    maintenance_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_maintenance_schedules.id", ondelete="CASCADE"), nullable=True, index=True
    )
    item_name: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0", nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    complaint: Mapped[Optional["VSComplaint"]] = relationship("VSComplaint", back_populates="costs")
    maintenance: Mapped[Optional["VSMaintenanceSchedule"]] = relationship("VSMaintenanceSchedule", back_populates="costs")
