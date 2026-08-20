from datetime import date
from decimal import Decimal

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Query, Session

from app.categories.service import get_subcategory
from app.exceptions import NotFoundError
from app.models.orcamento import Orcamento, OrcamentoTipo


def _periodo_ordinal(ano: int, mes: int):
    return ano * 12 + mes


def vigente_filter(ano: int, mes: int):
    """Filtro de vigência em tempo constante — nunca expande "ad eternum" em
    série, compara por mês/ano via aritmética de ordinal (ano*12+mes)."""
    referencia = _periodo_ordinal(ano, mes)
    data_inicio_ordinal = func.extract("year", Orcamento.data_inicio) * 12 + func.extract(
        "month", Orcamento.data_inicio
    )
    data_fim_ordinal = func.extract("year", Orcamento.data_fim) * 12 + func.extract(
        "month", Orcamento.data_fim
    )

    eventual_vigente = and_(
        Orcamento.tipo == OrcamentoTipo.eventual,
        Orcamento.ano == ano,
        Orcamento.mes == mes,
    )
    recorrente_vigente = and_(
        Orcamento.tipo == OrcamentoTipo.recorrente,
        data_inicio_ordinal <= referencia,
        or_(Orcamento.data_fim.is_(None), data_fim_ordinal >= referencia),
    )
    return or_(eventual_vigente, recorrente_vigente)


def list_orcamentos(db: Session, user_id: int) -> list[Orcamento]:
    return db.query(Orcamento).filter(Orcamento.user_id == user_id).order_by(Orcamento.id).all()


def get_orcamento(db: Session, user_id: int, orcamento_id: int) -> Orcamento:
    orcamento = (
        db.query(Orcamento)
        .filter(Orcamento.id == orcamento_id, Orcamento.user_id == user_id)
        .one_or_none()
    )
    if orcamento is None:
        raise NotFoundError(f"Orçamento {orcamento_id} não encontrado")
    return orcamento


def create_orcamento(
    db: Session,
    user_id: int,
    *,
    subcategory_id: int,
    tipo: OrcamentoTipo,
    valor: Decimal,
    ano: int | None,
    mes: int | None,
    data_inicio: date | None,
    data_fim: date | None,
) -> Orcamento:
    get_subcategory(db, user_id, subcategory_id)
    orcamento = Orcamento(
        user_id=user_id,
        subcategory_id=subcategory_id,
        tipo=tipo,
        valor=valor,
        ano=ano,
        mes=mes,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
    db.add(orcamento)
    db.commit()
    db.refresh(orcamento)
    return orcamento


def update_orcamento(
    db: Session,
    user_id: int,
    orcamento_id: int,
    *,
    subcategory_id: int,
    tipo: OrcamentoTipo,
    valor: Decimal,
    ano: int | None,
    mes: int | None,
    data_inicio: date | None,
    data_fim: date | None,
) -> Orcamento:
    orcamento = get_orcamento(db, user_id, orcamento_id)
    get_subcategory(db, user_id, subcategory_id)
    orcamento.subcategory_id = subcategory_id
    orcamento.tipo = tipo
    orcamento.valor = valor
    orcamento.ano = ano
    orcamento.mes = mes
    orcamento.data_inicio = data_inicio
    orcamento.data_fim = data_fim
    db.commit()
    db.refresh(orcamento)
    return orcamento


def delete_orcamento(db: Session, user_id: int, orcamento_id: int) -> None:
    orcamento = get_orcamento(db, user_id, orcamento_id)
    db.delete(orcamento)
    db.commit()


def orcamentos_vigentes_query(db: Session, user_id: int, *, ano: int, mes: int) -> Query:
    return db.query(Orcamento).filter(Orcamento.user_id == user_id).filter(vigente_filter(ano, mes))
