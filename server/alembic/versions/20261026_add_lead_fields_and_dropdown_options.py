"""add lead fields and dropdown options

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-10-26 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Create crm_dropdown_options table if not exists
    if 'crm_dropdown_options' not in existing_tables:
        op.create_table(
            'crm_dropdown_options',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
            sa.Column('category', sa.String(length=50), nullable=False, index=True),
            sa.Column('label', sa.String(length=100), nullable=False),
            sa.Column('value', sa.String(length=100), nullable=False),
            sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # 2. Add new columns to applications table
    if 'applications' in existing_tables:
        # Convert lead_source to VARCHAR if PostgreSQL
        try:
            if conn.dialect.name == "postgresql":
                conn.execute(sa.text('ALTER TABLE applications ALTER COLUMN lead_source TYPE VARCHAR(100) USING lead_source::text'))
        except Exception:
            pass

        app_cols = [c['name'] for c in inspector.get_columns('applications')]
        with op.batch_alter_table('applications') as batch_op:
            if 'vehicle_number' not in app_cols:
                batch_op.add_column(sa.Column('vehicle_number', sa.String(length=50), nullable=True))
            if 'vehicle_year' not in app_cols:
                batch_op.add_column(sa.Column('vehicle_year', sa.String(length=20), nullable=True))
            if 'fuel_type' not in app_cols:
                batch_op.add_column(sa.Column('fuel_type', sa.String(length=50), nullable=True))
            if 'customer_status' not in app_cols:
                batch_op.add_column(sa.Column('customer_status', sa.String(length=50), nullable=True))
            if 'coupon_code' not in app_cols:
                batch_op.add_column(sa.Column('coupon_code', sa.String(length=50), nullable=True))
            if 'lost_reason' not in app_cols:
                batch_op.add_column(sa.Column('lost_reason', sa.String(length=120), nullable=True))


def downgrade() -> None:
    pass
