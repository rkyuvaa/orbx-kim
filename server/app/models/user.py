from datetime import datetime
from typing import TYPE_CHECKING
import enum

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.notification import Notification
    from app.models.push_subscription import PushSubscription
    from app.models.rbac import DepartmentUser, UserPermission, UserRole


class UserStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), default=UserStatus.ACTIVE, nullable=False
    )
    force_password_change: Mapped[bool] = mapped_column(default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reporting_manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    push_subscriptions: Mapped[list["PushSubscription"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole", foreign_keys="UserRole.user_id", back_populates="user", cascade="all, delete-orphan"
    )
    user_permissions: Mapped[list["UserPermission"]] = relationship(
        "UserPermission", foreign_keys="UserPermission.user_id", back_populates="user", cascade="all, delete-orphan"
    )
    department_users: Mapped[list["DepartmentUser"]] = relationship(
        "DepartmentUser", foreign_keys="DepartmentUser.user_id", back_populates="user", cascade="all, delete-orphan"
    )
    reporting_manager: Mapped["User | None"] = relationship(
        "User", remote_side=[id], foreign_keys=[reporting_manager_id], lazy="joined"
    )
    subordinates: Mapped[list["User"]] = relationship(
        "User", back_populates="reporting_manager", lazy="selectin"
    )

    @property
    def initials(self) -> str:
        return (self.full_name or self.email).strip().upper()[:1]
