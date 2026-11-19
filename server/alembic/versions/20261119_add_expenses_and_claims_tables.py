"""add expenses and claims tables

Revision ID: 20261119_add_expenses_and_claims_tables
Revises: 20261118_add_requirement_approval_tokens
Create Date: 2026-11-19 20:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20261119_add_expenses_and_claims_tables"
down_revision = "20261118_add_requirement_approval_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add branch_id to users
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("branch_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_users_branch_id_branches", "branches", ["branch_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_users_branch_id", ["branch_id"], unique=False)

    # 2. expense_categories
    op.create_table(
        "expense_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("limit_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("limit_period", sa.String(length=30), nullable=False, server_default="PER_EXPENSE"),
        sa.Column("gl_account_code", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_expense_categories_name", "expense_categories", ["name"], unique=True)
    op.create_index("ix_expense_categories_code", "expense_categories", ["code"], unique=True)

    # 3. claim_cycles
    op.create_table(
        "claim_cycles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("frequency", sa.String(length=30), nullable=False, server_default="FORTNIGHTLY"),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="OPEN"),
        sa.Column("auto_submit_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 4. claims (before bills because bills refer to claims.id, and claims refer to claim_cycles.id)
    op.create_table(
        "claims",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("claim_no", sa.String(length=50), nullable=False),
        sa.Column("employee_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("claim_cycle_id", sa.Integer(), sa.ForeignKey("claim_cycles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="DRAFT"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("line_manager_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("line_manager_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cfo_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cfo_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accountant_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accountant_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_claims_claim_no", "claims", ["claim_no"], unique=True)
    op.create_index("ix_claims_employee_user_id", "claims", ["employee_user_id"], unique=False)
    op.create_index("ix_claims_branch_id", "claims", ["branch_id"], unique=False)
    op.create_index("ix_claims_claim_cycle_id", "claims", ["claim_cycle_id"], unique=False)
    op.create_index("ix_claims_status", "claims", ["status"], unique=False)

    # 5. bills
    op.create_table(
        "bills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bill_number", sa.String(length=100), nullable=True),
        sa.Column("bill_date", sa.Date(), nullable=True),
        sa.Column("supplier_name", sa.String(length=200), nullable=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("expense_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_file_path", sa.String(length=500), nullable=False),
        sa.Column("source_mime", sa.String(length=100), nullable=False, server_default="application/octet-stream"),
        sa.Column("source_hash", sa.String(length=64), nullable=True),
        sa.Column("taxable_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("cgst_pct", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("cgst_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("sgst_pct", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("sgst_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("igst_pct", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("igst_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("gst_total", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("extraction_status", sa.String(length=30), nullable=False, server_default="PROCESSING"),
        sa.Column("extraction_confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("extraction_raw", sa.JSON(), nullable=True),
        sa.Column("is_duplicate", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("duplicate_of_bill_id", sa.Integer(), sa.ForeignKey("bills.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_bills_uploaded_by_id", "bills", ["uploaded_by_id"], unique=False)
    op.create_index("ix_bills_branch_id", "bills", ["branch_id"], unique=False)
    op.create_index("ix_bills_claim_id", "bills", ["claim_id"], unique=False)
    op.create_index("ix_bills_category_id", "bills", ["category_id"], unique=False)
    op.create_index("ix_bills_source_hash", "bills", ["source_hash"], unique=False)
    op.create_index("ix_bills_bill_number", "bills", ["bill_number"], unique=False)
    op.create_index("ix_bills_supplier_name", "bills", ["supplier_name"], unique=False)

    # 6. claim_status_history
    op.create_table(
        "claim_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(length=50), nullable=False),
        sa.Column("to_status", sa.String(length=50), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_claim_status_history_claim_id", "claim_status_history", ["claim_id"], unique=False)

    # 7. payouts
    op.create_table(
        "payouts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_no", sa.String(length=50), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING_TRANSFER"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("claim_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("utr_number", sa.String(length=100), nullable=True),
        sa.Column("bank_ref", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("transferred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payouts_batch_no", "payouts", ["batch_no"], unique=True)
    op.create_index("ix_payouts_status", "payouts", ["status"], unique=False)
    op.create_index("ix_payouts_utr_number", "payouts", ["utr_number"], unique=False)

    # 8. payout_claims
    op.create_table(
        "payout_claims",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("payout_id", sa.Integer(), sa.ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payout_claims_payout_id", "payout_claims", ["payout_id"], unique=False)
    op.create_index("ix_payout_claims_claim_id", "payout_claims", ["claim_id"], unique=False)

    # 9. payout_employee_status
    op.create_table(
        "payout_employee_status",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("payout_id", sa.Integer(), sa.ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING_CONFIRMATION"),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmation_method", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reminder_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_reminder_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payout_employee_status_payout_id", "payout_employee_status", ["payout_id"], unique=False)
    op.create_index("ix_payout_employee_status_employee_user_id", "payout_employee_status", ["employee_user_id"], unique=False)
    op.create_index("ix_payout_employee_status_status", "payout_employee_status", ["status"], unique=False)

    # 10. expense_policies
    op.create_table(
        "expense_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("policy_key", sa.String(length=100), nullable=False),
        sa.Column("policy_value", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_type", sa.String(length=20), nullable=False, server_default="STRING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_expense_policies_policy_key", "expense_policies", ["policy_key"], unique=True)

    # 11. ai_providers
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("api_endpoint", sa.String(length=255), nullable=True),
        sa.Column("api_key_env_var", sa.String(length=100), nullable=True),
        sa.Column("api_key_override", sa.String(length=255), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("config_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_providers_provider", "ai_providers", ["provider"], unique=True)


def downgrade() -> None:
    op.drop_table("ai_providers")
    op.drop_table("expense_policies")
    op.drop_table("payout_employee_status")
    op.drop_table("payout_claims")
    op.drop_table("payouts")
    op.drop_table("claim_status_history")
    op.drop_table("bills")
    op.drop_table("claims")
    op.drop_table("claim_cycles")
    op.drop_table("expense_categories")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index("ix_users_branch_id")
        batch_op.drop_column("branch_id")
