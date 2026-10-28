from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_type: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prefix: Mapped[str] = mapped_column(String(50), default="", server_default="", nullable=False)
    padding: Mapped[int] = mapped_column(Integer, default=4, server_default="4", nullable=False)
    next_number: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    suffix: Mapped[str] = mapped_column(String(50), default="", server_default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
