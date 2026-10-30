from datetime import datetime
from typing import TYPE_CHECKING, Any, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.vehicle_service import VSComplaint


class VSCustomFieldTab(Base):
    """Tabs for grouping custom fields in vehicle service work orders."""
    __tablename__ = "vs_custom_field_tabs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(40), default="LayoutPanelTop")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    department_id: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)  # Optional dept scoping
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    fields: Mapped[List["VSCustomFieldDefinition"]] = relationship(
        back_populates="tab", cascade="all, delete-orphan", order_by="VSCustomFieldDefinition.display_order"
    )


class VSCustomFieldDefinition(Base):
    """Admin-configurable custom field definitions for vehicle service work orders."""
    __tablename__ = "vs_custom_field_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    tab_id: Mapped[int] = mapped_column(ForeignKey("vs_custom_field_tabs.id", ondelete="CASCADE"), index=True, nullable=False)
    key: Mapped[str] = mapped_column(String(60), nullable=False, index=True)  # Machine name (e.g., "estimated_minutes")
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    field_type: Mapped[str] = mapped_column(String(30), default="text", nullable=False)  # text, number, date, timer, user, file, dropdown
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_readonly: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    department_id: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)  # Optional dept scoping
    
    placeholder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # For dropdown: [{label: "High", value: "high", default: false}, ...]
    options: Mapped[List[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    
    # For file: {allowed_extensions: ["pdf","png","jpg"], max_size_mb: 10}
    file_config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    
    # For user type: {filter_by_department: true, department_field: "department_id"}
    user_config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    
    # Required rules per status: {"OPEN": true, "ACKNOWLEDGED": true, "ASSIGNED": false, ...}
    required_by_status: Mapped[dict[str, bool] | None] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    tab: Mapped["VSCustomFieldTab"] = relationship(back_populates="fields")
    values: Mapped[List["VSComplaintCustomFieldValue"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint('tab_id', 'key', name='uq_vs_custom_field_tab_key'),
        UniqueConstraint('tab_id', 'label', name='uq_vs_custom_field_tab_label'),
    )


class VSComplaintCustomFieldValue(Base):
    """Per-work-order values for custom fields."""
    __tablename__ = "vs_complaint_custom_field_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("vs_complaints.id", ondelete="CASCADE"), index=True, nullable=False)
    field_id: Mapped[int] = mapped_column(ForeignKey("vs_custom_field_definitions.id", ondelete="CASCADE"), index=True, nullable=False)
    
    # Textual or JSON payload (handles string, number, date, bool, dropdown value, or file info dict)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # For file fields: {filename, original_name, size, mime_type, url, preview_url, uploaded_at}
    file_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    complaint: Mapped["VSComplaint"] = relationship(back_populates="custom_field_values")
    field: Mapped["VSCustomFieldDefinition"] = relationship(back_populates="values")

    __table_args__ = (
        UniqueConstraint('complaint_id', 'field_id', name='uq_vs_complaint_field'),
    )