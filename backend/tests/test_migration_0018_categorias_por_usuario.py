import importlib.util
from datetime import date
from pathlib import Path

import pytest

from app.models.categorization import CategorizationRule
from app.models.category import CategoryGroup, Subcategory
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_SEQ = iter(range(1, 10_000))

_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1] / "alembic" / "versions" / "0018_categorias_por_usuario.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0018", _MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def migration():
    return _load_migration()


@pytest.fixture()
def user(db_session):
    n = next(_SEQ)
    u = User(google_sub=f"google-{n}", email=f"user{n}@example.com", name="Alice")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture()
def other_user(db_session):
    n = next(_SEQ)
    u = User(google_sub=f"google-{n}", email=f"user{n}@example.com", name="Bob")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def test_clone_catalog_for_user_creates_isolated_copy_with_id_mapping(db_session, user, migration):
    grupos = [(101, "Moradia", False)]
    subcategorias = [(201, 101, "Aluguel", "fixa"), (202, 101, "Condomínio", None)]

    grupo_map, subcategoria_map = migration._clone_catalog_for_user(
        db_session, user_id=user.id, grupos=grupos, subcategorias=subcategorias
    )
    db_session.commit()

    assert set(grupo_map.keys()) == {101}
    assert set(subcategoria_map.keys()) == {201, 202}

    novo_grupo = db_session.get(CategoryGroup, grupo_map[101])
    assert novo_grupo.user_id == user.id
    assert novo_grupo.nome == "Moradia"
    assert novo_grupo.excluir_de_totais is False

    novo_sub = db_session.get(Subcategory, subcategoria_map[201])
    assert novo_sub.user_id == user.id
    assert novo_sub.group_id == grupo_map[101]
    assert novo_sub.nome == "Aluguel"
    assert novo_sub.natureza == "fixa"


def test_clone_catalog_for_user_isolated_between_two_users(db_session, user, other_user, migration):
    grupos = [(101, "Moradia", False)]
    subcategorias = [(201, 101, "Aluguel", "fixa")]

    _, map_user = migration._clone_catalog_for_user(
        db_session, user_id=user.id, grupos=grupos, subcategorias=subcategorias
    )
    _, map_other = migration._clone_catalog_for_user(
        db_session, user_id=other_user.id, grupos=grupos, subcategorias=subcategorias
    )
    db_session.commit()

    assert map_user[201] != map_other[201]
    sub_user = db_session.get(Subcategory, map_user[201])
    sub_other = db_session.get(Subcategory, map_other[201])
    assert sub_user.user_id == user.id
    assert sub_other.user_id == other_user.id


def _account(db_session, user):
    n = next(_SEQ)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{n}",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    account = PluggyAccount(
        item_id=item.id,
        user_id=user.id,
        pluggy_account_id=f"acc-{n}",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=0,
    )
    db_session.add(account)
    db_session.flush()
    return account


def test_repoint_references_updates_transactions_and_rules_for_the_right_user_only(
    db_session, user, other_user, migration
):
    account_user = _account(db_session, user)
    account_other = _account(db_session, other_user)

    old_subcategory_id = 999  # id "antigo" (da linha global, já removida na migration real)
    new_subcategory_id_user = 555

    tx_user = PluggyTransaction(
        account_id=account_user.id,
        user_id=user.id,
        pluggy_transaction_id="tx-user-1",
        descricao="Aluguel",
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        data_competencia=date(2026, 1, 10),
        subcategory_id=old_subcategory_id,
        status=PluggyTransactionStatus.efetivada,
    )
    tx_other = PluggyTransaction(
        account_id=account_other.id,
        user_id=other_user.id,
        pluggy_transaction_id="tx-other-1",
        descricao="Aluguel",
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        data_competencia=date(2026, 1, 10),
        subcategory_id=old_subcategory_id,
        status=PluggyTransactionStatus.efetivada,
    )
    rule_user = CategorizationRule(
        user_id=user.id,
        subcategory_id=old_subcategory_id,
        padrao_descricao="Aluguel",
        padrao_normalizado="aluguel",
        origem="legado",
    )
    db_session.add_all([tx_user, tx_other, rule_user])
    db_session.commit()

    migration._repoint_references(
        db_session,
        user_id=user.id,
        subcategoria_id_map={old_subcategory_id: new_subcategory_id_user},
    )
    db_session.commit()

    db_session.refresh(tx_user)
    db_session.refresh(tx_other)
    db_session.refresh(rule_user)

    assert tx_user.subcategory_id == new_subcategory_id_user
    assert rule_user.subcategory_id == new_subcategory_id_user
    # transação de outro usuário nunca é tocada, mesmo referenciando o mesmo id antigo.
    assert tx_other.subcategory_id == old_subcategory_id
