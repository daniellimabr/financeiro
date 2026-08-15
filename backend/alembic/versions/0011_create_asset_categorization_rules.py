"""create asset_categorization_rules

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_categorization_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset_id", sa.Integer(), sa.ForeignKey("assets.id"), nullable=False),
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
    op.create_index(
        "ix_asset_categorization_rules_user_id", "asset_categorization_rules", ["user_id"]
    )
    op.create_index(
        "uq_asset_categorization_rule_user_padrao",
        "asset_categorization_rules",
        ["user_id", "padrao_normalizado"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_asset_categorization_rule_user_padrao", table_name="asset_categorization_rules"
    )
    op.drop_index("ix_asset_categorization_rules_user_id", table_name="asset_categorization_rules")
    op.drop_table("asset_categorization_rules")
