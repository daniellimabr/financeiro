from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.categorization.competencia import caixa, competencia_padrao, competencia_salario
from app.categorization.engine import suggest_holding_investimento
from app.categorization.service import salario_subcategory_id
from app.config import settings
from app.exceptions import InvalidStateError, NotFoundError
from app.models.category import SEM_CATEGORIA_ID
from app.models.investimento import Investimento
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyInvestment,
    PluggyInvestmentSnapshot,
    PluggyInvestmentTransaction,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.pluggy_integration.client import PluggyClient

_SALARIO_AJUSTE_DEZ_2025_DESCRICAO = "Salário (ajuste dez/2025)"


def _salario_ajuste_dez_2025_pluggy_transaction_id(user_id: int) -> str:
    return f"manual-salario-dez2025-user{user_id}"


NOT_SYNCABLE_STATUSES = {
    PluggyItemStatus.updating,
    PluggyItemStatus.login_error,
    PluggyItemStatus.error,
    PluggyItemStatus.waiting_user_input,
}


def create_connect_token(client: PluggyClient, *, item_id: str | None = None) -> str:
    return client.create_connect_token(item_id=item_id)


def register_item(
    db: Session, client: PluggyClient, user_id: int, pluggy_item_id: str
) -> PluggyItem:
    existing = (
        db.query(PluggyItem).filter(PluggyItem.pluggy_item_id == pluggy_item_id).one_or_none()
    )
    if existing is not None:
        return existing

    raw = client.get_item(pluggy_item_id)
    item = PluggyItem(
        user_id=user_id,
        pluggy_item_id=pluggy_item_id,
        connector_id=raw["connector"]["id"],
        connector_name=raw["connector"]["name"],
        status=_map_item_status(raw["status"]),
        status_detail=raw.get("statusDetail"),
        cutoff_date=settings.pluggy_sync_cutoff_date,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_items(db: Session, user_id: int) -> list[PluggyItem]:
    return (
        db.query(PluggyItem)
        .filter(PluggyItem.user_id == user_id)
        .order_by(PluggyItem.created_at)
        .all()
    )


def get_item(db: Session, user_id: int, item_id: int) -> PluggyItem:
    item = (
        db.query(PluggyItem)
        .filter(PluggyItem.id == item_id, PluggyItem.user_id == user_id)
        .one_or_none()
    )
    if item is None:
        raise NotFoundError(f"Item Pluggy {item_id} não encontrado")
    return item


def list_accounts(db: Session, user_id: int) -> list[PluggyAccount]:
    return (
        db.query(PluggyAccount)
        .filter(PluggyAccount.user_id == user_id)
        .order_by(PluggyAccount.nome)
        .all()
    )


def get_account(db: Session, user_id: int, account_id: int) -> PluggyAccount:
    account = (
        db.query(PluggyAccount)
        .filter(PluggyAccount.id == account_id, PluggyAccount.user_id == user_id)
        .one_or_none()
    )
    if account is None:
        raise NotFoundError(f"Conta {account_id} não encontrada")
    return account


def update_account(
    db: Session,
    user_id: int,
    account_id: int,
    *,
    apelido: str | None,
    sync_enabled: bool,
    investimento_id: int | None = None,
) -> PluggyAccount:
    account = get_account(db, user_id, account_id)
    if investimento_id is not None:
        investimento = (
            db.query(Investimento)
            .filter(Investimento.id == investimento_id, Investimento.user_id == user_id)
            .one_or_none()
        )
        if investimento is None:
            raise NotFoundError(f"Investimento {investimento_id} não encontrado")
    account.apelido = apelido
    account.sync_enabled = sync_enabled
    account.investimento_id = investimento_id
    db.commit()
    db.refresh(account)
    return account


def delete_account(db: Session, user_id: int, account_id: int) -> None:
    """Exclui uma conta desativada e suas transações — reutilizável (botão
    "Excluir conta" em Gestão de Contas), não script pontual. `PluggyAccount.
    transactions` já tem `cascade="all, delete-orphan"`, cobrindo a exclusão
    das `PluggyTransaction` da própria conta; a única desassociação manual
    necessária é `descricao_sugestao_origem_id` em transações de **outras**
    contas que apontem pra uma transação desta conta como origem da sugestão
    (FK auto-referenciada sem `ON DELETE`, rejeitaria a exclusão em cascata
    sem isso). `PluggyInvestment` nunca é tocado — holdings vivem no nível do
    item (`item_id`), não da conta.
    """
    account = get_account(db, user_id, account_id)
    transaction_ids = [
        row[0]
        for row in db.query(PluggyTransaction.id).filter(PluggyTransaction.account_id == account.id)
    ]
    if transaction_ids:
        db.query(PluggyTransaction).filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.descricao_sugestao_origem_id.in_(transaction_ids),
        ).update({PluggyTransaction.descricao_sugestao_origem_id: None}, synchronize_session=False)
    db.delete(account)
    db.commit()


