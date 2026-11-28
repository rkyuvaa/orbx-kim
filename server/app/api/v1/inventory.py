"""Inventory module API (vehicle-service spare parts & consumables)."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.inventory import (
    InvAdjustment,
    InvAdjustmentType,
    InvBin,
    InvBrand,
    InvCategory,
    InvDocStatus,
    InvGoodsReceipt,
    InvIssue,
    InvItem,
    InvLocation,
    InvPurchaseOrder,
    InvPurchaseRequest,
    InvReturn,
    InvReturnType,
    InvStockBalance,
    InvStockMove,
    InvStore,
    InvSupplier,
    InvTaxRate,
    InvTransfer,
    InvUnit,
)
from app.models.user import User
from app.models.vehicle_service import VSComplaint
from app.schemas.inventory import (
    InvAdjustmentCreate,
    InvAdjustmentOut,
    InvAdjustmentUpdate,
    InvBinCreate,
    InvBinOut,
    InvBinUpdate,
    InvBrandCreate,
    InvBrandOut,
    InvBrandUpdate,
    InvCategoryCreate,
    InvCategoryOut,
    InvCategoryUpdate,
    InvDashboardOut,
    InvGoodsReceiptCreate,
    InvGoodsReceiptOut,
    InvGoodsReceiptUpdate,
    InvIssuedToJob,
    InvIssueCreate,
    InvIssueOut,
    InvIssueUpdate,
    InvItemCreate,
    InvItemOut,
    InvItemUpdate,
    InvLocationCreate,
    InvLocationOut,
    InvLocationUpdate,
    InvLowStockItem,
    InvNonMovingRow,
    InvPendingDoc,
    InvPurchaseOrderCreate,
    InvPurchaseOrderOut,
    InvPurchaseOrderUpdate,
    InvPurchaseRequestCreate,
    InvPurchaseRequestOut,
    InvPurchaseRequestUpdate,
    InvRecentMove,
    InvReturnCreate,
    InvReturnOut,
    InvReturnUpdate,
    InvStockBalanceOut,
    InvStockMoveOut,
    InvStoreCreate,
    InvStoreOut,
    InvStoreUpdate,
    InvSupplierCreate,
    InvSupplierOut,
    InvSupplierUpdate,
    InvTaxRateCreate,
    InvTaxRateOut,
    InvTaxRateUpdate,
    InvTransferCreate,
    InvTransferOut,
    InvTransferUpdate,
    InvUnitCreate,
    InvUnitOut,
    InvUnitUpdate,
    InvUsageRow,
    InvValuationRow,
)
from app.services.document_numbering import generate_next_document_number
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ===========================================================================
# Configuration masters
# ===========================================================================
@router.get("/stores", response_model=List[InvStoreOut])
def list_stores(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    return db.query(InvStore).order_by(InvStore.name.asc()).all()


@router.post("/stores", response_model=InvStoreOut, status_code=status.HTTP_201_CREATED)
def create_store(
    payload: InvStoreCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    if db.query(InvStore).filter(InvStore.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Store code already exists")
    obj = InvStore(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/stores/{store_id}", response_model=InvStoreOut)
def update_store(
    store_id: int,
    payload: InvStoreUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvStore, store_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Store not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/stores/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store(
    store_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvStore, store_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Store not found")
    db.delete(obj)
    db.commit()


@router.get("/locations", response_model=List[InvLocationOut])
def list_locations(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    q = db.query(InvLocation)
    if store_id is not None:
        q = q.filter(InvLocation.store_id == store_id)
    return q.order_by(InvLocation.name.asc()).all()


@router.post("/locations", response_model=InvLocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: InvLocationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    obj = InvLocation(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/locations/{location_id}", response_model=InvLocationOut)
def update_location(
    location_id: int,
    payload: InvLocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvLocation, location_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Location not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvLocation, location_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(obj)
    db.commit()


@router.get("/bins", response_model=List[InvBinOut])
def list_bins(
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    q = db.query(InvBin)
    if location_id is not None:
        q = q.filter(InvBin.location_id == location_id)
    return q.order_by(InvBin.name.asc()).all()


@router.post("/bins", response_model=InvBinOut, status_code=status.HTTP_201_CREATED)
def create_bin(
    payload: InvBinCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    obj = InvBin(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/bins/{bin_id}", response_model=InvBinOut)
def update_bin(
    bin_id: int,
    payload: InvBinUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvBin, bin_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/bins/{bin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bin(
    bin_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvBin, bin_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    db.delete(obj)
    db.commit()


@router.get("/categories", response_model=List[InvCategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    return db.query(InvCategory).order_by(InvCategory.name.asc()).all()


@router.post("/categories", response_model=InvCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: InvCategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    if db.query(InvCategory).filter(InvCategory.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Category code already exists")
    obj = InvCategory(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/categories/{category_id}", response_model=InvCategoryOut)
def update_category(
    category_id: int,
    payload: InvCategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvCategory, category_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvCategory, category_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(obj)
    db.commit()


@router.get("/units", response_model=List[InvUnitOut])
def list_units(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    return db.query(InvUnit).order_by(InvUnit.name.asc()).all()


@router.post("/units", response_model=InvUnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(
    payload: InvUnitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    if db.query(InvUnit).filter(InvUnit.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Unit code already exists")
    obj = InvUnit(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/units/{unit_id}", response_model=InvUnitOut)
def update_unit(
    unit_id: int,
    payload: InvUnitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvUnit, unit_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Unit not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvUnit, unit_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Unit not found")
    db.delete(obj)
    db.commit()


@router.get("/brands", response_model=List[InvBrandOut])
def list_brands(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    return db.query(InvBrand).order_by(InvBrand.name.asc()).all()


@router.post("/brands", response_model=InvBrandOut, status_code=status.HTTP_201_CREATED)
def create_brand(
    payload: InvBrandCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    obj = InvBrand(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/brands/{brand_id}", response_model=InvBrandOut)
def update_brand(
    brand_id: int,
    payload: InvBrandUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvBrand, brand_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Brand not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvBrand, brand_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Brand not found")
    db.delete(obj)
    db.commit()


@router.get("/suppliers", response_model=List[InvSupplierOut])
def list_suppliers(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    q = db.query(InvSupplier)
    if search:
        s = f"%{search}%"
        q = q.filter(or_(InvSupplier.name.ilike(s), InvSupplier.code.ilike(s)))
    return q.order_by(InvSupplier.name.asc()).all()


@router.post("/suppliers", response_model=InvSupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: InvSupplierCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    if db.query(InvSupplier).filter(InvSupplier.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Supplier code already exists")
    obj = InvSupplier(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/suppliers/{supplier_id}", response_model=InvSupplierOut)
def update_supplier(
    supplier_id: int,
    payload: InvSupplierUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvSupplier, supplier_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvSupplier, supplier_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(obj)
    db.commit()


@router.get("/tax-rates", response_model=List[InvTaxRateOut])
def list_tax_rates(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_configuration")),
):
    return db.query(InvTaxRate).order_by(InvTaxRate.name.asc()).all()


@router.post("/tax-rates", response_model=InvTaxRateOut, status_code=status.HTTP_201_CREATED)
def create_tax_rate(
    payload: InvTaxRateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_configuration")),
):
    obj = InvTaxRate(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/tax-rates/{tax_id}", response_model=InvTaxRateOut)
def update_tax_rate(
    tax_id: int,
    payload: InvTaxRateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_configuration")),
):
    obj = db.get(InvTaxRate, tax_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Tax rate not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/tax-rates/{tax_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_rate(
    tax_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_configuration")),
):
    obj = db.get(InvTaxRate, tax_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Tax rate not found")
    db.delete(obj)
    db.commit()


# ===========================================================================
# Item master (parts & consumables catalogue)
# ===========================================================================
@router.get("/items", response_model=List[InvItemOut])
def list_items(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_stock")),
):
    q = db.query(InvItem)
    if is_active is not None:
        q = q.filter(InvItem.is_active == is_active)
    if category_id is not None:
        q = q.filter(InvItem.category_id == category_id)
    if search:
        s = f"%{search}%"
        q = q.filter(or_(InvItem.name.ilike(s), InvItem.sku.ilike(s)))
    return q.order_by(InvItem.name.asc()).all()


@router.post("/items", response_model=InvItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: InvItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_stock")),
):
    if db.query(InvItem).filter(InvItem.sku == payload.sku).first():
        raise HTTPException(status_code=400, detail="SKU already exists")
    obj = InvItem(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/items/{item_id}", response_model=InvItemOut)
def update_item(
    item_id: int,
    payload: InvItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_stock")),
):
    obj = db.get(InvItem, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "inv_stock")),
):
    obj = db.get(InvItem, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(obj)
    db.commit()


# ===========================================================================
# Stock balances & movement history
# ===========================================================================
@router.get("/stock/balances", response_model=List[InvStockBalanceOut])
def list_balances(
    item_id: Optional[int] = None,
    store_id: Optional[int] = None,
    low_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_stock")),
):
    q = db.query(InvStockBalance)
    if item_id is not None:
        q = q.filter(InvStockBalance.item_id == item_id)
    if store_id is not None:
        q = q.filter(InvStockBalance.store_id == store_id)
    rows = q.order_by(InvStockBalance.item_id.asc()).all()
    if low_only:
        by_item = inventory_service.available_qty_by_item(db)
        rows = [
            r
            for r in rows
            if r.item_id in by_item
            and r.qty > 0
        ]
    return rows


@router.get("/stock/moves", response_model=List[InvStockMoveOut])
def list_moves(
    item_id: Optional[int] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_stock")),
):
    q = db.query(InvStockMove)
    if item_id is not None:
        q = q.filter(InvStockMove.item_id == item_id)
    return q.order_by(InvStockMove.id.desc()).limit(limit).all()


# ===========================================================================
# Transaction helpers
# ===========================================================================
def _get_doc(db, model, doc_id, not_found: str):
    obj = db.get(model, doc_id)
    if not obj:
        raise HTTPException(status_code=404, detail=not_found)
    return obj


def _assert_editable(obj):
    if obj.status != InvDocStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft documents can be edited")


def _submit(obj):
    if obj.status != InvDocStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft documents can be submitted")
    obj.status = InvDocStatus.PENDING_APPROVAL


def _cancel(obj):
    if obj.status not in (InvDocStatus.DRAFT, InvDocStatus.PENDING_APPROVAL):
        raise HTTPException(status_code=400, detail="Only draft/pending documents can be cancelled")
    obj.status = InvDocStatus.CANCELLED


# ---------------------------------------------------------------------------
# Purchase requests
# ---------------------------------------------------------------------------
@router.get("/purchase-requests", response_model=List[InvPurchaseRequestOut])
def list_prs(
    status_filter: Optional[InvDocStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvPurchaseRequest)
    if status_filter is not None:
        q = q.filter(InvPurchaseRequest.status == status_filter)
    return q.order_by(InvPurchaseRequest.id.desc()).all()


@router.post("/purchase-requests", response_model=InvPurchaseRequestOut, status_code=201)
def create_pr(
    payload: InvPurchaseRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvPurchaseRequestLine

    number = generate_next_document_number(
        db, "purchase_request", default_prefix="PR-", default_padding=4
    )
    obj = InvPurchaseRequest(
        pr_number=number,
        supplier_id=payload.supplier_id,
        notes=payload.notes,
        status=InvDocStatus.DRAFT,
        requested_by_id=user.id,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvPurchaseRequestLine(pr_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/purchase-requests/{pr_id}", response_model=InvPurchaseRequestOut)
def update_pr(
    pr_id: int,
    payload: InvPurchaseRequestUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvPurchaseRequestLine

    obj = _get_doc(db, InvPurchaseRequest, pr_id, "Purchase request not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvPurchaseRequestLine(pr_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/purchase-requests/{pr_id}/submit", response_model=InvPurchaseRequestOut)
def submit_pr(
    pr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvPurchaseRequest, pr_id, "Purchase request not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/purchase-requests/{pr_id}/approve", response_model=InvPurchaseRequestOut)
def approve_pr(
    pr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvPurchaseRequest, pr_id, "Purchase request not found")
    if obj.status not in (InvDocStatus.DRAFT, InvDocStatus.PENDING_APPROVAL):
        raise HTTPException(status_code=400, detail="Document already processed")
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/purchase-requests/{pr_id}/cancel", response_model=InvPurchaseRequestOut)
def cancel_pr(
    pr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvPurchaseRequest, pr_id, "Purchase request not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------------------------------------------------------
# Purchase orders
# ---------------------------------------------------------------------------
@router.get("/purchase-orders", response_model=List[InvPurchaseOrderOut])
def list_pos(
    status_filter: Optional[InvDocStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvPurchaseOrder)
    if status_filter is not None:
        q = q.filter(InvPurchaseOrder.status == status_filter)
    return q.order_by(InvPurchaseOrder.id.desc()).all()


@router.post("/purchase-orders", response_model=InvPurchaseOrderOut, status_code=201)
def create_po(
    payload: InvPurchaseOrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvPurchaseOrderLine

    number = generate_next_document_number(
        db, "purchase_order", default_prefix="PO-", default_padding=4
    )
    obj = InvPurchaseOrder(
        po_number=number,
        supplier_id=payload.supplier_id,
        expected_date=payload.expected_date,
        notes=payload.notes,
        status=InvDocStatus.DRAFT,
        requested_by_id=user.id,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvPurchaseOrderLine(po_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/purchase-orders/{po_id}", response_model=InvPurchaseOrderOut)
def update_po(
    po_id: int,
    payload: InvPurchaseOrderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvPurchaseOrderLine

    obj = _get_doc(db, InvPurchaseOrder, po_id, "Purchase order not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvPurchaseOrderLine(po_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/purchase-orders/{po_id}/submit", response_model=InvPurchaseOrderOut)
def submit_po(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvPurchaseOrder, po_id, "Purchase order not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/purchase-orders/{po_id}/approve", response_model=InvPurchaseOrderOut)
def approve_po(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvPurchaseOrder, po_id, "Purchase order not found")
    if obj.status not in (InvDocStatus.DRAFT, InvDocStatus.PENDING_APPROVAL):
        raise HTTPException(status_code=400, detail="Document already processed")
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/purchase-orders/{po_id}/cancel", response_model=InvPurchaseOrderOut)
def cancel_po(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvPurchaseOrder, po_id, "Purchase order not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------------------------------------------------------
# Goods receipts
# ---------------------------------------------------------------------------
@router.get("/goods-receipts", response_model=List[InvGoodsReceiptOut])
def list_grs(
    status_filter: Optional[InvDocStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvGoodsReceipt)
    if status_filter is not None:
        q = q.filter(InvGoodsReceipt.status == status_filter)
    return q.order_by(InvGoodsReceipt.id.desc()).all()


@router.post("/goods-receipts", response_model=InvGoodsReceiptOut, status_code=201)
def create_gr(
    payload: InvGoodsReceiptCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvGoodsReceiptLine

    number = generate_next_document_number(
        db, "goods_receipt", default_prefix="GR-", default_padding=4
    )
    obj = InvGoodsReceipt(
        gr_number=number,
        po_id=payload.po_id,
        supplier_id=payload.supplier_id,
        receipt_date=payload.receipt_date,
        notes=payload.notes,
        status=InvDocStatus.DRAFT,
        received_by_id=user.id,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvGoodsReceiptLine(gr_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/goods-receipts/{gr_id}", response_model=InvGoodsReceiptOut)
def update_gr(
    gr_id: int,
    payload: InvGoodsReceiptUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvGoodsReceiptLine

    obj = _get_doc(db, InvGoodsReceipt, gr_id, "Goods receipt not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvGoodsReceiptLine(gr_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/goods-receipts/{gr_id}/submit", response_model=InvGoodsReceiptOut)
def submit_gr(
    gr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvGoodsReceipt, gr_id, "Goods receipt not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/goods-receipts/{gr_id}/approve", response_model=InvGoodsReceiptOut)
def approve_gr(
    gr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvGoodsReceipt, gr_id, "Goods receipt not found")
    if obj.status == InvDocStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Document already approved")
    if obj.status == InvDocStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled document cannot be approved")
    try:
        inventory_service.post_goods_receipt(db, obj, user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/goods-receipts/{gr_id}/cancel", response_model=InvGoodsReceiptOut)
def cancel_gr(
    gr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvGoodsReceipt, gr_id, "Goods receipt not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------------------------------------------------------
# Issues (parts issued to a service job)
# ---------------------------------------------------------------------------
@router.get("/issues", response_model=List[InvIssueOut])
def list_issues(
    status_filter: Optional[InvDocStatus] = None,
    complaint_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvIssue)
    if status_filter is not None:
        q = q.filter(InvIssue.status == status_filter)
    if complaint_id is not None:
        q = q.filter(InvIssue.complaint_id == complaint_id)
    return q.order_by(InvIssue.id.desc()).all()


@router.post("/issues", response_model=InvIssueOut, status_code=201)
def create_issue(
    payload: InvIssueCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvIssueLine

    complaint = db.get(VSComplaint, payload.complaint_id)
    if not complaint:
        raise HTTPException(status_code=400, detail="Service job (complaint) not found")
    number = generate_next_document_number(
        db, "stock_issue", default_prefix="IS-", default_padding=4
    )
    vehicle_id = payload.vehicle_id or complaint.vehicle_id
    obj = InvIssue(
        issue_number=number,
        complaint_id=payload.complaint_id,
        vehicle_id=vehicle_id,
        issue_date=payload.issue_date,
        notes=payload.notes,
        status=InvDocStatus.DRAFT,
        issued_by_id=user.id,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvIssueLine(issue_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/issues/{issue_id}", response_model=InvIssueOut)
def update_issue(
    issue_id: int,
    payload: InvIssueUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvIssueLine

    obj = _get_doc(db, InvIssue, issue_id, "Issue not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvIssueLine(issue_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/issues/{issue_id}/submit", response_model=InvIssueOut)
def submit_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvIssue, issue_id, "Issue not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/issues/{issue_id}/approve", response_model=InvIssueOut)
def approve_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvIssue, issue_id, "Issue not found")
    if obj.status == InvDocStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Document already approved")
    if obj.status == InvDocStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled document cannot be approved")
    try:
        inventory_service.post_issue(db, obj, user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/issues/{issue_id}/cancel", response_model=InvIssueOut)
def cancel_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvIssue, issue_id, "Issue not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------------------------------------------------------
# Returns
# ---------------------------------------------------------------------------
@router.get("/returns", response_model=List[InvReturnOut])
def list_returns(
    status_filter: Optional[InvDocStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvReturn)
    if status_filter is not None:
        q = q.filter(InvReturn.status == status_filter)
    return q.order_by(InvReturn.id.desc()).all()


@router.post("/returns", response_model=InvReturnOut, status_code=201)
def create_return(
    payload: InvReturnCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvReturnLine

    number = generate_next_document_number(
        db, "stock_return", default_prefix="RT-", default_padding=4
    )
    obj = InvReturn(
        return_number=number,
        return_type=payload.return_type,
        complaint_id=payload.complaint_id,
        supplier_id=payload.supplier_id,
        return_date=payload.return_date,
        notes=payload.notes,
        status=InvDocStatus.DRAFT,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvReturnLine(return_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/returns/{return_id}", response_model=InvReturnOut)
def update_return(
    return_id: int,
    payload: InvReturnUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvReturnLine

    obj = _get_doc(db, InvReturn, return_id, "Return not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvReturnLine(return_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/returns/{return_id}/submit", response_model=InvReturnOut)
def submit_return(
    return_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvReturn, return_id, "Return not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/returns/{return_id}/approve", response_model=InvReturnOut)
def approve_return(
    return_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvReturn, return_id, "Return not found")
    if obj.status == InvDocStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Document already approved")
    if obj.status == InvDocStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled document cannot be approved")
    try:
        inventory_service.post_return(db, obj, user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/returns/{return_id}/cancel", response_model=InvReturnOut)
def cancel_return(
    return_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvReturn, return_id, "Return not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------
@router.get("/transfers", response_model=List[InvTransferOut])
def list_transfers(
    status_filter: Optional[InvDocStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvTransfer)
    if status_filter is not None:
        q = q.filter(InvTransfer.status == status_filter)
    return q.order_by(InvTransfer.id.desc()).all()


@router.post("/transfers", response_model=InvTransferOut, status_code=201)
def create_transfer(
    payload: InvTransferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvTransferLine

    if payload.from_store_id == payload.to_store_id:
        raise HTTPException(status_code=400, detail="Source and destination store must differ")
    number = generate_next_document_number(
        db, "stock_transfer", default_prefix="TR-", default_padding=4
    )
    obj = InvTransfer(
        transfer_number=number,
        from_store_id=payload.from_store_id,
        to_store_id=payload.to_store_id,
        transfer_date=payload.transfer_date,
        notes=payload.notes,
        status=InvDocStatus.DRAFT,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvTransferLine(transfer_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/transfers/{transfer_id}", response_model=InvTransferOut)
def update_transfer(
    transfer_id: int,
    payload: InvTransferUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvTransferLine

    obj = _get_doc(db, InvTransfer, transfer_id, "Transfer not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvTransferLine(transfer_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/transfers/{transfer_id}/submit", response_model=InvTransferOut)
def submit_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvTransfer, transfer_id, "Transfer not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/transfers/{transfer_id}/approve", response_model=InvTransferOut)
def approve_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvTransfer, transfer_id, "Transfer not found")
    if obj.status == InvDocStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Document already approved")
    if obj.status == InvDocStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled document cannot be approved")
    try:
        inventory_service.post_transfer(db, obj, user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/transfers/{transfer_id}/cancel", response_model=InvTransferOut)
def cancel_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvTransfer, transfer_id, "Transfer not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------------------------------------------------------
# Adjustments
# ---------------------------------------------------------------------------
@router.get("/adjustments", response_model=List[InvAdjustmentOut])
def list_adjustments(
    status_filter: Optional[InvDocStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_transactions")),
):
    q = db.query(InvAdjustment)
    if status_filter is not None:
        q = q.filter(InvAdjustment.status == status_filter)
    return q.order_by(InvAdjustment.id.desc()).all()


@router.post("/adjustments", response_model=InvAdjustmentOut, status_code=201)
def create_adjustment(
    payload: InvAdjustmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "inv_transactions")),
):
    from app.models.inventory import InvAdjustmentLine

    number = generate_next_document_number(
        db, "stock_adjustment", default_prefix="AD-", default_padding=4
    )
    obj = InvAdjustment(
        adj_number=number,
        adjustment_type=payload.adjustment_type,
        reason=payload.reason,
        adj_date=payload.adj_date,
        status=InvDocStatus.DRAFT,
    )
    db.add(obj)
    db.flush()
    for ln in payload.lines:
        db.add(InvAdjustmentLine(adj_id=obj.id, **ln.model_dump()))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/adjustments/{adj_id}", response_model=InvAdjustmentOut)
def update_adjustment(
    adj_id: int,
    payload: InvAdjustmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    from app.models.inventory import InvAdjustmentLine

    obj = _get_doc(db, InvAdjustment, adj_id, "Adjustment not found")
    _assert_editable(obj)
    data = payload.model_dump(exclude_unset=True)
    lines = data.pop("lines", None)
    for k, v in data.items():
        setattr(obj, k, v)
    if lines is not None:
        obj.lines.clear()
        db.flush()
        for ln in lines:
            db.add(InvAdjustmentLine(adj_id=obj.id, **ln))
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/adjustments/{adj_id}/submit", response_model=InvAdjustmentOut)
def submit_adjustment(
    adj_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvAdjustment, adj_id, "Adjustment not found")
    _submit(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/adjustments/{adj_id}/approve", response_model=InvAdjustmentOut)
def approve_adjustment(
    adj_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approve", "inv_transactions")),
):
    obj = _get_doc(db, InvAdjustment, adj_id, "Adjustment not found")
    if obj.status == InvDocStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Document already approved")
    if obj.status == InvDocStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled document cannot be approved")
    try:
        inventory_service.post_adjustment(db, obj, user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    obj.status = InvDocStatus.APPROVED
    obj.approved_by_id = user.id
    obj.approved_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/adjustments/{adj_id}/cancel", response_model=InvAdjustmentOut)
def cancel_adjustment(
    adj_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "inv_transactions")),
):
    obj = _get_doc(db, InvAdjustment, adj_id, "Adjustment not found")
    _cancel(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ===========================================================================
# Dashboard
# ===========================================================================
@router.get("/dashboard", response_model=InvDashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_dashboard")),
):
    from app.models.inventory import InvIssueLine

    by_item = inventory_service.available_qty_by_item(db)
    items = {i.id: i for i in db.query(InvItem).all()}

    low_stock: List[InvLowStockItem] = []
    out_of_stock: List[InvLowStockItem] = []
    for item_id, qty in by_item.items():
        item = items.get(item_id)
        if not item:
            continue
        if qty <= 0:
            out_of_stock.append(
                InvLowStockItem(
                    item_id=item.id, sku=item.sku, name=item.name,
                    available_qty=qty, reorder_level=item.reorder_level,
                    reorder_qty=item.reorder_qty,
                )
            )
        elif item.reorder_level and qty <= item.reorder_level:
            low_stock.append(
                InvLowStockItem(
                    item_id=item.id, sku=item.sku, name=item.name,
                    available_qty=qty, reorder_level=item.reorder_level,
                    reorder_qty=item.reorder_qty,
                )
            )

    pending_pos = [
        InvPendingDoc(id=p.id, number=p.po_number, status=p.status.value,
                      date=p.expected_date.isoformat() if p.expected_date else None)
        for p in db.query(InvPurchaseOrder)
        .filter(InvPurchaseOrder.status == InvDocStatus.PENDING_APPROVAL)
        .all()
    ]
    pending_grs = [
        InvPendingDoc(id=g.id, number=g.gr_number, status=g.status.value,
                      date=g.receipt_date.isoformat() if g.receipt_date else None)
        for g in db.query(InvGoodsReceipt)
        .filter(InvGoodsReceipt.status == InvDocStatus.PENDING_APPROVAL)
        .all()
    ]

    # Parts issued to open service jobs
    open_statuses = ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"]
    issued_rows = (
        db.query(InvIssueLine, InvIssue, VSComplaint)
        .join(InvIssue, InvIssueLine.issue_id == InvIssue.id)
        .join(VSComplaint, InvIssue.complaint_id == VSComplaint.id)
        .filter(InvIssue.status == InvDocStatus.APPROVED)
        .filter(VSComplaint.status.in_(open_statuses))
        .all()
    )
    issued_map: dict[int, InvIssuedToJob] = {}
    for line, issue, complaint in issued_rows:
        key = issue.id
        if key not in issued_map:
            issued_map[key] = InvIssuedToJob(
                issue_id=issue.id,
                issue_number=issue.issue_number,
                complaint_id=complaint.id,
                complaint_no=complaint.complaint_no,
                vehicle_number=None,
                qty=0.0,
                total_cost=0.0,
            )
        issued_map[key].qty += float(line.qty)
        issued_map[key].total_cost += float(line.unit_cost) * float(line.qty)

    recent = [
        InvRecentMove(
            id=m.id, item_id=m.item_id,
            item_name=items[m.item_id].name if m.item_id in items else str(m.item_id),
            move_type=m.move_type.value, qty=m.qty,
            total_cost=float(m.total_cost), document_no=m.document_no,
            created_at=m.created_at,
        )
        for m in db.query(InvStockMove).order_by(InvStockMove.id.desc()).limit(10).all()
    ]

    return InvDashboardOut(
        total_stock_value=inventory_service.stock_value(db),
        low_stock=low_stock,
        out_of_stock=out_of_stock,
        pending_purchase_orders=pending_pos,
        pending_goods_receipts=pending_grs,
        issued_to_open_jobs=list(issued_map.values()),
        recent_movements=recent,
    )


# ===========================================================================
# Reports
# ===========================================================================
@router.get("/reports/valuation", response_model=List[InvValuationRow])
def report_valuation(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_reports")),
):
    rows = []
    items = {i.id: i for i in db.query(InvItem).all()}
    agg: dict[int, float] = {}
    val: dict[int, float] = {}
    for bal in db.query(InvStockBalance).all():
        agg[bal.item_id] = agg.get(bal.item_id, 0.0) + float(bal.qty or 0)
        val[bal.item_id] = val.get(bal.item_id, 0.0) + float(bal.qty or 0) * float(bal.avg_cost or 0)
    for item_id, qty in agg.items():
        item = items.get(item_id)
        if not item:
            continue
        avg = (val[item_id] / qty) if qty else 0.0
        rows.append(
            InvValuationRow(
                item_id=item.id, sku=item.sku, name=item.name,
                qty=qty, avg_cost=avg, total_value=val[item_id],
            )
        )
    return rows


@router.get("/reports/low-stock", response_model=List[InvLowStockItem])
def report_low_stock(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_reports")),
):
    by_item = inventory_service.available_qty_by_item(db)
    items = {i.id: i for i in db.query(InvItem).filter(InvItem.is_active == True).all()}  # noqa: E712
    out = []
    for item_id, item in items.items():
        qty = by_item.get(item_id, 0.0)
        if qty <= 0 or (item.reorder_level and qty <= item.reorder_level):
            out.append(
                InvLowStockItem(
                    item_id=item.id, sku=item.sku, name=item.name,
                    available_qty=qty, reorder_level=item.reorder_level,
                    reorder_qty=item.reorder_qty,
                )
            )
    return out


@router.get("/reports/non-moving", response_model=List[InvNonMovingRow])
def report_non_moving(
    days: int = Query(90, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_reports")),
):
    from datetime import timedelta

    cutoff = _now() - timedelta(days=days)
    last_move: dict[int, datetime] = {}
    for m in db.query(InvStockMove).filter(InvStockMove.created_at >= cutoff).all():
        last_move[m.item_id] = m.created_at
    by_item = inventory_service.available_qty_by_item(db)
    items = {i.id: i for i in db.query(InvItem).all()}
    out = []
    for item_id, qty in by_item.items():
        if qty <= 0:
            continue
        item = items.get(item_id)
        if not item:
            continue
        if item_id not in last_move:
            out.append(
                InvNonMovingRow(
                    item_id=item.id, sku=item.sku, name=item.name,
                    qty=qty, last_move_date=None,
                )
            )
    return out


@router.get("/reports/usage", response_model=List[InvUsageRow])
def report_usage(
    complaint_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_reports")),
):
    from app.models.inventory import InvIssueLine

    q = (
        db.query(InvIssueLine.item_id, InvIssueLine.qty, InvIssueLine.unit_cost)
        .join(InvIssue, InvIssueLine.issue_id == InvIssue.id)
        .filter(InvIssue.status == InvDocStatus.APPROVED)
    )
    if complaint_id is not None:
        q = q.filter(InvIssue.complaint_id == complaint_id)
    items = {i.id: i for i in db.query(InvItem).all()}
    agg: dict[int, tuple[float, float]] = {}
    for item_id, qty, cost in q.all():
        q_v, c_v = agg.get(item_id, (0.0, 0.0))
        agg[item_id] = (q_v + float(qty), c_v + float(cost) * float(qty))
    out = []
    for item_id, (qty, cost) in agg.items():
        item = items.get(item_id)
        out.append(
            InvUsageRow(
                item_id=item_id,
                sku=item.sku if item else str(item_id),
                name=item.name if item else str(item_id),
                qty=qty, total_cost=cost,
            )
        )
    return out


@router.get("/reports/purchase-history", response_model=List[InvGoodsReceiptOut])
def report_purchase_history(
    supplier_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_reports")),
):
    q = db.query(InvGoodsReceipt).filter(InvGoodsReceipt.status == InvDocStatus.APPROVED)
    if supplier_id is not None:
        q = q.filter(InvGoodsReceipt.supplier_id == supplier_id)
    return q.order_by(InvGoodsReceipt.id.desc()).all()


@router.get("/reports/returns-adjustments", response_model=List[dict])
def report_returns_adjustments(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "inv_reports")),
):
    out: List[dict] = []
    for r in db.query(InvReturn).filter(InvReturn.status == InvDocStatus.APPROVED).all():
        out.append({
            "type": "return",
            "number": r.return_number,
            "return_type": r.return_type.value,
            "date": r.return_date.isoformat() if r.return_date else None,
        })
    for a in db.query(InvAdjustment).filter(InvAdjustment.status == InvDocStatus.APPROVED).all():
        out.append({
            "type": "adjustment",
            "number": a.adj_number,
            "adjustment_type": a.adjustment_type.value,
            "date": a.adj_date.isoformat() if a.adj_date else None,
        })
    return out