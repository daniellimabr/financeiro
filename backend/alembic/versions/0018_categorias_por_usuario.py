"""categorias por usuario: user_id em category_groups/subcategories, clona
catalogo global (ate entao unico) para cada usuario existente e repontoa
pluggy_transactions/categorization_rules; unicidade de grupo passa a ser
por (user_id, nome)

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tabelas mínimas declaradas aqui (não importadas de app/) porque migrations
# não devem depender de código que muda depois — mesmo precedente das
# migrations 0012/0013 (lookup/backfill via SQL própria).
_metadata = sa.MetaData()

_category_groups = sa.Table(
    "category_groups",
    _metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer),
    sa.Column("nome", sa.String(255)),
    sa.Column("excluir_de_totais", sa.Boolean),
)

_natureza_enum_no_create = postgresql.ENUM(
    "fixa", "variavel", "eventual", name="natureza", create_type=False
)

_subcategories = sa.Table(
    "subcategories",
    _metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer),
    sa.Column("group_id", sa.Integer),
    sa.Column("nome", sa.String(255)),
    sa.Column("natureza", _natureza_enum_no_create),
)

_pluggy_transactions = sa.Table(
    "pluggy_transactions",
    _metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer),
    sa.Column("subcategory_id", sa.Integer),
    sa.Column("subcategoria_sugerida_id", sa.Integer),
)

_categorization_rules = sa.Table(
    "categorization_rules",
    _metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer),
    sa.Column("subcategory_id", sa.Integer),
)

_users = sa.Table(
    "users",
    _metadata,
    sa.Column("id", sa.Integer, primary_key=True),
)


def _clone_catalog_for_user(
    conn,
    *,
    user_id: int,
    grupos: list[tuple[int, str, bool]],
    subcategorias: list[tuple[int, int, str, str | None]],
) -> tuple[dict[int, int], dict[int, int]]:
    """Clona o catálogo (grupos, subcategorias) para `user_id`. `grupos` é
    uma lista de (id_antigo, nome, excluir_de_totais); `subcategorias` é uma
    lista de (id_antigo, group_id_antigo, nome, natureza). Retorna os mapas
    id_antigo -> id_novo de grupo e de subcategoria."""
    grupo_id_map: dict[int, int] = {}
    for old_id, nome, excluir_de_totais in grupos:
        result = conn.execute(
            _category_groups.insert().values(
                user_id=user_id, nome=nome, excluir_de_totais=excluir_de_totais
            )
        )
        grupo_id_map[old_id] = result.inserted_primary_key[0]

    subcategoria_id_map: dict[int, int] = {}
    for old_id, old_group_id, nome, natureza in subcategorias:
        result = conn.execute(
            _subcategories.insert().values(
                user_id=user_id,
                group_id=grupo_id_map[old_group_id],
                nome=nome,
                natureza=natureza,
            )
        )
        subcategoria_id_map[old_id] = result.inserted_primary_key[0]

    return grupo_id_map, subcategoria_id_map


def _repoint_references(conn, *, user_id: int, subcategoria_id_map: dict[int, int]) -> None:
    """Repontoa subcategory_id/subcategoria_sugerida_id de
    pluggy_transactions e subcategory_id de categorization_rules do
    usuário, da subcategoria global antiga para a cópia nova dele."""
    for old_id, new_id in subcategoria_id_map.items():
        conn.execute(
            _pluggy_transactions.update()
            .where(
                _pluggy_transactions.c.user_id == user_id,
                _pluggy_transactions.c.subcategory_id == old_id,
            )
            .values(subcategory_id=new_id)
        )
        conn.execute(
            _pluggy_transactions.update()
            .where(
                _pluggy_transactions.c.user_id == user_id,
                _pluggy_transactions.c.subcategoria_sugerida_id == old_id,
            )
            .values(subcategoria_sugerida_id=new_id)
        )
        conn.execute(
            _categorization_rules.update()
            .where(
                _categorization_rules.c.user_id == user_id,
                _categorization_rules.c.subcategory_id == old_id,
            )
            .values(subcategory_id=new_id)
        )


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column(
        "category_groups",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column(
        "subcategories",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_category_groups_user_id", "category_groups", ["user_id"])
    op.create_index("ix_subcategories_user_id", "subcategories", ["user_id"])

    # Precisa cair antes do loop de clonagem: enquanto as linhas globais
    # ainda existem (só são removidas depois de clonadas para todos os
    # usuários), o índice único antigo em `nome` sozinho rejeitaria a cópia
    # de cada usuário com IntegrityError (mesmo nome, dono diferente) — achado
    # real ao aplicar contra a VM de dev, rollback automático do Postgres
    # (transação da migration) confirmou que nenhum dado real foi tocado.
    op.drop_index("ix_category_groups_nome", table_name="category_groups")

    grupos_globais = [
        (row.id, row.nome, row.excluir_de_totais)
        for row in bind.execute(
            sa.select(_category_groups).where(_category_groups.c.user_id.is_(None))
        )
    ]
    subcategorias_globais = [
        (row.id, row.group_id, row.nome, row.natureza)
        for row in bind.execute(sa.select(_subcategories).where(_subcategories.c.user_id.is_(None)))
    ]
    usuarios = [row.id for row in bind.execute(sa.select(_users.c.id))]

    for user_id in usuarios:
        _, subcategoria_id_map = _clone_catalog_for_user(
            bind, user_id=user_id, grupos=grupos_globais, subcategorias=subcategorias_globais
        )
        _repoint_references(bind, user_id=user_id, subcategoria_id_map=subcategoria_id_map)

    bind.execute(_subcategories.delete().where(_subcategories.c.user_id.is_(None)))
    bind.execute(_category_groups.delete().where(_category_groups.c.user_id.is_(None)))

    op.alter_column("category_groups", "user_id", nullable=False)
    op.alter_column("subcategories", "user_id", nullable=False)

    op.create_index("ix_category_groups_nome", "category_groups", ["nome"])
    op.create_unique_constraint(
        "uq_category_group_user_nome", "category_groups", ["user_id", "nome"]
    )


def downgrade() -> None:
    # Best-effort/irreversível: fundir as cópias por usuário de volta a um
    # único catálogo global não é uma operação limpa — perderia qualquer
    # edição divergente feita por cada usuário após a migração (renomeios,
    # exclusões, grupos/subcategorias novas). O downgrade desfaz só a parte
    # de schema (colunas/índices/constraint novos); não recria o catálogo
    # global original nem reverte o repontamento de FKs.
    op.drop_constraint("uq_category_group_user_nome", "category_groups", type_="unique")
    op.drop_index("ix_category_groups_nome", table_name="category_groups")
    op.create_index("ix_category_groups_nome", "category_groups", ["nome"], unique=True)
    op.drop_index("ix_subcategories_user_id", table_name="subcategories")
    op.drop_index("ix_category_groups_user_id", table_name="category_groups")
    op.drop_column("subcategories", "user_id")
    op.drop_column("category_groups", "user_id")