def update_saldo_inicial(
    db: Session, user_id: int, account_id: int, *, saldo_inicial: Decimal | None
) -> PluggyAccount:
    account = get_account(db, user_id, account_id)
    account.saldo_inicial = saldo_inicial
    db.commit()
    db.refresh(account)
    return account


def list_investments(
    db: Session, user_id: int, *, investimento_id: int | None = None
) -> list[PluggyInvestment]:
    query = db.query(PluggyInvestment).filter(PluggyInvestment.user_id == user_id)
    if investimento_id is not None:
        query = query.filter(PluggyInvestment.investimento_id == investimento_id)
    return query.order_by(PluggyInvestment.nome).all()


def get_investment(db: Session, user_id: int, investment_id: int) -> PluggyInvestment:
    investment = (
        db.query(PluggyInvestment)
        .filter(PluggyInvestment.id == investment_id, PluggyInvestment.user_id == user_id)
        .one_or_none()
    )
    if investment is None:
        raise NotFoundError(f"Posição de investimento {investment_id} não encontrada")
    return investment


def update_investment(
    db: Session, user_id: int, investment_id: int, *, investimento_id: int | None = None
) -> PluggyInvestment:
    investment = get_investment(db, user_id, investment_id)
    if investimento_id is not None:
        investimento = (
            db.query(Investimento)
            .filter(Investimento.id == investimento_id, Investimento.user_id == user_id)
            .one_or_none()
        )
        if investimento is None:
            raise NotFoundError(f"Investimento {investimento_id} não encontrado")
    investment.investimento_id = investimento_id
    db.commit()
    db.refresh(investment)
    return investment


def update_investment_saldo_inicial(
    db: Session, user_id: int, investment_id: int, *, saldo_inicial: Decimal | None
) -> PluggyInvestment:
    investment = get_investment(db, user_id, investment_id)
    investment.saldo_inicial = saldo_inicial
    db.commit()
    db.refresh(investment)
    return investment


_BASELINE_DATA = date(2025, 12, 31)


@dataclass
class BaselineProposalLine:
    investment_id: int
    nome: str
    tipo: str
    codigo: str | None
    saldo_atual: Decimal
    saldo_inicial_proposto: Decimal
    confianca: str
    motivo: str


def propose_baseline_dez_2025(
    db: Session, client: PluggyClient, user_id: int
) -> list[BaselineProposalLine]:
    """Gera a proposta de saldo em 31/12/2025 por holding, sem persistir nada
    — o CEO revisa/ajusta linha a linha antes de `confirm_baseline_dez_2025`.
    Algoritmo fechado no Bloco 0 da Sprint 21 (ver SPRINT-021-progress.md):
    (1) posição comprada depois do baseline -> 0, confiança alta (fato, não
    estimativa); (2) taxa verdadeiramente fixa (`fixedAnnualRate`, sem índice
    variável) e comprada antes do baseline -> juros compostos, confiança
    alta; (3) resto (CDI/IPCA indexado, ou EQUITY) -> fórmula reversa de
    fluxo, confiança "estimada" — CDI/IPCA histórico e cotação de ações são
    fontes de mercado fora de escopo (mesmo princípio já usado pra ações).
    """
    holdings = (
        db.query(PluggyInvestment)
        .filter(PluggyInvestment.user_id == user_id)
        .order_by(PluggyInvestment.nome)
        .all()
    )
    if not holdings:
        return []

    items_by_id = {
        item.id: item
        for item in db.query(PluggyItem).filter(PluggyItem.id.in_({h.item_id for h in holdings}))
    }
    raw_by_investment_id: dict[str, dict] = {}
    fetched_pluggy_item_ids: set[str] = set()
    for holding in holdings:
        pluggy_item_id = items_by_id[holding.item_id].pluggy_item_id
        if pluggy_item_id in fetched_pluggy_item_ids:
            continue
        for raw in client.get_investments(pluggy_item_id):
            raw_by_investment_id[raw["id"]] = raw
        fetched_pluggy_item_ids.add(pluggy_item_id)

    return [
        _propose_baseline_line(db, holding, raw_by_investment_id.get(holding.pluggy_investment_id))
        for holding in holdings
    ]


