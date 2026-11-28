from datetime import date, datetime
import enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InvDocStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    CANCELLED = "CANCELLED"


class InvMoveType(str, enum.Enum):
    RECEIPT = "RECEIPT"
    ISSUE = "ISSUE"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    RETURN_IN = "RETURN_IN"
    RETURN_OUT = "RETURN_OUT"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"


class InvReturnType(str, enum.Enum):
    FROM_JOB = "FROM_JOB"
    TO_SUPPLIER = "TO_SUPPLIER"


class InvAdjustmentType(str, enum.Enum):
    DAMAGE = "DAMAGE"
    WRITE_OFF = "WRITE_OFF"
    COUNT = "COUNT"
    OTHER = "OTHER"


# ---------------------------------------------------------------------------
# Configuration masters
# ---------------------------------------------------------------------------
class InvStore(Base):
    __tablename__ = "inv_stores"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    locations: Mapped[list["InvLocation"]] = relationship(
        "InvLocation", back_populates="store", cascade="all, delete-orphan"
    )


class InvLocation(Base):
    __tablename__ = "inv_locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    store: Mapped["InvStore"] = relationship("InvStore", back_populates="locations")
    bins: Mapped[list["InvBin"]] = relationship(
        "InvBin", back_populates="location", cascade="all, delete-orphan"
    )


class InvBin(Base):
    __tablename__ = "inv_bins"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("inv_locations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location: Mapped["InvLocation"] = relationship("InvLocation", back_populates="bins")


class InvCategory(Base):
    __tablename__ = "inv_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_categories.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvUnit(Base):
    __tablename__ = "inv_units"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvBrand(Base):
    __tablename__ = "inv_brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvSupplier(Base):
    __tablename__ = "inv_suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    credit_terms: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvTaxRate(Base):
    __tablename__ = "inv_tax_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    rate: Mapped[float] = mapped_column(Float, default=0.0, server_default="0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvItem(Base):
    __tablename__ = "inv_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    unit_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_units.id", ondelete="SET NULL"), nullable=True
    )
    brand_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_brands.id", ondelete="SET NULL"), nullable=True
    )
    default_supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_suppliers.id", ondelete="SET NULL"), nullable=True
    )
    tax_rate_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_tax_rates.id", ondelete="SET NULL"), nullable=True
    )
    purchase_price: Mapped[float] = mapped_column(Numeric(14, 4), default=0, server_default="0", nullable=False)
    reorder_level: Mapped[float] = mapped_column(Float, default=0, server_default="0", nullable=False)
    reorder_qty: Mapped[float] = mapped_column(Float, default=0, server_default="0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ---------------------------------------------------------------------------
# Stock balances & ledger
# ---------------------------------------------------------------------------
class InvStockBalance(Base):
    __tablename__ = "inv_stock_balances"
    __table_args__ = (
        UniqueConstraint(
            "item_id", "store_id", "location_id", "bin_id",
            "batch_no", "serial_no", "expiry_date",
            name="uq_inv_stock_balance_key",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="CASCADE"), index=True, nullable=False)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("inv_locations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="CASCADE"), index=True, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    qty: Mapped[float] = mapped_column(Float, default=0, server_default="0", nullable=False)
    avg_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0, server_default="0", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvStockMove(Base):
    __tablename__ = "inv_stock_moves"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="CASCADE"), index=True, nullable=False)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("inv_locations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="CASCADE"), index=True, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    move_type: Mapped[InvMoveType] = mapped_column(
        SQLEnum(InvMoveType), nullable=False, index=True
    )
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0, server_default="0", nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0, server_default="0", nullable=False)
    document_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    source_doc_type: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    source_doc_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


