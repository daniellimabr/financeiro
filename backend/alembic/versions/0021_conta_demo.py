"""adiciona users.is_demo — flag do usuário sentinela da conta demo (Sprint 37,
PRD-037), nunca criado via /auth/google/*, só via GET /demo/enter

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-03

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "is_demo")
