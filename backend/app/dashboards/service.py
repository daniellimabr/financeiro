from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from app.models.asset import Asset, AssetStatus
from app.models.category import SEM_CATEGORIA_ID, CategoryGroup, Subcategory
from app.models.liability import Liability, LiabilityStatus
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyTransaction,
    PluggyTransactionTipo,
)


@dataclass
class Summary:
    receita: Decimal
    despesa: Decimal
    saldo: Decimal
    patrimonio: Decimal
    ativos: Decimal
    passivos: Decimal


@dataclass
class CategoriaTotal:
    group_id: int
    group_nome: str
    subcategory_id: int
    subcategory_nome: str
    total: Decimal
    percentual: Decimal


@dataclass
class MeioPagamentoTotal:
    account_tipo: PluggyAccountTipo
    total: Decimal
    percentual: Decimal


@dataclass
class TendenciaMes:
    ano: int
    mes: int
    receita: Decimal
    despesa: Decimal
    saldo: Decimal


@dataclass
class PontoTendencia:
    ano: int
    mes: int
    total: Decimal


@dataclass
class TendenciaCategoria:
    subcategory_id: int
    subcategory_nome: str
    pontos: list[PontoTendencia]


@dataclass
class AtivoTotal:
    asset_id: int
    asset_nome: str
    total: Decimal


@dataclass
class TendenciaAtivo:
    asset_id: int
    asset_nome: str
    pontos: list[PontoTendencia]


@dataclass
class PassivoTotal:
    liability_id: int
    liability_nome: str
    total: Decimal


@dataclass
class TendenciaPassivo:
    liability_id: int
    liability_nome: str
    pontos: list[PontoTendencia]


@dataclass
class PatrimonioBreakdown:
    ativos: Decimal
    passivos: Decimal
    saldo_contas: Decimal
    saldo_cartoes: Decimal
    total: Decimal


@dataclass
class SaldoConta:
    account_id: int
    account_nome: str
    account_tipo: PluggyAccountTipo
    saldo: Decimal
    limite_credito: Decimal | None = None


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


def _percentual(total: Decimal, total_geral: Decimal) -> Decimal:
    if total_geral == 0:
        return Decimal("0")
    return (total / total_geral * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _month_range(ano: int, mes: int, meses: int) -> list[tuple[int, int]]:
    """Últimos `meses` meses terminando em (ano, mes), em ordem cronológica."""
    periodo = []
    y, m = ano, mes
    for _ in range(meses):
        periodo.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    periodo.reverse()
    return periodo


def _date_bounds(periodo: list[tuple[int, int]]) -> tuple[date, date]:
    ano_ini, mes_ini = periodo[0]
    ano_fim, mes_fim = periodo[-1]
    inicio = date(ano_ini, mes_ini, 1)
    fim = date(ano_fim + 1, 1, 1) if mes_fim == 12 else date(ano_fim, mes_fim + 1, 1)
    return inicio, fim


def _base_query(db: Session, user_id: int) -> Query:
    return (
        db.query(PluggyTransaction)
        .join(PluggyAccount, PluggyTransaction.account_id == PluggyAccount.id)
        .outerjoin(Subcategory, PluggyTransaction.subcategory_id == Subcategory.id)
        .outerjoin(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(PluggyTransaction.user_id == user_id)
        .filter(func.coalesce(CategoryGroup.excluir_de_totais, False).is_(False))
        # Em conta de cartão de crédito, `tipo=credito` nunca é receita real —
        # é pagamento de fatura ou estorno/reversão de compra (sinal negativo
        # de `valor`, convenção já validada na Sprint 5 para saldo/fatura).
        # Investigado na Sprint 10 (achado NuTag): 100% dos `credito` de
        # cartão têm valor negativo, contra 100% dos `debito` com valor
        # positivo — sem exceção que sugira receita real (ex.: cashback)
        # nesse tipo de conta.
        .filter(
            ~(
                (PluggyAccount.tipo == PluggyAccountTipo.cartao_credito)
                & (PluggyTransaction.tipo == PluggyTransactionTipo.credito)
            )
        )
    )


def _apply_periodo(query: Query, *, ano: int | None, mes: int | None) -> Query:
    if ano is not None:
        query = query.filter(func.extract("year", PluggyTransaction.data_competencia) == ano)
    if mes is not None:
        query = query.filter(func.extract("month", PluggyTransaction.data_competencia) == mes)
    return query


def _sum_tipo(
    db: Session, user_id: int, tipo: PluggyTransactionTipo, *, ano: int | None, mes: int | None
) -> Decimal:
    query = _base_query(db, user_id).filter(PluggyTransaction.tipo == tipo)
    query = _apply_periodo(query, ano=ano, mes=mes)
    total = query.with_entities(
        func.coalesce(func.sum(func.abs(PluggyTransaction.valor)), 0)
    ).scalar()
    return _to_decimal(total)


def _ativos_e_passivos(db: Session, user_id: int) -> tuple[Decimal, Decimal]:
    ativos = (
        db.query(func.coalesce(func.sum(Asset.valor_atual), 0))
        .filter(Asset.user_id == user_id, Asset.status == AssetStatus.ativo)
        .scalar()
    )
    passivos = (
        db.query(func.coalesce(func.sum(Liability.saldo_devedor), 0))
        .filter(Liability.user_id == user_id, Liability.status == LiabilityStatus.ativo)
        .scalar()
    )
    return _to_decimal(ativos), _to_decimal(passivos)


def _patrimonio_breakdown(db: Session, user_id: int) -> PatrimonioBreakdown:
    ativos, passivos = _ativos_e_passivos(db, user_id)
    saldo_contas = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo != PluggyAccountTipo.cartao_credito,
        )
        .scalar()
    )
    # Saldo de cartão de crédito representa dívida (confirmado empiricamente
    # contra dado real da VM de dev, ver plano da Sprint 5), não ativo — entra
    # subtraindo do patrimônio.
    saldo_cartoes = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo == PluggyAccountTipo.cartao_credito,
        )
        .scalar()
    )
    saldo_contas = _to_decimal(saldo_contas)
    saldo_cartoes = _to_decimal(saldo_cartoes)
    return PatrimonioBreakdown(
        ativos=ativos,
        passivos=passivos,
        saldo_contas=saldo_contas,
        saldo_cartoes=saldo_cartoes,
        total=ativos - passivos + saldo_contas - saldo_cartoes,
    )


