from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Kit & Component Types
# ============================================================================

class VSKitComponentTypeCreate(BaseModel):
    component_type: str = Field(..., max_length=50)
    label: str = Field(..., max_length=120)
    serial_number: Optional[str] = Field(None, max_length=100)
    is_required: bool = True


class VSKitComponentTypeOut(BaseModel):
    id: int
    kit_id: int
    component_type: str
    label: str
    serial_number: Optional[str] = None
    is_required: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VSKitCreate(BaseModel):
    kit_number: str = Field(..., max_length=80)
    kit_name: str = Field(..., max_length=120)
    customer_name: Optional[str] = Field(None, max_length=120)
    vehicle_number: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = None
    component_types: List[VSKitComponentTypeCreate] = []


class VSKitUpdate(BaseModel):
    kit_name: Optional[str] = Field(None, max_length=120)
    customer_name: Optional[str] = Field(None, max_length=120)
    vehicle_number: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class VSKitOut(BaseModel):
    id: int
    kit_number: str
    kit_name: str
    customer_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    component_types: List[VSKitComponentTypeOut] = []

    model_config = ConfigDict(from_attributes=True)


class VSKitPdfParsePreview(BaseModel):
    kit_name: str
    kit_number: str
    customer_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    components: List[VSKitComponentTypeCreate] = []
    total_raw: int
    total_serialized: int
    total_skipped: int


# ============================================================================
# Vehicle Components & Replacement History
# ============================================================================

class VSVehicleComponentCreate(BaseModel):
    component_type_id: Optional[int] = None
    component_type: str = Field(..., max_length=50)
    component_label: str = Field(..., max_length=120)
    serial_number: str = Field(..., max_length=100)
    installed_date: Optional[date] = None


class VSComponentReplaceRequest(BaseModel):
    new_serial_number: str = Field(..., min_length=1, max_length=100)
    replaced_date: date
    reason: Optional[str] = None
    complaint_id: Optional[int] = None


class VSComponentHistoryOut(BaseModel):
    id: int
    vehicle_component_id: int
    old_serial_number: str
    new_serial_number: str
    replaced_date: date
    reason: Optional[str]
    replaced_by_id: Optional[int]
    replaced_by_name: Optional[str] = None
    complaint_id: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VSVehicleComponentOut(BaseModel):
    id: int
    vehicle_id: int
    component_type_id: Optional[int]
    component_type: str
    component_label: str
    serial_number: str
    installed_date: Optional[date]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    history: List[VSComponentHistoryOut] = []

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Retrofitted Vehicle
# ============================================================================

class VSVehicleCreate(BaseModel):
    vehicle_number: str = Field(..., max_length=40)
    chassis_number: Optional[str] = Field(None, max_length=80)
    kit_id: Optional[int] = None
    retrofit_date: Optional[date] = None
    owner_name: str = Field(..., max_length=120)
    owner_phone: str = Field(..., max_length=20)
    owner_address: Optional[str] = None
    warranty_expiry: Optional[date] = None
    total_mileage_km: float = 0.0
    components: List[VSVehicleComponentCreate] = []


class VSVehicleUpdate(BaseModel):
    chassis_number: Optional[str] = Field(None, max_length=80)
    owner_name: Optional[str] = Field(None, max_length=120)
    owner_phone: Optional[str] = Field(None, max_length=20)
    owner_address: Optional[str] = None
    warranty_expiry: Optional[date] = None
    last_service_date: Optional[date] = None
    total_mileage_km: Optional[float] = None
    is_active: Optional[bool] = None


class VSVehicleOut(BaseModel):
    id: int
    vehicle_number: str
    chassis_number: Optional[str]
    kit_id: Optional[int]
    kit_number: Optional[str] = None
    kit_name: Optional[str] = None
    retrofit_date: Optional[date]
    owner_name: str
    owner_phone: str
    owner_address: Optional[str]
    warranty_expiry: Optional[date]
    last_service_date: Optional[date]
    total_mileage_km: float
    qr_token: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    components: List[VSVehicleComponentOut] = []
    open_complaints_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Complaint Notes, Costs, Feedback
# ============================================================================

class VSComplaintNoteCreate(BaseModel):
    note: str = Field(..., min_length=1)


class VSComplaintNoteOut(BaseModel):
    id: int
    complaint_id: int
    author_id: Optional[int]
    author_name: str
    note: str
    is_status_change: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VSServiceCostCreate(BaseModel):
    item_name: str = Field(..., max_length=120)
    quantity: float = 1.0
    unit_price: float


class VSServiceCostOut(BaseModel):
    id: int
    complaint_id: Optional[int]
    maintenance_id: Optional[int]
    item_name: str
    quantity: float
    unit_price: float
    total_price: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VSCustomerFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class VSCustomerFeedbackOut(BaseModel):
    id: int
    complaint_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Complaints / Work Orders
