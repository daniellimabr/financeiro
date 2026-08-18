from datetime import date
from decimal import Decimal

import pytest

from app.dashboards import service
from app.models.asset import Asset, AssetStatus, AssetTipo
from app.models.category import CategoryGroup, Natureza, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability, LiabilityStatus, LiabilityTipo
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyInvestment,
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


def _subcategory(db_session, group=None, nome=None, natureza=None):
    group = group or _group(db_session)
    s = Subcategory(group_id=group.id, nome=nome or f"Sub {next(_SEQ)}", natureza=natureza)
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


def test_get_summary_excludes_cartao_credito_credito_from_receita(db_session, user):
    # Achado da Sprint 10 (investigação NuTag): em cartão de crédito,
    # tipo=credito é sempre pagamento de fatura ou estorno (nunca receita
    # real) — valor negativo, mesma convenção já validada na Sprint 5.
    account = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )

    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert summary.receita == Decimal("0")


def test_get_summary_includes_cartao_credito_debito_as_despesa(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    _transaction(
        db_session,
        user,
        account,
        valor="50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )

    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert summary.despesa == Decimal("50.00")


def test_get_summary_corrente_credito_still_counts_as_receita(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )

    summary = service.get_summary(db_session, user.id, ano=2026, mes=1)

    assert summary.receita == Decimal("1000.00")


def test_get_patrimonio_breakdown_parts_sum_to_summary_patrimonio(db_session, user):
    _account(db_session, user, tipo=PluggyAccountTipo.corrente, saldo=Decimal("1000.00"))
    _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito, saldo=Decimal("300.00"))
    db_session.add(
        Asset(
            user_id=user.id,
            nome="Carro",
            tipo=AssetTipo.veiculo,
            valor_atual=Decimal("50000.00"),
            data_aquisicao=date(2020, 1, 1),
            status=AssetStatus.ativo,
        )
    )
    db_session.add(
        Liability(
            user_id=user.id,
            nome="Financiamento",
            tipo=LiabilityTipo.financiamento,
            valor_total=Decimal("10000.00"),
            saldo_devedor=Decimal("4000.00"),
            status=LiabilityStatus.ativo,
        )
    )
    db_session.commit()

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)
    summary = service.get_summary(db_session, user.id)

    assert breakdown.ativos == Decimal("50000.00")
    assert breakdown.passivos == Decimal("4000.00")
    # Nenhuma das contas tem saldo_inicial preenchido — ambas entram pelo
    # fallback de saldo ao vivo (corrente soma, cartão de crédito subtrai,
    # mesma convenção de sinal de _base_query).
    assert breakdown.saldo_liquido_acumulado == Decimal("700.00")
    assert breakdown.saldo_investimentos == Decimal("0")
    assert breakdown.total == summary.patrimonio


def test_get_patrimonio_breakdown_isolated_by_user(db_session, user):
    other = User(google_sub="google-breakdown-other", email="other-bd@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _account(db_session, other, tipo=PluggyAccountTipo.corrente, saldo=Decimal("999.00"))

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.total == Decimal("0")


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


def _investimento(db_session, user, nome="Reserva de emergência"):
    investimento = Investimento(user_id=user.id, nome=nome)
    db_session.add(investimento)
    db_session.flush()
    return investimento


def test_get_por_investimento_no_transactions_returns_empty_list(db_session, user):
    por_investimento = service.get_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert por_investimento == []


def test_get_por_investimento_sums_aporte_and_excludes_investimento_without_transaction(
    db_session, user
):
    account = _account(db_session, user)
    investimento_com_aporte = _investimento(db_session, user, nome="Reserva")
    _investimento(db_session, user, nome="Renda fixa")
    tx = _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.investimento_id = investimento_com_aporte.id
    db_session.commit()

    por_investimento = service.get_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert len(por_investimento) == 1
    assert por_investimento[0].investimento_id == investimento_com_aporte.id
    assert por_investimento[0].investimento_nome == "Reserva"
    assert por_investimento[0].total == Decimal("300.00")


def test_get_por_investimento_filters_by_tipo(db_session, user):
    account = _account(db_session, user)
    investimento_aporte = _investimento(db_session, user, nome="Reserva")
    investimento_resgate = _investimento(db_session, user, nome="Renda fixa")
    tx_aporte = _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx_aporte.investimento_id = investimento_aporte.id
    tx_resgate = _transaction(
        db_session,
        user,
        account,
        valor="1500.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 12),
    )
    tx_resgate.investimento_id = investimento_resgate.id
    db_session.commit()

    despesas = service.get_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )
    receitas = service.get_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.credito, ano=2026, mes=1
    )

    assert [i.investimento_id for i in despesas] == [investimento_aporte.id]
    assert [i.investimento_id for i in receitas] == [investimento_resgate.id]
    assert receitas[0].total == Decimal("1500.00")


