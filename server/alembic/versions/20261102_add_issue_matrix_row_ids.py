import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261102_issue_matrix_row_ids"
down_revision: Union[str, None] = "20261031_add_app_data_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    # 1. Ensure vs_issue_matrix_config table exists with row_ids
    if "vs_issue_matrix_config" not in tables:
        op.create_table(
            "vs_issue_matrix_config",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("headers", sa.JSON(), nullable=False),
            sa.Column("rows", sa.JSON(), nullable=False),
            sa.Column("row_ids", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("source_filename", sa.String(length=255), nullable=False),
            sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("vs_issue_matrix_config")}
        if "row_ids" not in existing_cols:
            op.add_column(
                "vs_issue_matrix_config",
                sa.Column("row_ids", sa.JSON(), nullable=True),
            )
            matrix_table = sa.table(
                "vs_issue_matrix_config",
                sa.column("id", sa.Integer()),
                sa.column("rows", sa.JSON()),
                sa.column("row_ids", sa.JSON()),
            )
            rows = connection.execute(sa.select(matrix_table.c.id, matrix_table.c.rows)).mappings()
            for config in rows:
                payload = config["rows"] or []
                if isinstance(payload, str):
                    payload = json.loads(payload)
                row_ids = [f"IM-{config['id']}-{index + 1}" for index, _ in enumerate(payload or [])]
                connection.execute(
                    sa.update(matrix_table)
                    .where(matrix_table.c.id == config["id"])
                    .values(row_ids=row_ids)
                )
            connection.execute(
                sa.update(matrix_table)
                .where(matrix_table.c.row_ids.is_(None))
                .values(row_ids=[]),
            )
            with op.batch_alter_table("vs_issue_matrix_config") as batch_op:
                batch_op.alter_column("row_ids", existing_type=sa.JSON(), nullable=False)

    # 2. Ensure vs_complaint_issue_matrix_items table exists
    if "vs_complaint_issue_matrix_items" not in tables:
        op.create_table(
            "vs_complaint_issue_matrix_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("complaint_id", sa.Integer(), nullable=False),
            sa.Column("issue_code", sa.String(length=100), nullable=False),
            sa.Column("issue_row", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["complaint_id"], ["vs_complaints.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("vs_complaint_issue_matrix_items") as batch_op:
            batch_op.create_index(batch_op.f("ix_vs_complaint_issue_matrix_items_complaint_id"), ["complaint_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_vs_complaint_issue_matrix_items_issue_code"), ["issue_code"], unique=False)

    # 3. Ensure vs_technician_advice table exists
    if "vs_technician_advice" not in tables:
        op.create_table(
            "vs_technician_advice",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("complaint_id", sa.Integer(), nullable=False),
            sa.Column("serial_number", sa.String(length=32), nullable=False),
            sa.Column("issue_to_resolve", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["complaint_id"], ["vs_complaints.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("vs_technician_advice") as batch_op:
            batch_op.create_index(batch_op.f("ix_vs_technician_advice_complaint_id"), ["complaint_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_vs_technician_advice_serial_number"), ["serial_number"], unique=False)


def downgrade() -> None:
    op.drop_column("vs_issue_matrix_config", "row_ids")
