from datetime import date
from decimal import Decimal

import pytest

from app.exceptions import NotFoundError
from app.investimentos import service
from app.models.category import CategoryGroup, Subcategory
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyInvestment,
    PluggyInvestmentTransaction,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
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


@pytest.fixture()
def other_user(db_session):
    n = next(_SEQ)
    u = User(google_sub=f"google-{n}", email=f"user{n}@example.com", name="Bob")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _investimentos_group(db_session, user):
    group = (
        db_session.query(CategoryGroup)
        .filter(CategoryGroup.user_id == user.id, CategoryGroup.nome == "Investimentos")
        .one_or_none()
    )
    if group is None:
        group = CategoryGroup(user_id=user.id, nome="Investimentos", excluir_de_totais=False)
        db_session.add(group)
        db_session.flush()
    return group


def _aporte_subcategory(db_session, user):
    group = _investimentos_group(db_session, user)
    sub = (
        db_session.query(Subcategory)
        .filter(Subcategory.group_id == group.id, Subcategory.nome == "Aporte")
        .one_or_none()
    )
    if sub is None:
        sub = Subcategory(user_id=user.id, group_id=group.id, nome="Aporte")
        db_session.add(sub)
        db_session.commit()
        db_session.refresh(sub)
    return sub


def _resgate_subcategory(db_session, user):
    group = _investimentos_group(db_session, user)
    sub = (
        db_session.query(Subcategory)
        .filter(Subcategory.group_id == group.id, Subcategory.nome == "Resgate")
        .one_or_none()
    )
    if sub is None:
        sub = Subcategory(user_id=user.id, group_id=group.id, nome="Resgate")
        db_session.add(sub)
        db_session.commit()
        db_session.refresh(sub)
    return sub


def _account(
    db_session,
    user,
    *,
    tipo=PluggyAccountTipo.investimento,
    saldo=Decimal("0"),
    saldo_inicial=None,
    investimento_id=None,
):
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
        nome="Carteira",
        saldo=saldo,
        saldo_inicial=saldo_inicial,
        investimento_id=investimento_id,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def _investment(
    db_session,
    user,
    *,
    valor_atual=Decimal("0"),
    saldo_inicial=None,
    investimento_id=None,
):
    n = next(_SEQ)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-inv-{n}",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    investment = PluggyInvestment(
        item_id=item.id,
        user_id=user.id,
        pluggy_investment_id=f"inv-{n}",
        tipo="FIXED_INCOME",
        subtipo="CDB",
        nome="CDB Fake",
        valor_atual=valor_atual,
        saldo_inicial=saldo_inicial,
        investimento_id=investimento_id,
    )
    db_session.add(investment)
    db_session.commit()
    db_session.refresh(investment)
    return investment


