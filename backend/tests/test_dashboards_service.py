from datetime import date
from decimal import Decimal

import pytest

from app.dashboards import service
from app.models.asset import Asset, AssetStatus, AssetTipo
from app.models.category import CategoryGroup, Subcategory
from app.models.liability import Liability, LiabilityStatus, LiabilityTipo
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


@pytest.fixture()
def user(db_session):
    n = next(_SEQ)
    u = User(google_sub=f"google-{n}", email=f"user{n}@example.com", name="Alice")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _group(db_session, nome=None, excluir_de_totais=False):
    group = CategoryGroup(nome=nome or f"Grupo {next(_SEQ)}", excluir_de_totais=excluir_de_totais)
    db_session.add(group)
    db_session.flush()
    return group


def _subcategory(db_session, group=None, nome=None):
    group = group or _group(db_session)
    s = Subcategory(group_id=group.id, nome=nome or f"Sub {next(_SEQ)}")
    db_session.add(s)
    db_session.flush()
    return s


def _account(db_session, user, tipo=PluggyAccountTipo.corrente, saldo=Decimal("0")):
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
        tipo=tipo,
        nome="Conta",
        saldo=saldo,
    )
    db_session.add(account)
    db_session.flush()
    return account


def _transaction(
    db_session,
    user,
    account,
    *,
    valor,
    tipo,
    data,
    data_competencia=None,
    subcategory_id=None,
):
    n = next(_SEQ)
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{n}",
        descricao=f"Transacao {n}",
        valor=Decimal(valor),
        tipo=tipo,
        data=data,
        data_competencia=data_competencia if data_competencia is not None else data,
        subcategory_id=subcategory_id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.flush()
    return tx


def test_get_summary_empty_period_returns_zeros(db_session, user):
    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert summary.receita == Decimal("0")
    assert summary.despesa == Decimal("0")
    assert summary.saldo == Decimal("0")
    assert summary.patrimonio == Decimal("0")


def test_get_summary_period_with_only_transferencia_interna_is_zeroed(db_session, user):
    account = _account(db_session, user)
    transferencia = _group(db_session, nome="Transferência interna", excluir_de_totais=True)
    sub = _subcategory(db_session, group=transferencia, nome="Pagamento de Fatura")
    _transaction(
        db_session,
        user,
        account,
        valor="500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        subcategory_id=sub.id,
    )

    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert summary.receita == Decimal("0")
    assert summary.despesa == Decimal("0")
    assert summary.saldo == Decimal("0")


def test_get_summary_mixed_debito_credito_computes_saldo(db_session, user):
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        valor="-200.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 6),
    )

    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert summary.despesa == Decimal("200.00")
    assert summary.receita == Decimal("1000.00")
    assert summary.saldo == Decimal("800.00")


def test_get_summary_patrimonio_subtracts_cartao_credito_balance(db_session, user):
    _account(db_session, user, tipo=PluggyAccountTipo.corrente, saldo=Decimal("1000.00"))
    _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito, saldo=Decimal("300.00"))

    summary = service.get_summary(db_session, user.id)

    assert summary.patrimonio == Decimal("700.00")


def test_get_summary_patrimonio_excludes_inactive_assets_and_liabilities(db_session, user):
    db_session.add_all(
        [
            Asset(
                user_id=user.id,
                nome="Carro",
                tipo=AssetTipo.veiculo,
                valor_atual=Decimal("50000.00"),
                data_aquisicao=date(2020, 1, 1),
                status=AssetStatus.ativo,
            ),
            Asset(
                user_id=user.id,
                nome="Carro vendido",
                tipo=AssetTipo.veiculo,
                valor_atual=Decimal("20000.00"),
                data_aquisicao=date(2019, 1, 1),
                status=AssetStatus.baixado,
            ),
            Liability(
                user_id=user.id,
                nome="Financiamento",
                tipo=LiabilityTipo.financiamento,
                valor_total=Decimal("10000.00"),
                saldo_devedor=Decimal("4000.00"),
                status=LiabilityStatus.ativo,
            ),
            Liability(
                user_id=user.id,
                nome="Quitado",
                tipo=LiabilityTipo.financiamento,
                valor_total=Decimal("5000.00"),
                saldo_devedor=Decimal("0.00"),
                status=LiabilityStatus.quitado,
            ),
        ]
    )
    db_session.commit()

    summary = service.get_summary(db_session, user.id)

    assert summary.patrimonio == Decimal("46000.00")


