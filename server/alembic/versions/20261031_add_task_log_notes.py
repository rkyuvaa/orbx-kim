"""Add task_log_notes table

Revision ID: 20261031_add_task_log_notes
Revises: 20261030_add_vs_custom_fields
Create Date: 2026-10-31 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20261031_add_task_log_notes'
down_revision: Union[str, None] = '20261030_add_vs_custom_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if 'task_log_notes' not in tables:
        op.create_table(
            'task_log_notes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('task_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('note', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_task_log_notes_task_id'), 'task_log_notes', ['task_id'], unique=False)
        op.create_index(op.f('ix_task_log_notes_user_id'), 'task_log_notes', ['user_id'], unique=False)
        op.create_index(op.f('ix_task_log_notes_created_at'), 'task_log_notes', ['created_at'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if 'task_log_notes' in tables:
        op.drop_index(op.f('ix_task_log_notes_created_at'), table_name='task_log_notes')
        op.drop_index(op.f('ix_task_log_notes_user_id'), table_name='task_log_notes')
        op.drop_index(op.f('ix_task_log_notes_task_id'), table_name='task_log_notes')
        op.drop_table('task_log_notes')
