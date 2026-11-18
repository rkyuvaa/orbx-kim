"""add requirement approval token tables

Revision ID: 20261118_add_requirement_approval_tokens
Revises: 20261110_add_push_settings_to_personal_settings
Create Date: 2026-11-18 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20261118_add_requirement_approval_tokens"
down_revision = "20261110_add_push_settings_to_personal_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "requirement_approval_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("requirement_id", sa.String(length=100), nullable=False),
        sa.Column("request_no", sa.String(length=100), nullable=False),
        sa.Column("requirement_type", sa.String(length=20), nullable=False),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approver_name", sa.String(length=120), nullable=False),
        sa.Column("approver_email", sa.String(length=255), nullable=False),
        sa.Column("submitted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("submitted_by_name", sa.String(length=120), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("decided_via", sa.String(length=30), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
    )
    op.create_index(op.f("ix_requirement_approval_tokens_token_hash"), "requirement_approval_tokens", ["token_hash"], unique=True)
    op.create_index(op.f("ix_requirement_approval_tokens_requirement_id"), "requirement_approval_tokens", ["requirement_id"], unique=False)
    op.create_index(op.f("ix_requirement_approval_tokens_request_no"), "requirement_approval_tokens", ["request_no"], unique=False)
    op.create_index(op.f("ix_requirement_approval_tokens_expires_at"), "requirement_approval_tokens", ["expires_at"], unique=False)
    op.create_index(op.f("ix_requirement_approval_tokens_status"), "requirement_approval_tokens", ["status"], unique=False)

    op.create_table(
        "requirement_approval_access_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_id", sa.Integer(), sa.ForeignKey("requirement_approval_tokens.id", ondelete="CASCADE"), nullable=True),
        sa.Column("requirement_id", sa.String(length=100), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("ip_address", sa.String(length=60), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("accessed_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
    )
    op.create_index(op.f("ix_requirement_approval_access_logs_token_id"), "requirement_approval_access_logs", ["token_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_requirement_approval_access_logs_token_id"), table_name="requirement_approval_access_logs")
    op.drop_table("requirement_approval_access_logs")
    op.drop_index(op.f("ix_requirement_approval_tokens_status"), table_name="requirement_approval_tokens")
    op.drop_index(op.f("ix_requirement_approval_tokens_expires_at"), table_name="requirement_approval_tokens")
    op.drop_index(op.f("ix_requirement_approval_tokens_request_no"), table_name="requirement_approval_tokens")
    op.drop_index(op.f("ix_requirement_approval_tokens_requirement_id"), table_name="requirement_approval_tokens")
    op.drop_index(op.f("ix_requirement_approval_tokens_token_hash"), table_name="requirement_approval_tokens")
    op.drop_table("requirement_approval_tokens")
