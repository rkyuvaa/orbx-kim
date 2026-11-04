from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SmsSetting(Base):
    __tablename__ = "sms_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    provider: Mapped[str] = mapped_column(String(50), default="textguru", nullable=False)
    api_url: Mapped[str] = mapped_column(String(255), default="https://www.textguru.in/api/v22.0/", nullable=False)
    api_method: Mapped[str] = mapped_column(String(10), default="GET", nullable=False)
    username: Mapped[str | None] = mapped_column(String(120), nullable=True)
    password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    registration_template_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    registration_message_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    otp_template_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    otp_message_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )
