"""create categorization_rules

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "categorization_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "subcategory_id", sa.Integer(), sa.ForeignKey("subcategories.id"), nullable=False
        ),
        sa.Column("padrao_descricao", sa.String(length=500), nullable=False),
        sa.Column("padrao_normalizado", sa.String(length=500), nullable=False),
        sa.Column("origem", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_categorization_rules_user_id", "categorization_rules", ["user_id"])
    op.create_index(
        "uq_categorization_rule_user_padrao",
        "categorization_rules",
        ["user_id", "padrao_normalizado"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_categorization_rule_user_padrao", table_name="categorization_rules")
    op.drop_index("ix_categorization_rules_user_id", table_name="categorization_rules")
    op.drop_table("categorization_rules")
