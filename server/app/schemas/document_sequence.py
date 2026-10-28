from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentSequenceBase(BaseModel):
    document_type: str = Field(
        ..., min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9_\-]+$"
    )
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    prefix: str = Field(default="", max_length=50)
    padding: int = Field(default=4, ge=1, le=12)
    next_number: int = Field(default=1, ge=1)
    suffix: str = Field(default="", max_length=50)
    is_active: bool = True


class DocumentSequenceCreate(DocumentSequenceBase):
    pass


class DocumentSequenceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    prefix: Optional[str] = Field(default=None, max_length=50)
    padding: Optional[int] = Field(default=None, ge=1, le=12)
    next_number: Optional[int] = Field(default=None, ge=1)
    suffix: Optional[str] = Field(default=None, max_length=50)
    is_active: Optional[bool] = None


class DocumentSequenceOut(BaseModel):
    id: int
    document_type: str
    name: str
    description: Optional[str] = None
    prefix: str
    padding: int
    next_number: int
    suffix: str
    is_active: bool
    sample_preview: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentNumberPreviewRequest(BaseModel):
    prefix: str = Field(default="", max_length=50)
    padding: int = Field(default=4, ge=1, le=12)
    next_number: int = Field(default=1, ge=1)
    suffix: str = Field(default="", max_length=50)


class DocumentNumberPreviewResponse(BaseModel):
    preview: str