def _propose_baseline_line(
    db: Session, holding: PluggyInvestment, raw: dict | None
) -> BaselineProposalLine:
    purchase_date_raw = raw.get("purchaseDate") if raw else None
    purchase_date = _parse_investment_date(purchase_date_raw) if purchase_date_raw else None

    if purchase_date is not None and purchase_date > _BASELINE_DATA:
        return BaselineProposalLine(
            investment_id=holding.id,
            nome=holding.nome,
            tipo=holding.tipo,
            codigo=holding.codigo,
            saldo_atual=holding.valor_atual,
            saldo_inicial_proposto=Decimal("0"),
            confianca="alta",
            motivo="Posição comprada depois de 31/12/2025 — não existia no baseline.",
        )

    fixed_annual_rate = raw.get("fixedAnnualRate") if raw else None
    rate_type = raw.get("rateType") if raw else None
    amount_original = raw.get("amountOriginal") if raw else None
    if (
        purchase_date is not None
        and fixed_annual_rate is not None
        and rate_type is None
        and amount_original
    ):
        saldo = _juros_compostos(
            Decimal(str(amount_original)),
            Decimal(str(fixed_annual_rate)),
            purchase_date,
            _BASELINE_DATA,
        )
        return BaselineProposalLine(
            investment_id=holding.id,
            nome=holding.nome,
            tipo=holding.tipo,
            codigo=holding.codigo,
            saldo_atual=holding.valor_atual,
            saldo_inicial_proposto=saldo,
            confianca="alta",
            motivo=(
                f"Juros compostos a {fixed_annual_rate}% a.a. (taxa fixa) desde "
                f"{purchase_date.isoformat()}."
            ),
        )

    net_aportes = _net_aportes_desde_cutoff(db, holding.id)
    saldo_estimado = max(holding.valor_atual - net_aportes, Decimal("0"))
    return BaselineProposalLine(
        investment_id=holding.id,
        nome=holding.nome,
        tipo=holding.tipo,
        codigo=holding.codigo,
        saldo_atual=holding.valor_atual,
        saldo_inicial_proposto=saldo_estimado,
        confianca="estimada",
        motivo=(
            "Estimado por fluxo reverso (saldo atual − aportes líquidos desde jan/2026) — "
            "sem fonte de cotação/índice histórico integrada (fora de escopo)."
        ),
    )


def _juros_compostos(
    principal: Decimal, annual_rate_pct: Decimal, start: date, end: date
) -> Decimal:
    if end <= start:
        return principal
    days = (end - start).days
    daily_rate = (1 + float(annual_rate_pct) / 100) ** (1 / 365) - 1
    valor = float(principal) * (1 + daily_rate) ** days
    return Decimal(str(round(valor, 2)))


def _net_aportes_desde_cutoff(db: Session, investment_id: int) -> Decimal:
    # Achado real do Bloco 0 da Sprint 22: sem o filtro de data, uma compra
    # original registrada *antes* do baseline (ex.: 06/10/2025) era somada
    # aqui como se fosse um aporte novo — subtraindo do saldo atual capital
    # que já deveria estar dentro do próprio baseline, subestimando
    # `saldo_inicial_proposto` em holdings com histórico de transação
    # anterior a 31/12/2025 (gap de ~R$22k confirmado contra 3 holdings reais
    # do investimento "Quitar o AP": ids com BUY pré-corte).
    buys = (
        db.query(func.coalesce(func.sum(PluggyInvestmentTransaction.valor), 0))
        .filter(
            PluggyInvestmentTransaction.investment_id == investment_id,
            PluggyInvestmentTransaction.tipo == "BUY",
            PluggyInvestmentTransaction.data > _BASELINE_DATA,
        )
        .scalar()
    )
    sells = (
        db.query(func.coalesce(func.sum(PluggyInvestmentTransaction.valor), 0))
        .filter(
            PluggyInvestmentTransaction.investment_id == investment_id,
            PluggyInvestmentTransaction.tipo == "SELL",
            PluggyInvestmentTransaction.data > _BASELINE_DATA,
        )
        .scalar()
    )
    return Decimal(str(buys)) - Decimal(str(sells))


def confirm_baseline_dez_2025(
    db: Session, user_id: int, linhas: list[tuple[int, Decimal]]
) -> list[PluggyInvestment]:
    """Grava `saldo_inicial` só após o CEO revisar/ajustar a proposta —
    nunca chamado automaticamente pelo sync."""
    investments = [get_investment(db, user_id, investment_id) for investment_id, _ in linhas]
    for investment, (_, saldo_inicial) in zip(investments, linhas, strict=True):
        investment.saldo_inicial = saldo_inicial
    db.commit()
    for investment in investments:
        db.refresh(investment)
    return investments


def reconstruct_historical_snapshots(db: Session, user_id: int) -> list[PluggyInvestmentSnapshot]:
    """Popula retroativamente jan/2026 até o mês anterior ao corrente, por
    holding com baseline já aprovado (`saldo_inicial IS NOT NULL` —
    holdings sem baseline aprovado são ignoradas). Sem fonte de valorização
    histórica real (mesma limitação de mercado do baseline), o crescimento
    total observado (`holding.valor_atual` de hoje menos o saldo projetado só
    por fluxo de aportes/resgates) é distribuído pró-rata pelos dias em que a
    posição esteve aberta em cada mês — não mais zerado e concentrado inteiro
    no primeiro snapshot real (achado real da Sprint 22: CDB "Quitar o AP"
    mostrava R$22k de "rendimento" só no mês do primeiro sync pós-baseline).
    `snapshot_current_month` (chamado a cada sync, não alterado por este
    ajuste) automaticamente herda o resíduo correto do mês corrente, porque
    seu cálculo já é por subtração contra o `saldo` do último mês reconstruído
    — ao reconstruir com a fatia correta aqui, o que sobra pro mês corrente
    também fica correto, sem precisar duplicar a lógica de residual.
    `confianca="reconstruido"` marca a diferença pra UI.
    """
    holdings = (
        db.query(PluggyInvestment)
        .filter(PluggyInvestment.user_id == user_id, PluggyInvestment.saldo_inicial.isnot(None))
        .order_by(PluggyInvestment.id)
        .all()
    )
    snapshots = [
        snap for holding in holdings for snap in _reconstruct_holding_snapshots(db, holding)
    ]
    db.commit()
    return snapshots


