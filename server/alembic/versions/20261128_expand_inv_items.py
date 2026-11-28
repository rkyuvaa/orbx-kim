"""Expand inv_items with item master fields

Revision ID: 20261128_expand_inv_items
Revises: 20261128_create_inventory_tables
Create Date: 2026-11-28 09:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261128_expand_inv_items'
down_revision: Union[str, None] = '20261128_create_inventory_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'inv_items' not in inspector.get_table_names():
        return

    existing = {c["name"] for c in inspector.get_columns('inv_items')}

    with op.batch_alter_table('inv_items') as batch_op:
        if 'item_type' not in existing:
            batch_op.add_column(sa.Column('item_type', sa.String(20), nullable=False, server_default='GOODS'))
        if 'tracking_mode' not in existing:
            batch_op.add_column(sa.Column('tracking_mode', sa.String(20), nullable=False, server_default='BY_QUANTITY'))
        if 'sales_price' not in existing:
            batch_op.add_column(sa.Column('sales_price', sa.Numeric(14, 2), nullable=False, server_default='0'))
        if 'sales_tax_pct' not in existing:
            batch_op.add_column(sa.Column('sales_tax_pct', sa.Numeric(5, 2), nullable=False, server_default='0'))
        if 'purchase_tax_pct' not in existing:
            batch_op.add_column(sa.Column('purchase_tax_pct', sa.Numeric(5, 2), nullable=False, server_default='0'))
        if 'internal_reference' not in existing:
            batch_op.add_column(sa.Column('internal_reference', sa.String(100), nullable=True))
        if 'barcode' not in existing:
            batch_op.add_column(sa.Column('barcode', sa.String(100), nullable=True))
        if 'hsn_sac_code' not in existing:
            batch_op.add_column(sa.Column('hsn_sac_code', sa.String(40), nullable=True))
        # Widen purchase_price precision to 2 decimals
        batch_op.alter_column('purchase_price', type_=sa.Numeric(14, 2), existing_type=sa.Numeric(14, 4))

    # Unique index on barcode (multiple NULLs allowed)
    idx_names = {i["name"] for i in inspector.get_indexes('inv_items')}
    if 'ix_inv_items_barcode' not in idx_names:
        op.create_index('ix_inv_items_barcode', 'inv_items', ['barcode'], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'inv_items' not in inspector.get_table_names():
        return

    idx_names = {i["name"] for i in inspector.get_indexes('inv_items')}
    if 'ix_inv_items_barcode' in idx_names:
        op.drop_index('ix_inv_items_barcode', table_name='inv_items')

    existing = {c["name"] for c in inspector.get_columns('inv_items')}
    with op.batch_alter_table('inv_items') as batch_op:
        batch_op.alter_column('purchase_price', type_=sa.Numeric(14, 4), existing_type=sa.Numeric(14, 2))
        for col in ['hsn_sac_code', 'barcode', 'internal_reference', 'purchase_tax_pct', 'sales_tax_pct', 'sales_price', 'tracking_mode', 'item_type']:
            if col in existing:
                batch_op.drop_column(col)