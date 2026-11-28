"""Create inventory module tables

Revision ID: 20261128_create_inventory_tables
Revises: 20261127_add_job_work_assigned_to_complaint
Create Date: 2026-11-28 07:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261128_create_inventory_tables'
down_revision: Union[str, None] = '20261127_add_job_work_assigned_to_complaint'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(conn, table):
    return {c["name"] for c in sa.inspect(conn).get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    existing = set(sa.inspect(conn).get_table_names())

    def create(name, *cols, **kw):
        if name in existing:
            return
        op.create_table(name, *cols, **kw)

    # Configuration
    create(
        'inv_stores',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_inv_stores_code', 'inv_stores', ['code'], unique=True) if 'inv_stores' not in existing else None

    create(
        'inv_locations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_bins',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('inv_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_units',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(60), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_brands',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_suppliers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('contact_name', sa.String(120), nullable=True),
        sa.Column('phone', sa.String(40), nullable=True),
        sa.Column('email', sa.String(120), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('gstin', sa.String(20), nullable=True),
        sa.Column('credit_terms', sa.String(120), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_tax_rates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(60), nullable=False),
        sa.Column('rate', sa.Float(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    create(
        'inv_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sku', sa.String(60), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('inv_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('inv_units.id', ondelete='SET NULL'), nullable=True),
        sa.Column('brand_id', sa.Integer(), sa.ForeignKey('inv_brands.id', ondelete='SET NULL'), nullable=True),
        sa.Column('default_supplier_id', sa.Integer(), sa.ForeignKey('inv_suppliers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tax_rate_id', sa.Integer(), sa.ForeignKey('inv_tax_rates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('purchase_price', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('reorder_level', sa.Float(), nullable=False, server_default='0'),
        sa.Column('reorder_qty', sa.Float(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Stock
    create(
        'inv_stock_balances',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='CASCADE'), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('qty', sa.Float(), nullable=False, server_default='0'),
        sa.Column('avg_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            'item_id', 'store_id', 'location_id', 'bin_id',
            'batch_no', 'serial_no', 'expiry_date',
            name='uq_inv_stock_balance_key',
        ),
    )

    create(
        'inv_stock_moves',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='CASCADE'), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('move_type', sa.String(30), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('unit_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('total_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('document_no', sa.String(64), nullable=True),
        sa.Column('source_doc_type', sa.String(40), nullable=True),
        sa.Column('source_doc_id', sa.Integer(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Purchase requests
    create(
        'inv_purchase_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pr_number', sa.String(64), nullable=False),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('inv_suppliers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('requested_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_purchase_request_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pr_id', sa.Integer(), sa.ForeignKey('inv_purchase_requests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('est_unit_price', sa.Numeric(14, 4), nullable=False, server_default='0'),
    )

    # Purchase orders
    create(
        'inv_purchase_orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('po_number', sa.String(64), nullable=False),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('inv_suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('expected_date', sa.Date(), nullable=True),
        sa.Column('requested_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_purchase_order_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('po_id', sa.Integer(), sa.ForeignKey('inv_purchase_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('tax_rate_id', sa.Integer(), sa.ForeignKey('inv_tax_rates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('received_qty', sa.Float(), nullable=False, server_default='0'),
    )

    # Goods receipts
    create(
        'inv_goods_receipts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('gr_number', sa.String(64), nullable=False),
        sa.Column('po_id', sa.Integer(), sa.ForeignKey('inv_purchase_orders.id', ondelete='SET NULL'), nullable=True),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('inv_suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('receipt_date', sa.Date(), nullable=False),
        sa.Column('received_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_goods_receipt_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('gr_id', sa.Integer(), sa.ForeignKey('inv_goods_receipts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('po_line_id', sa.Integer(), sa.ForeignKey('inv_purchase_order_lines.id', ondelete='SET NULL'), nullable=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('unit_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='RESTRICT'), nullable=False),
    )

    # Issues
    create(
        'inv_issues',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('issue_number', sa.String(64), nullable=False),
        sa.Column('complaint_id', sa.Integer(), sa.ForeignKey('vs_complaints.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vs_vehicles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('issued_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_issue_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('issue_id', sa.Integer(), sa.ForeignKey('inv_issues.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('unit_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='RESTRICT'), nullable=False),
    )

    # Returns
    create(
        'inv_returns',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('return_number', sa.String(64), nullable=False),
        sa.Column('return_type', sa.String(30), nullable=False),
        sa.Column('complaint_id', sa.Integer(), sa.ForeignKey('vs_complaints.id', ondelete='SET NULL'), nullable=True),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('inv_suppliers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('return_date', sa.Date(), nullable=False),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_return_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('return_id', sa.Integer(), sa.ForeignKey('inv_returns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('unit_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='RESTRICT'), nullable=False),
    )

    # Transfers
    create(
        'inv_transfers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('transfer_number', sa.String(64), nullable=False),
        sa.Column('from_store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('to_store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('transfer_date', sa.Date(), nullable=False),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_transfer_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('transfer_id', sa.Integer(), sa.ForeignKey('inv_transfers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('from_location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('from_bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('to_location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('to_bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='RESTRICT'), nullable=False),
    )

    # Adjustments
    create(
        'inv_adjustments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('adj_number', sa.String(64), nullable=False),
        sa.Column('adjustment_type', sa.String(30), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('adj_date', sa.Date(), nullable=False),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    create(
        'inv_adjustment_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('adj_id', sa.Integer(), sa.ForeignKey('inv_adjustments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inv_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('batch_no', sa.String(60), nullable=False, server_default=''),
        sa.Column('serial_no', sa.String(80), nullable=False, server_default=''),
        sa.Column('unit_cost', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('inv_stores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('inv_locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('bin_id', sa.Integer(), sa.ForeignKey('inv_bins.id', ondelete='RESTRICT'), nullable=False),
    )


def downgrade() -> None:
    conn = op.get_bind()
    existing = set(sa.inspect(conn).get_table_names())
    for table in [
        'inv_adjustment_lines', 'inv_adjustments',
        'inv_transfer_lines', 'inv_transfers',
        'inv_return_lines', 'inv_returns',
        'inv_issue_lines', 'inv_issues',
        'inv_goods_receipt_lines', 'inv_goods_receipts',
        'inv_purchase_order_lines', 'inv_purchase_orders',
        'inv_purchase_request_lines', 'inv_purchase_requests',
        'inv_stock_moves', 'inv_stock_balances',
        'inv_items', 'inv_tax_rates', 'inv_suppliers', 'inv_brands',
        'inv_units', 'inv_categories', 'inv_bins', 'inv_locations', 'inv_stores',
    ]:
        if table in existing:
            op.drop_table(table)