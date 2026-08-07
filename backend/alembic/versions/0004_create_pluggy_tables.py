"""create pluggy tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-07

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

item_status_enum = postgresql.ENUM(
    "updating",
    "updated",
    "login_error",
    "waiting_user_input",
    "outdated",
    "error",
    name="pluggy_item_status",
)
item_status_enum_no_create = postgresql.ENUM(
    "updating",
    "updated",
    "login_error",
    "waiting_user_input",
    "outdated",
    "error",
    name="pluggy_item_status",
    create_type=False,
)
account_tipo_enum = postgresql.ENUM(
    "corrente", "poupanca", "cartao_credito", "investimento", name="pluggy_account_tipo"
)
account_tipo_enum_no_create = postgresql.ENUM(
    "corrente",
    "poupanca",
    "cartao_credito",
    "investimento",
    name="pluggy_account_tipo",
    create_type=False,
)
transaction_tipo_enum = postgresql.ENUM("debito", "credito", name="pluggy_transaction_tipo")
transaction_tipo_enum_no_create = postgresql.ENUM(
    "debito", "credito", name="pluggy_transaction_tipo", create_type=False
)
transaction_status_enum = postgresql.ENUM("pendente", "efetivada", name="pluggy_transaction_status")
transaction_status_enum_no_create = postgresql.ENUM(
    "pendente", "efetivada", name="pluggy_transaction_status", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    item_status_enum.create(bind, checkfirst=True)
    account_tipo_enum.create(bind, checkfirst=True)
    transaction_tipo_enum.create(bind, checkfirst=True)
    transaction_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "pluggy_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pluggy_item_id", sa.String(length=255), nullable=False),
        sa.Column("connector_id", sa.Integer(), nullable=False),
        sa.Column("connector_name", sa.String(length=255), nullable=False),
        sa.Column("status", item_status_enum_no_create, nullable=False),
        sa.Column("status_detail", sa.String(length=255), nullable=True),
        sa.Column("cutoff_date", sa.Date(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_pluggy_items_user_id", "pluggy_items", ["user_id"])
    op.create_index(
        "ix_pluggy_items_pluggy_item_id", "pluggy_items", ["pluggy_item_id"], unique=True
    )

    op.create_table(
        "pluggy_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("pluggy_items.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pluggy_account_id", sa.String(length=255), nullable=False),
        sa.Column("tipo", account_tipo_enum_no_create, nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("numero_mascarado", sa.String(length=50), nullable=True),
        sa.Column("saldo", sa.Numeric(14, 2), nullable=False),
        sa.Column("moeda", sa.String(length=10), nullable=False, server_default="BRL"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_pluggy_accounts_user_id", "pluggy_accounts", ["user_id"])
    op.create_index(
        "ix_pluggy_accounts_pluggy_account_id",
        "pluggy_accounts",
        ["pluggy_account_id"],
        unique=True,
    )

    op.create_table(
        "pluggy_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("pluggy_accounts.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pluggy_transaction_id", sa.String(length=255), nullable=False),
        sa.Column("descricao", sa.String(length=500), nullable=False),
        sa.Column("valor", sa.Numeric(14, 2), nullable=False),
        sa.Column("tipo", transaction_tipo_enum_no_create, nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("data_competencia", sa.Date(), nullable=True),
        sa.Column("subcategory_id", sa.Integer(), sa.ForeignKey("subcategories.id"), nullable=True),
        sa.Column("categoria_pluggy", sa.String(length=255), nullable=True),
        sa.Column("status", transaction_status_enum_no_create, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_pluggy_transactions_user_id", "pluggy_transactions", ["user_id"])
    op.create_index(
        "ix_pluggy_transactions_pluggy_transaction_id",
        "pluggy_transactions",
        ["pluggy_transaction_id"],
        unique=True,
    )
    op.create_index(
        "ix_pluggy_transactions_account_id_data",
        "pluggy_transactions",
        ["account_id", "data"],
    )


def downgrade() -> None:
    op.drop_index("ix_pluggy_transactions_account_id_data", table_name="pluggy_transactions")
    op.drop_index("ix_pluggy_transactions_pluggy_transaction_id", table_name="pluggy_transactions")
    op.drop_index("ix_pluggy_transactions_user_id", table_name="pluggy_transactions")
    op.drop_table("pluggy_transactions")

    op.drop_index("ix_pluggy_accounts_pluggy_account_id", table_name="pluggy_accounts")
    op.drop_index("ix_pluggy_accounts_user_id", table_name="pluggy_accounts")
    op.drop_table("pluggy_accounts")

    op.drop_index("ix_pluggy_items_pluggy_item_id", table_name="pluggy_items")
    op.drop_index("ix_pluggy_items_user_id", table_name="pluggy_items")
    op.drop_table("pluggy_items")

    bind = op.get_bind()
    transaction_status_enum.drop(bind, checkfirst=True)
    transaction_tipo_enum.drop(bind, checkfirst=True)
    account_tipo_enum.drop(bind, checkfirst=True)
    item_status_enum.drop(bind, checkfirst=True)
