from datetime import date
from decimal import Decimal

import pytest

from app.categories.service import create_group, create_subcategory
from app.exceptions import NotFoundError
from app.models.orcamento import OrcamentoTipo
from app.models.user import User
from app.orcamentos.service import (
    create_orcamento,
    delete_orcamento,
    get_orcamento,
    list_orcamentos,
    update_orcamento,
)


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


@pytest.fixture()
def subcategory(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    return create_subcategory(db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None)


def test_create_orcamento_eventual(db_session, user, subcategory):
    orcamento = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("500.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    assert orcamento.id is not None
    assert orcamento.tipo == OrcamentoTipo.eventual
    assert orcamento.ano == 2026
    assert orcamento.mes == 3


def test_create_orcamento_recorrente_without_data_fim(db_session, user, subcategory):
    orcamento = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.recorrente,
        valor=Decimal("800.00"),
        ano=None,
        mes=None,
        data_inicio=date(2026, 1, 1),
        data_fim=None,
    )

    assert orcamento.data_inicio == date(2026, 1, 1)
    assert orcamento.data_fim is None


def test_create_orcamento_requires_existing_subcategory(db_session, user):
    with pytest.raises(NotFoundError):
        create_orcamento(
            db_session,
            user.id,
            subcategory_id=999,
            tipo=OrcamentoTipo.eventual,
            valor=Decimal("100.00"),
            ano=2026,
            mes=1,
            data_inicio=None,
            data_fim=None,
        )


def test_create_orcamento_rejects_other_users_subcategory(
    db_session, user, other_user, subcategory
):
    with pytest.raises(NotFoundError):
        create_orcamento(
            db_session,
            other_user.id,
            subcategory_id=subcategory.id,
            tipo=OrcamentoTipo.eventual,
            valor=Decimal("100.00"),
            ano=2026,
            mes=1,
            data_inicio=None,
            data_fim=None,
        )


def test_multiple_orcamentos_allowed_for_same_subcategory(db_session, user, subcategory):
    first = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("100.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )
    second = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("50.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    orcamentos = list_orcamentos(db_session, user.id)
    assert {o.id for o in orcamentos} == {first.id, second.id}


def test_update_orcamento(db_session, user, subcategory):
    orcamento = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("100.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    updated = update_orcamento(
        db_session,
        user.id,
        orcamento.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("200.00"),
        ano=2026,
        mes=4,
        data_inicio=None,
        data_fim=None,
    )

    assert updated.valor == Decimal("200.00")
    assert updated.mes == 4


def test_update_other_users_orcamento_raises_not_found(db_session, user, other_user, subcategory):
    orcamento = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("100.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    with pytest.raises(NotFoundError):
        update_orcamento(
            db_session,
            other_user.id,
            orcamento.id,
            subcategory_id=subcategory.id,
            tipo=OrcamentoTipo.eventual,
            valor=Decimal("999.00"),
            ano=2026,
            mes=3,
            data_inicio=None,
            data_fim=None,
        )


def test_delete_orcamento(db_session, user, subcategory):
    orcamento = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("100.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    delete_orcamento(db_session, user.id, orcamento.id)

    with pytest.raises(NotFoundError):
        get_orcamento(db_session, user.id, orcamento.id)


def test_delete_other_users_orcamento_raises_not_found(db_session, user, other_user, subcategory):
    orcamento = create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("100.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    with pytest.raises(NotFoundError):
        delete_orcamento(db_session, other_user.id, orcamento.id)


def test_list_orcamentos_isolated_by_user(db_session, user, other_user, subcategory):
    create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.eventual,
        valor=Decimal("100.00"),
        ano=2026,
        mes=3,
        data_inicio=None,
        data_fim=None,
    )

    assert list_orcamentos(db_session, other_user.id) == []
