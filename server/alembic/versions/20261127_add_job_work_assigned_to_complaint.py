"""Add job_work_assigned_to_id field to VSComplaint

Revision ID: 20261127_add_job_work_assigned_to_complaint
Revises: 20261127_add_reporter_address_to_complaint
Create Date: 2026-11-27 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261127_add_job_work_assigned_to_complaint'
down_revision: Union[str, None] = '20261127_add_reporter_address_to_complaint'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'vs_complaints' not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    if 'job_work_assigned_to_id' not in existing_cols:
        op.add_column(
            'vs_complaints',
            sa.Column('job_work_assigned_to_id', sa.Integer(), nullable=True)
        )
        op.create_foreign_key(
            'fk_vs_complaints_job_work_assigned_to_id',
            'vs_complaints',
            'users',
            ['job_work_assigned_to_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'vs_complaints' not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    if 'job_work_assigned_to_id' in existing_cols:
        op.drop_constraint('fk_vs_complaints_job_work_assigned_to_id', 'vs_complaints', type_='foreignkey')
        op.drop_column('vs_complaints', 'job_work_assigned_to_id')