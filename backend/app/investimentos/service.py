from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.category import CategoryGroup, Subcategory
from app.models.investimento import Investimento
from app.models.pluggy import (
    PluggyAccount,
    PluggyInvestment,
    PluggyInvestmentSnapshot,
    PluggyInvestmentTransaction,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
)

_INVESTIMENTOS_GROUP_NOME = "Investimentos"
_APORTE_SUBCATEGORY_NOME = "Aporte"
_RESGATE_SUBCATEGORY_NOME = "Resgate"


def _subcategory_id(db: Session, user_id: int, nome: str) -> int | None:
    row = (
        db.query(Subcategory.id)
        .join(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(
            Subcategory.user_id == user_id,
            Subcategory.nome == nome,
            CategoryGroup.nome == _INVESTIMENTOS_GROUP_NOME,
        )
        .one_or_none()
    )
    return row[0] if row else None


def aporte_subcategory_id(db: Session, user_id: int) -> int | None:
    return _subcategory_id(db, user_id, _APORTE_SUBCATEGORY_NOME)


def resgate_subcategory_id(db: Session, user_id: int) -> int | None:
    return _subcategory_id(db, user_id, _RESGATE_SUBCATEGORY_NOME)


@dataclass
class Evolucao:
    saldo_base: Decimal
    saldo_atual: Decimal
    total_aportes: Decimal
    total_resgates: Decimal
    rendimento_estimado: Decimal


def list_investimentos(db: Session, user_id: int) -> list[Investimento]:
    return (
        db.query(Investimento)
        .filter(Investimento.user_id == user_id)
        .order_by(Investimento.nome)
        .all()
    )


@dataclass
class InvestimentoComValorAtual:
    id: int
    user_id: int
    nome: str
    valor_atual: Decimal
    created_at: object
    updated_at: object


def list_investimentos_com_valor_atual(
    db: Session, user_id: int
) -> list[InvestimentoComValorAtual]:
    """Mesma listagem de `list_investimentos`, com `valor_atual` agregado
    (contas + holdings vinculadas, mesma fonte usada em `get_evolucao`) —
    pronta pro drilldown do card Ativos/Patrimônio (Sprint 22), sem N+1: uma
    query agregada por fonte, não uma chamada de `get_evolucao` por linha."""
    investimentos = list_investimentos(db, user_id)
    if not investimentos:
        return []
    ids = [i.id for i in investimentos]
    saldo_contas = dict(
        db.query(PluggyAccount.investimento_id, func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(PluggyAccount.user_id == user_id, PluggyAccount.investimento_id.in_(ids))
        .group_by(PluggyAccount.investimento_id)
        .all()
    )
    saldo_holdings = dict(
        db.query(
            PluggyInvestment.investimento_id,
            func.coalesce(func.sum(PluggyInvestment.valor_atual), 0),
        )
        .filter(PluggyInvestment.user_id == user_id, PluggyInvestment.investimento_id.in_(ids))
        .group_by(PluggyInvestment.investimento_id)
        .all()
    )
    return [
        InvestimentoComValorAtual(
            id=i.id,
            user_id=i.user_id,
            nome=i.nome,
            valor_atual=(
                Decimal(str(saldo_contas.get(i.id, 0))) + Decimal(str(saldo_holdings.get(i.id, 0)))
            ),
            created_at=i.created_at,
            updated_at=i.updated_at,
        )
        for i in investimentos
    ]


def get_investimento(db: Session, user_id: int, investimento_id: int) -> Investimento:
    investimento = (
        db.query(Investimento)
        .filter(Investimento.id == investimento_id, Investimento.user_id == user_id)
        .one_or_none()
    )
    if investimento is None:
        raise NotFoundError(f"Investimento {investimento_id} não encontrado")
    return investimento


def create_investimento(db: Session, user_id: int, *, nome: str) -> Investimento:
    investimento = Investimento(user_id=user_id, nome=nome)
    db.add(investimento)
    db.commit()
    db.refresh(investimento)
    return investimento


def update_investimento(
    db: Session, user_id: int, investimento_id: int, *, nome: str
) -> Investimento:
    investimento = get_investimento(db, user_id, investimento_id)
    investimento.nome = nome
    db.commit()
    db.refresh(investimento)
    return investimento


def delete_investimento(db: Session, user_id: int, investimento_id: int) -> None:
    investimento = get_investimento(db, user_id, investimento_id)
    # Preserva histórico: exclusão nunca leva junto carteiras ou transações
    # vinculadas, só desassocia (mesmo princípio de delete_asset).
    db.query(PluggyAccount).filter(
        PluggyAccount.user_id == user_id, PluggyAccount.investimento_id == investimento_id
    ).update({PluggyAccount.investimento_id: None})
    db.query(PluggyTransaction).filter(
        PluggyTransaction.user_id == user_id,
        PluggyTransaction.investimento_id == investimento_id,
    ).update({PluggyTransaction.investimento_id: None})
    db.query(PluggyTransaction).filter(
        PluggyTransaction.user_id == user_id,
        PluggyTransaction.investimento_sugerido_id == investimento_id,
    ).update({PluggyTransaction.investimento_sugerido_id: None})
    db.delete(investimento)
    db.commit()


def _confirmed_total(
    db: Session, user_id: int, investimento_id: int, subcategory_id: int | None
) -> Decimal:
    if subcategory_id is None:
        return Decimal("0")
    total = (
        db.query(func.coalesce(func.sum(func.abs(PluggyTransaction.valor)), 0))
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.investimento_id == investimento_id,
            PluggyTransaction.subcategory_id == subcategory_id,
            PluggyTransaction.categorizacao_status
            == PluggyTransactionCategorizacaoStatus.confirmada,
        )
        .scalar()
    )
    return Decimal(str(total))


def get_evolucao(db: Session, user_id: int, investimento_id: int) -> Evolucao:
    get_investimento(db, user_id, investimento_id)

    saldo_base_carteiras = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo_inicial), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.investimento_id == investimento_id,
        )
        .scalar()
    )
    saldo_base_holdings = (
        db.query(func.coalesce(func.sum(PluggyInvestment.saldo_inicial), 0))
        .filter(
            PluggyInvestment.user_id == user_id,
            PluggyInvestment.investimento_id == investimento_id,
        )
        .scalar()
    )
    saldo_base = Decimal(str(saldo_base_carteiras)) + Decimal(str(saldo_base_holdings))

    saldo_atual_carteiras = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.investimento_id == investimento_id,
        )
        .scalar()
    )
    saldo_atual_holdings = (
        db.query(func.coalesce(func.sum(PluggyInvestment.valor_atual), 0))
        .filter(
            PluggyInvestment.user_id == user_id,
            PluggyInvestment.investimento_id == investimento_id,
        )
        .scalar()
    )
    saldo_atual = Decimal(str(saldo_atual_carteiras)) + Decimal(str(saldo_atual_holdings))

    total_aportes = _confirmed_total(
        db, user_id, investimento_id, aporte_subcategory_id(db, user_id)
    )
    total_resgates = _confirmed_total(
        db, user_id, investimento_id, resgate_subcategory_id(db, user_id)
    )

    rendimento_estimado = saldo_atual - saldo_base - total_aportes + total_resgates

    return Evolucao(
        saldo_base=saldo_base,
        saldo_atual=saldo_atual,
        total_aportes=total_aportes,
        total_resgates=total_resgates,
        rendimento_estimado=rendimento_estimado,
    )