def test_get_por_investimento_isolated_by_user(db_session, user):
    other = User(
        google_sub="google-por-investimento-other", email="other-pi@example.com", name="Bob"
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    investimento = _investimento(db_session, other)
    tx = _transaction(
        db_session,
        other,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.investimento_id = investimento.id
    db_session.commit()

    por_investimento = service.get_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert por_investimento == []


def test_get_tendencia_por_investimento_zero_fills_months_without_transaction(db_session, user):
    account = _account(db_session, user)
    investimento = _investimento(db_session, user, nome="Reserva")
    tx_jan = _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx_jan.investimento_id = investimento.id
    tx_mar = _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 3, 5),
    )
    tx_mar.investimento_id = investimento.id
    db_session.commit()

    tendencia = service.get_tendencia_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=3, meses=3
    )

    assert len(tendencia) == 1
    item = tendencia[0]
    assert item.investimento_id == investimento.id
    assert item.investimento_nome == "Reserva"
    pontos = {(p.ano, p.mes): p.total for p in item.pontos}
    assert pontos[(2026, 1)] == Decimal("100.00")
    assert pontos[(2026, 2)] == Decimal("0")
    assert pontos[(2026, 3)] == Decimal("50.00")


def test_get_tendencia_por_investimento_isolated_by_user(db_session, user):
    other = User(
        google_sub="google-tendencia-investimento-other", email="other-ti@example.com", name="Bob"
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account = _account(db_session, other)
    investimento = _investimento(db_session, other)
    tx = _transaction(
        db_session,
        other,
        account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    tx.investimento_id = investimento.id
    db_session.commit()

    tendencia = service.get_tendencia_por_investimento(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1, meses=3
    )

    assert tendencia == []


# --- regressão: introdução do grupo "Investimentos" não muda totais --------
# --- pré-existentes de Despesa/Receita para transações não relacionadas ----


def test_aporte_resgate_group_does_not_change_totals_of_unrelated_transactions(db_session, user):
    account = _account(db_session, user)
    outro_grupo = _subcategory(db_session, nome="Mercado")
    _transaction(
        db_session,
        user,
        account,
        valor="-150.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        subcategory_id=outro_grupo.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 15),
    )

    summary_antes = service.get_summary(db_session, user.id, ano=2026, mes=1)
    por_categoria_antes = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    # Introduz o grupo "Investimentos" (excluir_de_totais=False) com
    # subcategorias Aporte/Resgate, sem nenhuma transação usá-lo — mesmo
    # cenário do dia 1 pós-migration 0015, antes de qualquer aporte real.
    investimentos_group = CategoryGroup(nome="Investimentos", excluir_de_totais=False)
    db_session.add(investimentos_group)
    db_session.flush()
    db_session.add(Subcategory(group_id=investimentos_group.id, nome="Aporte"))
    db_session.add(Subcategory(group_id=investimentos_group.id, nome="Resgate"))
    db_session.commit()

    summary_depois = service.get_summary(db_session, user.id, ano=2026, mes=1)
    por_categoria_depois = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert summary_depois.receita == summary_antes.receita == Decimal("1000.00")
    assert summary_depois.despesa == summary_antes.despesa == Decimal("150.00")
    assert por_categoria_depois == por_categoria_antes


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


def test_get_por_natureza_groups_by_fixa_variavel_eventual(db_session, user):
    account = _account(db_session, user)
    sub_fixa = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    sub_variavel = _subcategory(db_session, nome="Mercado", natureza=Natureza.variavel)
    sub_eventual = _subcategory(db_session, nome="Viagem", natureza=Natureza.eventual)
    _transaction(
        db_session,
        user,
        account,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_fixa.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
        subcategory_id=sub_variavel.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-200.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 7),
        subcategory_id=sub_eventual.id,
    )

    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    totais = {n.natureza: n.total for n in por_natureza}
    assert totais[Natureza.fixa] == Decimal("1000.00")
    assert totais[Natureza.variavel] == Decimal("300.00")
    assert totais[Natureza.eventual] == Decimal("200.00")


def test_get_por_natureza_null_natureza_falls_back_to_eventual(db_session, user):
    account = _account(db_session, user)
    sub_sem_natureza = _subcategory(db_session, nome="Diversos", natureza=None)
    _transaction(
        db_session,
        user,
        account,
        valor="-50.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_sem_natureza.id,
    )

    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    totais = {n.natureza: n.total for n in por_natureza}
    assert totais[Natureza.eventual] == Decimal("50.00")
    assert totais[Natureza.fixa] == Decimal("0")
    assert totais[Natureza.variavel] == Decimal("0")


def test_get_por_natureza_transaction_without_subcategory_falls_back_to_eventual(db_session, user):
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        valor="-40.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=None,
    )

    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    totais = {n.natureza: n.total for n in por_natureza}
    assert totais[Natureza.eventual] == Decimal("40.00")


