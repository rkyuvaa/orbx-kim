"""Inventory posting and valuation logic.

All stock mutations run inside the caller's DB transaction. Weighted-average
cost is maintained per stock-balance key (item/store/location/bin/batch/serial/
expiry). Every mutation appends an immutable ``InvStockMove`` ledger row.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.inventory import (
    InvAdjustment,
    InvGoodsReceipt,
    InvIssue,
    InvMoveType,
    InvReturn,
    InvReturnType,
    InvStockBalance,
    InvStockMove,
    InvTransfer,
)
from app.models.vehicle_service import VSServiceCost


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lock_balance(
    db: Session,
    item_id: int,
    store_id: int,
    location_id: int,
    bin_id: int,
    batch_no: str,
    serial_no: str,
    expiry_date,
) -> InvStockBalance:
    query = db.query(InvStockBalance).filter(
        InvStockBalance.item_id == item_id,
        InvStockBalance.store_id == store_id,
        InvStockBalance.location_id == location_id,
        InvStockBalance.bin_id == bin_id,
        InvStockBalance.batch_no == (batch_no or ""),
        InvStockBalance.serial_no == (serial_no or ""),
        InvStockBalance.expiry_date.is_(expiry_date)
        if expiry_date is not None
        else InvStockBalance.expiry_date.is_(None),
    )
    bind = db.get_bind()
    if bind is not None and bind.dialect.name != "sqlite":
        query = query.with_for_update()

    bal = query.first()
    if bal is None:
        bal = InvStockBalance(
            item_id=item_id,
            store_id=store_id,
            location_id=location_id,
            bin_id=bin_id,
            batch_no=batch_no or "",
            serial_no=serial_no or "",
            expiry_date=expiry_date,
            qty=0,
            avg_cost=0,
        )
        db.add(bal)
        db.flush()
    return bal


def apply_delta(
    db: Session,
    *,
    item_id: int,
    store_id: int,
    location_id: int,
    bin_id: int,
    batch_no: str,
    serial_no: str,
    expiry_date,
    delta_qty: float,
    in_cost: Optional[float],
    move_type: InvMoveType,
    document_no: Optional[str],
    source_doc_type: Optional[str],
    source_doc_id: Optional[int],
    created_by_id: Optional[int],
) -> float:
    """Apply a signed stock delta and append a ledger move.

    Returns the unit cost used for the move (inward -> supplied cost,
    outward -> current weighted-average cost). Raises ValueError on
    insufficient stock for outward moves.
    """

    bal = _lock_balance(
        db, item_id, store_id, location_id, bin_id, batch_no, serial_no, expiry_date
    )

    if delta_qty >= 0:
        cost = float(in_cost or 0)
        new_qty = bal.qty + delta_qty
        if new_qty > 0:
            new_avg = (bal.qty * float(bal.avg_cost) + delta_qty * cost) / new_qty
        else:
            new_avg = cost
        bal.qty = new_qty
        bal.avg_cost = new_avg
        unit_cost = cost
    else:
        out_qty = -delta_qty
        if bal.qty + 1e-9 < out_qty:
            raise ValueError(
                f"Insufficient stock for item {item_id} at bin {bin_id}: "
                f"available {bal.qty}, requested {out_qty}"
            )
        unit_cost = float(bal.avg_cost)
        bal.qty = bal.qty - out_qty

    total_cost = unit_cost * abs(delta_qty)
    move = InvStockMove(
        item_id=item_id,
        store_id=store_id,
        location_id=location_id,
        bin_id=bin_id,
        batch_no=batch_no or "",
        serial_no=serial_no or "",
        expiry_date=expiry_date,
        move_type=move_type,
        qty=delta_qty,
        unit_cost=unit_cost,
        total_cost=total_cost,
        document_no=document_no,
        source_doc_type=source_doc_type,
        source_doc_id=source_doc_id,
        created_by_id=created_by_id,
        created_at=_now(),
    )
    db.add(move)
    db.flush()
    bal.updated_at = _now()
    return unit_cost


# ---------------------------------------------------------------------------
# Posting per document type
# ---------------------------------------------------------------------------
def post_goods_receipt(db: Session, gr: InvGoodsReceipt, user_id: Optional[int]) -> None:
    for line in gr.lines:
        apply_delta(
            db,
            item_id=line.item_id,
            store_id=line.store_id,
            location_id=line.location_id,
            bin_id=line.bin_id,
            batch_no=line.batch_no,
            serial_no=line.serial_no,
            expiry_date=line.expiry_date,
            delta_qty=line.qty,
            in_cost=float(line.unit_cost),
            move_type=InvMoveType.RECEIPT,
            document_no=gr.gr_number,
            source_doc_type="goods_receipt",
            source_doc_id=gr.id,
            created_by_id=user_id,
        )
        if line.po_line_id:
            from app.models.inventory import InvPurchaseOrderLine

            po_line_obj = db.get(InvPurchaseOrderLine, line.po_line_id)
            if po_line_obj is not None:
                po_line_obj.received_qty = float(po_line_obj.received_qty) + float(line.qty)
                db.add(po_line_obj)


def post_issue(db: Session, issue: InvIssue, user_id: Optional[int]) -> None:
    from app.models.inventory import InvItem

    for line in issue.lines:
        unit_cost = apply_delta(
            db,
            item_id=line.item_id,
            store_id=line.store_id,
            location_id=line.location_id,
            bin_id=line.bin_id,
            batch_no=line.batch_no,
            serial_no=line.serial_no,
            expiry_date=None,
            delta_qty=-line.qty,
            in_cost=None,
            move_type=InvMoveType.ISSUE,
            document_no=issue.issue_number,
            source_doc_type="issue",
            source_doc_id=issue.id,
            created_by_id=user_id,
        )
        item = db.get(InvItem, line.item_id)
        db.add(
            VSServiceCost(
                complaint_id=issue.complaint_id,
                item_name=item.name if item else f"Item {line.item_id}",
                quantity=line.qty,
                unit_price=unit_cost,
                total_price=unit_cost * line.qty,
                created_at=_now(),
            )
        )


def post_transfer(db: Session, transfer: InvTransfer, user_id: Optional[int]) -> None:
    for line in transfer.lines:
        apply_delta(
            db,
            item_id=line.item_id,
            store_id=transfer.from_store_id,
            location_id=line.from_location_id,
            bin_id=line.from_bin_id,
            batch_no=line.batch_no,
            serial_no=line.serial_no,
            expiry_date=line.expiry_date,
            delta_qty=-line.qty,
            in_cost=None,
            move_type=InvMoveType.TRANSFER_OUT,
            document_no=transfer.transfer_number,
            source_doc_type="transfer",
            source_doc_id=transfer.id,
            created_by_id=user_id,
        )
        # unit cost for the transfer-in mirrors the transfer-out average
        apply_delta(
            db,
            item_id=line.item_id,
            store_id=transfer.to_store_id,
            location_id=line.to_location_id,
            bin_id=line.to_bin_id,
            batch_no=line.batch_no,
            serial_no=line.serial_no,
            expiry_date=line.expiry_date,
            delta_qty=line.qty,
            in_cost=_transfer_in_cost(db, transfer, line),
            move_type=InvMoveType.TRANSFER_IN,
            document_no=transfer.transfer_number,
            source_doc_type="transfer",
            source_doc_id=transfer.id,
            created_by_id=user_id,
        )


def _transfer_in_cost(db: Session, transfer: InvTransfer, line) -> float:
    """Find the unit cost recorded on the matching TRANSFER_OUT move."""

    move = (
        db.query(InvStockMove)
        .filter(
            InvStockMove.source_doc_type == "transfer",
            InvStockMove.source_doc_id == transfer.id,
            InvStockMove.item_id == line.item_id,
            InvStockMove.move_type == InvMoveType.TRANSFER_OUT,
        )
        .order_by(InvStockMove.id.desc())
        .first()
    )
    return float(move.unit_cost) if move else 0.0


def post_return(db: Session, ret: InvReturn, user_id: Optional[int]) -> None:
    for line in ret.lines:
        if ret.return_type == InvReturnType.FROM_JOB:
            delta = line.qty
            move_type = InvMoveType.RETURN_IN
            in_cost: Optional[float] = float(line.unit_cost)
        else:  # TO_SUPPLIER
            delta = -line.qty
            move_type = InvMoveType.RETURN_OUT
            in_cost = None
        apply_delta(
            db,
            item_id=line.item_id,
            store_id=line.store_id,
            location_id=line.location_id,
            bin_id=line.bin_id,
            batch_no=line.batch_no,
            serial_no=line.serial_no,
            expiry_date=None,
            delta_qty=delta,
            in_cost=in_cost,
            move_type=move_type,
            document_no=ret.return_number,
            source_doc_type="return",
            source_doc_id=ret.id,
            created_by_id=user_id,
        )


def post_adjustment(db: Session, adj: InvAdjustment, user_id: Optional[int]) -> None:
    for line in adj.lines:
        # COUNT/OTHER may be positive (gain) or negative (loss); DAMAGE/WRITE_OFF
        # are always losses.
        delta = line.qty
        if delta == 0:
            continue
        move_type = InvMoveType.ADJUSTMENT_IN if delta > 0 else InvMoveType.ADJUSTMENT_OUT
        apply_delta(
            db,
            item_id=line.item_id,
            store_id=line.store_id,
            location_id=line.location_id,
            bin_id=line.bin_id,
            batch_no=line.batch_no,
            serial_no=line.serial_no,
            expiry_date=None,
            delta_qty=delta,
            in_cost=float(line.unit_cost) if delta > 0 else None,
            move_type=move_type,
            document_no=adj.adj_number,
            source_doc_type="adjustment",
            source_doc_id=adj.id,
            created_by_id=user_id,
        )


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------
def available_qty_by_item(db: Session) -> dict[int, float]:
    rows = db.query(
        InvStockBalance.item_id, InvStockBalance.qty
    ).all()
    result: dict[int, float] = {}
    for item_id, qty in rows:
        result[item_id] = result.get(item_id, 0.0) + float(qty or 0)
    return result


def stock_value(db: Session) -> float:
    rows = db.query(InvStockBalance.qty, InvStockBalance.avg_cost).all()
    return sum(float(qty or 0) * float(cost or 0) for qty, cost in rows)