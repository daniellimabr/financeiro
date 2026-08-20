from datetime import date
from decimal import Decimal

import pytest

from app.categories.service import (
    create_group,
    create_subcategory,
    delete_group,
    delete_subcategory,
    get_group,
    get_subcategory,
    list_groups,
    list_subcategories,
)
from app.exceptions import DuplicateNameError, InvalidStateError, NotFoundError
from app.models.categorization import CategorizationRule
from app.models.category import Natureza
from app.models.orcamento import OrcamentoTipo
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
from app.orcamentos.service import create_orcamento


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def other_user(db_session):
    user = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_create_group_rejects_duplicate_name_case_insensitive(db_session, user):
    create_group(db_session, user.id, nome="Moradia")

    with pytest.raises(DuplicateNameError):
        create_group(db_session, user.id, nome="moradia")


def test_create_group_allows_same_name_for_different_users(db_session, user, other_user):
    create_group(db_session, user.id, nome="Moradia")

    group = create_group(db_session, other_user.id, nome="Moradia")

    assert group.id is not None


def test_create_subcategory_rejects_duplicate_name_within_group(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    create_subcategory(db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None)

    with pytest.raises(DuplicateNameError):
        create_subcategory(db_session, user.id, group_id=group.id, nome="aluguel", natureza=None)


def test_create_subcategory_allows_same_name_in_different_groups(db_session, user):
    group_a = create_group(db_session, user.id, nome="Moradia")
    group_b = create_group(db_session, user.id, nome="Veículos")

    create_subcategory(db_session, user.id, group_id=group_a.id, nome="Seguro", natureza=None)
    subcategory_b = create_subcategory(
        db_session, user.id, group_id=group_b.id, nome="Seguro", natureza=None
    )

    assert subcategory_b.id is not None


def test_create_subcategory_requires_existing_group(db_session, user):
    with pytest.raises(NotFoundError):
        create_subcategory(db_session, user.id, group_id=999, nome="Aluguel", natureza=None)


def test_create_subcategory_accepts_valid_natureza(db_session, user):
    group = create_group(db_session, user.id, nome="Lazer")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Viagens", natureza=Natureza.eventual
    )

    assert subcategory.natureza == Natureza.eventual


def test_list_groups_isolated_by_user(db_session, user, other_user):
    create_group(db_session, user.id, nome="Moradia")
    create_group(db_session, other_user.id, nome="Lazer")

    groups = list_groups(db_session, user.id)

    assert [g.nome for g in groups] == ["Moradia"]


def test_get_other_users_group_returns_not_found(db_session, user, other_user):
    group = create_group(db_session, user.id, nome="Moradia")

    with pytest.raises(NotFoundError):
        get_group(db_session, other_user.id, group.id)


def test_list_subcategories_isolated_by_user(db_session, user, other_user):
    group_a = create_group(db_session, user.id, nome="Moradia")
    group_b = create_group(db_session, other_user.id, nome="Moradia")
    create_subcategory(db_session, user.id, group_id=group_a.id, nome="Aluguel", natureza=None)
    create_subcategory(
        db_session, other_user.id, group_id=group_b.id, nome="Aluguel", natureza=None
    )

    subcategories = list_subcategories(db_session, user.id)

    assert len(subcategories) == 1
    assert subcategories[0].user_id == user.id


def test_get_other_users_subcategory_returns_not_found(db_session, user, other_user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )

    with pytest.raises(NotFoundError):
        get_subcategory(db_session, other_user.id, subcategory.id)


def test_delete_other_users_group_returns_not_found(db_session, user, other_user):
    group = create_group(db_session, user.id, nome="Moradia")

    with pytest.raises(NotFoundError):
        delete_group(db_session, other_user.id, group.id)


def test_delete_other_users_subcategory_returns_not_found(db_session, user, other_user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )

    with pytest.raises(NotFoundError):
        delete_subcategory(db_session, other_user.id, subcategory.id)


# --- bloqueio de exclusão de subcategoria/grupo em uso (PRD-030) -----------


def _account(db_session, user):
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id="item-1",
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
        pluggy_account_id="acc-1",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    return account


def test_delete_subcategory_blocked_when_used_by_transaction(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )
    account = _account(db_session, user)
    db_session.add(
        PluggyTransaction(
            account_id=account.id,
            user_id=user.id,
            pluggy_transaction_id="tx-1",
            descricao="Aluguel",
            valor=Decimal("-1000.00"),
            tipo=PluggyTransactionTipo.debito,
            data=date(2026, 1, 5),
            data_competencia=date(2026, 1, 5),
            subcategory_id=subcategory.id,
            status=PluggyTransactionStatus.efetivada,
        )
    )
    db_session.commit()

    with pytest.raises(InvalidStateError):
        delete_subcategory(db_session, user.id, subcategory.id)


def test_delete_subcategory_blocked_when_used_by_categorization_rule(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )
    db_session.add(
        CategorizationRule(
            user_id=user.id,
            subcategory_id=subcategory.id,
            padrao_descricao="Imobiliaria XYZ",
            padrao_normalizado="imobiliaria xyz",
            origem="manual",
        )
    )
    db_session.commit()

    with pytest.raises(InvalidStateError):
        delete_subcategory(db_session, user.id, subcategory.id)


def test_delete_subcategory_blocked_when_used_by_orcamento(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )
    create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("1000.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    with pytest.raises(InvalidStateError):
        delete_subcategory(db_session, user.id, subcategory.id)


def test_delete_subcategory_succeeds_when_free(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )

    delete_subcategory(db_session, user.id, subcategory.id)

    with pytest.raises(NotFoundError):
        get_subcategory(db_session, user.id, subcategory.id)


def test_delete_group_blocked_when_a_subcategory_is_in_use(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    subcategory = create_subcategory(
        db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None
    )
    account = _account(db_session, user)
    db_session.add(
        PluggyTransaction(
            account_id=account.id,
            user_id=user.id,
            pluggy_transaction_id="tx-1",
            descricao="Aluguel",
            valor=Decimal("-1000.00"),
            tipo=PluggyTransactionTipo.debito,
            data=date(2026, 1, 5),
            data_competencia=date(2026, 1, 5),
            subcategory_id=subcategory.id,
            status=PluggyTransactionStatus.efetivada,
        )
    )
    db_session.commit()

    with pytest.raises(InvalidStateError):
        delete_group(db_session, user.id, group.id)


def test_delete_group_succeeds_when_all_subcategories_are_free(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    create_subcategory(db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None)

    delete_group(db_session, user.id, group.id)

    with pytest.raises(NotFoundError):
        get_group(db_session, user.id, group.id)