def test_get_por_natureza_excludes_excluir_de_totais_group(db_session, user):
    account = _account(db_session, user)
    transferencia = _group(db_session, nome="Transferência interna", excluir_de_totais=True)
    sub = _subcategory(
        db_session, group=transferencia, nome="Pagamento de Fatura", natureza=Natureza.fixa
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        subcategory_id=sub.id,
    )

    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert all(n.total == Decimal("0") for n in por_natureza)


def test_get_por_natureza_isolated_by_user(db_session, user):
    other = User(google_sub="google-natureza-other", email="other-nat@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        other,
        other_account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub.id,
    )

    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert all(n.total == Decimal("0") for n in por_natureza)


def test_get_por_natureza_always_returns_three_buckets_when_no_data(db_session, user):
    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert {n.natureza for n in por_natureza} == {
        Natureza.fixa,
        Natureza.variavel,
        Natureza.eventual,
    }
    assert all(n.total == Decimal("0") for n in por_natureza)
    assert all(n.percentual == Decimal("0") for n in por_natureza)


def test_get_por_natureza_percentual_sums_to_100(db_session, user):
    account = _account(db_session, user)
    sub_fixa = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    sub_variavel = _subcategory(db_session, nome="Mercado", natureza=Natureza.variavel)
    _transaction(
        db_session,
        user,
        account,
        valor="-750.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_fixa.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-250.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
        subcategory_id=sub_variavel.id,
    )

    por_natureza = service.get_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1
    )

    assert sum(n.percentual for n in por_natureza) == Decimal("100.00")
    totais = {n.natureza: n.percentual for n in por_natureza}
    assert totais[Natureza.fixa] == Decimal("75.00")
    assert totais[Natureza.variavel] == Decimal("25.00")


def test_get_tendencia_por_natureza_groups_across_months_zero_filled(db_session, user):
    account = _account(db_session, user)
    sub_fixa = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        user,
        account,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_fixa.id,
    )

    tendencia = service.get_tendencia_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1, meses=3
    )

    assert {t.natureza for t in tendencia} == {
        Natureza.fixa,
        Natureza.variavel,
        Natureza.eventual,
    }
    fixa = next(t for t in tendencia if t.natureza == Natureza.fixa)
    assert len(fixa.pontos) == 3
    janeiro = next(p for p in fixa.pontos if p.ano == 2026 and p.mes == 1)
    assert janeiro.total == Decimal("1000.00")
    variavel = next(t for t in tendencia if t.natureza == Natureza.variavel)
    assert all(p.total == Decimal("0") for p in variavel.pontos)


def test_future_month_range_returns_months_after_base():
    assert service._future_month_range(2026, 10, 3) == [(2026, 11), (2026, 12), (2027, 1)]


def test_future_month_range_wraps_year_boundary():
    assert service._future_month_range(2026, 12, 2) == [(2027, 1), (2027, 2)]


def test_get_projecao_averages_last_janela_meses_of_fixa_variavel(db_session, user):
    account = _account(db_session, user)
    sub_fixa = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    sub_variavel = _subcategory(db_session, nome="Mercado", natureza=Natureza.variavel)
    # 3 meses de janela (nov/dez/jan), média deve ser (1000+900+800)/3=900 despesa,
    # (2000+2000+2000)/3=2000 receita.
    _transaction(
        db_session,
        user,
        account,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2025, 11, 5),
        subcategory_id=sub_fixa.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-900.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2025, 12, 5),
        subcategory_id=sub_fixa.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-800.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_fixa.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="2000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2025, 11, 6),
        subcategory_id=sub_variavel.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="2000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2025, 12, 6),
        subcategory_id=sub_variavel.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="2000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 6),
        subcategory_id=sub_variavel.id,
    )

    projecao = service.get_projecao(
        db_session, user.id, ano=2026, mes=1, meses_futuros=3, janela_media=3
    )

    assert [(p.ano, p.mes) for p in projecao] == [(2026, 2), (2026, 3), (2026, 4)]
    assert all(p.despesa == Decimal("900.00") for p in projecao)
    assert all(p.receita == Decimal("2000.00") for p in projecao)
    assert all(p.saldo == Decimal("1100.00") for p in projecao)


def test_get_projecao_excludes_eventual_and_null_natureza(db_session, user):
    account = _account(db_session, user)
    sub_eventual = _subcategory(db_session, nome="Viagem", natureza=Natureza.eventual)
    sub_sem_natureza = _subcategory(db_session, nome="Diversos", natureza=None)
    _transaction(
        db_session,
        user,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_eventual.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 6),
        subcategory_id=sub_sem_natureza.id,
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 7),
        subcategory_id=None,
    )

    projecao = service.get_projecao(db_session, user.id, ano=2026, mes=1)

    assert all(p.despesa == Decimal("0") for p in projecao)