def _calcula_patrimonio(db: Session, user_id: int) -> Decimal:
    return _patrimonio_breakdown(db, user_id).total


def get_patrimonio_breakdown(db: Session, user_id: int) -> PatrimonioBreakdown:
    return _patrimonio_breakdown(db, user_id)


def get_summary(
    db: Session, user_id: int, *, ano: int | None = None, mes: int | None = None
) -> Summary:
    receita = _sum_tipo(db, user_id, PluggyTransactionTipo.credito, ano=ano, mes=mes)
    despesa = _sum_tipo(db, user_id, PluggyTransactionTipo.debito, ano=ano, mes=mes)
    patrimonio = _calcula_patrimonio(db, user_id)
    ativos, passivos = _ativos_e_passivos(db, user_id)
    return Summary(
        receita=receita,
        despesa=despesa,
        saldo=receita - despesa,
        patrimonio=patrimonio,
        ativos=ativos,
        passivos=passivos,
    )


def get_por_categoria(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
) -> list[CategoriaTotal]:
    query = _base_query(db, user_id).filter(PluggyTransaction.tipo == tipo)
    query = _apply_periodo(query, ano=ano, mes=mes)
    rows = (
        query.with_entities(
            CategoryGroup.id,
            CategoryGroup.nome,
            Subcategory.id,
            Subcategory.nome,
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(CategoryGroup.id, CategoryGroup.nome, Subcategory.id, Subcategory.nome)
        .all()
    )
    totais = [_to_decimal(total) for *_resto, total in rows]
    total_geral = sum(totais, Decimal("0"))
    return [
        CategoriaTotal(
            group_id=group_id if group_id is not None else SEM_CATEGORIA_ID,
            group_nome=group_nome if group_nome is not None else "Não categorizado",
            subcategory_id=subcategory_id if subcategory_id is not None else SEM_CATEGORIA_ID,
            subcategory_nome=(
                subcategory_nome if subcategory_nome is not None else "Não categorizado"
            ),
            total=total,
            percentual=_percentual(total, total_geral),
        )
        for (group_id, group_nome, subcategory_id, subcategory_nome, _), total in zip(
            rows, totais, strict=True
        )
    ]


def get_por_meio_pagamento(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    categoria_id: int | None = None,
) -> list[MeioPagamentoTotal]:
    query = _base_query(db, user_id).filter(PluggyTransaction.tipo == tipo)
    query = _apply_periodo(query, ano=ano, mes=mes)
    if categoria_id is not None:
        if categoria_id == SEM_CATEGORIA_ID:
            query = query.filter(PluggyTransaction.subcategory_id.is_(None))
        else:
            query = query.filter(PluggyTransaction.subcategory_id == categoria_id)

    rows = (
        query.with_entities(PluggyAccount.tipo, func.sum(func.abs(PluggyTransaction.valor)))
        .group_by(PluggyAccount.tipo)
        .all()
    )
    totais = [_to_decimal(total) for _, total in rows]
    total_geral = sum(totais, Decimal("0"))
    return [
        MeioPagamentoTotal(
            account_tipo=account_tipo, total=total, percentual=_percentual(total, total_geral)
        )
        for (account_tipo, _), total in zip(rows, totais, strict=True)
    ]


def get_tendencia(
    db: Session, user_id: int, *, ano: int, mes: int, meses: int = 6
) -> list[TendenciaMes]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)

    query = _base_query(db, user_id).filter(
        PluggyTransaction.data_competencia >= inicio,
        PluggyTransaction.data_competencia < fim,
    )
    rows = (
        query.with_entities(
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
            PluggyTransaction.tipo,
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
            PluggyTransaction.tipo,
        )
        .all()
    )

    totais = {chave: {"receita": Decimal("0"), "despesa": Decimal("0")} for chave in periodo}
    for y, m, tipo, total in rows:
        campo = "receita" if tipo == PluggyTransactionTipo.credito else "despesa"
        totais[(int(y), int(m))][campo] = _to_decimal(total)

    return [
        TendenciaMes(
            ano=y,
            mes=m,
            receita=totais[(y, m)]["receita"],
            despesa=totais[(y, m)]["despesa"],
            saldo=totais[(y, m)]["receita"] - totais[(y, m)]["despesa"],
        )
        for y, m in periodo
    ]


