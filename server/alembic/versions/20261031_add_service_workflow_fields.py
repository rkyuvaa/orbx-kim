"""Add service workflow fields to VSComplaint

Revision ID: 20261031_add_service_workflow_fields
Revises: 20261031_add_task_log_notes
Create Date: 2026-10-31 14:54:57.643139

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20261031_add_service_workflow_fields'
down_revision: Union[str, None] = '20261031_add_task_log_notes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'vs_complaints' not in existing_tables:
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    existing_indexes = {ix["name"] for ix in inspector.get_indexes('vs_complaints')}

    # Ensure PostgreSQL Enum type exists
    service_type_enum = sa.Enum('FREE', 'GENERAL', 'PAID', name='servicetype')
    try:
        service_type_enum.create(conn, checkfirst=True)
    except Exception:
        pass

    with op.batch_alter_table('vs_complaints', schema=None) as batch_op:
        if 'est_delivery_date' not in existing_cols:
            batch_op.add_column(sa.Column('est_delivery_date', sa.Date(), nullable=True))
        if 'initial_checklist_url' not in existing_cols:
            batch_op.add_column(sa.Column('initial_checklist_url', sa.String(length=500), nullable=True))
        if 'can_data_collected' not in existing_cols:
            batch_op.add_column(sa.Column('can_data_collected', sa.Boolean(), server_default='0', nullable=False))
        if 'master_checklist_url' not in existing_cols:
            batch_op.add_column(sa.Column('master_checklist_url', sa.String(length=500), nullable=True))
        if 'complaints_8d_url' not in existing_cols:
            batch_op.add_column(sa.Column('complaints_8d_url', sa.String(length=500), nullable=True))
        if 'technician_remarks' not in existing_cols:
            batch_op.add_column(sa.Column('technician_remarks', sa.Text(), nullable=True))
        if 'vehicle_images' not in existing_cols:
            batch_op.add_column(sa.Column('vehicle_images', sa.Text(), nullable=True))
        if 'odometer_reading' not in existing_cols:
            batch_op.add_column(sa.Column('odometer_reading', sa.Float(), nullable=True))
        if 'timer_started_at' not in existing_cols:
            batch_op.add_column(sa.Column('timer_started_at', sa.DateTime(timezone=True), nullable=True))
        if 'timer_ended_at' not in existing_cols:
            batch_op.add_column(sa.Column('timer_ended_at', sa.DateTime(timezone=True), nullable=True))
        if 'service_hours' not in existing_cols:
            batch_op.add_column(sa.Column('service_hours', sa.Float(), nullable=True))
        if 'service_type' not in existing_cols:
            batch_op.add_column(sa.Column('service_type', service_type_enum, server_default='GENERAL', nullable=False))
        if 'ix_vs_complaints_service_type' not in existing_indexes:
            try:
                batch_op.create_index(batch_op.f('ix_vs_complaints_service_type'), ['service_type'], unique=False)
            except Exception:
                pass


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if 'vs_complaints' not in existing_tables:
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    existing_indexes = {ix["name"] for ix in inspector.get_indexes('vs_complaints')}

    with op.batch_alter_table('vs_complaints', schema=None) as batch_op:
        if 'ix_vs_complaints_service_type' in existing_indexes:
            batch_op.drop_index(batch_op.f('ix_vs_complaints_service_type'))
        for col in [
            'service_type', 'service_hours', 'timer_ended_at', 'timer_started_at',
            'odometer_reading', 'vehicle_images', 'technician_remarks',
            'complaints_8d_url', 'master_checklist_url', 'can_data_collected',
            'initial_checklist_url', 'est_delivery_date'
        ]:
            if col in existing_cols:
                batch_op.drop_column(col)
