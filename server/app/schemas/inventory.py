from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.inventory import (
    InvAdjustmentType,
    InvDocStatus,
    InvMoveType,
    InvReturnType,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
class InvStoreCreate(BaseModel):
    name: str = Field(..., max_length=120)
    code: str = Field(..., max_length=40)
    is_active: bool = True


class InvStoreUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    is_active: Optional[bool] = None


class InvStoreOut(ORMModel):
    id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvLocationCreate(BaseModel):
    store_id: int
    name: str = Field(..., max_length=120)
    code: str = Field(..., max_length=40)
    is_active: bool = True


class InvLocationUpdate(BaseModel):
    store_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    is_active: Optional[bool] = None


class InvLocationOut(ORMModel):
    id: int
    store_id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvBinCreate(BaseModel):
    location_id: int
    name: str = Field(..., max_length=120)
    code: str = Field(..., max_length=40)
    is_active: bool = True


class InvBinUpdate(BaseModel):
    location_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    is_active: Optional[bool] = None


class InvBinOut(ORMModel):
    id: int
    location_id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvCategoryCreate(BaseModel):
    name: str = Field(..., max_length=120)
    code: str = Field(..., max_length=40)
    parent_id: Optional[int] = None
    is_active: bool = True


class InvCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


class InvCategoryOut(ORMModel):
    id: int
    name: str
    code: str
    parent_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvUnitCreate(BaseModel):
    name: str = Field(..., max_length=60)
    code: str = Field(..., max_length=20)
    is_active: bool = True


class InvUnitUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    code: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class InvUnitOut(ORMModel):
    id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvBrandCreate(BaseModel):
    name: str = Field(..., max_length=120)
    code: str = Field(..., max_length=40)
    is_active: bool = True


class InvBrandUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    is_active: Optional[bool] = None


class InvBrandOut(ORMModel):
    id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvSupplierCreate(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=40)
    contact_name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=20)
    credit_terms: Optional[str] = Field(None, max_length=120)
    is_active: bool = True


class InvSupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    code: Optional[str] = Field(None, max_length=40)
    contact_name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=20)
    credit_terms: Optional[str] = Field(None, max_length=120)
    is_active: Optional[bool] = None


class InvSupplierOut(ORMModel):
    id: int
    name: str
    code: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    credit_terms: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvTaxRateCreate(BaseModel):
    name: str = Field(..., max_length=60)
    rate: float = 0.0
    is_active: bool = True


class InvTaxRateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    rate: Optional[float] = None
    is_active: Optional[bool] = None


class InvTaxRateOut(ORMModel):
    id: int
    name: str
    rate: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvItemCreate(BaseModel):
    sku: str = Field(..., max_length=60)
    name: str = Field(..., max_length=200)
    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    brand_id: Optional[int] = None
    default_supplier_id: Optional[int] = None
    tax_rate_id: Optional[int] = None
    purchase_price: float = 0.0
    reorder_level: float = 0.0
    reorder_qty: float = 0.0
    is_active: bool = True


class InvItemUpdate(BaseModel):
    sku: Optional[str] = Field(None, max_length=60)
    name: Optional[str] = Field(None, max_length=200)
    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    brand_id: Optional[int] = None
    default_supplier_id: Optional[int] = None
    tax_rate_id: Optional[int] = None
    purchase_price: Optional[float] = None
    reorder_level: Optional[float] = None
    reorder_qty: Optional[float] = None
    is_active: Optional[bool] = None


class InvItemOut(ORMModel):
    id: int
    sku: str
    name: str
    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    brand_id: Optional[int] = None
    default_supplier_id: Optional[int] = None
    tax_rate_id: Optional[int] = None
    purchase_price: float
    reorder_level: float
    reorder_qty: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------
class InvStockBalanceOut(ORMModel):
    id: int
    item_id: int
    store_id: int
    location_id: int
    bin_id: int
    batch_no: str
    serial_no: str
    expiry_date: Optional[date] = None
    qty: float
    avg_cost: float
    updated_at: datetime


class InvStockMoveOut(ORMModel):
    id: int
    item_id: int
    store_id: int
    location_id: int
    bin_id: int
    batch_no: str
    serial_no: str
    expiry_date: Optional[date] = None
    move_type: InvMoveType
    qty: float
    unit_cost: float
    total_cost: float
    document_no: Optional[str] = None
    source_doc_type: Optional[str] = None
    source_doc_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Transaction line schemas
