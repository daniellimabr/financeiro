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


def test_get_summary_ativos_passivos_match_patrimonio_base(db_session, user):
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

    assert summary.ativos == Decimal("50000.00")
    assert summary.passivos == Decimal("4000.00")
    assert summary.patrimonio == summary.ativos - summary.passivos


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


def test_get_por_categoria_percentual_sums_to_100(db_session, user):
    account = _account(db_session, user)
    group = _group(db_session, nome="Alimentação")
    sub1 = _subcategory(db_session, group=group, nome="Mercado")
    sub2 = _subcategory(db_session, group=group, nome="Restaurante")
    _transaction(
        db_session,
        user,
        account,
        valor="-75.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        subcategory_id=sub1.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-25.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 11),
        subcategory_id=sub2.id,
    )

    por_categoria = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert sum(c.percentual for c in por_categoria) == Decimal("100.00")
    assert next(c for c in por_categoria if c.subcategory_id == sub1.id).percentual == Decimal(
        "75.00"
    )
    assert next(c for c in por_categoria if c.subcategory_id == sub2.id).percentual == Decimal(
        "25.00"
    )


def test_percentual_helper_returns_zero_for_zero_denominator():
    assert service._percentual(Decimal("0"), Decimal("0")) == Decimal("0")


def test_get_por_categoria_percentual_zero_when_no_data(db_session, user):
    por_categoria = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert por_categoria == []


def test_get_por_meio_pagamento_percentual(db_session, user):
    corrente = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    cartao = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    _transaction(
        db_session,
        user,
        corrente,
        valor="-60.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
    )
    _transaction(
        db_session,
        user,
        cartao,
        valor="-40.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
    )

    resultado = service.get_por_meio_pagamento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    percentuais = {r.account_tipo: r.percentual for r in resultado}
    assert percentuais[PluggyAccountTipo.corrente] == Decimal("60.00")
    assert percentuais[PluggyAccountTipo.cartao_credito] == Decimal("40.00")


def test_get_tendencia_terminates_at_filtered_month_not_calendar_month(db_session, user):
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2025, 11, 15),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-200.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2025, 12, 5),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-9999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 6, 1),
    )

    tendencia = service.get_tendencia(db_session, user.id, ano=2025, mes=12, meses=3)

    assert [(p.ano, p.mes) for p in tendencia] == [(2025, 10), (2025, 11), (2025, 12)]
    out_by_month = {(p.ano, p.mes): p for p in tendencia}
    assert out_by_month[(2025, 10)].receita == Decimal("0")
    assert out_by_month[(2025, 10)].despesa == Decimal("0")
    assert out_by_month[(2025, 11)].receita == Decimal("1000.00")
    assert out_by_month[(2025, 12)].despesa == Decimal("200.00")
    assert out_by_month[(2025, 12)].saldo == Decimal("-200.00")


def test_get_tendencia_month_without_transactions_appears_zeroed(db_session, user):
    tendencia = service.get_tendencia(db_session, user.id, ano=2026, mes=3, meses=6)

    assert len(tendencia) == 6
    assert all(p.receita == Decimal("0") and p.despesa == Decimal("0") for p in tendencia)


def test_get_tendencia_por_categoria_groups_across_months_with_uncategorized_bucket(
    db_session, user
):
    account = _account(db_session, user)
    group = _group(db_session, nome="Alimentação")
    sub = _subcategory(db_session, group=group, nome="Mercado")
    _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        subcategory_id=sub.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 10),
        subcategory_id=sub.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-20.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 11),
        subcategory_id=None,
    )

    tendencia = service.get_tendencia_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=2, meses=3
    )

    por_sub = {t.subcategory_id: t for t in tendencia}
    mercado = por_sub[sub.id]
    pontos_mercado = {(p.ano, p.mes): p.total for p in mercado.pontos}
    assert pontos_mercado[(2025, 12)] == Decimal("0")
    assert pontos_mercado[(2026, 1)] == Decimal("100.00")
    assert pontos_mercado[(2026, 2)] == Decimal("50.00")

    nao_categorizado = por_sub[service.SEM_CATEGORIA_ID]
    pontos_nc = {(p.ano, p.mes): p.total for p in nao_categorizado.pontos}
    assert pontos_nc[(2026, 2)] == Decimal("20.00")


def _asset(db_session, user, nome="Carro"):
    asset = Asset(
        user_id=user.id,
        nome=nome,
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )
    db_session.add(asset)
    db_session.flush()
    return asset


def test_get_por_ativo_no_transactions_returns_empty_list(db_session, user):
    por_ativo = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert por_ativo == []


def test_get_por_ativo_asset_without_linked_transaction_is_absent(db_session, user):
    account = _account(db_session, user)
    _asset(db_session, user, nome="Carro")
    _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )

    por_ativo = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert por_ativo == []


def test_get_por_ativo_sums_expenses_and_excludes_asset_without_transaction(db_session, user):
    account = _account(db_session, user)
    asset_com_gasto = _asset(db_session, user, nome="Carro")
    _asset(db_session, user, nome="Casa")
    tx = _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.asset_id = asset_com_gasto.id
    db_session.commit()

    por_ativo = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert len(por_ativo) == 1
    assert por_ativo[0].asset_id == asset_com_gasto.id
    assert por_ativo[0].asset_nome == "Carro"
    assert por_ativo[0].total == Decimal("300.00")