def test_get_projecao_excludes_excluir_de_totais_and_cartao_credito_credito(db_session, user):
    transferencia = _group(db_session, nome="Transferência interna", excluir_de_totais=True)
    sub_transf = _subcategory(
        db_session, group=transferencia, nome="Pagamento de Fatura", natureza=Natureza.fixa
    )
    conta_normal = _account(db_session, user)
    _transaction(
        db_session,
        user,
        conta_normal,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_transf.id,
    )

    sub_fixa = _subcategory(db_session, nome="Estorno", natureza=Natureza.fixa)
    cartao = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    _transaction(
        db_session,
        user,
        cartao,
        valor="-200.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 6),
        subcategory_id=sub_fixa.id,
    )

    projecao = service.get_projecao(db_session, user.id, ano=2026, mes=1)

    assert all(p.receita == Decimal("0") and p.despesa == Decimal("0") for p in projecao)


def test_get_projecao_meses_futuros_and_janela_media_parametrizable(db_session, user):
    account = _account(db_session, user)
    sub_fixa = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        user,
        account,
        valor="-1200.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub_fixa.id,
    )

    projecao = service.get_projecao(
        db_session, user.id, ano=2026, mes=1, meses_futuros=12, janela_media=1
    )

    assert len(projecao) == 12
    assert projecao[0].despesa == Decimal("1200.00")


def test_get_projecao_isolated_by_user(db_session, user):
    other = User(google_sub="google-projecao-other", email="other-proj@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        other,
        other_account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub.id,
    )

    projecao = service.get_projecao(db_session, user.id, ano=2026, mes=1)

    assert all(p.despesa == Decimal("0") for p in projecao)


def test_get_tendencia_por_natureza_isolated_by_user(db_session, user):
    other = User(
        google_sub="google-tendencia-natureza-other",
        email="other-tn@example.com",
        name="Bob",
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        other,
        other_account,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 5),
        subcategory_id=sub.id,
    )

    tendencia = service.get_tendencia_por_natureza(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=1, meses=3
    )

    assert all(p.total == Decimal("0") for t in tendencia for p in t.pontos)


# --- get_evolucao_saldo_por_conta -------------------------------------------


