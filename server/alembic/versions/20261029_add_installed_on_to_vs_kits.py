"""add installed_on to vs_kits

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-10-29 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('vs_kits', schema=None) as batch_op:
        batch_op.add_column(sa.Column('installed_on', sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('vs_kits', schema=None) as batch_op:
        batch_op.drop_column('installed_on')