@dataclass
class EvolucaoMensal:
    ano_mes: str
    saldo: Decimal
    valorizacao: Decimal
    rendimento: Decimal
    dividendos: Decimal
    aportes: Decimal
    resgates: Decimal
    confianca: str


def get_evolucao_mensal(db: Session, user_id: int, investimento_id: int) -> list[EvolucaoMensal]:
    """Série mês a mês (Sprint 21) — extensão de `get_evolucao` (snapshot
    atual), sem alterar seu cálculo. Agrega `pluggy_investment_snapshots` das
    holdings vinculadas a este `Investimento`; contas (`PluggyAccount`) não
    têm snapshot mensal nesta sprint (fora de escopo — só holdings de
    investimento têm histórico jan-ago/2026 reconstruído + job mensal).
    """
    get_investimento(db, user_id, investimento_id)

    holding_ids = [
        row[0]
        for row in db.query(PluggyInvestment.id).filter(
            PluggyInvestment.user_id == user_id,
            PluggyInvestment.investimento_id == investimento_id,
        )
    ]
    if not holding_ids:
        return []

    snapshots = (
        db.query(PluggyInvestmentSnapshot)
        .filter(PluggyInvestmentSnapshot.investment_id.in_(holding_ids))
        .order_by(PluggyInvestmentSnapshot.ano_mes)
        .all()
    )

    por_mes: dict[str, list[PluggyInvestmentSnapshot]] = {}
    for snap in snapshots:
        por_mes.setdefault(snap.ano_mes, []).append(snap)

    return [
        EvolucaoMensal(
            ano_mes=ano_mes,
            saldo=sum((r.saldo for r in rows), Decimal("0")),
            valorizacao=sum((r.valorizacao for r in rows), Decimal("0")),
            rendimento=sum((r.rendimento for r in rows), Decimal("0")),
            dividendos=sum((r.dividendos or Decimal("0") for r in rows), Decimal("0")),
            aportes=sum((r.aportes for r in rows), Decimal("0")),
            resgates=sum((r.resgates for r in rows), Decimal("0")),
            confianca="reconstruido"
            if any(r.confianca == "reconstruido" for r in rows)
            else "real",
        )
        for ano_mes, rows in sorted(por_mes.items())
    ]