def test_get_evolucao_saldo_por_conta_accumulates_by_data_real(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    account.saldo_inicial = Decimal("1000.00")
    db_session.flush()
    _transaction(
        db_session,
        user,
        account,
        valor="500.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-200.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 5),
    )
    db_session.commit()

    evolucao = service.get_evolucao_saldo_por_conta(db_session, user.id, ano=2026, mes=2, meses=2)

    assert len(evolucao) == 1
    conta = evolucao[0]
    assert conta.saldo_inicial == Decimal("1000.00")
    pontos = {(p.ano, p.mes): p.total for p in conta.pontos}
    assert pontos[(2026, 1)] == Decimal("1500.00")
    assert pontos[(2026, 2)] == Decimal("1300.00")


def test_get_evolucao_saldo_por_conta_credit_card_direction_is_opposite(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    account.saldo_inicial = Decimal("0")
    db_session.flush()
    _transaction(
        db_session,
        user,
        account,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
    )
    db_session.commit()

    evolucao = service.get_evolucao_saldo_por_conta(db_session, user.id, ano=2026, mes=1, meses=1)

    assert evolucao[0].pontos[0].total == Decimal("-300.00")


def test_get_evolucao_saldo_por_conta_excludes_account_without_saldo_inicial(db_session, user):
    _account(db_session, user, tipo=PluggyAccountTipo.corrente)

    evolucao = service.get_evolucao_saldo_por_conta(db_session, user.id, ano=2026, mes=1, meses=3)

    assert evolucao == []


def test_get_evolucao_saldo_por_conta_uses_data_real_not_competencia(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    account.saldo_inicial = Decimal("0")
    db_session.flush()
    # data real em janeiro, mas competência deslocada pra fevereiro (ex.:
    # regra de salário) — auditoria por conta soma pela data real.
    _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 30),
        data_competencia=date(2026, 2, 28),
    )
    db_session.commit()

    evolucao = service.get_evolucao_saldo_por_conta(db_session, user.id, ano=2026, mes=2, meses=2)

    pontos = {(p.ano, p.mes): p.total for p in evolucao[0].pontos}
    assert pontos[(2026, 1)] == Decimal("1000.00")
    assert pontos[(2026, 2)] == Decimal("1000.00")


def test_get_evolucao_saldo_por_conta_isolated_by_user(db_session, user):
    other = User(google_sub="google-evolucao-other", email="other-evo@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    other_account.saldo_inicial = Decimal("999.00")
    db_session.commit()

    evolucao = service.get_evolucao_saldo_por_conta(db_session, user.id, ano=2026, mes=1, meses=3)

    assert evolucao == []


# --- get_saldo_acumulado -----------------------------------------------------


def test_get_saldo_acumulado_anchor_without_salario_sentinela(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    account.saldo_inicial = Decimal("1000.00")
    db_session.commit()

    pontos = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=1, meses=2)

    por_mes = {(p.ano, p.mes): p.total for p in pontos}
    assert por_mes[(2025, 12)] == Decimal("1000.00")
    assert por_mes[(2026, 1)] == Decimal("1000.00")


def test_get_saldo_acumulado_subtracts_salario_sentinela_from_anchor(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    account.saldo_inicial = Decimal("1000.00")
    db_session.flush()
    # transação sentinela de salário de dez/2025 (competência jan/2026) —
    # o valor já entra de volta na receita de jan/2026 abaixo.
    _transaction(
        db_session,
        user,
        account,
        valor="500.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2025, 12, 30),
        data_competencia=date(2026, 1, 30),
        subcategory_id=None,
    )
    db_session.commit()
    tx = db_session.query(PluggyTransaction).one()
    tx.pluggy_transaction_id = f"manual-salario-dez2025-user{user.id}"
    db_session.commit()

    pontos = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=1, meses=2)

    por_mes = {(p.ano, p.mes): p.total for p in pontos}
    # Âncora de dez/2025 = 1000 (saldo_inicial) - 500 (sentinela) = 500.
    assert por_mes[(2025, 12)] == Decimal("500.00")
    # jan/2026 = âncora (500) + receita de jan/2026 (a própria sentinela, 500).
    assert por_mes[(2026, 1)] == Decimal("1000.00")


def test_get_saldo_acumulado_accumulates_receita_menos_despesa_month_over_month(db_session, user):
    account = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    account.saldo_inicial = Decimal("0")
    db_session.flush()
    _transaction(
        db_session,
        user,
        account,
        valor="1000.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )
    _transaction(
        db_session,
        user,
        account,
        valor="-400.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 5),
    )
    db_session.commit()

    pontos = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=2, meses=3)

    por_mes = {(p.ano, p.mes): p.total for p in pontos}
    assert por_mes[(2025, 12)] == Decimal("0")
    assert por_mes[(2026, 1)] == Decimal("1000.00")
    assert por_mes[(2026, 2)] == Decimal("600.00")


def test_get_saldo_acumulado_isolated_by_user(db_session, user):
    other = User(google_sub="google-acumulado-other", email="other-acu@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    other_account.saldo_inicial = Decimal("999.00")
    db_session.commit()

    pontos = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=1, meses=1)

    assert pontos[0].total == Decimal("0")


def test_get_saldo_acumulado_excludes_investimento_from_anchor(db_session, user):
    _account(db_session, user, tipo=PluggyAccountTipo.corrente).saldo_inicial = Decimal("1000.00")
    investimento = _account(db_session, user, tipo=PluggyAccountTipo.investimento)
    investimento.saldo_inicial = Decimal("50000.00")
    db_session.commit()

    pontos = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=1, meses=1)

    assert pontos[0].total == Decimal("1000.00")


def test_get_saldo_acumulado_excludes_investimento_transactions_from_accumulation(db_session, user):
    corrente = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    corrente.saldo_inicial = Decimal("0")
    investimento = _account(db_session, user, tipo=PluggyAccountTipo.investimento)
    investimento.saldo_inicial = Decimal("0")
    db_session.flush()
    _transaction(
        db_session,
        user,
        corrente,
        valor="100.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )
    _transaction(
        db_session,
        user,
        investimento,
        valor="9999.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
    )
    db_session.commit()

    pontos = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=1, meses=1)

    assert pontos[0].total == Decimal("100.00")


def test_get_saldo_acumulado_regime_caixa_uses_data_caixa(db_session, user):
    conta = _account(db_session, user)
    _transaction(
        db_session,
        user,
        conta,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        data_competencia=date(2026, 2, 10),
    )
    tx = db_session.query(PluggyTransaction).one()
    tx.data_caixa = date(2026, 3, 10)
    db_session.commit()

    competencia = service.get_saldo_acumulado(db_session, user.id, ano=2026, mes=2, meses=1)
    caixa = service.get_saldo_acumulado(
        db_session, user.id, ano=2026, mes=2, meses=1, regime="caixa"
    )
    caixa_no_mes_certo = service.get_saldo_acumulado(
        db_session, user.id, ano=2026, mes=3, meses=1, regime="caixa"
    )

    assert competencia[0].total == Decimal("-100.00")
    assert caixa[0].total == Decimal("0")
    assert caixa_no_mes_certo[0].total == Decimal("-100.00")


# --- get_summary / get_por_categoria / etc. respeitando regime (Sprint 16) --


def _transacao_com_caixa_deslocado(db_session, user):
    """Transação de conta corrente com data/competência/caixa manualmente
    divergentes (evento em jan, competência fev, caixa mar) — permite
    diferenciar as 3 datas em cada teste de regime sem depender do
    tratamento especial de cartão de crédito sob caixa (Sprint 18, que
    exclui cartão inteiramente desse regime — ver
    test_get_saldo_acumulado_regime_caixa_excludes_cartao_credito)."""
    conta = _account(db_session, user)
    tx = _transaction(
        db_session,
        user,
        conta,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 20),
        data_competencia=date(2026, 2, 20),
    )
    tx.data_caixa = date(2026, 3, 20)
    db_session.commit()
    return tx