# ============================================================================

class VSComplaintCreate(BaseModel):
    vehicle_id: int
    affected_component_id: Optional[int] = None
    reported_by: str = Field(..., max_length=120)
    reported_phone: str = Field(..., max_length=20)
    category: str = Field(default="BREAKDOWN", max_length=40)
    severity: str = Field(default="MEDIUM", max_length=20)
    description: str
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_address: Optional[str] = Field(None, max_length=255)
    assigned_to_id: Optional[int] = None


class VSPublicComplaintCreate(BaseModel):
    vehicle_number: Optional[str] = None
    affected_component_id: Optional[int] = None
    reported_by: str = Field(..., max_length=120)
    reported_phone: str = Field(..., max_length=20)
    category: str = Field(default="BREAKDOWN", max_length=40)
    severity: str = Field(default="MEDIUM", max_length=20)
    description: Optional[str] = Field(default="", max_length=1000)
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_address: Optional[str] = Field(None, max_length=255)


class VSUniversalComplaintCreate(BaseModel):
    vehicle_number: str = Field(..., min_length=2, max_length=40)
    reported_by: str = Field(..., max_length=120)
    reported_phone: str = Field(..., max_length=20)
    category: str = Field(default="BREAKDOWN", max_length=40)
    severity: str = Field(default="MEDIUM", max_length=20)
    description: Optional[str] = Field(default="", max_length=1000)
    affected_component_id: Optional[int] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_address: Optional[str] = Field(None, max_length=255)


class VSComplaintUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=30)
    severity: Optional[str] = Field(None, max_length=20)
    assigned_to_id: Optional[int] = None
    affected_component_id: Optional[int] = None
    resolution_summary: Optional[str] = None


class VSComplaintCloseRequest(BaseModel):
    resolution_summary: str = Field(..., min_length=1)
    rating: Optional[int] = Field(None, ge=1, le=5)
    feedback_comment: Optional[str] = None


class VSComplaintOut(BaseModel):
    id: int
    complaint_no: str
    vehicle_id: int
    vehicle_number: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    affected_component_id: Optional[int]
    affected_component_label: Optional[str] = None
    affected_component_serial: Optional[str] = None
    reported_by: str
    reported_phone: str
    category: str
    severity: str
    description: str
    gps_latitude: Optional[float]
    gps_longitude: Optional[float]
    gps_address: Optional[str]
    registered_via: str
    status: str
    assigned_to_id: Optional[int]
    assigned_to_name: Optional[str] = None
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    resolution_summary: Optional[str]
    created_at: datetime
    updated_at: datetime
    notes: List[VSComplaintNoteOut] = []
    feedback: Optional[VSCustomerFeedbackOut] = None
    costs: List[VSServiceCostOut] = []

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Maintenance Schedules
# ============================================================================

class VSMaintenanceCreate(BaseModel):
    vehicle_id: int
    title: str = Field(..., max_length=150)
    service_type: str = Field(..., max_length=60)
    scheduled_date: date
    notes: Optional[str] = None
    technician_id: Optional[int] = None
    cost: float = 0.0


class VSMaintenanceUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=30)
    completed_date: Optional[date] = None
    notes: Optional[str] = None
    cost: Optional[float] = None
    technician_id: Optional[int] = None


class VSMaintenanceOut(BaseModel):
    id: int
    vehicle_id: int
    vehicle_number: Optional[str] = None
    title: str
    service_type: str
    scheduled_date: date
    completed_date: Optional[date]
    status: str
    notes: Optional[str]
    technician_id: Optional[int]
    technician_name: Optional[str] = None
    cost: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Dashboard & Analytics
# ============================================================================

class VSDashboardKPIs(BaseModel):
    total_vehicles: int
    open_complaints: int
    critical_alerts: int
    pending_maintenance: int
    resolved_this_month: int
    avg_resolution_hours: float


class VSCategoryCount(BaseModel):
    category: str
    count: int


class VSSeverityCount(BaseModel):
    severity: str
    count: int


class VSStatusCount(BaseModel):
    status: str
    count: int


class VSAnomalyAlert(BaseModel):
    vehicle_id: int
    vehicle_number: str
    category: str
    complaints_count: int
    message: str


class VSDashboardOut(BaseModel):
    kpis: VSDashboardKPIs
    by_category: List[VSCategoryCount] = []
    by_severity: List[VSSeverityCount] = []
    by_status: List[VSStatusCount] = []
    recent_complaints: List[VSComplaintOut] = []
    anomalies: List[VSAnomalyAlert] = []


class VSPublicVehicleInfo(BaseModel):
    vehicle_id: int
    vehicle_number: str
    owner_name: str
    owner_phone: str
    kit_number: Optional[str] = None
    kit_name: Optional[str] = None
    warranty_expiry: Optional[date] = None
    components: List[VSVehicleComponentOut] = []
