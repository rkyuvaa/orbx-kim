from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import (
    DateTime, ForeignKey, String, func, Float, Boolean, Integer, JSON, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.projects import Task


class PersonalSettings(Base):
    """Personal settings and capacity configuration for single-user task management"""
    __tablename__ = "personal_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", nullable=False)
    working_hours_per_day: Mapped[float] = mapped_column(Float, default=8.0, nullable=False)
    working_days: Mapped[str] = mapped_column(String(50), default="MON,TUE,WED,THU,FRI", nullable=False)
    quiet_hours_start: Mapped[str | None] = mapped_column(String(5), nullable=True)  # HH:MM
    quiet_hours_end: Mapped[str | None] = mapped_column(String(5), nullable=True)    # HH:MM
    digest_time: Mapped[str | None] = mapped_column(String(5), nullable=True)        # HH:MM
    default_reminder_presets: Mapped[str] = mapped_column(String(200), default="1d,1h,due", nullable=False)
    max_timer_hours: Mapped[float] = mapped_column(Float, default=8.0, nullable=False)
    auto_stop_timer_at_eod: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    holidays_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class PersonalReminder(Base):
    """Reminder notifications for personal tasks with idempotency tracking"""
    __tablename__ = "personal_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_type: Mapped[str] = mapped_column(String(30), default="custom", nullable=False)  # preset/custom/overdue/new-task
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending/sent/failed/cancelled/snoozed
    idempotency_key: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class PersonalTemplate(Base):
    """Reusable task checklists and templates"""
    __tablename__ = "personal_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    subtasks_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # List of [{"title": "..."}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
