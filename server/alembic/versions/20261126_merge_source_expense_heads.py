"""Merge the work order source and expense migration heads."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261126_merge_source_expense_heads"
down_revision: Union[str, Sequence[str], None] = (
    "20261119_add_expenses_and_claims_tables",
    "20261126_add_source_to_complaint",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