def test_get_summary_regime_caixa_uses_data_caixa(db_session, user):
    _transacao_com_caixa_deslocado(db_session, user)

    competencia = service.get_summary(db_session, user.id, ano=2026, mes=2)
    caixa = service.get_summary(db_session, user.id, ano=2026, mes=3, regime="caixa")

    assert competencia.despesa == Decimal("100.00")
    assert caixa.despesa == Decimal("100.00")


def test_get_por_categoria_regime_caixa_uses_data_caixa(db_session, user):
    tx = _transacao_com_caixa_deslocado(db_session, user)
    group = _group(db_session, nome="Cartão")
    sub = _subcategory(db_session, group=group, nome="Compras")
    tx.subcategory_id = sub.id
    db_session.commit()

    por_categoria_caixa = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=3, regime="caixa"
    )
    por_categoria_competencia_no_mes_caixa = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=3
    )

    assert por_categoria_caixa[0].total == Decimal("100.00")
    assert por_categoria_competencia_no_mes_caixa == []


def test_get_tendencia_regime_caixa_uses_data_caixa(db_session, user):
    _transacao_com_caixa_deslocado(db_session, user)

    tendencia = service.get_tendencia(db_session, user.id, ano=2026, mes=3, meses=3, regime="caixa")

    marco = next(p for p in tendencia if p.ano == 2026 and p.mes == 3)
    fevereiro = next(p for p in tendencia if p.ano == 2026 and p.mes == 2)
    assert marco.despesa == Decimal("100.00")
    assert fevereiro.despesa == Decimal("0")


def test_get_tendencia_por_categoria_regime_caixa_uses_data_caixa(db_session, user):
    tx = _transacao_com_caixa_deslocado(db_session, user)
    sub = _subcategory(db_session, nome="Compras")
    tx.subcategory_id = sub.id
    db_session.commit()

    tendencia = service.get_tendencia_por_categoria(
        db_session,
        user.id,
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=3,
        meses=3,
        regime="caixa",
    )

    pontos = {(p.ano, p.mes): p.total for p in tendencia[0].pontos}
    assert pontos[(2026, 3)] == Decimal("100.00")
    assert pontos[(2026, 2)] == Decimal("0")


def test_get_por_ativo_regime_caixa_uses_data_caixa(db_session, user):
    tx = _transacao_com_caixa_deslocado(db_session, user)
    asset = _asset(db_session, user)
    tx.asset_id = asset.id
    db_session.commit()

    por_ativo = service.get_por_ativo(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=3, regime="caixa"
    )

    assert len(por_ativo) == 1
    assert por_ativo[0].total == Decimal("100.00")


def test_get_tendencia_por_ativo_regime_caixa_uses_data_caixa(db_session, user):
    tx = _transacao_com_caixa_deslocado(db_session, user)
    asset = _asset(db_session, user)
    tx.asset_id = asset.id
    db_session.commit()

    tendencia = service.get_tendencia_por_ativo(
        db_session,
        user.id,
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=3,
        meses=3,
        regime="caixa",
    )

    pontos = {(p.ano, p.mes): p.total for p in tendencia[0].pontos}
    assert pontos[(2026, 3)] == Decimal("100.00")


def test_get_por_passivo_regime_caixa_uses_data_caixa(db_session, user):
    tx = _transacao_com_caixa_deslocado(db_session, user)
    liability = _liability(db_session, user)
    tx.liability_id = liability.id
    db_session.commit()

    por_passivo = service.get_por_passivo(db_session, user.id, ano=2026, mes=3, regime="caixa")

    assert len(por_passivo) == 1
    assert por_passivo[0].total == Decimal("100.00")


def test_get_tendencia_por_passivo_regime_caixa_uses_data_caixa(db_session, user):
    tx = _transacao_com_caixa_deslocado(db_session, user)
    liability = _liability(db_session, user)
    tx.liability_id = liability.id
    db_session.commit()

    tendencia = service.get_tendencia_por_passivo(
        db_session, user.id, ano=2026, mes=3, meses=3, regime="caixa"
    )

    pontos = {(p.ano, p.mes): p.total for p in tendencia[0].pontos}
    assert pontos[(2026, 3)] == Decimal("100.00")


# --- regime caixa: pagamento de fatura substitui o deslocamento modelado do
# --- cartão de crédito (Sprint 18) --------------------------------------


def _pagamento_fatura_subcategory(db_session):
    grupo = _group(db_session, nome="Transferência interna", excluir_de_totais=True)
    return _subcategory(db_session, group=grupo, nome="Pagamento de Fatura")