def _months_between(start: date, end_exclusive: date) -> list[str]:
    months = []
    year, month = start.year, start.month
    while (year, month) < (end_exclusive.year, end_exclusive.month):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            month, year = 1, year + 1
    return months


def _mes_bounds(ano: int, mes: int) -> tuple[date, date]:
    inicio = date(ano, mes, 1)
    fim = date(ano, 12, 31) if mes == 12 else date(ano, mes + 1, 1) - timedelta(days=1)
    return inicio, fim


def _dias_posicao_aberta_no_mes(
    effective_start: date, effective_end: date, ano: int, mes: int
) -> int:
    """Dias em que a posição esteve aberta (comprada e ainda não totalmente
    resgatada) dentro do mês — usado como peso da redistribuição pró-rata do
    crescimento observado. `effective_end` já vem limitado a "hoje" (nunca
    conta dias futuros do mês corrente)."""
    mes_inicio, mes_fim = _mes_bounds(ano, mes)
    lo = max(effective_start, mes_inicio)
    hi = min(effective_end, mes_fim)
    return max((hi - lo).days + 1, 0)


def _reconstruct_holding_snapshots(
    db: Session, holding: PluggyInvestment
) -> list[PluggyInvestmentSnapshot]:
    hoje = datetime.now(_BRT).date()
    meses = _months_between(date(2026, 1, 1), date(hoje.year, hoje.month, 1))
    transactions = (
        db.query(PluggyInvestmentTransaction)
        .filter(PluggyInvestmentTransaction.investment_id == holding.id)
        .order_by(PluggyInvestmentTransaction.data)
        .all()
    )

    # Crescimento total observado até hoje (mesma fórmula de resíduo que
    # snapshot_current_month usa para um único mês, aqui aplicada ao período
    # inteiro jan/2026-hoje) — distribuído a seguir pró-rata pelos meses
    # reconstruídos; o que sobrar fica implicitamente para snapshot_current_month
    # calcular no mês corrente (ver docstring de reconstruct_historical_snapshots).
    # Mesmo cuidado de _net_aportes_desde_cutoff (achado real do Bloco 0 da
    # Sprint 22): só conta transação **depois** do baseline — uma compra
    # anterior a 31/12/2025 já está embutida em `saldo_inicial`, contá-la
    # aqui de novo subtrairia capital que nunca foi "crescimento".
    net_aportes_total = sum(
        (tx.valor for tx in transactions if tx.tipo == "BUY" and tx.data > _BASELINE_DATA),
        Decimal("0"),
    ) - sum(
        (tx.valor for tx in transactions if tx.tipo == "SELL" and tx.data > _BASELINE_DATA),
        Decimal("0"),
    )
    residual_total = holding.valor_atual - holding.saldo_inicial - net_aportes_total

    buys_no_periodo = [tx.data for tx in transactions if tx.tipo == "BUY"]
    sells_no_periodo = [tx.data for tx in transactions if tx.tipo == "SELL"]
    if holding.saldo_inicial != 0:
        effective_start = date(2026, 1, 1)
    else:
        effective_start = min(buys_no_periodo) if buys_no_periodo else date(2026, 1, 1)
    if holding.valor_atual == 0 and sells_no_periodo:
        effective_end = max(sells_no_periodo)
    else:
        effective_end = hoje

    pesos_reconstrucao = {
        ano_mes: _dias_posicao_aberta_no_mes(
            effective_start, effective_end, int(ano_mes[:4]), int(ano_mes[5:7])
        )
        for ano_mes in meses
    }
    peso_mes_atual = _dias_posicao_aberta_no_mes(
        effective_start, effective_end, hoje.year, hoje.month
    )
    total_dias = sum(pesos_reconstrucao.values()) + peso_mes_atual

    saldo_acumulado = holding.saldo_inicial
    result = []
    for ano_mes in meses:
        ano, mes = int(ano_mes[:4]), int(ano_mes[5:7])
        aportes = sum(
            (tx.valor for tx in transactions if tx.tipo == "BUY" and _no_mes(tx.data, ano, mes)),
            Decimal("0"),
        )
        resgates = sum(
            (tx.valor for tx in transactions if tx.tipo == "SELL" and _no_mes(tx.data, ano, mes)),
            Decimal("0"),
        )
        crescimento_alocado = (
            (residual_total * pesos_reconstrucao[ano_mes] / total_dias).quantize(Decimal("0.01"))
            if total_dias > 0
            else Decimal("0")
        )
        saldo_acumulado = saldo_acumulado + aportes - resgates + crescimento_alocado
        valorizacao = crescimento_alocado if holding.tipo == "EQUITY" else Decimal("0")
        rendimento = Decimal("0") if holding.tipo == "EQUITY" else crescimento_alocado
        result.append(
            _upsert_snapshot(
                db,
                holding,
                ano_mes,
                saldo=saldo_acumulado,
                valorizacao=valorizacao,
                rendimento=rendimento,
                dividendos=Decimal("0") if holding.tipo == "EQUITY" else None,
                aportes=aportes,
                resgates=resgates,
                confianca="reconstruido",
            )
        )
    return result


