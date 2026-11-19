from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


# Category Schemas
class ExpenseCategoryBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    limit_amount: Optional[float] = None
    limit_period: str = "PER_EXPENSE"
    gl_account_code: Optional[str] = None
    is_active: bool = True


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    limit_amount: Optional[float] = None
    limit_period: Optional[str] = None
    gl_account_code: Optional[str] = None
    is_active: Optional[bool] = None


class ExpenseCategoryResponse(ExpenseCategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Claim Cycle Schemas
class ClaimCycleBase(BaseModel):
    name: str
    frequency: str = "FORTNIGHTLY"
    period_start: date
    period_end: date
    due_date: date
    status: str = "OPEN"
    auto_submit_enabled: bool = True


class ClaimCycleCreate(ClaimCycleBase):
    pass


class ClaimCycleUpdate(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    auto_submit_enabled: Optional[bool] = None


class ClaimCycleResponse(ClaimCycleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Bill Schemas
class BillUpdate(BaseModel):
    bill_number: Optional[str] = None
    bill_date: Optional[date] = None
    supplier_name: Optional[str] = None
    category_id: Optional[int] = None
    taxable_amount: Optional[float] = 0.0
    cgst_pct: Optional[float] = 0.0
    cgst_amount: Optional[float] = 0.0
    sgst_pct: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    igst_pct: Optional[float] = 0.0
    igst_amount: Optional[float] = 0.0
    gst_total: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    notes: Optional[str] = None
    extraction_status: Optional[str] = None


class BillResponse(BaseModel):
    id: int
    bill_number: Optional[str] = None
    bill_date: Optional[date] = None
    supplier_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    uploaded_by_id: int
    uploaded_by_name: Optional[str] = None
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    claim_id: Optional[int] = None
    source_file_path: str
    source_mime: str
    source_hash: Optional[str] = None
    taxable_amount: float
    cgst_pct: float
    cgst_amount: float
    sgst_pct: float
    sgst_amount: float
    igst_pct: float
    igst_amount: float
    gst_total: float
    total_amount: float
    extraction_status: str
    extraction_confidence: float
    extraction_raw: Optional[dict[str, Any]] = None
    is_duplicate: bool
    duplicate_of_bill_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Claim Schemas
class ClaimStatusHistoryResponse(BaseModel):
    id: int
    from_status: str
    to_status: str
    actor_user_id: Optional[int] = None
    actor_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClaimResponse(BaseModel):
    id: int
    claim_no: str
    employee_user_id: int
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    claim_cycle_id: Optional[int] = None
    cycle_name: Optional[str] = None
    status: str
    total_amount: float
    submitted_at: Optional[datetime] = None
    line_manager_id: Optional[int] = None
    line_manager_name: Optional[str] = None
    line_manager_action_at: Optional[datetime] = None
    cfo_id: Optional[int] = None
    cfo_name: Optional[str] = None
    cfo_action_at: Optional[datetime] = None
    accountant_id: Optional[int] = None
    accountant_name: Optional[str] = None
    accountant_action_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    bills_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClaimDetailResponse(ClaimResponse):
    bills: list[BillResponse] = []
    status_history: list[ClaimStatusHistoryResponse] = []


class ClaimApprovalAction(BaseModel):
    note: Optional[str] = None


class ClaimRejectAction(BaseModel):
    reason: str


# Payout Schemas
class PayoutBatchCreate(BaseModel):
    claim_ids: list[int]
    notes: Optional[str] = None


class PayoutTransferRecord(BaseModel):
    utr_number: str
    payment_date: date
    bank_ref: Optional[str] = None
    notes: Optional[str] = None


class PayoutEmployeeStatusResponse(BaseModel):
    id: int
    payout_id: int
    employee_user_id: int
    employee_name: Optional[str] = None
    amount: float
    status: str
    confirmed_at: Optional[datetime] = None
    confirmation_method: Optional[str] = None
    notes: Optional[str] = None
    reminder_count: int
    last_reminder_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayoutResponse(BaseModel):
    id: int
    batch_no: str
    created_by_id: int
    created_by_name: Optional[str] = None
    status: str
    total_amount: float
    claim_count: int
    payment_date: Optional[date] = None
    utr_number: Optional[str] = None
    bank_ref: Optional[str] = None
    notes: Optional[str] = None
    transferred_at: Optional[datetime] = None
    created_at: datetime
    employee_statuses: list[PayoutEmployeeStatusResponse] = []

    model_config = ConfigDict(from_attributes=True)


# AI Provider Schemas
class AIProviderConfigBase(BaseModel):
    provider: str
    label: str
    model_name: str
    api_endpoint: Optional[str] = None
    api_key_env_var: Optional[str] = None
    api_key_override: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    config_json: Optional[dict[str, Any]] = None


class AIProviderConfigCreate(AIProviderConfigBase):
    pass


class AIProviderConfigUpdate(BaseModel):
    label: Optional[str] = None
    model_name: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_key_env_var: Optional[str] = None
    api_key_override: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    config_json: Optional[dict[str, Any]] = None


class AIProviderConfigResponse(AIProviderConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Policy Schemas
class ExpensePolicyResponse(BaseModel):
    id: int
    policy_key: str
    policy_value: str
    description: Optional[str] = None
    data_type: str

    model_config = ConfigDict(from_attributes=True)


class ExpensePolicyUpdate(BaseModel):
    policy_value: str
    description: Optional[str] = None


# Branch Assignment
class UserBranchAssignment(BaseModel):
    user_id: int
    branch_id: Optional[int] = None
    reporting_manager_id: Optional[int] = None
