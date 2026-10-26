from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ApplicationStatus, LeadSource


class ApplicationBase(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(min_length=8, max_length=20)
    vehicle: str = Field(default="", max_length=120)
    vehicle_number: str | None = None
    vehicle_year: str | None = None
    fuel_type: str | None = None
    customer_status: str | None = None
    coupon_code: str | None = None
    lost_reason: str | None = None
    amount: float = Field(default=0.0, ge=0)
    status: ApplicationStatus = ApplicationStatus.LEAD
    stage_key: str | None = None
    lead_source: str | None = None
    finance_company_id: int | None = None
    vehicle_model_id: int | None = None
    vehicle_price: float | None = Field(default=None, ge=0)
    down_payment: float | None = Field(default=None, ge=0)
    assigned_to: int | None = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    customer_name: str | None = None
    customer_phone: str | None = None
    vehicle: str | None = None
    vehicle_number: str | None = None
    vehicle_year: str | None = None
    fuel_type: str | None = None
    customer_status: str | None = None
    coupon_code: str | None = None
    lost_reason: str | None = None
    amount: float | None = Field(default=None, ge=0)
    status: ApplicationStatus | None = None
    stage_key: str | None = None
    lead_source: str | None = None
    finance_company_id: int | None = None
    vehicle_model_id: int | None = None
    vehicle_price: float | None = Field(default=None, ge=0)
    down_payment: float | None = Field(default=None, ge=0)
    assigned_to: int | None = None


class ApplicationOut(BaseModel):
    id: int
    app_no: str
    customer_name: str | None = ""
    customer_phone: str | None = ""
    vehicle: str | None = ""
    vehicle_number: str | None = None
    vehicle_year: str | None = None
    fuel_type: str | None = None
    customer_status: str | None = None
    coupon_code: str | None = None
    lost_reason: str | None = None
    amount: float = 0.0
    status: ApplicationStatus
    stage_key: str | None = "new"
    lead_source: str | None = None
    lead_score: int = 0
    finance_company_id: int | None = None
    finance_company_name: str | None = None
    vehicle_model_id: int | None = None
    vehicle_price: float | None = None
    down_payment: float | None = None
    assigned_to: int | None = None
    assigned_to_name: str | None = None
    created_at: datetime
    updated_at: datetime
    aging_label: str = "0h"
    aging_tone: str = "neutral"

    model_config = {"from_attributes": True}


class TabCounts(BaseModel):
    all: int
    mine: int
    pending: int


class ApplicationListResponse(BaseModel):
    items: list[ApplicationOut]
    total: int
    page: int
    page_size: int
    tab_counts: TabCounts
    stage_counts: dict[str, int] = {}


class PlannedActivityCreate(BaseModel):
    activity_type_id: int | None = None
    activity_type_name: str = Field(min_length=2, max_length=60)
    subject: str = Field(min_length=2, max_length=120)
    notes: str | None = None
    due_date: datetime | None = None
    assigned_to: int | None = None


class PlannedActivityUpdate(BaseModel):
    subject: str | None = Field(default=None, min_length=2, max_length=120)
    notes: str | None = None
    due_date: datetime | None = None
    status: str | None = Field(default=None, max_length=20)
    assigned_to: int | None = None


class PlannedActivityOut(BaseModel):
    id: int
    application_id: int
    activity_type_id: int | None
    activity_type_name: str
    subject: str
    notes: str | None
    due_date: datetime | None
    status: str
    assigned_to: int | None
    assignee_name: str | None = None
    created_by: int | None
    creator_name: str | None = None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class BulkAssignRequest(BaseModel):
    application_ids: list[int] = Field(min_items=1, max_items=100)
    assigned_to: int


class BulkStatusChangeRequest(BaseModel):
    application_ids: list[int] = Field(min_items=1, max_items=100)
    status: ApplicationStatus


class BulkDeleteRequest(BaseModel):
    application_ids: list[int] = Field(min_items=1, max_items=100)


class LeadFilterPreset(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    filters: dict
    is_default: bool = False