def _no_mes(data: date, ano: int, mes: int) -> bool:
    return data.year == ano and data.month == mes


def _upsert_snapshot(
    db: Session,
    holding: PluggyInvestment,
    ano_mes: str,
    *,
    saldo: Decimal,
    valorizacao: Decimal,
    rendimento: Decimal,
    dividendos: Decimal | None,
    aportes: Decimal,
    resgates: Decimal,
    confianca: str,
) -> PluggyInvestmentSnapshot:
    snapshot = (
        db.query(PluggyInvestmentSnapshot)
        .filter(
            PluggyInvestmentSnapshot.investment_id == holding.id,
            PluggyInvestmentSnapshot.ano_mes == ano_mes,
        )
        .one_or_none()
    )
    if snapshot is None:
        snapshot = PluggyInvestmentSnapshot(
            investment_id=holding.id, user_id=holding.user_id, ano_mes=ano_mes
        )
        db.add(snapshot)
    snapshot.saldo = saldo
    snapshot.valorizacao = valorizacao
    snapshot.rendimento = rendimento
    snapshot.dividendos = dividendos
    snapshot.aportes = aportes
    snapshot.resgates = resgates
    snapshot.confianca = confianca
    db.flush()
    return snapshot


def snapshot_current_month(
    db: Session, holding: PluggyInvestment
) -> PluggyInvestmentSnapshot | None:
    """Grava/atualiza o snapshot do mês corrente pra uma holding, chamado a
    cada sync (mesmo princípio de "mês corrente é provisório" já usado
    noutras partes do sistema — meses fechados nunca são revisitados aqui).
    Idempotente via `UniqueConstraint(investment_id, ano_mes)` — rodar 2x no
    mesmo mês faz upsert, não duplica. Não faz nada se o baseline ainda não
    foi aprovado (`saldo_inicial IS NULL`) — não há base pra calcular
    valorização/rendimento residual.
    """
    if holding.saldo_inicial is None:
        return None

    hoje = datetime.now(_BRT).date()
    ano_mes = f"{hoje.year:04d}-{hoje.month:02d}"
    mes_transactions = (
        db.query(PluggyInvestmentTransaction)
        .filter(
            PluggyInvestmentTransaction.investment_id == holding.id,
            PluggyInvestmentTransaction.data >= date(hoje.year, hoje.month, 1),
        )
        .all()
    )
    aportes = sum((tx.valor for tx in mes_transactions if tx.tipo == "BUY"), Decimal("0"))
    resgates = sum((tx.valor for tx in mes_transactions if tx.tipo == "SELL"), Decimal("0"))

    snapshot_anterior = (
        db.query(PluggyInvestmentSnapshot)
        .filter(
            PluggyInvestmentSnapshot.investment_id == holding.id,
            PluggyInvestmentSnapshot.ano_mes < ano_mes,
        )
        .order_by(PluggyInvestmentSnapshot.ano_mes.desc())
        .first()
    )
    saldo_anterior = (
        snapshot_anterior.saldo if snapshot_anterior is not None else holding.saldo_inicial
    )

    saldo_atual = holding.valor_atual
    residual = saldo_atual - saldo_anterior - aportes + resgates
    if holding.tipo == "EQUITY":
        # Nenhuma transação de dividendo foi observada no achado real do
        # Bloco 0 — dividendos ficam 0 até a Pluggy reportar um `type`
        # identificável; toda a diferença cai em valorização.
        valorizacao, rendimento, dividendos = residual, Decimal("0"), Decimal("0")
    else:
        valorizacao, rendimento, dividendos = Decimal("0"), residual, None

    snapshot = _upsert_snapshot(
        db,
        holding,
        ano_mes,
        saldo=saldo_atual,
        valorizacao=valorizacao,
        rendimento=rendimento,
        dividendos=dividendos,
        aportes=aportes,
        resgates=resgates,
        confianca="real",
    )
    return snapshot


