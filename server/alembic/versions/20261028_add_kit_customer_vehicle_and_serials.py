"""add customer_name and vehicle_number to vs_kits and serial_number to vs_kit_component_types

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-10-28 23:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('vs_kits', schema=None) as batch_op:
        batch_op.add_column(sa.Column('customer_name', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('vehicle_number', sa.String(length=40), nullable=True))
        batch_op.create_index(batch_op.f('ix_vs_kits_vehicle_number'), ['vehicle_number'], unique=False)

    with op.batch_alter_table('vs_kit_component_types', schema=None) as batch_op:
        batch_op.add_column(sa.Column('serial_number', sa.String(length=100), nullable=True))
        batch_op.create_index(batch_op.f('ix_vs_kit_component_types_serial_number'), ['serial_number'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('vs_kit_component_types', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_vs_kit_component_types_serial_number'))
        batch_op.drop_column('serial_number')

    with op.batch_alter_table('vs_kits', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_vs_kits_vehicle_number'))
        batch_op.drop_column('vehicle_number')
        batch_op.drop_column('customer_name')