def test_get_por_ativo_filters_by_tipo(db_session, user):
    account = _account(db_session, user)
    asset_despesa = _asset(db_session, user, nome="Carro")
    asset_receita = _asset(db_session, user, nome="Apartamento alugado")
    tx_despesa = _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx_despesa.asset_id = asset_despesa.id
    tx_receita = _transaction(
        db_session,
        user,
        account,
        valor="1500.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 12),
    )
    tx_receita.asset_id = asset_receita.id
    db_session.commit()

    despesas = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )
    receitas = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.credito, ano=2026, mes=1
    )

    assert [a.asset_id for a in despesas] == [asset_despesa.id]
    assert [a.asset_id for a in receitas] == [asset_receita.id]
    assert receitas[0].total == Decimal("1500.00")


def test_get_por_ativo_isolated_by_user(db_session, user):
    other = User(google_sub="google-por-ativo-other", email="other-pa@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    asset = _asset(db_session, other)
    tx = _transaction(
        db_session,
        other,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.asset_id = asset.id
    db_session.commit()

    por_ativo = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert por_ativo == []


def test_get_tendencia_por_ativo_zero_fills_months_without_transaction(db_session, user):
    account = _account(db_session, user)
    asset = _asset(db_session, user, nome="Carro")
    tx_jan = _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx_jan.asset_id = asset.id
    tx_mar = _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 3, 5),
    )
    tx_mar.asset_id = asset.id
    db_session.commit()

    tendencia = service.get_tendencia_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=3, meses=3
    )

    assert len(tendencia) == 1
    ativo = tendencia[0]
    assert ativo.asset_id == asset.id
    assert ativo.asset_nome == "Carro"
    pontos = {(p.ano, p.mes): p.total for p in ativo.pontos}
    assert pontos[(2026, 1)] == Decimal("100.00")
    assert pontos[(2026, 2)] == Decimal("0")
    assert pontos[(2026, 3)] == Decimal("50.00")


def test_get_tendencia_por_ativo_filters_by_tipo(db_session, user):
    account = _account(db_session, user)
    asset = _asset(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )
    tx.asset_id = asset.id
    db_session.commit()

    despesas = service.get_tendencia_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1, meses=3
    )
    receitas = service.get_tendencia_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.credito, ano=2026, mes=1, meses=3
    )

    assert despesas == []
    assert len(receitas) == 1


def test_get_tendencia_por_ativo_isolated_by_user(db_session, user):
    other = User(
        google_sub="google-tendencia-ativo-other", email="other-ta@example.com", name="Bob"
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    asset = _asset(db_session, other)
    tx = _transaction(
        db_session,
        other,
        account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.asset_id = asset.id
    db_session.commit()

    tendencia = service.get_tendencia_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1, meses=3
    )

    assert tendencia == []


def test_tendencia_isolated_by_user(db_session, user):
    other = User(google_sub="google-tendencia-other", email="other-t@example.com", name="Bob")
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

    tendencia = service.get_tendencia(db_session, user.id, ano=2026, mes=1, meses=3)
    tendencia_categoria = service.get_tendencia_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1, meses=3
    )

    assert all(p.despesa == Decimal("0") for p in tendencia)
    assert tendencia_categoria == []