def list_investment_transactions(
    db: Session, user_id: int, investment_id: int
) -> list[PluggyInvestmentTransaction]:
    get_investment(db, user_id, investment_id)
    return (
        db.query(PluggyInvestmentTransaction)
        .filter(
            PluggyInvestmentTransaction.user_id == user_id,
            PluggyInvestmentTransaction.investment_id == investment_id,
        )
        .order_by(PluggyInvestmentTransaction.data.desc())
        .all()
    )


def get_salario_ajuste_dez_2025(db: Session, user_id: int) -> PluggyTransaction | None:
    return (
        db.query(PluggyTransaction)
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.pluggy_transaction_id
            == _salario_ajuste_dez_2025_pluggy_transaction_id(user_id),
        )
        .one_or_none()
    )


def upsert_salario_ajuste_dez_2025(
    db: Session,
    user_id: int,
    *,
    account_id: int,
    data: date,
    valor: Decimal | None,
    cutoff_dia: int,
) -> PluggyTransaction | None:
    account = get_account(db, user_id, account_id)
    tx = get_salario_ajuste_dez_2025(db, user_id)

    if valor is None:
        if tx is not None:
            db.delete(tx)
            db.commit()
        return None

    subcategory_id = salario_subcategory_id(db)
    if subcategory_id is None:
        raise NotFoundError("Subcategoria 'Salário' não encontrada no catálogo")

    if tx is None:
        tx = PluggyTransaction(
            account_id=account.id,
            user_id=user_id,
            pluggy_transaction_id=_salario_ajuste_dez_2025_pluggy_transaction_id(user_id),
        )
        db.add(tx)
    else:
        tx.account_id = account.id

    tx.descricao = _SALARIO_AJUSTE_DEZ_2025_DESCRICAO
    tx.valor = valor
    tx.tipo = PluggyTransactionTipo.credito
    tx.data = data
    if account.tipo == PluggyAccountTipo.cartao_credito:
        tx.data_competencia = competencia_padrao(data, account.tipo)
    else:
        tx.data_competencia = competencia_salario(data, cutoff_dia)
    tx.data_caixa = caixa(tx.data_competencia, account.tipo)
    tx.subcategory_id = subcategory_id
    tx.status = PluggyTransactionStatus.efetivada
    tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
    db.commit()
    db.refresh(tx)
    return tx


def list_transactions(
    db: Session,
    user_id: int,
    *,
    ano: int | None = None,
    mes: int | None = None,
    subcategory_id: int | None = None,
    account_tipo: PluggyAccountTipo | None = None,
    asset_id: int | None = None,
    liability_id: int | None = None,
    investimento_id: int | None = None,
    tipo: PluggyTransactionTipo | None = None,
    competencia: bool = False,
) -> list[PluggyTransaction]:
    query = db.query(PluggyTransaction).filter(PluggyTransaction.user_id == user_id)

    data_field = PluggyTransaction.data_competencia if competencia else PluggyTransaction.data
    if ano is not None:
        query = query.filter(func.extract("year", data_field) == ano)
    if mes is not None:
        query = query.filter(func.extract("month", data_field) == mes)
    if subcategory_id is not None:
        if subcategory_id == SEM_CATEGORIA_ID:
            query = query.filter(PluggyTransaction.subcategory_id.is_(None))
        else:
            query = query.filter(PluggyTransaction.subcategory_id == subcategory_id)
    if account_tipo is not None:
        query = query.join(PluggyAccount).filter(PluggyAccount.tipo == account_tipo)
    if asset_id is not None:
        query = query.filter(PluggyTransaction.asset_id == asset_id)
    if liability_id is not None:
        query = query.filter(PluggyTransaction.liability_id == liability_id)
    if investimento_id is not None:
        query = query.filter(PluggyTransaction.investimento_id == investimento_id)
    if tipo is not None:
        query = query.filter(PluggyTransaction.tipo == tipo)

    return (
        query.options(joinedload(PluggyTransaction.account))
        .order_by(PluggyTransaction.data.desc())
        .all()
    )


