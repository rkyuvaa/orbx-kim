"""Add reporter_address field to VSComplaint

Revision ID: 20261127_add_reporter_address_to_complaint
Revises: 20261126_merge_source_expense_heads
Create Date: 2026-11-27 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261127_add_reporter_address_to_complaint'
down_revision: Union[str, None] = '20261126_merge_source_expense_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'vs_complaints' not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    if 'reporter_address' not in existing_cols:
        op.add_column(
            'vs_complaints',
            sa.Column('reporter_address', sa.String(length=500), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'vs_complaints' not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    if 'reporter_address' in existing_cols:
        op.drop_column('vs_complaints', 'reporter_address')
