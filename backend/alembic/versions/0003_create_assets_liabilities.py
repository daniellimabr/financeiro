"""create assets and liabilities tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-05

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

asset_tipo_enum = sa.Enum("imovel", "veiculo", "outro", name="asset_tipo")
asset_status_enum = sa.Enum("ativo", "baixado", name="asset_status")
liability_tipo_enum = sa.Enum("financiamento", "outro", name="liability_tipo")
liability_status_enum = sa.Enum("ativo", "quitado", name="liability_status")

asset_tipo_enum_no_create = sa.Enum(
    "imovel", "veiculo", "outro", name="asset_tipo", create_type=False
)
asset_status_enum_no_create = sa.Enum("ativo", "baixado", name="asset_status", create_type=False)
liability_tipo_enum_no_create = sa.Enum(
    "financiamento", "outro", name="liability_tipo", create_type=False
)
liability_status_enum_no_create = sa.Enum(
    "ativo", "quitado", name="liability_status", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    asset_tipo_enum.create(bind, checkfirst=True)
    asset_status_enum.create(bind, checkfirst=True)
    liability_tipo_enum.create(bind, checkfirst=True)
    liability_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("tipo", asset_tipo_enum_no_create, nullable=False),
        sa.Column("valor_atual", sa.Numeric(14, 2), nullable=False),
        sa.Column("data_aquisicao", sa.Date(), nullable=False),
        sa.Column("status", asset_status_enum_no_create, nullable=False, server_default="ativo"),
        sa.Column("data_venda", sa.Date(), nullable=True),
        sa.Column("valor_venda", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_assets_user_id", "assets", ["user_id"])

    op.create_table(
        "liabilities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("tipo", liability_tipo_enum_no_create, nullable=False),
        sa.Column("valor_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("saldo_devedor", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "status", liability_status_enum_no_create, nullable=False, server_default="ativo"
        ),
        sa.Column("data_quitacao", sa.Date(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_liabilities_user_id", "liabilities", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_liabilities_user_id", table_name="liabilities")
    op.drop_table("liabilities")
    op.drop_index("ix_assets_user_id", table_name="assets")
    op.drop_table("assets")

    bind = op.get_bind()
    liability_status_enum.drop(bind, checkfirst=True)
    liability_tipo_enum.drop(bind, checkfirst=True)
    asset_status_enum.drop(bind, checkfirst=True)
    asset_tipo_enum.drop(bind, checkfirst=True)
