"""Add stable identifiers for Issue Matrix rows."""

from typing import Sequence, Union

from alembic import op
import json

import sqlalchemy as sa


revision: str = "20261102_issue_matrix_row_ids"
down_revision: Union[str, None] = "20261031_add_app_data_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vs_issue_matrix_config",
        sa.Column("row_ids", sa.JSON(), nullable=True),
    )
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, rows FROM vs_issue_matrix_config")).mappings()
    for config in rows:
        payload = config["rows"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        row_ids = [f"IM-{config['id']}-{index + 1}" for index, _ in enumerate(payload or [])]
        connection.execute(
            sa.text("UPDATE vs_issue_matrix_config SET row_ids = :row_ids WHERE id = :id"),
            {"row_ids": json.dumps(row_ids), "id": config["id"]},
        )
    with op.batch_alter_table("vs_issue_matrix_config") as batch_op:
        batch_op.alter_column("row_ids", existing_type=sa.JSON(), nullable=False)


def downgrade() -> None:
    op.drop_column("vs_issue_matrix_config", "row_ids")
