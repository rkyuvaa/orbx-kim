"""create document numbering framework table and seed initial sequence

Revision ID: b3c4d5e6f7a8
Revises: 26a1376756d3
Create Date: 2026-10-28 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = '26a1376756d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create document_sequences table
    op.create_table(
        'document_sequences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('prefix', sa.String(length=50), server_default='', nullable=False),
        sa.Column('padding', sa.Integer(), server_default='4', nullable=False),
        sa.Column('next_number', sa.Integer(), server_default='1', nullable=False),
        sa.Column('suffix', sa.String(length=50), server_default='', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('document_sequences', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_document_sequences_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_document_sequences_document_type'), ['document_type'], unique=True)

    # 2. Expand vs_complaints.complaint_no length to 64
    with op.batch_alter_table('vs_complaints', schema=None) as batch_op:
        batch_op.alter_column('complaint_no', existing_type=sa.String(length=32), type_=sa.String(length=64))

    # 3. Seed default document sequences
    document_sequences_table = sa.table(
        'document_sequences',
        sa.column('document_type', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('prefix', sa.String),
        sa.column('padding', sa.Integer),
        sa.column('next_number', sa.Integer),
        sa.column('suffix', sa.String),
        sa.column('is_active', sa.Boolean),
    )

    op.bulk_insert(
        document_sequences_table,
        [
            {
                'document_type': 'complaint',
                'name': 'Vehicle Service Complaint',
                'description': 'Unique sequence identifier for customer and staff vehicle service complaints',
                'prefix': 'VC-',
                'padding': 4,
                'next_number': 1,
                'suffix': '',
                'is_active': True,
            },
            {
                'document_type': 'work_order',
                'name': 'Vehicle Work Order',
                'description': 'Job card and work order numbering for workshop repair and maintenance',
                'prefix': 'WO-',
                'padding': 4,
                'next_number': 1,
                'suffix': '',
                'is_active': True,
            },
        ]
    )


def downgrade() -> None:
    with op.batch_alter_table('vs_complaints', schema=None) as batch_op:
        batch_op.alter_column('complaint_no', existing_type=sa.String(length=64), type_=sa.String(length=32))

    with op.batch_alter_table('document_sequences', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_document_sequences_document_type'))
        batch_op.drop_index(batch_op.f('ix_document_sequences_id'))

    op.drop_table('document_sequences')
