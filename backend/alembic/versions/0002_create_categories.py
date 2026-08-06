"""create category_groups and subcategories tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-05

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

natureza_enum = sa.Enum("fixa", "variavel", "eventual", name="natureza")


def upgrade() -> None:
    op.create_table(
        "category_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_category_groups_nome", "category_groups", ["nome"], unique=True)

    natureza_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "subcategories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("category_groups.id"), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("natureza", natureza_enum, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("group_id", "nome", name="uq_subcategory_group_nome"),
    )


def downgrade() -> None:
    op.drop_table("subcategories")
    natureza_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_index("ix_category_groups_nome", table_name="category_groups")
    op.drop_table("category_groups")