def _liability(db_session, user, nome="Financiamento"):
    liability = Liability(
        user_id=user.id,
        nome=nome,
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.flush()
    return liability


def test_get_por_passivo_no_transactions_returns_empty_list(db_session, user):
    por_passivo = service.get_por_passivo(db_session, user.id, ano=2026, mes=1)

    assert por_passivo == []


def test_get_por_passivo_sums_expenses_and_excludes_liability_without_transaction(db_session, user):
    account = _account(db_session, user)
    liability_com_gasto = _liability(db_session, user, nome="Financiamento carro")
    _liability(db_session, user, nome="Financiamento casa")
    tx = _transaction(
        db_session,
        user,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.liability_id = liability_com_gasto.id
    db_session.commit()

    por_passivo = service.get_por_passivo(db_session, user.id, ano=2026, mes=1)

    assert len(por_passivo) == 1
    assert por_passivo[0].liability_id == liability_com_gasto.id
    assert por_passivo[0].liability_nome == "Financiamento carro"
    assert por_passivo[0].total == Decimal("500.00")


def test_get_por_passivo_never_sums_credito(db_session, user):
    account = _account(db_session, user)
    liability = _liability(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        valor="500.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )
    tx.liability_id = liability.id
    db_session.commit()

    por_passivo = service.get_por_passivo(db_session, user.id, ano=2026, mes=1)

    assert por_passivo == []


def test_get_por_passivo_isolated_by_user(db_session, user):
    other = User(google_sub="google-por-passivo-other", email="other-pp@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    liability = _liability(db_session, other)
    tx = _transaction(
        db_session,
        other,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.liability_id = liability.id
    db_session.commit()

    por_passivo = service.get_por_passivo(db_session, user.id, ano=2026, mes=1)

    assert por_passivo == []


def test_get_tendencia_por_passivo_zero_fills_months_without_transaction(db_session, user):
    account = _account(db_session, user)
    liability = _liability(db_session, user, nome="Financiamento carro")
    tx_jan = _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx_jan.liability_id = liability.id
    tx_mar = _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 3, 5),
    )
    tx_mar.liability_id = liability.id
    db_session.commit()

    tendencia = service.get_tendencia_por_passivo(db_session, user.id, ano=2026, mes=3, meses=3)

    assert len(tendencia) == 1
    passivo = tendencia[0]
    assert passivo.liability_id == liability.id
    assert passivo.liability_nome == "Financiamento carro"
    pontos = {(p.ano, p.mes): p.total for p in passivo.pontos}
    assert pontos[(2026, 1)] == Decimal("100.00")
    assert pontos[(2026, 2)] == Decimal("0")
    assert pontos[(2026, 3)] == Decimal("50.00")


def test_get_tendencia_por_passivo_isolated_by_user(db_session, user):
    other = User(
        google_sub="google-tendencia-passivo-other", email="other-tp@example.com", name="Bob"
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    liability = _liability(db_session, other)
    tx = _transaction(
        db_session,
        other,
        account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.liability_id = liability.id
    db_session.commit()

    tendencia = service.get_tendencia_por_passivo(db_session, user.id, ano=2026, mes=1, meses=3)

    assert tendencia == []


def test_get_saldo_por_conta_returns_all_accounts_current_balance(db_session, user):
    _account(db_session, user, tipo=PluggyAccountTipo.corrente, saldo=Decimal("1000.00"))
    _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito, saldo=Decimal("300.00"))

    saldos = service.get_saldo_por_conta(db_session, user.id)

    assert len(saldos) == 2
    total = {s.account_tipo: s.saldo for s in saldos}
    assert total[PluggyAccountTipo.corrente] == Decimal("1000.00")
    assert total[PluggyAccountTipo.cartao_credito] == Decimal("300.00")


def test_get_saldo_por_conta_uses_apelido_fallback_to_nome(db_session, user):
    account = _account(db_session, user, saldo=Decimal("500.00"))
    account.apelido = "Conta do dia a dia"
    db_session.commit()
    other_account = _account(db_session, user, saldo=Decimal("200.00"))

    saldos = service.get_saldo_por_conta(db_session, user.id)

    por_id = {s.account_id: s for s in saldos}
    assert por_id[account.id].account_nome == "Conta do dia a dia"
    assert por_id[other_account.id].account_nome == "Conta"


def test_subtract_month_rolls_back_year_at_january():
    assert service._subtract_month(date(2026, 1, 15)) == date(2025, 12, 15)


def test_subtract_month_clamps_day_overflow():
    assert service._subtract_month(date(2026, 3, 31)) == date(2026, 2, 28)


def test_get_saldo_por_conta_credit_card_shows_sum_of_current_invoice(db_session, user):
    account = _account(
        db_session, user, tipo=PluggyAccountTipo.cartao_credito, saldo=Decimal("999999.00")
    )
    account.fatura_vencimento = date(2026, 8, 6)
    account.limite_credito = Decimal("15300.00")
    db_session.commit()
    # dentro da janela (2026-07-06, 2026-08-06]
    _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 7, 20),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 8, 6),
    )
    # fora da janela (antes do início) — não deve entrar na soma
    _transaction(
        db_session,
        user,
        account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 7, 5),
    )
    # crédito (pagamento/estorno) dentro da janela — nunca soma
    _transaction(
        db_session,
        user,
        account,
        valor="200.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 7, 25),
    )

    saldos = service.get_saldo_por_conta(db_session, user.id)

    saldo_cartao = next(s for s in saldos if s.account_id == account.id)
    assert saldo_cartao.saldo == Decimal("150.00")
    assert saldo_cartao.limite_credito == Decimal("15300.00")


def test_get_saldo_por_conta_credit_card_without_fatura_vencimento_falls_back_to_saldo(
    db_session, user
):
    account = _account(
        db_session, user, tipo=PluggyAccountTipo.cartao_credito, saldo=Decimal("300.00")
    )

    saldos = service.get_saldo_por_conta(db_session, user.id)

    saldo_cartao = next(s for s in saldos if s.account_id == account.id)
    assert saldo_cartao.saldo == Decimal("300.00")
    assert saldo_cartao.limite_credito is None


def test_get_saldo_por_conta_non_credit_account_ignores_limite_credito(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente, saldo=Decimal("500.00"))

    saldos = service.get_saldo_por_conta(db_session, user.id)

    saldo_conta = next(s for s in saldos if s.account_id == account.id)
    assert saldo_conta.saldo == Decimal("500.00")
    assert saldo_conta.limite_credito is None


def test_get_saldo_por_conta_isolated_by_user(db_session, user):
    other = User(google_sub="google-saldo-conta-other", email="other-sc@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _account(db_session, other, saldo=Decimal("999.00"))

    saldos = service.get_saldo_por_conta(db_session, user.id)

    assert saldos == []