def test_get_summary_regime_caixa_excludes_cartao_credito_entirely(db_session, user):
    # Sob caixa, o cartão não usa mais o deslocamento modelado (compra+2
    # meses) — a compra em si nunca conta, nem no mês do evento nem no mês
    # do caixa modelado, evitando dobrar com o pagamento real da fatura.
    cartao = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    tx = _transaction(
        db_session,
        user,
        cartao,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 20),
        data_competencia=date(2026, 2, 20),
    )
    tx.data_caixa = date(2026, 3, 20)
    db_session.commit()

    competencia = service.get_summary(db_session, user.id, ano=2026, mes=2)
    caixa_no_mes_do_evento = service.get_summary(
        db_session, user.id, ano=2026, mes=1, regime="caixa"
    )
    caixa_no_mes_modelado = service.get_summary(
        db_session, user.id, ano=2026, mes=3, regime="caixa"
    )

    assert competencia.despesa == Decimal("100.00")
    assert caixa_no_mes_do_evento.despesa == Decimal("0")
    assert caixa_no_mes_modelado.despesa == Decimal("0")


def test_get_summary_regime_caixa_counts_pagamento_de_fatura_on_real_date(db_session, user):
    sub = _pagamento_fatura_subcategory(db_session)
    conta = _account(db_session, user)
    tx = _transaction(
        db_session,
        user,
        conta,
        valor="-1767.05",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 2),
        subcategory_id=sub.id,
    )
    tx.data_caixa = date(2026, 2, 2)
    db_session.commit()

    competencia = service.get_summary(db_session, user.id, ano=2026, mes=2)
    caixa = service.get_summary(db_session, user.id, ano=2026, mes=2, regime="caixa")

    # Competência continua excluindo (evita dobrar com o modelo de
    # compra+1 mês já aplicado às compras do cartão) — caixa passa a
    # contar, na data real em que o dinheiro saiu da conta.
    assert competencia.despesa == Decimal("0")
    assert caixa.despesa == Decimal("1767.05")


def test_get_summary_regime_caixa_still_excludes_other_transferencia_interna(db_session, user):
    grupo = _group(db_session, nome="Transferência interna", excluir_de_totais=True)
    sub = _subcategory(db_session, group=grupo, nome="Transferência interna")
    conta = _account(db_session, user)
    tx = _transaction(
        db_session,
        user,
        conta,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 2),
        subcategory_id=sub.id,
    )
    tx.data_caixa = date(2026, 2, 2)
    db_session.commit()

    caixa = service.get_summary(db_session, user.id, ano=2026, mes=2, regime="caixa")

    assert caixa.despesa == Decimal("0")


def test_get_por_categoria_regime_caixa_counts_pagamento_de_fatura(db_session, user):
    sub = _pagamento_fatura_subcategory(db_session)
    conta = _account(db_session, user)
    tx = _transaction(
        db_session,
        user,
        conta,
        valor="-1767.05",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 2),
        subcategory_id=sub.id,
    )
    tx.data_caixa = date(2026, 2, 2)
    db_session.commit()

    por_categoria = service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.debito, ano=2026, mes=2, regime="caixa"
    )

    assert len(por_categoria) == 1
    assert por_categoria[0].total == Decimal("1767.05")


def test_get_saldo_acumulado_regime_caixa_pagamento_de_fatura_avoids_double_count(db_session, user):
    # Cenário real da Sprint 18: compra de cartão em janeiro (competência
    # fev, caixa modelado mar) paga via Pix da conta corrente em fevereiro,
    # categorizado "Pagamento de Fatura". Sob caixa, só a fatura real conta —
    # a compra modelada em março não deve aparecer.
    sub = _pagamento_fatura_subcategory(db_session)
    corrente = _account(db_session, user)
    corrente.saldo_inicial = Decimal("0")
    cartao = _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito)
    db_session.flush()

    compra = _transaction(
        db_session,
        user,
        cartao,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 15),
        data_competencia=date(2026, 2, 15),
    )
    compra.data_caixa = date(2026, 3, 15)
    fatura = _transaction(
        db_session,
        user,
        corrente,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 2, 2),
        subcategory_id=sub.id,
    )
    fatura.data_caixa = date(2026, 2, 2)
    db_session.commit()

    caixa = service.get_saldo_acumulado(
        db_session, user.id, ano=2026, mes=3, meses=3, regime="caixa"
    )

    pontos = {(p.ano, p.mes): p.total for p in caixa}
    # A fatura já pesou em fevereiro (-100) e permanece assim em março — não
    # cai de novo (o que daria -200).
    assert pontos[(2026, 2)] == Decimal("-100.00")
    assert pontos[(2026, 3)] == Decimal("-100.00")


# --- Patrimônio: saldo_liquido_acumulado / saldo_investimentos / fallback ---


