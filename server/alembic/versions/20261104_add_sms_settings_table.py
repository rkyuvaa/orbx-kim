"""add sms settings table

Revision ID: 20261104_add_sms_settings_table
Revises: 20261102_issue_matrix_row_ids
Create Date: 2026-11-04 17:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261104_add_sms_settings_table'
down_revision: Union[str, None] = '20261102_issue_matrix_row_ids'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sms_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False, server_default='textguru'),
        sa.Column('api_url', sa.String(length=255), nullable=False, server_default='https://www.textguru.in/api/v2/SendSMS.aspx'),
        sa.Column('api_method', sa.String(length=10), nullable=False, server_default='GET'),
        sa.Column('username', sa.String(length=120), nullable=True),
        sa.Column('password', sa.String(length=255), nullable=True),
        sa.Column('sender_id', sa.String(length=30), nullable=True),
        sa.Column('entity_id', sa.String(length=60), nullable=True),
        sa.Column('registration_template_id', sa.String(length=60), nullable=True),
        sa.Column('registration_message_template', sa.Text(), nullable=True),
        sa.Column('otp_template_id', sa.String(length=60), nullable=True),
        sa.Column('otp_message_template', sa.Text(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('sms_settings')
