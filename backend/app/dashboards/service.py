from dataclasses import dataclass
from decimal import Decimal

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


@dataclass
class MeioPagamentoTotal:
    account_tipo: PluggyAccountTipo
    total: Decimal


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


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
    return [
        CategoriaTotal(
            group_id=group_id if group_id is not None else SEM_CATEGORIA_ID,
            group_nome=group_nome if group_nome is not None else "Não categorizado",
            subcategory_id=subcategory_id if subcategory_id is not None else SEM_CATEGORIA_ID,
            subcategory_nome=(
                subcategory_nome if subcategory_nome is not None else "Não categorizado"
            ),
            total=_to_decimal(total),
        )
        for group_id, group_nome, subcategory_id, subcategory_nome, total in rows
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
    return [
        MeioPagamentoTotal(account_tipo=account_tipo, total=_to_decimal(total))
        for account_tipo, total in rows
    ]
