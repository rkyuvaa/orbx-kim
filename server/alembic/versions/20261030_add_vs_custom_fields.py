"""Add vehicle service custom fields tables

Revision ID: 20261030_add_vs_custom_fields
Revises: f7a8b9c0d1e2
Create Date: 2026-10-30 20:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20261030_add_vs_custom_fields'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'vs_custom_field_tabs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=60), nullable=False),
        sa.Column('code', sa.String(length=40), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('icon', sa.String(length=40), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('department_id', sa.String(length=40), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vs_custom_field_tabs_code'), 'vs_custom_field_tabs', ['code'], unique=True)
    op.create_index(op.f('ix_vs_custom_field_tabs_department_id'), 'vs_custom_field_tabs', ['department_id'])

    op.create_table(
        'vs_custom_field_definitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tab_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=60), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=False),
        sa.Column('field_type', sa.String(length=30), nullable=False, server_default='text'),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('is_readonly', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('department_id', sa.String(length=40), nullable=True),
        sa.Column('placeholder', sa.String(length=255), nullable=True),
        sa.Column('help_text', sa.Text(), nullable=True),
        sa.Column('default_value', sa.Text(), nullable=True),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('file_config', sa.JSON(), nullable=True),
        sa.Column('user_config', sa.JSON(), nullable=True),
        sa.Column('required_by_status', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tab_id'], ['vs_custom_field_tabs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vs_custom_field_definitions_tab_id'), 'vs_custom_field_definitions', ['tab_id'])
    op.create_index(op.f('ix_vs_custom_field_definitions_key'), 'vs_custom_field_definitions', ['key'])
    op.create_index(op.f('ix_vs_custom_field_definitions_department_id'), 'vs_custom_field_definitions', ['department_id'])
    op.create_unique_constraint('uq_vs_custom_field_tab_key', 'vs_custom_field_definitions', ['tab_id', 'key'])
    op.create_unique_constraint('uq_vs_custom_field_tab_label', 'vs_custom_field_definitions', ['tab_id', 'label'])

    op.create_table(
        'vs_complaint_custom_field_values',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('complaint_id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('file_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['complaint_id'], ['vs_complaints.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['field_id'], ['vs_custom_field_definitions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vs_complaint_custom_field_values_complaint_id'), 'vs_complaint_custom_field_values', ['complaint_id'])
    op.create_index(op.f('ix_vs_complaint_custom_field_values_field_id'), 'vs_complaint_custom_field_values', ['field_id'])
    op.create_unique_constraint('uq_vs_complaint_field', 'vs_complaint_custom_field_values', ['complaint_id', 'field_id'])


def downgrade() -> None:
    op.drop_constraint('uq_vs_complaint_field', 'vs_complaint_custom_field_values', type_='unique')
    op.drop_index(op.f('ix_vs_complaint_custom_field_values_field_id'), table_name='vs_complaint_custom_field_values')
    op.drop_index(op.f('ix_vs_complaint_custom_field_values_complaint_id'), table_name='vs_complaint_custom_field_values')
    op.drop_table('vs_complaint_custom_field_values')

    op.drop_constraint('uq_vs_custom_field_tab_label', 'vs_custom_field_definitions', type_='unique')
    op.drop_constraint('uq_vs_custom_field_tab_key', 'vs_custom_field_definitions', type_='unique')
    op.drop_index(op.f('ix_vs_custom_field_definitions_department_id'), table_name='vs_custom_field_definitions')
    op.drop_index(op.f('ix_vs_custom_field_definitions_key'), table_name='vs_custom_field_definitions')
    op.drop_index(op.f('ix_vs_custom_field_definitions_tab_id'), table_name='vs_custom_field_definitions')
    op.drop_table('vs_custom_field_definitions')

    op.drop_index(op.f('ix_vs_custom_field_tabs_department_id'), table_name='vs_custom_field_tabs')
    op.drop_index(op.f('ix_vs_custom_field_tabs_code'), table_name='vs_custom_field_tabs')
    op.drop_table('vs_custom_field_tabs')