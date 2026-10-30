"""seed default complaint categories into crm_dropdown_options

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-10-30 09:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_CATEGORIES = [
    {"category": "complaint_category", "label": "Vehicle Breakdown", "value": "BREAKDOWN", "order_index": 1, "is_active": True},
    {"category": "complaint_category", "label": "Battery / Range Issue", "value": "BATTERY", "order_index": 2, "is_active": True},
    {"category": "complaint_category", "label": "Motor Issue", "value": "MOTOR", "order_index": 3, "is_active": True},
    {"category": "complaint_category", "label": "Controller / Throttle", "value": "CONTROLLER", "order_index": 4, "is_active": True},
    {"category": "complaint_category", "label": "Charging Failure", "value": "CHARGING", "order_index": 5, "is_active": True},
    {"category": "complaint_category", "label": "Speed / Performance", "value": "PERFORMANCE", "order_index": 6, "is_active": True},
    {"category": "complaint_category", "label": "Other Issue", "value": "OTHER", "order_index": 7, "is_active": True},
]


def upgrade() -> None:
    dropdown_table = sa.table(
        'crm_dropdown_options',
        sa.column('category', sa.String),
        sa.column('label', sa.String),
        sa.column('value', sa.String),
        sa.column('order_index', sa.Integer),
        sa.column('is_active', sa.Boolean),
    )
    op.bulk_insert(dropdown_table, DEFAULT_CATEGORIES)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM crm_dropdown_options WHERE category = 'complaint_category'")
    )
