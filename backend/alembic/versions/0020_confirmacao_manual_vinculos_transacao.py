"""adiciona flags de confirmação manual (asset/liability/investimento) em
pluggy_transactions — impedem que o motor de sugestão reponha um vínculo que
o usuário removeu explicitamente (achado real: Tesouro Direto Nubank voltava
a aparecer vinculado a um Pix depois de o usuário escolher "Nenhum")

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-20

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "asset_confirmado_manualmente",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "liability_confirmado_manualmente",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "investimento_confirmado_manualmente",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("pluggy_transactions", "investimento_confirmado_manualmente")
    op.drop_column("pluggy_transactions", "liability_confirmado_manualmente")
    op.drop_column("pluggy_transactions", "asset_confirmado_manualmente")