def sync_item(db: Session, client: PluggyClient, user_id: int, item_id: int) -> PluggyItem:
    item = get_item(db, user_id, item_id)

    raw_item = client.get_item(item.pluggy_item_id)
    item.status = _map_item_status(raw_item["status"])
    item.status_detail = raw_item.get("statusDetail")

    if item.status in NOT_SYNCABLE_STATUSES:
        db.commit()
        db.refresh(item)
        raise InvalidStateError(
            f"Item {item_id} está em status '{item.status}' e não pode ser sincronizado"
        )

    accounts_raw = client.get_accounts(item.pluggy_item_id)
    for account_raw in accounts_raw:
        existing = (
            db.query(PluggyAccount)
            .filter(PluggyAccount.pluggy_account_id == account_raw["id"])
            .one_or_none()
        )
        if existing is not None and not existing.sync_enabled:
            # Conta removida da lista de sync pelo usuário — nem saldo nem
            # transações são atualizados enquanto sync_enabled=False.
            continue

        account = _upsert_account(db, item, account_raw)
        transactions_raw = client.get_transactions(account_raw["id"], from_date=item.cutoff_date)
        for tx_raw in transactions_raw:
            tx_date = _parse_date(tx_raw["date"])
            if tx_date < item.cutoff_date:
                continue
            _upsert_transaction(db, account, tx_raw, tx_date)

    # Investments é buscado para todo item, mesmo os que também retornam
    # contas via /accounts (achado real do Bloco 1, Sprint 20: XP retorna
    # ambos, sem sobreposição — holdings e contas bancárias são fontes
    # distintas para o mesmo item).
    investments_raw = client.get_investments(item.pluggy_item_id)
    for investment_raw in investments_raw:
        investment = _upsert_investment(db, item, investment_raw)
        if investment.investimento_id is None:
            _apply_holding_suggestion(db, investment)
        investment_transactions_raw = client.get_investment_transactions(
            investment_raw["id"], from_date=item.cutoff_date
        )
        for investment_tx_raw in investment_transactions_raw:
            _upsert_investment_transaction(db, investment, investment_tx_raw)
        snapshot_current_month(db, investment)

    item.last_synced_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item


class SyncItemResult:
    def __init__(
        self, item_id: int, success: bool, error: str | None = None, item: PluggyItem | None = None
    ):
        self.item_id = item_id
        self.success = success
        self.error = error
        self.item = item


def sync_items(
    db: Session, client: PluggyClient, user_id: int, item_ids: list[int] | None = None
) -> list[SyncItemResult]:
    ids = item_ids if item_ids is not None else [item.id for item in list_items(db, user_id)]

    results: list[SyncItemResult] = []
    for item_id in ids:
        try:
            synced = sync_item(db, client, user_id, item_id)
            results.append(SyncItemResult(item_id, True, None, synced))
        except NotFoundError as exc:
            results.append(SyncItemResult(item_id, False, str(exc)))
        except InvalidStateError as exc:
            results.append(SyncItemResult(item_id, False, str(exc)))
    return results


def _upsert_account(db: Session, item: PluggyItem, raw: dict) -> PluggyAccount:
    account = (
        db.query(PluggyAccount).filter(PluggyAccount.pluggy_account_id == raw["id"]).one_or_none()
    )
    if account is None:
        account = PluggyAccount(item_id=item.id, user_id=item.user_id, pluggy_account_id=raw["id"])
        db.add(account)

    account.tipo = _map_account_tipo(raw)
    account.nome = raw.get("name") or raw.get("marketingName") or ""
    account.numero_mascarado = raw.get("number")
    account.saldo = Decimal(str(raw["balance"]))
    account.moeda = raw.get("currencyCode", "BRL")

    credit_data = raw.get("creditData") or {}
    account.limite_credito = (
        Decimal(str(credit_data["creditLimit"]))
        if credit_data.get("creditLimit") is not None
        else None
    )
    account.fatura_vencimento = (
        date.fromisoformat(credit_data["balanceDueDate"])
        if credit_data.get("balanceDueDate")
        else None
    )

    db.flush()
    return account


def _upsert_investment(db: Session, item: PluggyItem, raw: dict) -> PluggyInvestment:
    investment = (
        db.query(PluggyInvestment)
        .filter(PluggyInvestment.pluggy_investment_id == raw["id"])
        .one_or_none()
    )
    if investment is None:
        investment = PluggyInvestment(
            item_id=item.id, user_id=item.user_id, pluggy_investment_id=raw["id"]
        )
        db.add(investment)

    investment.tipo = raw.get("type") or ""
    investment.subtipo = raw.get("subtype")
    investment.nome = raw.get("name") or ""
    # `code` (ticker) e `isin` são campos distintos no payload real (Bloco 1) —
    # `code` cobre ações (ex.: HAPV3); CDBs não têm nenhum dos dois, títulos do
    # Tesouro têm os dois idênticos. Um único campo `codigo` livre é suficiente
    # para exibição (critério de aceite 4 do PRD-020).
    investment.codigo = raw.get("code") or raw.get("isin")
    investment.quantidade = (
        Decimal(str(raw["quantity"])) if raw.get("quantity") is not None else None
    )
    investment.valor_investido = (
        Decimal(str(raw["amountOriginal"])) if raw.get("amountOriginal") is not None else None
    )
    investment.valor_atual = Decimal(str(raw["balance"]))
    investment.moeda = raw.get("currencyCode", "BRL")

    db.flush()
    return investment


