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
        .outerjoin(Subcategory, PluggyTransaction.subcategory_id == Subcategory.id)
        .outerjoin(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(PluggyTransaction.user_id == user_id)
        .filter(func.coalesce(CategoryGroup.excluir_de_totais, False).is_(False))
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


def _calcula_patrimonio(db: Session, user_id: int) -> Decimal:
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
    return (
        _to_decimal(ativos)
        - _to_decimal(passivos)
        + _to_decimal(saldo_contas)
        - _to_decimal(saldo_cartoes)
    )


def get_summary(
    db: Session, user_id: int, *, ano: int | None = None, mes: int | None = None
) -> Summary:
    receita = _sum_tipo(db, user_id, PluggyTransactionTipo.credito, ano=ano, mes=mes)
    despesa = _sum_tipo(db, user_id, PluggyTransactionTipo.debito, ano=ano, mes=mes)
    patrimonio = _calcula_patrimonio(db, user_id)
    return Summary(receita=receita, despesa=despesa, saldo=receita - despesa, patrimonio=patrimonio)


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
    query = (
        _base_query(db, user_id)
        .join(PluggyAccount, PluggyTransaction.account_id == PluggyAccount.id)
        .filter(PluggyTransaction.tipo == tipo)
    )
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
    db: Session, user_id: int, *, ano: int | None = None, mes: int | None = None
) -> list[AtivoTotal]:
    # Só despesas — venda de ativo é tratada à parte (valor_venda), não entra
    # na agregação de transações. Sem bucket "sem ativo": a maioria das
    # despesas não tem asset_id, e isso é esperado (ver PRD-008).
    query = (
        _base_query(db, user_id)
        .join(Asset, PluggyTransaction.asset_id == Asset.id)
        .filter(PluggyTransaction.tipo == PluggyTransactionTipo.debito)
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