def _transaction(
    db_session,
    user,
    account,
    *,
    valor,
    tipo,
    subcategory_id=None,
    investimento_id=None,
    status_categorizacao=PluggyTransactionCategorizacaoStatus.confirmada,
    data=date(2026, 1, 15),
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
        data_competencia=data,
        subcategory_id=subcategory_id,
        investimento_id=investimento_id,
        status=PluggyTransactionStatus.efetivada,
        categorizacao_status=status_categorizacao,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def _investment_transaction(
    db_session,
    user,
    investment,
    *,
    valor,
    tipo="BUY",
    descricao=None,
    data=date(2026, 1, 15),
):
    n = next(_SEQ)
    tx = PluggyInvestmentTransaction(
        investment_id=investment.id,
        user_id=user.id,
        pluggy_investment_transaction_id=f"inv-tx-{n}",
        tipo=tipo,
        descricao=descricao,
        valor=Decimal(valor),
        data=data,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


# --- CRUD --------------------------------------------------------------


def test_create_and_list_investimento(db_session, user):
    service.create_investimento(db_session, user.id, nome="Reserva de emergência")

    investimentos = service.list_investimentos(db_session, user.id)

    assert [i.nome for i in investimentos] == ["Reserva de emergência"]


def test_list_investimentos_isolated_by_user(db_session, user, other_user):
    service.create_investimento(db_session, other_user.id, nome="Do outro")

    assert service.list_investimentos(db_session, user.id) == []


def test_list_investimentos_com_valor_atual_sums_accounts_and_holdings(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Reserva")
    _account(db_session, user, saldo=Decimal("300.00"), investimento_id=investimento.id)
    _investment(db_session, user, valor_atual=Decimal("700.00"), investimento_id=investimento.id)

    resultado = service.list_investimentos_com_valor_atual(db_session, user.id)

    assert len(resultado) == 1
    assert resultado[0].id == investimento.id
    assert resultado[0].valor_atual == Decimal("1000.00")


def test_list_investimentos_com_valor_atual_zero_when_nothing_linked(db_session, user):
    service.create_investimento(db_session, user.id, nome="Sem vínculo")

    resultado = service.list_investimentos_com_valor_atual(db_session, user.id)

    assert resultado[0].valor_atual == Decimal("0")


def test_list_investimentos_com_valor_atual_isolated_by_user(db_session, user, other_user):
    service.create_investimento(db_session, other_user.id, nome="Do outro")

    assert service.list_investimentos_com_valor_atual(db_session, user.id) == []


def test_get_investimento_other_users_raises_not_found(db_session, user, other_user):
    investimento = service.create_investimento(db_session, other_user.id, nome="Do outro")

    with pytest.raises(NotFoundError):
        service.get_investimento(db_session, user.id, investimento.id)


def test_update_investimento_renames(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Nome antigo")

    updated = service.update_investimento(db_session, user.id, investimento.id, nome="Nome novo")

    assert updated.nome == "Nome novo"


def test_update_missing_investimento_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.update_investimento(db_session, user.id, 999, nome="X")


def test_delete_investimento_disassociates_accounts_and_transactions(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Renda fixa")
    account = _account(db_session, user, investimento_id=investimento.id)
    aporte = _aporte_subcategory(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=aporte.id,
        investimento_id=investimento.id,
    )
    tx.investimento_sugerido_id = investimento.id
    db_session.commit()

    service.delete_investimento(db_session, user.id, investimento.id)

    db_session.refresh(account)
    db_session.refresh(tx)
    assert account.investimento_id is None
    assert tx.investimento_id is None
    assert tx.investimento_sugerido_id is None
    # histórico preservado: conta e transação continuam existindo
    assert db_session.query(PluggyAccount).filter(PluggyAccount.id == account.id).one_or_none()
    assert db_session.query(PluggyTransaction).filter(PluggyTransaction.id == tx.id).one_or_none()


def test_delete_missing_investimento_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.delete_investimento(db_session, user.id, 999)


# --- get_evolucao --------------------------------------------------------


def test_get_evolucao_sums_saldo_base_and_saldo_atual_across_multiple_carteiras(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Multi-carteira")
    _account(
        db_session,
        user,
        saldo=Decimal("1200.00"),
        saldo_inicial=Decimal("1000.00"),
        investimento_id=investimento.id,
    )
    _account(
        db_session,
        user,
        saldo=Decimal("300.00"),
        saldo_inicial=Decimal("200.00"),
        investimento_id=investimento.id,
    )

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.saldo_base == Decimal("1200.00")
    assert evolucao.saldo_atual == Decimal("1500.00")


def test_get_evolucao_treats_missing_saldo_inicial_as_zero(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Sem base")
    _account(
        db_session,
        user,
        saldo=Decimal("500.00"),
        saldo_inicial=None,
        investimento_id=investimento.id,
    )

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.saldo_base == Decimal("0")
    assert evolucao.saldo_atual == Decimal("500.00")


def test_get_evolucao_only_counts_confirmed_aporte_resgate(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Aportes")
    carteira = _account(
        db_session,
        user,
        saldo=Decimal("2000.00"),
        saldo_inicial=Decimal("1000.00"),
        investimento_id=investimento.id,
    )
    aporte = _aporte_subcategory(db_session, user)
    resgate = _resgate_subcategory(db_session, user)

    _transaction(
        db_session,
        user,
        carteira,
        valor="-800.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=aporte.id,
        investimento_id=investimento.id,
        status_categorizacao=PluggyTransactionCategorizacaoStatus.confirmada,
    )
    _transaction(
        db_session,
        user,
        carteira,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=aporte.id,
        investimento_id=investimento.id,
        status_categorizacao=PluggyTransactionCategorizacaoStatus.pendente,
    )
    _transaction(
        db_session,
        user,
        carteira,
        valor="200.00",
        tipo=PluggyTransactionTipo.credito,
        subcategory_id=resgate.id,
        investimento_id=investimento.id,
        status_categorizacao=PluggyTransactionCategorizacaoStatus.confirmada,
    )

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.total_aportes == Decimal("800.00")
    assert evolucao.total_resgates == Decimal("200.00")
    # rendimento_estimado = saldo_atual - saldo_base - aportes + resgates
    assert evolucao.rendimento_estimado == Decimal("2000.00") - Decimal("1000.00") - Decimal(
        "800.00"
    ) + Decimal("200.00")


def test_get_evolucao_sums_holdings_saldo_base_and_saldo_atual(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Com holding")
    _investment(
        db_session,
        user,
        valor_atual=Decimal("22762.07"),
        saldo_inicial=Decimal("20000.00"),
        investimento_id=investimento.id,
    )

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.saldo_base == Decimal("20000.00")
    assert evolucao.saldo_atual == Decimal("22762.07")


def test_get_evolucao_sums_carteiras_and_holdings_together(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Misto")
    _account(
        db_session,
        user,
        saldo=Decimal("1200.00"),
        saldo_inicial=Decimal("1000.00"),
        investimento_id=investimento.id,
    )
    _investment(
        db_session,
        user,
        valor_atual=Decimal("500.00"),
        saldo_inicial=Decimal("400.00"),
        investimento_id=investimento.id,
    )

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.saldo_base == Decimal("1400.00")
    assert evolucao.saldo_atual == Decimal("1700.00")


def test_get_evolucao_treats_missing_holding_saldo_inicial_as_zero(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Holding sem base")
    _investment(
        db_session,
        user,
        valor_atual=Decimal("500.00"),
        saldo_inicial=None,
        investimento_id=investimento.id,
    )

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.saldo_base == Decimal("0")
    assert evolucao.saldo_atual == Decimal("500.00")


def test_get_evolucao_holdings_isolated_by_user(db_session, user, other_user):
    investimento = service.create_investimento(db_session, other_user.id, nome="Do outro")
    _investment(
        db_session,
        other_user,
        valor_atual=Decimal("999.00"),
        saldo_inicial=Decimal("500.00"),
        investimento_id=investimento.id,
    )

    with pytest.raises(NotFoundError):
        service.get_evolucao(db_session, user.id, investimento.id)


def test_get_evolucao_missing_investimento_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.get_evolucao(db_session, user.id, 999)


# --- Sprint 21: get_evolucao_mensal ---------------------------------------


def _snapshot(
    db_session,
    holding,
    *,
    ano_mes,
    saldo,
    valorizacao=Decimal("0"),
    rendimento=Decimal("0"),
    dividendos=None,
    aportes=Decimal("0"),
    resgates=Decimal("0"),
    confianca="reconstruido",
):
    from app.models.pluggy import PluggyInvestmentSnapshot

    snap = PluggyInvestmentSnapshot(
        investment_id=holding.id,
        user_id=holding.user_id,
        ano_mes=ano_mes,
        saldo=saldo,
        valorizacao=valorizacao,
        rendimento=rendimento,
        dividendos=dividendos,
        aportes=aportes,
        resgates=resgates,
        confianca=confianca,
    )
    db_session.add(snap)
    db_session.commit()
    db_session.refresh(snap)
    return snap


def test_get_evolucao_mensal_returns_empty_when_no_holdings(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Sem holding")

    assert service.get_evolucao_mensal(db_session, user.id, investimento.id) == []


def test_get_evolucao_mensal_missing_investimento_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.get_evolucao_mensal(db_session, user.id, 999)


def test_get_evolucao_mensal_aggregates_across_holdings_by_month(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Com holdings")
    holding_a = _investment(
        db_session, user, valor_atual=Decimal("6000.00"), investimento_id=investimento.id
    )
    holding_b = _investment(
        db_session, user, valor_atual=Decimal("2000.00"), investimento_id=investimento.id
    )
    _snapshot(db_session, holding_a, ano_mes="2026-01", saldo=Decimal("5000.00"))
    _snapshot(db_session, holding_b, ano_mes="2026-01", saldo=Decimal("1500.00"))
    _snapshot(
        db_session,
        holding_a,
        ano_mes="2026-02",
        saldo=Decimal("6000.00"),
        rendimento=Decimal("1000.00"),
        confianca="real",
    )

    evolucao = service.get_evolucao_mensal(db_session, user.id, investimento.id)

    assert [e.ano_mes for e in evolucao] == ["2026-01", "2026-02"]
    jan = evolucao[0]
    assert jan.saldo == Decimal("6500.00")
    assert jan.confianca == "reconstruido"
    fev = evolucao[1]
    assert fev.saldo == Decimal("6000.00")
    assert fev.rendimento == Decimal("1000.00")
    assert fev.confianca == "real"


def test_get_evolucao_mensal_isolated_by_user(db_session, user, other_user):
    investimento = service.create_investimento(db_session, other_user.id, nome="Do outro")
    holding = _investment(
        db_session, other_user, valor_atual=Decimal("999.00"), investimento_id=investimento.id
    )
    _snapshot(db_session, holding, ano_mes="2026-01", saldo=Decimal("900.00"))

    with pytest.raises(NotFoundError):
        service.get_evolucao_mensal(db_session, user.id, investimento.id)


def test_get_evolucao_unchanged_by_snapshots(db_session, user):
    # Regressão explícita: get_evolucao (snapshot atual) não deve ser afetado
    # pela existência de pluggy_investment_snapshots (Sprint 21).
    investimento = service.create_investimento(db_session, user.id, nome="Regressão")
    holding = _investment(
        db_session,
        user,
        valor_atual=Decimal("6000.00"),
        saldo_inicial=Decimal("5000.00"),
        investimento_id=investimento.id,
    )
    _snapshot(db_session, holding, ano_mes="2026-01", saldo=Decimal("999999.00"))

    evolucao = service.get_evolucao(db_session, user.id, investimento.id)

    assert evolucao.saldo_base == Decimal("5000.00")
    assert evolucao.saldo_atual == Decimal("6000.00")


def test_get_evolucao_isolated_by_user(db_session, user, other_user):
    investimento = service.create_investimento(db_session, other_user.id, nome="Do outro")
    _account(
        db_session,
        other_user,
        saldo=Decimal("999.00"),
        saldo_inicial=Decimal("500.00"),
        investimento_id=investimento.id,
    )

    with pytest.raises(NotFoundError):
        service.get_evolucao(db_session, user.id, investimento.id)


# --- Sprint 36 (PRD-036b): get_evolucao_mensal_consolidada ---------------


def test_get_evolucao_mensal_consolidada_returns_empty_when_no_investimentos(db_session, user):
    assert service.get_evolucao_mensal_consolidada(db_session, user.id) == []


def test_get_evolucao_mensal_consolidada_returns_empty_when_no_holdings(db_session, user):
    service.create_investimento(db_session, user.id, nome="Sem holding")

    assert service.get_evolucao_mensal_consolidada(db_session, user.id) == []


def test_get_evolucao_mensal_consolidada_sums_across_investimentos_by_month(db_session, user):
    reserva = service.create_investimento(db_session, user.id, nome="Reserva")
    tesouro = service.create_investimento(db_session, user.id, nome="Tesouro IPCA+")
    holding_reserva = _investment(
        db_session, user, valor_atual=Decimal("6000.00"), investimento_id=reserva.id
    )
    holding_tesouro = _investment(
        db_session, user, valor_atual=Decimal("9000.00"), investimento_id=tesouro.id
    )
    _snapshot(
        db_session, holding_reserva, ano_mes="2026-01", saldo=Decimal("5000.00"), confianca="real"
    )
    _snapshot(
        db_session, holding_tesouro, ano_mes="2026-01", saldo=Decimal("8000.00"), confianca="real"
    )
    _snapshot(
        db_session,
        holding_reserva,
        ano_mes="2026-02",
        saldo=Decimal("6000.00"),
        rendimento=Decimal("300.00"),
        confianca="real",
    )
    _snapshot(
        db_session,
        holding_tesouro,
        ano_mes="2026-02",
        saldo=Decimal("9000.00"),
        rendimento=Decimal("700.00"),
        confianca="real",
    )

    evolucao = service.get_evolucao_mensal_consolidada(db_session, user.id)

    assert [e.ano_mes for e in evolucao] == ["2026-01", "2026-02"]
    jan = evolucao[0]
    assert jan.saldo == Decimal("13000.00")
    fev = evolucao[1]
    assert fev.saldo == Decimal("15000.00")
    assert fev.rendimento == Decimal("1000.00")


def test_get_evolucao_mensal_consolidada_mes_reconstruido_se_qualquer_holding_for(db_session, user):
    reserva = service.create_investimento(db_session, user.id, nome="Reserva")
    tesouro = service.create_investimento(db_session, user.id, nome="Tesouro IPCA+")
    holding_reserva = _investment(db_session, user, investimento_id=reserva.id)
    holding_tesouro = _investment(db_session, user, investimento_id=tesouro.id)
    _snapshot(
        db_session, holding_reserva, ano_mes="2026-01", saldo=Decimal("1000.00"), confianca="real"
    )
    _snapshot(
        db_session,
        holding_tesouro,
        ano_mes="2026-01",
        saldo=Decimal("2000.00"),
        confianca="reconstruido",
    )

    evolucao = service.get_evolucao_mensal_consolidada(db_session, user.id)

    assert evolucao[0].confianca == "reconstruido"


def test_get_evolucao_mensal_consolidada_isolated_by_user(db_session, user, other_user):
    investimento = service.create_investimento(db_session, other_user.id, nome="Do outro")
    holding = _investment(db_session, other_user, investimento_id=investimento.id)
    _snapshot(db_session, holding, ano_mes="2026-01", saldo=Decimal("999.00"))

    assert service.get_evolucao_mensal_consolidada(db_session, user.id) == []


def test_get_evolucao_mensal_consolidada_ignores_unlinked_holdings(db_session, user):
    service.create_investimento(db_session, user.id, nome="Sem holding vinculado")
    holding_solto = _investment(db_session, user, valor_atual=Decimal("1000.00"))
    _snapshot(db_session, holding_solto, ano_mes="2026-01", saldo=Decimal("1000.00"))

    assert service.get_evolucao_mensal_consolidada(db_session, user.id) == []


# --- Sprint 23: get_transacoes (extrato unificado) ------------------------


def test_get_transacoes_only_holdings_returns_holding_side(db_session, user):
    # Regressão do bug real: "Quitar o AP" (só-holdings, sem carteira
    # bancária vinculada) resultava em extrato sempre vazio.
    investimento = service.create_investimento(db_session, user.id, nome="Quitar o AP")
    holding = _investment(db_session, user, investimento_id=investimento.id)
    _investment_transaction(
        db_session, user, holding, valor="5000.00", tipo="BUY", data=date(2026, 1, 3)
    )

    transacoes = service.get_transacoes(db_session, user.id, investimento.id)

    assert len(transacoes) == 1
    assert transacoes[0].origem == "holding"
    assert transacoes[0].tipo == "BUY"
    assert transacoes[0].valor == Decimal("5000.00")
    assert transacoes[0].holding_nome == holding.nome


def test_get_transacoes_unites_conta_and_holding_sources(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Misto")
    account = _account(db_session, user, investimento_id=investimento.id)
    aporte = _aporte_subcategory(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=aporte.id,
        investimento_id=investimento.id,
        data=date(2026, 1, 10),
    )
    holding = _investment(db_session, user, investimento_id=investimento.id)
    _investment_transaction(
        db_session, user, holding, valor="2000.00", tipo="BUY", data=date(2026, 1, 20)
    )

    transacoes = service.get_transacoes(db_session, user.id, investimento.id)

    assert [t.origem for t in transacoes] == ["holding", "conta"]  # data desc


def test_get_transacoes_filters_by_ano_mes(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Filtro")
    holding = _investment(db_session, user, investimento_id=investimento.id)
    _investment_transaction(db_session, user, holding, valor="100.00", data=date(2026, 1, 15))
    _investment_transaction(db_session, user, holding, valor="200.00", data=date(2026, 2, 15))
    _investment_transaction(db_session, user, holding, valor="300.00", data=date(2025, 1, 15))

    transacoes = service.get_transacoes(db_session, user.id, investimento.id, ano=2026, mes=1)

    assert len(transacoes) == 1
    assert transacoes[0].valor == Decimal("100.00")


def test_get_transacoes_uses_descricao_usuario_override(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Override")
    account = _account(db_session, user, investimento_id=investimento.id)
    tx = _transaction(
        db_session,
        user,
        account,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        investimento_id=investimento.id,
    )
    tx.descricao_usuario = "Aporte mensal renomeado"
    db_session.commit()

    transacoes = service.get_transacoes(db_session, user.id, investimento.id)

    assert transacoes[0].descricao == "Aporte mensal renomeado"


def test_get_transacoes_isolated_by_user(db_session, user, other_user):
    investimento = service.create_investimento(db_session, other_user.id, nome="Do outro")
    holding = _investment(db_session, other_user, investimento_id=investimento.id)
    _investment_transaction(db_session, other_user, holding, valor="999.00")

    with pytest.raises(NotFoundError):
        service.get_transacoes(db_session, user.id, investimento.id)


def test_get_transacoes_missing_investimento_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.get_transacoes(db_session, user.id, 999)


def test_get_transacoes_empty_when_nothing_linked(db_session, user):
    investimento = service.create_investimento(db_session, user.id, nome="Vazio")

    assert service.get_transacoes(db_session, user.id, investimento.id) == []