def _apply_holding_suggestion(db: Session, investment: PluggyInvestment) -> None:
    # Só chamada para holdings ainda sem investimento_id (verificado pelo
    # chamador) — nunca sobrescreve um vínculo manual já feito pelo usuário.
    suggestion = suggest_holding_investimento(db, investment.user_id, investment)
    if suggestion is not None:
        investment.investimento_sugerido_id = suggestion.investimento_id
        investment.investimento_sugestao_confianca = suggestion.confianca
        investment.investimento_sugestao_fonte_tipo = suggestion.fonte_tipo
        investment.investimento_sugestao_fonte_id = suggestion.fonte_id
        investment.investimento_sugestao_score = suggestion.score
    else:
        investment.investimento_sugerido_id = None
        investment.investimento_sugestao_confianca = None
        investment.investimento_sugestao_fonte_tipo = None
        investment.investimento_sugestao_fonte_id = None
        investment.investimento_sugestao_score = None
    db.flush()


def _upsert_investment_transaction(
    db: Session, investment: PluggyInvestment, raw: dict
) -> PluggyInvestmentTransaction:
    tx = (
        db.query(PluggyInvestmentTransaction)
        .filter(PluggyInvestmentTransaction.pluggy_investment_transaction_id == raw["id"])
        .one_or_none()
    )
    if tx is None:
        tx = PluggyInvestmentTransaction(
            investment_id=investment.id,
            user_id=investment.user_id,
            pluggy_investment_transaction_id=raw["id"],
        )
        db.add(tx)

    tx.tipo = raw.get("type") or ""
    tx.descricao = raw.get("description")
    tx.valor = Decimal(str(raw["amount"]))
    tx.quantidade = Decimal(str(raw["quantity"])) if raw.get("quantity") is not None else None
    tx.data = _parse_investment_date(raw["date"])
    db.flush()
    return tx


def _upsert_transaction(
    db: Session, account: PluggyAccount, raw: dict, tx_date: date
) -> PluggyTransaction:
    tx = (
        db.query(PluggyTransaction)
        .filter(PluggyTransaction.pluggy_transaction_id == raw["id"])
        .one_or_none()
    )
    if tx is None:
        tx = PluggyTransaction(
            account_id=account.id,
            user_id=account.user_id,
            pluggy_transaction_id=raw["id"],
        )
        db.add(tx)

    tx.descricao = raw.get("description", "")
    tx.valor = Decimal(str(raw["amount"]))
    tx.tipo = _map_transaction_tipo(raw["type"])
    # Data editada manualmente pelo usuário (tela Categorizar) é uma trava
    # explícita contra o valor bruto da Pluggy — sobrevive a todo resync
    # futuro para a mesma transação (PRD-018).
    if not tx.data_editada_manualmente:
        tx.data = tx_date
        # Cartão sempre desloca incondicionalmente (mesmo valor de novo, sem
        # risco de perder ajuste manual). Transação já confirmada em outra conta
        # pode ter data_competencia deslocada por categoria (ex.: Salário, via
        # set_category/bulk_confirm) — resync não deve descartar esse ajuste.
        if (
            account.tipo == PluggyAccountTipo.cartao_credito
            or tx.categorizacao_status != PluggyTransactionCategorizacaoStatus.confirmada
        ):
            tx.data_competencia = competencia_padrao(tx_date, account.tipo)
            tx.data_caixa = caixa(tx.data_competencia, account.tipo)
    tx.categoria_pluggy = raw.get("category")
    tx.status = _map_transaction_status(raw.get("status", "POSTED"))
    db.flush()
    return tx


def _map_item_status(raw: str) -> PluggyItemStatus:
    return PluggyItemStatus(raw.lower())


def _map_account_tipo(raw: dict) -> PluggyAccountTipo:
    subtype = (raw.get("subtype") or "").upper()
    tipo = (raw.get("type") or "").upper()
    if tipo == "CREDIT":
        return PluggyAccountTipo.cartao_credito
    if subtype == "SAVINGS_ACCOUNT":
        return PluggyAccountTipo.poupanca
    if subtype == "CHECKING_ACCOUNT":
        return PluggyAccountTipo.corrente
    return PluggyAccountTipo.investimento


def _map_transaction_tipo(raw: str) -> PluggyTransactionTipo:
    return PluggyTransactionTipo.debito if raw.upper() == "DEBIT" else PluggyTransactionTipo.credito


def _map_transaction_status(raw: str) -> PluggyTransactionStatus:
    if raw.upper() == "PENDING":
        return PluggyTransactionStatus.pendente
    return PluggyTransactionStatus.efetivada


_BRT = ZoneInfo("America/Sao_Paulo")


def _parse_date(raw: str) -> date:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(_BRT).date()


def _parse_investment_date(raw: str) -> date:
    # `date`/`tradeDate` de /investments/{id}/transactions vêm como meia-noite
    # UTC (convenção de "só a data", achado do Bloco 1, Sprint 20) — diferente
    # do timestamp de evento de /v2/transactions, que exige conversão pra BRT
    # (_parse_date). Aplicar a mesma conversão aqui deslocaria a data um dia
    # pra trás incorretamente.
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
