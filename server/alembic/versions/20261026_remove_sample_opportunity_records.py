"""remove sample opportunity records

Revision ID: e1f2a3b4c5d6
Revises: c9d0e1224a5b
Create Date: 2026-10-26 15:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'c9d0e1224a5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Delete child records referencing sample opportunity applications
    child_tables = [
        ('activities', 'application_id'),
        ('deliveries', 'application_id'),
        ('disbursements', 'application_id'),
        ('documents', 'application_id'),
        ('finance_submissions', 'application_id'),
        ('sanctions', 'application_id'),
        ('verifications', 'application_id'),
        ('activity_logs', 'application_id'),
        ('planned_activities', 'application_id'),
        ('crm_lead_custom_field_values', 'application_id'),
        ('financier_document_access_tokens', 'application_id'),
        ('financier_document_access_logs', 'application_id'),
    ]
    for tbl, col in child_tables:
        try:
            conn.execute(
                sa.text(f"DELETE FROM {tbl} WHERE {col} IN (SELECT id FROM applications WHERE status != 'LEAD' AND app_no LIKE 'APP-%')")
            )
        except Exception:
            pass

    for app_no in ['APP-118', 'APP-116', 'APP-125', 'APP-114', 'APP-124']:
        try:
            conn.execute(
                sa.text("DELETE FROM notifications WHERE message LIKE :msg").bindparams(msg=f"%{app_no}%")
            )
        except Exception:
            pass

    # Delete sample opportunity applications
    try:
        conn.execute(
            sa.text("DELETE FROM applications WHERE status != 'LEAD' AND app_no LIKE 'APP-%'")
        )
    except Exception:
        pass


def downgrade() -> None:
    pass
