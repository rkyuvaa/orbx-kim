"""Add shared application data documents."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261031_add_app_data_documents"
down_revision: Union[str, None] = "20261031_add_service_workflow_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "app_data_documents" in inspector.get_table_names():
        return

    op.create_table(
        "app_data_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_app_data_documents_key"),
    )


def downgrade() -> None:
    op.drop_table("app_data_documents")
