"""Add source field to VSComplaint

Revision ID: 20261126_add_source_to_complaint
Revises: 20261104_add_sms_settings_table
Create Date: 2026-11-26 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261126_add_source_to_complaint'
down_revision: Union[str, None] = '20261104_add_sms_settings_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'vs_complaints' not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    if 'source' not in existing_cols:
        op.add_column(
            'vs_complaints',
            sa.Column('source', sa.String(length=40), nullable=True)
        )
    existing_indexes = {index["name"] for index in inspector.get_indexes('vs_complaints')}
    if 'ix_vs_complaints_source' not in existing_indexes:
        op.create_index('ix_vs_complaints_source', 'vs_complaints', ['source'], unique=False)

    if 'crm_dropdown_options' in inspector.get_table_names():
        dropdown_table = sa.table(
            'crm_dropdown_options',
            sa.column('category', sa.String()),
            sa.column('label', sa.String()),
            sa.column('value', sa.String()),
            sa.column('order_index', sa.Integer()),
            sa.column('is_active', sa.Boolean()),
        )
        source_options = [
            ("Walk-in", "walk_in", 1),
            ("Phone", "phone", 2),
            ("Web", "web", 3),
            ("Referral", "referral", 4),
            ("QR Code", "qr_code", 5),
        ]
        for label, value, order_index in source_options:
            existing_option = conn.execute(
                sa.select(sa.literal(1)).select_from(dropdown_table).where(
                    sa.and_(
                        dropdown_table.c.category == "source",
                        dropdown_table.c.value == value,
                    )
                ).limit(1)
            ).first()
            if not existing_option:
                conn.execute(
                    sa.insert(dropdown_table).values(
                        category="source",
                        label=label,
                        value=value,
                        order_index=order_index,
                        is_active=True,
                    )
                )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'vs_complaints' not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns('vs_complaints')}
    if 'source' in existing_cols:
        op.drop_index('ix_vs_complaints_source', table_name='vs_complaints')
        op.drop_column('vs_complaints', 'source')