@dataclass
class InvestimentoTransacao:
    data: date
    tipo: str
    descricao: str | None
    valor: Decimal
    origem: str
    holding_nome: str | None


def get_transacoes(
    db: Session,
    user_id: int,
    investimento_id: int,
    *,
    ano: int | None = None,
    mes: int | None = None,
) -> list[InvestimentoTransacao]:
    """Extrato unificado (Sprint 23): une `PluggyTransaction` (conta bancária
    vinculada) e `PluggyInvestmentTransaction` (movimento por holding) — um
    investimento só-holdings (ex. "Quitar o AP") nunca populava a primeira
    fonte, então o extrato de hoje ficava sempre vazio pra ele."""
    get_investimento(db, user_id, investimento_id)

    conta_query = db.query(PluggyTransaction).filter(
        PluggyTransaction.user_id == user_id,
        PluggyTransaction.investimento_id == investimento_id,
    )
    if ano is not None:
        conta_query = conta_query.filter(func.extract("year", PluggyTransaction.data) == ano)
    if mes is not None:
        conta_query = conta_query.filter(func.extract("month", PluggyTransaction.data) == mes)

    holding_query = (
        db.query(PluggyInvestmentTransaction, PluggyInvestment.nome)
        .join(PluggyInvestment, PluggyInvestmentTransaction.investment_id == PluggyInvestment.id)
        .filter(
            PluggyInvestment.user_id == user_id,
            PluggyInvestment.investimento_id == investimento_id,
        )
    )
    if ano is not None:
        holding_query = holding_query.filter(
            func.extract("year", PluggyInvestmentTransaction.data) == ano
        )
    if mes is not None:
        holding_query = holding_query.filter(
            func.extract("month", PluggyInvestmentTransaction.data) == mes
        )

    transacoes = [
        InvestimentoTransacao(
            data=tx.data,
            tipo=tx.tipo,
            descricao=tx.descricao_usuario or tx.descricao,
            valor=tx.valor,
            origem="conta",
            holding_nome=None,
        )
        for tx in conta_query.all()
    ] + [
        InvestimentoTransacao(
            data=tx.data,
            tipo=tx.tipo,
            descricao=tx.descricao,
            valor=tx.valor,
            origem="holding",
            holding_nome=holding_nome,
        )
        for tx, holding_nome in holding_query.all()
    ]
    transacoes.sort(key=lambda t: t.data, reverse=True)
    return transacoes