def test_get_summary_month_boundary_filters_by_data_competencia(db_session, user):
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 31),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 1),
    )

    january = service.get_summary(db_session, user.id, ano=2026, mes=1)
    february = service.get_summary(db_session, user.id, ano=2026, mes=2)

    assert january.despesa == Decimal("100.00")
    assert february.despesa == Decimal("50.00")


def test_get_por_categoria_sums_match_summary_and_bucket_uncategorized(db_session, user):
    account = _account(db_session, user)
    group = _group(db_session, nome="Alimentação")
    sub = _subcategory(db_session, group=group, nome="Mercado")
    _transaction(
        db_session,
        user,
        account,
        valor="-150.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        subcategory_id=sub.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-30.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 11),
        subcategory_id=None,
    )

    por_categoria = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )
    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert sum(c.total for c in por_categoria) == summary.despesa
    categorizado = next(c for c in por_categoria if c.subcategory_id == sub.id)
    assert categorizado.total == Decimal("150.00")
    assert categorizado.group_nome == "Alimentação"
    nao_categorizado = next(
        c for c in por_categoria if c.subcategory_id == service.SEM_CATEGORIA_ID
    )
    assert nao_categorizado.total == Decimal("30.00")
    assert nao_categorizado.subcategory_nome == "Não categorizado"


def test_get_por_meio_pagamento_groups_by_account_tipo(db_session, user):
    corrente = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    cartao = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    _transaction(
        db_session,
        user,
        corrente,
        valor="-80.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
    )
    _transaction(
        db_session,
        user,
        cartao,
        valor="120.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
    )

    resultado = service.get_por_meio_pagamento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    totals = {r.account_tipo: r.total for r in resultado}
    assert totals[PluggyAccountTipo.corrente] == Decimal("80.00")
    assert totals[PluggyAccountTipo.cartao_credito] == Decimal("120.00")


def test_get_por_meio_pagamento_filters_by_categoria_id(db_session, user):
    account = _account(db_session, user)
    group = _group(db_session, nome="Alimentação")
    sub = _subcategory(db_session, group=group, nome="Mercado")
    other_sub = _subcategory(db_session, group=group, nome="Restaurante")
    _transaction(
        db_session,
        user,
        account,
        valor="-40.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-60.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
        subcategory_id=other_sub.id,
    )

    resultado = service.get_por_meio_pagamento(
        db_session,
        user.id,
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=1,
        categoria_id=sub.id,
    )

    assert len(resultado) == 1
    assert resultado[0].total == Decimal("40.00")


def test_get_por_meio_pagamento_filters_by_categoria_id_uncategorized(db_session, user):
    account = _account(db_session, user)
    group = _group(db_session, nome="Alimentação")
    sub = _subcategory(db_session, group=group, nome="Mercado")
    _transaction(
        db_session,
        user,
        account,
        valor="-40.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-15.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
        subcategory_id=None,
    )

    resultado = service.get_por_meio_pagamento(
        db_session,
        user.id,
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=1,
        categoria_id=service.SEM_CATEGORIA_ID,
    )

    assert len(resultado) == 1
    assert resultado[0].total == Decimal("15.00")


def test_summary_and_por_categoria_isolated_by_user(db_session, user):
    other = User(google_sub="google-other", email="other@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    _transaction(
        db_session,
        other,
        account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
    )

    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)
    por_categoria = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert summary.despesa == Decimal("0")
    assert por_categoria == []