# ---------------------------------------------------------------------------
class InvPurchaseRequestLineCreate(BaseModel):
    item_id: int
    qty: float
    est_unit_price: float = 0.0


class InvPurchaseRequestLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    est_unit_price: float


class InvPurchaseRequestCreate(BaseModel):
    supplier_id: Optional[int] = None
    notes: Optional[str] = None
    lines: List[InvPurchaseRequestLineCreate] = []


class InvPurchaseRequestUpdate(BaseModel):
    supplier_id: Optional[int] = None
    notes: Optional[str] = None
    lines: Optional[List[InvPurchaseRequestLineCreate]] = None


class InvPurchaseRequestOut(ORMModel):
    id: int
    pr_number: str
    supplier_id: Optional[int] = None
    status: InvDocStatus
    requested_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvPurchaseRequestLineOut] = []


class InvPurchaseOrderLineCreate(BaseModel):
    item_id: int
    qty: float
    unit_price: float = 0.0
    tax_rate_id: Optional[int] = None


class InvPurchaseOrderLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    unit_price: float
    tax_rate_id: Optional[int] = None
    received_qty: float


class InvPurchaseOrderCreate(BaseModel):
    supplier_id: int
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[InvPurchaseOrderLineCreate] = []


class InvPurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    lines: Optional[List[InvPurchaseOrderLineCreate]] = None


class InvPurchaseOrderOut(ORMModel):
    id: int
    po_number: str
    supplier_id: int
    status: InvDocStatus
    expected_date: Optional[date] = None
    requested_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvPurchaseOrderLineOut] = []


class InvGoodsReceiptLineCreate(BaseModel):
    item_id: int
    qty: float
    batch_no: str = ""
    serial_no: str = ""
    expiry_date: Optional[date] = None
    unit_cost: float = 0.0
    store_id: int
    location_id: int
    bin_id: int
    po_line_id: Optional[int] = None


class InvGoodsReceiptLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    batch_no: str
    serial_no: str
    expiry_date: Optional[date] = None
    unit_cost: float
    store_id: int
    location_id: int
    bin_id: int
    po_line_id: Optional[int] = None


class InvGoodsReceiptCreate(BaseModel):
    po_id: Optional[int] = None
    supplier_id: int
    receipt_date: date
    notes: Optional[str] = None
    lines: List[InvGoodsReceiptLineCreate] = []


class InvGoodsReceiptUpdate(BaseModel):
    po_id: Optional[int] = None
    supplier_id: Optional[int] = None
    receipt_date: Optional[date] = None
    notes: Optional[str] = None
    lines: Optional[List[InvGoodsReceiptLineCreate]] = None


class InvGoodsReceiptOut(ORMModel):
    id: int
    gr_number: str
    po_id: Optional[int] = None
    supplier_id: int
    status: InvDocStatus
    receipt_date: date
    received_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvGoodsReceiptLineOut] = []


class InvIssueLineCreate(BaseModel):
    item_id: int
    qty: float
    batch_no: str = ""
    serial_no: str = ""
    store_id: int
    location_id: int
    bin_id: int


class InvIssueLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    batch_no: str
    serial_no: str
    unit_cost: float
    store_id: int
    location_id: int
    bin_id: int


class InvIssueCreate(BaseModel):
    complaint_id: int
    vehicle_id: Optional[int] = None
    issue_date: date
    notes: Optional[str] = None
    lines: List[InvIssueLineCreate] = []


class InvIssueUpdate(BaseModel):
    complaint_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    issue_date: Optional[date] = None
    notes: Optional[str] = None
    lines: Optional[List[InvIssueLineCreate]] = None


class InvIssueOut(ORMModel):
    id: int
    issue_number: str
    complaint_id: int
    vehicle_id: Optional[int] = None
    status: InvDocStatus
    issue_date: date
    issued_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvIssueLineOut] = []


class InvReturnLineCreate(BaseModel):
    item_id: int
    qty: float
    batch_no: str = ""
    serial_no: str = ""
    store_id: int
    location_id: int
    bin_id: int


class InvReturnLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    batch_no: str
    serial_no: str
    unit_cost: float
    store_id: int
    location_id: int
    bin_id: int


class InvReturnCreate(BaseModel):
    return_type: InvReturnType
    complaint_id: Optional[int] = None
    supplier_id: Optional[int] = None
    return_date: date
    notes: Optional[str] = None
    lines: List[InvReturnLineCreate] = []


