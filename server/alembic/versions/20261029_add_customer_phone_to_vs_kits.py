"""add customer_phone to vs_kits

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-10-29 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('vs_kits', schema=None) as batch_op:
        batch_op.add_column(sa.Column('customer_phone', sa.String(length=20), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('vs_kits', schema=None) as batch_op:
        batch_op.drop_column('customer_phone')