def get_tendencia_por_categoria(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = 6,
) -> list[TendenciaCategoria]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)

    query = (
        _base_query(db, user_id)
        .filter(PluggyTransaction.tipo == tipo)
        .filter(
            PluggyTransaction.data_competencia >= inicio,
            PluggyTransaction.data_competencia < fim,
        )
    )
    rows = (
        query.with_entities(
            Subcategory.id,
            Subcategory.nome,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Subcategory.id,
            Subcategory.nome,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
        )
        .all()
    )

    por_categoria: dict[int, dict] = {}
    for subcategory_id, subcategory_nome, y, m, total in rows:
        chave_cat = subcategory_id if subcategory_id is not None else SEM_CATEGORIA_ID
        nome = subcategory_nome if subcategory_nome is not None else "Não categorizado"
        if chave_cat not in por_categoria:
            por_categoria[chave_cat] = {
                "nome": nome,
                "pontos": {chave: Decimal("0") for chave in periodo},
            }
        por_categoria[chave_cat]["pontos"][(int(y), int(m))] = _to_decimal(total)

    return [
        TendenciaCategoria(
            subcategory_id=cat_id,
            subcategory_nome=dado["nome"],
            pontos=[PontoTendencia(ano=y, mes=m, total=dado["pontos"][(y, m)]) for y, m in periodo],
        )
        for cat_id, dado in por_categoria.items()
    ]


def get_por_ativo(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
) -> list[AtivoTotal]:
    # Venda de ativo é tratada à parte (valor_venda), nunca entra na
    # agregação de transações. Sem bucket "sem ativo": a maioria das
    # transações não tem asset_id, e isso é esperado (ver PRD-008).
    query = (
        _base_query(db, user_id)
        .join(Asset, PluggyTransaction.asset_id == Asset.id)
        .filter(PluggyTransaction.tipo == tipo)
    )
    query = _apply_periodo(query, ano=ano, mes=mes)
    rows = (
        query.with_entities(Asset.id, Asset.nome, func.sum(func.abs(PluggyTransaction.valor)))
        .group_by(Asset.id, Asset.nome)
        .all()
    )
    return [
        AtivoTotal(asset_id=asset_id, asset_nome=asset_nome, total=_to_decimal(total))
        for asset_id, asset_nome, total in rows
    ]


def get_tendencia_por_ativo(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = 6,
) -> list[TendenciaAtivo]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)

    query = (
        _base_query(db, user_id)
        .join(Asset, PluggyTransaction.asset_id == Asset.id)
        .filter(PluggyTransaction.tipo == tipo)
        .filter(
            PluggyTransaction.data_competencia >= inicio,
            PluggyTransaction.data_competencia < fim,
        )
    )
    rows = (
        query.with_entities(
            Asset.id,
            Asset.nome,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Asset.id,
            Asset.nome,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
        )
        .all()
    )

    por_ativo: dict[int, dict] = {}
    for asset_id, asset_nome, y, m, total in rows:
        if asset_id not in por_ativo:
            por_ativo[asset_id] = {
                "nome": asset_nome,
                "pontos": {chave: Decimal("0") for chave in periodo},
            }
        por_ativo[asset_id]["pontos"][(int(y), int(m))] = _to_decimal(total)

    return [
        TendenciaAtivo(
            asset_id=asset_id,
            asset_nome=dado["nome"],
            pontos=[PontoTendencia(ano=y, mes=m, total=dado["pontos"][(y, m)]) for y, m in periodo],
        )
        for asset_id, dado in por_ativo.items()
    ]