class InvReturnUpdate(BaseModel):
    return_type: Optional[InvReturnType] = None
    complaint_id: Optional[int] = None
    supplier_id: Optional[int] = None
    return_date: Optional[date] = None
    notes: Optional[str] = None
    lines: Optional[List[InvReturnLineCreate]] = None


class InvReturnOut(ORMModel):
    id: int
    return_number: str
    return_type: InvReturnType
    complaint_id: Optional[int] = None
    supplier_id: Optional[int] = None
    status: InvDocStatus
    return_date: date
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvReturnLineOut] = []


class InvTransferLineCreate(BaseModel):
    item_id: int
    qty: float
    batch_no: str = ""
    serial_no: str = ""
    expiry_date: Optional[date] = None
    from_location_id: int
    from_bin_id: int
    to_location_id: int
    to_bin_id: int


class InvTransferLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    batch_no: str
    serial_no: str
    expiry_date: Optional[date] = None
    from_location_id: int
    from_bin_id: int
    to_location_id: int
    to_bin_id: int


class InvTransferCreate(BaseModel):
    from_store_id: int
    to_store_id: int
    transfer_date: date
    notes: Optional[str] = None
    lines: List[InvTransferLineCreate] = []


class InvTransferUpdate(BaseModel):
    from_store_id: Optional[int] = None
    to_store_id: Optional[int] = None
    transfer_date: Optional[date] = None
    notes: Optional[str] = None
    lines: Optional[List[InvTransferLineCreate]] = None


class InvTransferOut(ORMModel):
    id: int
    transfer_number: str
    from_store_id: int
    to_store_id: int
    status: InvDocStatus
    transfer_date: date
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvTransferLineOut] = []


class InvAdjustmentLineCreate(BaseModel):
    item_id: int
    qty: float
    batch_no: str = ""
    serial_no: str = ""
    unit_cost: float = 0.0
    store_id: int
    location_id: int
    bin_id: int


class InvAdjustmentLineOut(ORMModel):
    id: int
    item_id: int
    qty: float
    batch_no: str
    serial_no: str
    unit_cost: float
    store_id: int
    location_id: int
    bin_id: int


class InvAdjustmentCreate(BaseModel):
    adjustment_type: InvAdjustmentType
    reason: Optional[str] = None
    adj_date: date
    lines: List[InvAdjustmentLineCreate] = []


class InvAdjustmentUpdate(BaseModel):
    adjustment_type: Optional[InvAdjustmentType] = None
    reason: Optional[str] = None
    adj_date: Optional[date] = None
    lines: Optional[List[InvAdjustmentLineCreate]] = None


class InvAdjustmentOut(ORMModel):
    id: int
    adj_number: str
    adjustment_type: InvAdjustmentType
    reason: Optional[str] = None
    status: InvDocStatus
    adj_date: date
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvAdjustmentLineOut] = []


# ---------------------------------------------------------------------------
# Dashboard & reports
# ---------------------------------------------------------------------------
class InvLowStockItem(BaseModel):
    item_id: int
    sku: str
    name: str
    available_qty: float
    reorder_level: float
    reorder_qty: float


class InvPendingDoc(BaseModel):
    id: int
    number: str
    status: str
    date: Optional[str] = None


class InvIssuedToJob(BaseModel):
    issue_id: int
    issue_number: str
    complaint_id: int
    complaint_no: str
    vehicle_number: Optional[str] = None
    qty: float
    total_cost: float


class InvRecentMove(BaseModel):
    id: int
    item_id: int
    item_name: str
    move_type: str
    qty: float
    total_cost: float
    document_no: Optional[str] = None
    created_at: datetime


class InvDashboardOut(BaseModel):
    total_stock_value: float
    low_stock: List[InvLowStockItem] = []
    out_of_stock: List[InvLowStockItem] = []
    pending_purchase_orders: List[InvPendingDoc] = []
    pending_goods_receipts: List[InvPendingDoc] = []
    issued_to_open_jobs: List[InvIssuedToJob] = []
    recent_movements: List[InvRecentMove] = []


class InvValuationRow(BaseModel):
    item_id: int
    sku: str
    name: str
    qty: float
    avg_cost: float
    total_value: float


class InvUsageRow(BaseModel):
    item_id: int
    sku: str
    name: str
    qty: float
    total_cost: float


class InvNonMovingRow(BaseModel):
    item_id: int
    sku: str
    name: str
    qty: float
    last_move_date: Optional[datetime] = None