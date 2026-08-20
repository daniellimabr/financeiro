from datetime import date
from decimal import Decimal

import pytest

from app.categories.service import create_group, create_subcategory
from app.models.orcamento import OrcamentoTipo
from app.models.user import User
from app.orcamentos.service import create_orcamento, orcamentos_vigentes_query


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def subcategory(db_session, user):
    group = create_group(db_session, user.id, nome="Moradia")
    return create_subcategory(db_session, user.id, group_id=group.id, nome="Aluguel", natureza=None)


def _vigentes(db_session, user, ano, mes):
    return orcamentos_vigentes_query(db_session, user.id, ano=ano, mes=mes).all()


def test_eventual_vigente_only_in_exact_month(db_session, user, subcategory):
    create_orcamento(
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

    assert len(_vigentes(db_session, user, 2026, 3)) == 1
    assert len(_vigentes(db_session, user, 2026, 2)) == 0
    assert len(_vigentes(db_session, user, 2026, 4)) == 0
    assert len(_vigentes(db_session, user, 2025, 3)) == 0


def test_recorrente_without_data_fim_vigente_ad_eternum(db_session, user, subcategory):
    create_orcamento(
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

    assert len(_vigentes(db_session, user, 2025, 12)) == 0
    assert len(_vigentes(db_session, user, 2026, 1)) == 1
    assert len(_vigentes(db_session, user, 2026, 6)) == 1
    # Mês arbitrariamente distante no futuro — tempo constante, sem expandir série.
    assert len(_vigentes(db_session, user, 2099, 12)) == 1


def test_recorrente_with_data_fim_vigente_only_within_range(db_session, user, subcategory):
    create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.recorrente,
        valor=Decimal("300.00"),
        ano=None,
        mes=None,
        data_inicio=date(2026, 3, 1),
        data_fim=date(2026, 5, 31),
    )

    assert len(_vigentes(db_session, user, 2026, 2)) == 0
    assert len(_vigentes(db_session, user, 2026, 3)) == 1
    assert len(_vigentes(db_session, user, 2026, 4)) == 1
    assert len(_vigentes(db_session, user, 2026, 5)) == 1
    assert len(_vigentes(db_session, user, 2026, 6)) == 0


def test_recorrente_data_fim_boundary_uses_month_not_day(db_session, user, subcategory):
    # data_fim no dia 5 do mês ainda conta o mês inteiro como vigente
    # (comparação por mês/ano, não por dia).
    create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.recorrente,
        valor=Decimal("300.00"),
        ano=None,
        mes=None,
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 5, 5),
    )

    assert len(_vigentes(db_session, user, 2026, 5)) == 1
    assert len(_vigentes(db_session, user, 2026, 6)) == 0


def test_multiple_vigentes_same_subcategory_both_returned(db_session, user, subcategory):
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
    create_orcamento(
        db_session,
        user.id,
        subcategory_id=subcategory.id,
        tipo=OrcamentoTipo.recorrente,
        valor=Decimal("50.00"),
        ano=None,
        mes=None,
        data_inicio=date(2026, 1, 1),
        data_fim=None,
    )

    assert len(_vigentes(db_session, user, 2026, 3)) == 2


def test_vigencia_isolated_by_user(db_session, user, subcategory):
    other = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

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

    assert _vigentes(db_session, other, 2026, 3) == []
