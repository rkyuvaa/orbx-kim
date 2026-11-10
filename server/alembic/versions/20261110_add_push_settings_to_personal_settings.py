"""add push settings to personal_settings table

Revision ID: 20261110_add_push_settings_to_personal_settings
Revises: 20261110_add_push_subscriptions_table
Create Date: 2026-11-10 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261110_add_push_settings_to_personal_settings'
down_revision: Union[str, None] = '20261110_add_push_subscriptions_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('personal_settings')]

    new_columns = [
        ('push_task_assigned', sa.Boolean(), 'true'),
        ('push_task_due_today', sa.Boolean(), 'true'),
        ('push_log_note_update', sa.Boolean(), 'true'),
        ('push_task_completed', sa.Boolean(), 'true'),
        ('push_task_comments', sa.Boolean(), 'true'),
    ]

    for col_name, col_type, default_val in new_columns:
        if col_name not in cols:
            op.add_column(
                'personal_settings',
                sa.Column(col_name, col_type, nullable=False, server_default=sa.text(default_val))
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('personal_settings')]

    for col_name in [
        'push_task_assigned',
        'push_task_due_today',
        'push_log_note_update',
        'push_task_completed',
        'push_task_comments',
    ]:
        if col_name in cols:
            op.drop_column('personal_settings', col_name)