def test_patrimonio_breakdown_saldo_investimentos_separate_from_acumulado(db_session, user):
    corrente = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    corrente.saldo_inicial = Decimal("1000.00")
    investimento = _account(
        db_session, user, tipo=PluggyAccountTipo.investimento, saldo=Decimal("5000.00")
    )
    investimento.saldo_inicial = Decimal("5000.00")
    db_session.commit()

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.saldo_liquido_acumulado == Decimal("1000.00")
    assert breakdown.saldo_investimentos == Decimal("5000.00")
    assert breakdown.total == Decimal("6000.00")


def test_patrimonio_breakdown_fallback_account_without_saldo_inicial_uses_live_balance(
    db_session, user
):
    _account(db_session, user, tipo=PluggyAccountTipo.corrente, saldo=Decimal("200.00"))
    ancorada = _account(db_session, user, tipo=PluggyAccountTipo.corrente)
    ancorada.saldo_inicial = Decimal("1000.00")
    db_session.commit()

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    # Conta ancorada entra via get_saldo_acumulado (1000, sem transações);
    # conta sem saldo_inicial entra pelo saldo ao vivo (200) — soma 1200,
    # sem quebrar o cálculo da conta ancorada.
    assert breakdown.saldo_liquido_acumulado == Decimal("1200.00")


def test_patrimonio_breakdown_fallback_credit_card_without_saldo_inicial_subtracts(
    db_session, user
):
    _account(db_session, user, tipo=PluggyAccountTipo.cartao_credito, saldo=Decimal("300.00"))

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.saldo_liquido_acumulado == Decimal("-300.00")


def test_patrimonio_breakdown_investimento_without_saldo_inicial_never_enters_fallback(
    db_session, user
):
    _account(db_session, user, tipo=PluggyAccountTipo.investimento, saldo=Decimal("777.00"))

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.saldo_liquido_acumulado == Decimal("0")
    assert breakdown.saldo_investimentos == Decimal("777.00")


def _item(db_session, user):
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
    return item


def _account_for_item(
    db_session, user, item, *, tipo=PluggyAccountTipo.corrente, saldo=Decimal("0")
):
    n = next(_SEQ)
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


def _investment(db_session, user, item, *, valor_atual=Decimal("0")):
    n = next(_SEQ)
    investment = PluggyInvestment(
        item_id=item.id,
        user_id=user.id,
        pluggy_investment_id=f"inv-{n}",
        tipo="FIXED_INCOME",
        subtipo="CDB",
        nome="CDB Fake",
        valor_atual=valor_atual,
    )
    db_session.add(investment)
    db_session.flush()
    return investment


def test_patrimonio_breakdown_sums_holdings_into_saldo_investimentos(db_session, user):
    item = _item(db_session, user)
    _investment(db_session, user, item, valor_atual=Decimal("22762.07"))
    db_session.commit()

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.saldo_investimentos == Decimal("22762.07")


def test_patrimonio_breakdown_prefers_holdings_over_account_for_same_item(db_session, user):
    # Achado do Bloco 1 (Sprint 20): nenhum item conhecido retorna as duas
    # fontes pro mesmo saldo hoje, mas a query já protege contra dobra de
    # contagem caso isso mude no futuro.
    item = _item(db_session, user)
    _account_for_item(
        db_session, user, item, tipo=PluggyAccountTipo.investimento, saldo=Decimal("999.00")
    )
    _investment(db_session, user, item, valor_atual=Decimal("22762.07"))
    db_session.commit()

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.saldo_investimentos == Decimal("22762.07")


def test_patrimonio_breakdown_item_without_holdings_keeps_using_account_saldo_regression(
    db_session, user
):
    # Regressão explícita (critério de aceite 5 do PRD-020): item com
    # holdings soma via holdings; item sem nenhuma holding continua somando
    # pelo saldo da conta tipo=investimento, exatamente como antes da sprint.
    item_com_holding = _item(db_session, user)
    _investment(db_session, user, item_com_holding, valor_atual=Decimal("1000.00"))
    item_sem_holding = _item(db_session, user)
    _account_for_item(
        db_session,
        user,
        item_sem_holding,
        tipo=PluggyAccountTipo.investimento,
        saldo=Decimal("500.00"),
    )
    db_session.commit()

    breakdown = service.get_patrimonio_breakdown(db_session, user.id)

    assert breakdown.saldo_investimentos == Decimal("1500.00")


def test_patrimonio_breakdown_regime_caixa_shifts_accumulation(db_session, user, monkeypatch):
    _transacao_com_caixa_deslocado(db_session, user)

    class _HojeFevereiro(date):
        @classmethod
        def today(cls):
            return date(2026, 2, 25)

    monkeypatch.setattr(service, "date", _HojeFevereiro)

    # "Hoje" congelado em 25/fev: a despesa (competência fev, caixa mar) já
    # entrou na acumulação por competência, mas ainda não por caixa (mar é
    # futuro em relação a "hoje").
    competencia = service.get_patrimonio_breakdown(db_session, user.id, regime="competencia")
    caixa = service.get_patrimonio_breakdown(db_session, user.id, regime="caixa")

    assert competencia.total == caixa.total - Decimal("100.00")