def get_por_passivo(
    db: Session,
    user_id: int,
    *,
    ano: int | None = None,
    mes: int | None = None,
) -> list[PassivoTotal]:
    # Passivo nunca gera receita — sempre despesa (tipo=debito), sem toggle
    # exposto ao chamador (diferente de /por-ativo).
    query = (
        _base_query(db, user_id)
        .join(Liability, PluggyTransaction.liability_id == Liability.id)
        .filter(PluggyTransaction.tipo == PluggyTransactionTipo.debito)
    )
    query = _apply_periodo(query, ano=ano, mes=mes)
    rows = (
        query.with_entities(
            Liability.id, Liability.nome, func.sum(func.abs(PluggyTransaction.valor))
        )
        .group_by(Liability.id, Liability.nome)
        .all()
    )
    return [
        PassivoTotal(
            liability_id=liability_id, liability_nome=liability_nome, total=_to_decimal(total)
        )
        for liability_id, liability_nome, total in rows
    ]


def get_tendencia_por_passivo(
    db: Session,
    user_id: int,
    *,
    ano: int,
    mes: int,
    meses: int = 6,
) -> list[TendenciaPassivo]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)

    query = (
        _base_query(db, user_id)
        .join(Liability, PluggyTransaction.liability_id == Liability.id)
        .filter(PluggyTransaction.tipo == PluggyTransactionTipo.debito)
        .filter(
            PluggyTransaction.data_competencia >= inicio,
            PluggyTransaction.data_competencia < fim,
        )
    )
    rows = (
        query.with_entities(
            Liability.id,
            Liability.nome,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Liability.id,
            Liability.nome,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
        )
        .all()
    )

    por_passivo: dict[int, dict] = {}
    for liability_id, liability_nome, y, m, total in rows:
        if liability_id not in por_passivo:
            por_passivo[liability_id] = {
                "nome": liability_nome,
                "pontos": {chave: Decimal("0") for chave in periodo},
            }
        por_passivo[liability_id]["pontos"][(int(y), int(m))] = _to_decimal(total)

    return [
        TendenciaPassivo(
            liability_id=liability_id,
            liability_nome=dado["nome"],
            pontos=[PontoTendencia(ano=y, mes=m, total=dado["pontos"][(y, m)]) for y, m in periodo],
        )
        for liability_id, dado in por_passivo.items()
    ]


def _subtract_month(d: date) -> date:
    year = d.year
    month = d.month - 1
    if month == 0:
        month = 12
        year -= 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def _fatura_atual(db: Session, account: PluggyAccount) -> Decimal:
    # Janela auto-contida (vencimento anterior, vencimento atual] — a Pluggy
    # não expõe data de fechamento de fatura nem um endpoint de bill/invoice
    # separado (só accounts/transactions), então a soma dos itens ainda não
    # pagos é aproximada por essa janela mensal ancorada no próprio
    # vencimento (não depende de nenhum outro dado do sync).
    inicio = _subtract_month(account.fatura_vencimento)
    total = (
        db.query(func.coalesce(func.sum(func.abs(PluggyTransaction.valor)), 0))
        .filter(
            PluggyTransaction.account_id == account.id,
            PluggyTransaction.tipo == PluggyTransactionTipo.debito,
            PluggyTransaction.data > inicio,
            PluggyTransaction.data <= account.fatura_vencimento,
        )
        .scalar()
    )
    return _to_decimal(total)


def get_saldo_por_conta(db: Session, user_id: int) -> list[SaldoConta]:
    # Sempre snapshot atual — sem parâmetro de período, mesmo padrão
    # conceitual do campo `patrimonio` em /dashboards/summary. Para
    # cartão de crédito com fatura_vencimento conhecido, mostra a soma dos
    # itens da fatura ainda não paga (ver _fatura_atual) em vez do saldo
    # bruto da conta; sem esse dado (conector não trouxe creditData), cai de
    # volta pro saldo bruto — mesmo comportamento de antes desta sprint.
    accounts = (
        db.query(PluggyAccount)
        .filter(PluggyAccount.user_id == user_id)
        .order_by(PluggyAccount.nome)
        .all()
    )
    return [
        SaldoConta(
            account_id=account.id,
            account_nome=account.apelido or account.nome,
            account_tipo=account.tipo,
            saldo=(
                _fatura_atual(db, account)
                if account.tipo == PluggyAccountTipo.cartao_credito
                and account.fatura_vencimento is not None
                else account.saldo
            ),
            limite_credito=account.limite_credito,
        )
        for account in accounts
    ]