# ---------------------------------------------------------------------------
# Transaction documents
# ---------------------------------------------------------------------------
class InvPurchaseRequest(Base):
    __tablename__ = "inv_purchase_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    pr_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    requested_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvPurchaseRequestLine"]] = relationship(
        "InvPurchaseRequestLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvPurchaseRequestLine(Base):
    __tablename__ = "inv_purchase_request_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    pr_id: Mapped[int] = mapped_column(
        ForeignKey("inv_purchase_requests.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    est_unit_price: Mapped[float] = mapped_column(Numeric(14, 4), default=0, server_default="0", nullable=False)

    document: Mapped["InvPurchaseRequest"] = relationship("InvPurchaseRequest", back_populates="lines")


class InvPurchaseOrder(Base):
    __tablename__ = "inv_purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("inv_suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    expected_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    requested_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvPurchaseOrderLine"]] = relationship(
        "InvPurchaseOrderLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvPurchaseOrderLine(Base):
    __tablename__ = "inv_purchase_order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_id: Mapped[int] = mapped_column(
        ForeignKey("inv_purchase_orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 4), default=0, server_default="0", nullable=False)
    tax_rate_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_tax_rates.id", ondelete="SET NULL"), nullable=True
    )
    received_qty: Mapped[float] = mapped_column(Float, default=0, server_default="0", nullable=False)

    document: Mapped["InvPurchaseOrder"] = relationship("InvPurchaseOrder", back_populates="lines")


class InvGoodsReceipt(Base):
    __tablename__ = "inv_goods_receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    gr_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    po_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("inv_suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    received_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvGoodsReceiptLine"]] = relationship(
        "InvGoodsReceiptLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvGoodsReceiptLine(Base):
    __tablename__ = "inv_goods_receipt_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    gr_id: Mapped[int] = mapped_column(
        ForeignKey("inv_goods_receipts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    po_line_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_purchase_order_lines.id", ondelete="SET NULL"), nullable=True
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    unit_cost: Mapped[float] = mapped_column(Numeric(14,4), default=0, server_default="0", nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="RESTRICT"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("inv_locations.id", ondelete="RESTRICT"), nullable=False)
    bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="RESTRICT"), nullable=False)

    document: Mapped["InvGoodsReceipt"] = relationship("InvGoodsReceipt", back_populates="lines")


class InvIssue(Base):
    __tablename__ = "inv_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("vs_complaints.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    vehicle_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_vehicles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    issued_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvIssueLine"]] = relationship(
        "InvIssueLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvIssueLine(Base):
    __tablename__ = "inv_issue_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("inv_issues.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(14,4), default=0, server_default="0", nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="RESTRICT"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("inv_locations.id", ondelete="RESTRICT"), nullable=False)
    bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="RESTRICT"), nullable=False)

    document: Mapped["InvIssue"] = relationship("InvIssue", back_populates="lines")


class InvReturn(Base):
    __tablename__ = "inv_returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    return_type: Mapped[InvReturnType] = mapped_column(SQLEnum(InvReturnType), nullable=False, index=True)
    complaint_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vs_complaints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvReturnLine"]] = relationship(
        "InvReturnLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvReturnLine(Base):
    __tablename__ = "inv_return_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_id: Mapped[int] = mapped_column(
        ForeignKey("inv_returns.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(14,4), default=0, server_default="0", nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="RESTRICT"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("inv_locations.id", ondelete="RESTRICT"), nullable=False)
    bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="RESTRICT"), nullable=False)

    document: Mapped["InvReturn"] = relationship("InvReturn", back_populates="lines")


class InvTransfer(Base):
    __tablename__ = "inv_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    from_store_id: Mapped[int] = mapped_column(
        ForeignKey("inv_stores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    to_store_id: Mapped[int] = mapped_column(
        ForeignKey("inv_stores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False)
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvTransferLine"]] = relationship(
        "InvTransferLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvTransferLine(Base):
    __tablename__ = "inv_transfer_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_id: Mapped[int] = mapped_column(
        ForeignKey("inv_transfers.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    from_location_id: Mapped[int] = mapped_column(
        ForeignKey("inv_locations.id", ondelete="RESTRICT"), nullable=False
    )
    from_bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="RESTRICT"), nullable=False)
    to_location_id: Mapped[int] = mapped_column(
        ForeignKey("inv_locations.id", ondelete="RESTRICT"), nullable=False
    )
    to_bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="RESTRICT"), nullable=False)

    document: Mapped["InvTransfer"] = relationship("InvTransfer", back_populates="lines")


class InvAdjustment(Base):
    __tablename__ = "inv_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    adj_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    adjustment_type: Mapped[InvAdjustmentType] = mapped_column(
        SQLEnum(InvAdjustmentType), nullable=False, index=True
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[InvDocStatus] = mapped_column(
        SQLEnum(InvDocStatus), default=InvDocStatus.DRAFT, nullable=False, index=True
    )
    adj_date: Mapped[date] = mapped_column(Date, nullable=False)
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["InvAdjustmentLine"]] = relationship(
        "InvAdjustmentLine", back_populates="document", cascade="all, delete-orphan"
    )


class InvAdjustmentLine(Base):
    __tablename__ = "inv_adjustment_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    adj_id: Mapped[int] = mapped_column(
        ForeignKey("inv_adjustments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inv_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    batch_no: Mapped[str] = mapped_column(String(60), default="", server_default="", nullable=False)
    serial_no: Mapped[str] = mapped_column(String(80), default="", server_default="", nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(14,4), default=0, server_default="0", nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("inv_stores.id", ondelete="RESTRICT"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("inv_locations.id", ondelete="RESTRICT"), nullable=False)
    bin_id: Mapped[int] = mapped_column(ForeignKey("inv_bins.id", ondelete="RESTRICT"), nullable=False)

    document: Mapped["InvAdjustment"] = relationship("InvAdjustment", back_populates="lines")