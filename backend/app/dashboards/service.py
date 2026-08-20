from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from sqlalchemy import func, or_
from sqlalchemy.orm import Query, Session

from app.categorization.service import salario_subcategory_id
from app.models.asset import Asset, AssetStatus
from app.models.category import SEM_CATEGORIA_ID, CategoryGroup, Natureza, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability, LiabilityStatus
from app.models.orcamento import Orcamento
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyInvestment,
    PluggyTransaction,
    PluggyTransactionTipo,
)
from app.orcamentos.service import orcamentos_vigentes_query

Regime = Literal["competencia", "caixa"]


@dataclass
class Summary:
    receita: Decimal
    despesa: Decimal
    saldo: Decimal
    patrimonio: Decimal
    ativos: Decimal
    ativos_totais: Decimal
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
class NaturezaTotal:
    natureza: Natureza
    total: Decimal
    percentual: Decimal


@dataclass
class TendenciaNatureza:
    natureza: Natureza
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
class InvestimentoTotal:
    investimento_id: int
    investimento_nome: str
    total: Decimal


@dataclass
class TendenciaInvestimento:
    investimento_id: int
    investimento_nome: str
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
    ativos_totais: Decimal
    passivos: Decimal
    saldo_acumulado_mes: Decimal
    total: Decimal


@dataclass
class SaldoConta:
    account_id: int
    account_nome: str
    account_tipo: PluggyAccountTipo
    saldo: Decimal
    limite_credito: Decimal | None = None


@dataclass
class EvolucaoSaldoConta:
    account_id: int
    account_nome: str
    account_tipo: PluggyAccountTipo
    saldo_inicial: Decimal
    pontos: list[PontoTendencia]


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


def _competencia_column(regime: Regime):
    return PluggyTransaction.data_caixa if regime == "caixa" else PluggyTransaction.data_competencia


_PAGAMENTO_FATURA_SUBCATEGORY_NOME = "Pagamento de Fatura"
_TRANSFERENCIA_INTERNA_GROUP_NOME = "Transferência interna"


def _pagamento_fatura_subcategory_id(db: Session, user_id: int) -> int | None:
    row = (
        db.query(Subcategory.id)
        .join(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(
            Subcategory.user_id == user_id,
            Subcategory.nome == _PAGAMENTO_FATURA_SUBCATEGORY_NOME,
            CategoryGroup.nome == _TRANSFERENCIA_INTERNA_GROUP_NOME,
        )
        .one_or_none()
    )
    return row[0] if row else None


def _base_query(db: Session, user_id: int, *, regime: Regime = "competencia") -> Query:
    query = (
        db.query(PluggyTransaction)
        .join(PluggyAccount, PluggyTransaction.account_id == PluggyAccount.id)
        .outerjoin(
            Subcategory,
            (PluggyTransaction.subcategory_id == Subcategory.id) & (Subcategory.user_id == user_id),
        )
        .outerjoin(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(PluggyTransaction.user_id == user_id)
    )

    if regime == "caixa":
        # Sob caixa, o cartão de crédito deixa de usar o deslocamento
        # modelado (compra+2 meses, uma estimativa) — a própria transação
        # real de "Pagamento de Fatura" (subcategoria dentro de
        # "Transferência interna") passa a representar a saída de caixa, na
        # data real em que o dinheiro saiu da conta corrente/poupança. Por
        # isso ela escapa da exclusão de "Transferência interna" só sob esse
        # regime, e toda transação de conta de cartão de crédito é excluída
        # (evita contar a mesma compra 2 vezes: uma pela fatura real, outra
        # pelo modelo de competência+1/caixa+2).
        pagamento_fatura_id = _pagamento_fatura_subcategory_id(db, user_id)
        if pagamento_fatura_id is not None:
            query = query.filter(
                or_(
                    func.coalesce(CategoryGroup.excluir_de_totais, False).is_(False),
                    PluggyTransaction.subcategory_id == pagamento_fatura_id,
                )
            )
        else:
            query = query.filter(func.coalesce(CategoryGroup.excluir_de_totais, False).is_(False))
        query = query.filter(PluggyAccount.tipo != PluggyAccountTipo.cartao_credito)
    else:
        query = query.filter(func.coalesce(CategoryGroup.excluir_de_totais, False).is_(False))
        # Em conta de cartão de crédito, `tipo=credito` nunca é receita real —
        # é pagamento de fatura ou estorno/reversão de compra (sinal negativo
        # de `valor`, convenção já validada na Sprint 5 para saldo/fatura).
        # Investigado na Sprint 10 (achado NuTag): 100% dos `credito` de
        # cartão têm valor negativo, contra 100% dos `debito` com valor
        # positivo — sem exceção que sugira receita real (ex.: cashback)
        # nesse tipo de conta.
        query = query.filter(
            ~(
                (PluggyAccount.tipo == PluggyAccountTipo.cartao_credito)
                & (PluggyTransaction.tipo == PluggyTransactionTipo.credito)
            )
        )

    return query


def _apply_periodo(
    query: Query, *, ano: int | None, mes: int | None, regime: Regime = "competencia"
) -> Query:
    coluna = _competencia_column(regime)
    if ano is not None:
        query = query.filter(func.extract("year", coluna) == ano)
    if mes is not None:
        query = query.filter(func.extract("month", coluna) == mes)
    return query


def _sum_tipo(
    db: Session,
    user_id: int,
    tipo: PluggyTransactionTipo,
    *,
    ano: int | None,
    mes: int | None,
    regime: Regime = "competencia",
) -> Decimal:
    query = _base_query(db, user_id, regime=regime).filter(PluggyTransaction.tipo == tipo)
    query = _apply_periodo(query, ano=ano, mes=mes, regime=regime)
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


def _saldo_investimentos(db: Session, user_id: int) -> Decimal:
    """Holdings (PluggyInvestment) são a fonte preferencial de saldo por item
    Pluggy; contas tipo=investimento só entram para itens sem nenhuma holding
    — evita dobrar contagem caso um item retorne as duas fontes pro mesmo
    saldo (nenhum item conhecido faz isso hoje, achado do Bloco 1 da Sprint
    20: XP retorna contas E holdings, sem sobreposição de saldo entre elas).
    """
    saldo_holdings = (
        db.query(func.coalesce(func.sum(PluggyInvestment.valor_atual), 0))
        .filter(PluggyInvestment.user_id == user_id)
        .scalar()
    )
    itens_com_holdings = db.query(PluggyInvestment.item_id).filter(
        PluggyInvestment.user_id == user_id
    )
    saldo_contas_sem_holdings = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo == PluggyAccountTipo.investimento,
            PluggyAccount.item_id.not_in(itens_com_holdings),
        )
        .scalar()
    )
    return _to_decimal(saldo_holdings) + _to_decimal(saldo_contas_sem_holdings)


def _saldo_contas_correntes(db: Session, user_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo == PluggyAccountTipo.corrente,
        )
        .scalar()
    )
    return _to_decimal(total)


def _ativos_totais(db: Session, user_id: int) -> Decimal:
    """Tudo que o CEO considera "com o que pode contar" (PRD-028): Gestão de
    Ativos + Investimentos (dedup-safe) + saldo ao vivo de conta corrente —
    poupança e cartão de crédito ficam de fora (critério de aceite 1/3)."""
    ativos, _passivos = _ativos_e_passivos(db, user_id)
    return ativos + _saldo_investimentos(db, user_id) + _saldo_contas_correntes(db, user_id)


def _patrimonio_breakdown(
    db: Session, user_id: int, *, regime: Regime = "competencia"
) -> PatrimonioBreakdown:
    _ativos, passivos = _ativos_e_passivos(db, user_id)
    ativos_totais = _ativos_totais(db, user_id)

    hoje = date.today()
    pontos_acumulado = get_saldo_acumulado(db, user_id, ano=hoje.year, mes=hoje.month, meses=1)
    saldo_acumulado_mes = pontos_acumulado[0].total if pontos_acumulado else Decimal("0")

    return PatrimonioBreakdown(
        ativos_totais=ativos_totais,
        passivos=passivos,
        saldo_acumulado_mes=saldo_acumulado_mes,
        total=ativos_totais - passivos + saldo_acumulado_mes,
    )


def _calcula_patrimonio(db: Session, user_id: int, *, regime: Regime = "competencia") -> Decimal:
    return _patrimonio_breakdown(db, user_id, regime=regime).total


def get_patrimonio_breakdown(
    db: Session, user_id: int, *, regime: Regime = "competencia"
) -> PatrimonioBreakdown:
    return _patrimonio_breakdown(db, user_id, regime=regime)


def get_summary(
    db: Session,
    user_id: int,
    *,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
) -> Summary:
    receita = _sum_tipo(db, user_id, PluggyTransactionTipo.credito, ano=ano, mes=mes, regime=regime)
    despesa = _sum_tipo(db, user_id, PluggyTransactionTipo.debito, ano=ano, mes=mes, regime=regime)
    patrimonio = _calcula_patrimonio(db, user_id, regime=regime)
    ativos, passivos = _ativos_e_passivos(db, user_id)
    ativos_totais = _ativos_totais(db, user_id)
    return Summary(
        receita=receita,
        despesa=despesa,
        saldo=receita - despesa,
        patrimonio=patrimonio,
        ativos=ativos,
        ativos_totais=ativos_totais,
        passivos=passivos,
    )


def get_por_categoria(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
) -> list[CategoriaTotal]:
    query = _base_query(db, user_id, regime=regime).filter(PluggyTransaction.tipo == tipo)
    query = _apply_periodo(query, ano=ano, mes=mes, regime=regime)
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


def _receita_despesa_por_periodo(
    db: Session,
    user_id: int,
    periodo: list[tuple[int, int]],
    *,
    regime: Regime = "competencia",
) -> dict[tuple[int, int], dict[str, Decimal]]:
    """Soma receita/despesa por mês (por competência ou caixa) num range
    arbitrário de meses — reaproveitado por get_tendencia (últimos N meses
    terminando no filtro)."""
    inicio, fim = _date_bounds(periodo)
    coluna = _competencia_column(regime)

    query = _base_query(db, user_id, regime=regime).filter(
        coluna >= inicio,
        coluna < fim,
    )
    rows = (
        query.with_entities(
            func.extract("year", coluna),
            func.extract("month", coluna),
            PluggyTransaction.tipo,
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            func.extract("year", coluna),
            func.extract("month", coluna),
            PluggyTransaction.tipo,
        )
        .all()
    )

    totais = {chave: {"receita": Decimal("0"), "despesa": Decimal("0")} for chave in periodo}
    for y, m, tipo, total in rows:
        campo = "receita" if tipo == PluggyTransactionTipo.credito else "despesa"
        totais[(int(y), int(m))][campo] = _to_decimal(total)
    return totais


def get_tendencia(
    db: Session, user_id: int, *, ano: int, mes: int, meses: int = 6, regime: Regime = "competencia"
) -> list[TendenciaMes]:
    periodo = _month_range(ano, mes, meses)
    totais = _receita_despesa_por_periodo(db, user_id, periodo, regime=regime)

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
    regime: Regime = "competencia",
) -> list[TendenciaCategoria]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)
    coluna = _competencia_column(regime)

    query = (
        _base_query(db, user_id, regime=regime)
        .filter(PluggyTransaction.tipo == tipo)
        .filter(
            coluna >= inicio,
            coluna < fim,
        )
    )
    rows = (
        query.with_entities(
            Subcategory.id,
            Subcategory.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Subcategory.id,
            Subcategory.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
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


_NATUREZA_ORDEM = (Natureza.fixa, Natureza.variavel, Natureza.eventual)


def get_por_natureza(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
) -> list[NaturezaTotal]:
    # Domínio fixo de 3 naturezas (diferente de categoria, que é aberto) —
    # sempre retorna as 3 zero-filled, para os cards da tela Natureza não
    # precisarem de lógica de fallback no frontend.
    natureza_expr = func.coalesce(Subcategory.natureza, Natureza.eventual)
    query = _base_query(db, user_id).filter(PluggyTransaction.tipo == tipo)
    query = _apply_periodo(query, ano=ano, mes=mes)
    rows = (
        query.with_entities(natureza_expr, func.sum(func.abs(PluggyTransaction.valor)))
        .group_by(natureza_expr)
        .all()
    )
    totais_por_natureza = {natureza: _to_decimal(total) for natureza, total in rows}
    total_geral = sum(totais_por_natureza.values(), Decimal("0"))
    return [
        NaturezaTotal(
            natureza=natureza,
            total=totais_por_natureza.get(natureza, Decimal("0")),
            percentual=_percentual(totais_por_natureza.get(natureza, Decimal("0")), total_geral),
        )
        for natureza in _NATUREZA_ORDEM
    ]


def get_tendencia_por_natureza(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = 6,
) -> list[TendenciaNatureza]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)
    natureza_expr = func.coalesce(Subcategory.natureza, Natureza.eventual)

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
            natureza_expr,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            natureza_expr,
            func.extract("year", PluggyTransaction.data_competencia),
            func.extract("month", PluggyTransaction.data_competencia),
        )
        .all()
    )

    pontos_por_natureza = {
        natureza: {chave: Decimal("0") for chave in periodo} for natureza in _NATUREZA_ORDEM
    }
    for natureza, y, m, total in rows:
        pontos_por_natureza[natureza][(int(y), int(m))] = _to_decimal(total)

    return [
        TendenciaNatureza(
            natureza=natureza,
            pontos=[
                PontoTendencia(ano=y, mes=m, total=pontos_por_natureza[natureza][(y, m)])
                for y, m in periodo
            ],
        )
        for natureza in _NATUREZA_ORDEM
    ]


def get_por_ativo(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
) -> list[AtivoTotal]:
    # Venda de ativo é tratada à parte (valor_venda), nunca entra na
    # agregação de transações. Sem bucket "sem ativo": a maioria das
    # transações não tem asset_id, e isso é esperado (ver PRD-008).
    query = (
        _base_query(db, user_id, regime=regime)
        .join(Asset, PluggyTransaction.asset_id == Asset.id)
        .filter(PluggyTransaction.tipo == tipo)
    )
    query = _apply_periodo(query, ano=ano, mes=mes, regime=regime)
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
    regime: Regime = "competencia",
) -> list[TendenciaAtivo]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)
    coluna = _competencia_column(regime)

    query = (
        _base_query(db, user_id, regime=regime)
        .join(Asset, PluggyTransaction.asset_id == Asset.id)
        .filter(PluggyTransaction.tipo == tipo)
        .filter(
            coluna >= inicio,
            coluna < fim,
        )
    )
    rows = (
        query.with_entities(
            Asset.id,
            Asset.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Asset.id,
            Asset.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
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


def get_por_investimento(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
) -> list[InvestimentoTotal]:
    # Aporte/Resgate contam nos totais normais de Despesa/Receita (decisão do
    # CEO, PRD-019) — acontecem na conta corrente de origem/destino, não numa
    # conta tipo=investimento, então _base_query não precisa de exclusão.
    query = (
        _base_query(db, user_id, regime=regime)
        .join(Investimento, PluggyTransaction.investimento_id == Investimento.id)
        .filter(PluggyTransaction.tipo == tipo)
    )
    query = _apply_periodo(query, ano=ano, mes=mes, regime=regime)
    rows = (
        query.with_entities(
            Investimento.id, Investimento.nome, func.sum(func.abs(PluggyTransaction.valor))
        )
        .group_by(Investimento.id, Investimento.nome)
        .all()
    )
    return [
        InvestimentoTotal(
            investimento_id=investimento_id,
            investimento_nome=investimento_nome,
            total=_to_decimal(total),
        )
        for investimento_id, investimento_nome, total in rows
    ]


def get_tendencia_por_investimento(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = 6,
    regime: Regime = "competencia",
) -> list[TendenciaInvestimento]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)
    coluna = _competencia_column(regime)

    query = (
        _base_query(db, user_id, regime=regime)
        .join(Investimento, PluggyTransaction.investimento_id == Investimento.id)
        .filter(PluggyTransaction.tipo == tipo)
        .filter(
            coluna >= inicio,
            coluna < fim,
        )
    )
    rows = (
        query.with_entities(
            Investimento.id,
            Investimento.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Investimento.id,
            Investimento.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
        )
        .all()
    )

    por_investimento: dict[int, dict] = {}
    for investimento_id, investimento_nome, y, m, total in rows:
        if investimento_id not in por_investimento:
            por_investimento[investimento_id] = {
                "nome": investimento_nome,
                "pontos": {chave: Decimal("0") for chave in periodo},
            }
        por_investimento[investimento_id]["pontos"][(int(y), int(m))] = _to_decimal(total)

    return [
        TendenciaInvestimento(
            investimento_id=investimento_id,
            investimento_nome=dado["nome"],
            pontos=[PontoTendencia(ano=y, mes=m, total=dado["pontos"][(y, m)]) for y, m in periodo],
        )
        for investimento_id, dado in por_investimento.items()
    ]


def get_por_passivo(
    db: Session,
    user_id: int,
    *,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
) -> list[PassivoTotal]:
    # Passivo nunca gera receita — sempre despesa (tipo=debito), sem toggle
    # de tipo exposto ao chamador (diferente de /por-ativo) — regime de
    # competência/caixa continua disponível.
    query = (
        _base_query(db, user_id, regime=regime)
        .join(Liability, PluggyTransaction.liability_id == Liability.id)
        .filter(PluggyTransaction.tipo == PluggyTransactionTipo.debito)
    )
    query = _apply_periodo(query, ano=ano, mes=mes, regime=regime)
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
    regime: Regime = "competencia",
) -> list[TendenciaPassivo]:
    periodo = _month_range(ano, mes, meses)
    inicio, fim = _date_bounds(periodo)
    coluna = _competencia_column(regime)

    query = (
        _base_query(db, user_id, regime=regime)
        .join(Liability, PluggyTransaction.liability_id == Liability.id)
        .filter(PluggyTransaction.tipo == PluggyTransactionTipo.debito)
        .filter(
            coluna >= inicio,
            coluna < fim,
        )
    )
    rows = (
        query.with_entities(
            Liability.id,
            Liability.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
            func.sum(func.abs(PluggyTransaction.valor)),
        )
        .group_by(
            Liability.id,
            Liability.nome,
            func.extract("year", coluna),
            func.extract("month", coluna),
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


@dataclass
class OrcamentoStatus:
    subcategory_id: int
    orcado: Decimal
    realizado: Decimal


def get_orcamento_status(
    db: Session,
    user_id: int,
    *,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    regime: Regime = "competencia",
) -> list[OrcamentoStatus]:
    # Orçado: soma de todos os orçamentos vigentes no mês, por subcategoria
    # (múltiplos orçamentos na mesma subcategoria somam — decisão do CEO).
    orcados_rows = (
        orcamentos_vigentes_query(db, user_id, ano=ano, mes=mes)
        .with_entities(Orcamento.subcategory_id, func.sum(Orcamento.valor))
        .group_by(Orcamento.subcategory_id)
        .all()
    )
    orcado_by_subcategoria = {
        subcategory_id: _to_decimal(total) for subcategory_id, total in orcados_rows
    }
    if not orcado_by_subcategoria:
        return []

    # Realizado: só para as subcategorias com orçamento vigente — reaproveita
    # o mesmo filtro base (excluir_de_totais/regime/investimento) de todo
    # outro agregador desta função.
    query = _apply_periodo(
        _base_query(db, user_id, regime=regime), ano=ano, mes=mes, regime=regime
    ).filter(
        PluggyTransaction.tipo == tipo,
        PluggyTransaction.subcategory_id.in_(orcado_by_subcategoria.keys()),
    )
    realizado_rows = (
        query.with_entities(
            PluggyTransaction.subcategory_id, func.sum(func.abs(PluggyTransaction.valor))
        )
        .group_by(PluggyTransaction.subcategory_id)
        .all()
    )
    realizado_by_subcategoria = {
        subcategory_id: _to_decimal(total) for subcategory_id, total in realizado_rows
    }

    return [
        OrcamentoStatus(
            subcategory_id=subcategory_id,
            orcado=orcado,
            realizado=realizado_by_subcategoria.get(subcategory_id, Decimal("0")),
        )
        for subcategory_id, orcado in orcado_by_subcategoria.items()
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


# Data fixa e implícita, ligada à decisão de corte do projeto (CLAUDE.md,
# "Corte de dados") — saldo_inicial das contas e a auditoria mensal (D) são
# ambos ancorados em 31/12/2025.
_INICIO_EVOLUCAO_SALDO = date(2026, 1, 1)


def _months_between(inicio: tuple[int, int], fim: tuple[int, int]) -> list[tuple[int, int]]:
    """Todos os meses de `inicio` até `fim` (inclusive), em ordem cronológica."""
    y, m = inicio
    periodo = []
    while (y, m) <= fim:
        periodo.append((y, m))
        m += 1
        if m == 13:
            m = 1
            y += 1
    return periodo


def _next_month(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _previous_month(ano: int, mes: int) -> tuple[int, int]:
    return (ano - 1, 12) if mes == 1 else (ano, mes - 1)


def _saldo_real_por_conta_e_mes(
    db: Session, account: PluggyAccount, range_completo: list[tuple[int, int]]
) -> dict[tuple[int, int], Decimal]:
    """Saldo real (saldo_inicial + movimento bruto, sem filtro de categoria
    nem exclusão nenhuma) no fim de cada mês de `range_completo`, para uma
    conta — usa `data` real, nunca `data_competencia`/`data_caixa` (ferramenta
    de auditoria bancária, PRD-018/PRD-032). Meses anteriores a jan/2026
    (fora da janela de movimento rastreado) ficam com o próprio
    `saldo_inicial`, sem ajuste."""
    fim_exclusivo = _date_bounds([range_completo[-1]])[1]
    rows = (
        db.query(
            func.extract("year", PluggyTransaction.data),
            func.extract("month", PluggyTransaction.data),
            func.sum(PluggyTransaction.valor),
        )
        .filter(
            PluggyTransaction.account_id == account.id,
            PluggyTransaction.data >= _INICIO_EVOLUCAO_SALDO,
            PluggyTransaction.data < fim_exclusivo,
        )
        .group_by(
            func.extract("year", PluggyTransaction.data),
            func.extract("month", PluggyTransaction.data),
        )
        .all()
    )
    movimento_por_mes = {(int(y), int(m)): _to_decimal(v) for y, m, v in rows}

    saldo = account.saldo_inicial
    saldo_por_mes: dict[tuple[int, int], Decimal] = {}
    for y, m in range_completo:
        if (y, m) >= (2026, 1):
            saldo += movimento_por_mes.get((y, m), Decimal("0"))
        saldo_por_mes[(y, m)] = saldo
    return saldo_por_mes


def get_evolucao_saldo_por_conta(
    db: Session, user_id: int, *, ano: int, mes: int, meses: int = 6
) -> list[EvolucaoSaldoConta]:
    # Ferramenta de auditoria bancária (D) — usa `data` real (não
    # `data_competencia`) e não reaproveita `_base_query`/`_apply_periodo`
    # (aquelas filtram por competência e excluem cartão-crédito+crédito, o
    # que é errado aqui: reconciliar com extrato real exige que todo
    # movimento conte, sem exclusão nenhuma).
    janela = [p for p in _month_range(ano, mes, meses) if p >= (2026, 1)]
    if not janela:
        return []

    range_completo = _months_between((2026, 1), janela[-1])

    accounts = (
        db.query(PluggyAccount)
        .filter(PluggyAccount.user_id == user_id, PluggyAccount.saldo_inicial.isnot(None))
        .order_by(PluggyAccount.nome)
        .all()
    )

    resultado = []
    for account in accounts:
        saldo_por_mes = _saldo_real_por_conta_e_mes(db, account, range_completo)
        resultado.append(
            EvolucaoSaldoConta(
                account_id=account.id,
                account_nome=account.apelido or account.nome,
                account_tipo=account.tipo,
                saldo_inicial=account.saldo_inicial,
                pontos=[
                    PontoTendencia(ano=y, mes=m, total=saldo_por_mes[(y, m)]) for y, m in janela
                ],
            )
        )
    return resultado


def _accounts_corrente_com_saldo_inicial(db: Session, user_id: int) -> list[PluggyAccount]:
    return (
        db.query(PluggyAccount)
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo == PluggyAccountTipo.corrente,
            PluggyAccount.saldo_inicial.isnot(None),
        )
        .order_by(PluggyAccount.nome)
        .all()
    )


def _salario_antecipado_por_conta_e_mes(
    db: Session,
    account_ids: list[int],
    salario_id: int,
    range_completo: list[tuple[int, int]],
) -> dict[int, dict[tuple[int, int], Decimal]]:
    """Soma, por conta e por mês de `data`, das transações de subcategoria
    "Salário" cuja `data_competencia` cai no mês seguinte — dinheiro que já
    está fisicamente na conta, mas que por competência "pertence" ao mês
    seguinte (regra de negócio do PRD-032; soma todas as ocorrências no mês,
    cobrindo o cenário real de mais de uma transação de salário no mesmo
    mês)."""
    inicio, fim = _date_bounds(range_completo)
    rows = (
        db.query(
            PluggyTransaction.account_id,
            PluggyTransaction.data,
            PluggyTransaction.data_competencia,
            PluggyTransaction.valor,
        )
        .filter(
            PluggyTransaction.account_id.in_(account_ids),
            PluggyTransaction.subcategory_id == salario_id,
            PluggyTransaction.data >= inicio,
            PluggyTransaction.data < fim,
        )
        .all()
    )
    resultado: dict[int, dict[tuple[int, int], Decimal]] = {}
    for account_id, data, data_competencia, valor in rows:
        if data_competencia is None:
            continue
        mes_dado = (data.year, data.month)
        if (data_competencia.year, data_competencia.month) != _next_month(*mes_dado):
            continue
        mapa = resultado.setdefault(account_id, {})
        mapa[mes_dado] = mapa.get(mes_dado, Decimal("0")) + abs(_to_decimal(valor))
    return resultado


def get_saldo_acumulado(
    db: Session, user_id: int, *, ano: int, mes: int, meses: int = 6
) -> list[PontoTendencia]:
    # Saldo real por conta corrente (decisão do CEO, PRD-032): soma do saldo
    # bancário de fim de mês de cada conta corrente com saldo_inicial
    # configurado (mesma lógica de get_evolucao_saldo_por_conta — sem nenhum
    # filtro de categoria) menos qualquer transação "Salário" cuja `data`
    # caia no mês mas `data_competencia` caia no mês seguinte (já está
    # fisicamente na conta, mas "pertence" ao mês seguinte). Não depende de
    # regime competência/caixa — a fórmula sempre usa `data` real.
    janela = _month_range(ano, mes, meses)
    contas = _accounts_corrente_com_saldo_inicial(db, user_id)
    if not contas:
        return [PontoTendencia(ano=y, mes=m, total=Decimal("0")) for y, m in janela]

    range_completo = _months_between(min(janela[0], (2025, 12)), janela[-1])
    salario_id = salario_subcategory_id(db, user_id)
    salario_por_conta_mes = (
        _salario_antecipado_por_conta_e_mes(db, [c.id for c in contas], salario_id, range_completo)
        if salario_id is not None
        else {}
    )

    saldo_total_por_mes = {chave: Decimal("0") for chave in range_completo}
    for conta in contas:
        saldo_por_mes = _saldo_real_por_conta_e_mes(db, conta, range_completo)
        salario_conta = salario_por_conta_mes.get(conta.id, {})
        for chave in range_completo:
            saldo_total_por_mes[chave] += saldo_por_mes[chave] - salario_conta.get(
                chave, Decimal("0")
            )

    return [PontoTendencia(ano=y, mes=m, total=saldo_total_por_mes[(y, m)]) for y, m in janela]


@dataclass
class LinhaConferenciaSaldo:
    account_id: int | None
    account_nome: str
    saldo_inicio: Decimal
    receitas: Decimal
    despesas: Decimal
    saldo_fim: Decimal
    salario_recebido: Decimal
    saldo_efetivo: Decimal


def _receita_despesa_bruta_mes(
    db: Session, account_id: int, ano: int, mes: int
) -> tuple[Decimal, Decimal]:
    rows = (
        db.query(PluggyTransaction.tipo, func.sum(func.abs(PluggyTransaction.valor)))
        .filter(
            PluggyTransaction.account_id == account_id,
            func.extract("year", PluggyTransaction.data) == ano,
            func.extract("month", PluggyTransaction.data) == mes,
        )
        .group_by(PluggyTransaction.tipo)
        .all()
    )
    totais = {tipo: _to_decimal(total) for tipo, total in rows}
    return (
        totais.get(PluggyTransactionTipo.credito, Decimal("0")),
        totais.get(PluggyTransactionTipo.debito, Decimal("0")),
    )


def get_saldo_acumulado_conferencia(
    db: Session, user_id: int, *, ano: int, mes: int
) -> list[LinhaConferenciaSaldo]:
    """Tabela de conferência do drill-down do Saldo Acumulado (PRD-032):
    Total (100%) + uma linha por conta corrente, com a memória de cálculo
    completa do mês — pensada para auditoria manual contra extrato bancário,
    sem precisar de SSH/consulta direta ao banco."""
    contas = _accounts_corrente_com_saldo_inicial(db, user_id)
    if not contas:
        return []

    mes_atual = (ano, mes)
    mes_ant = _previous_month(ano, mes)
    range_completo = _months_between(min(mes_ant, (2025, 12)), mes_atual)

    salario_id = salario_subcategory_id(db, user_id)
    salario_por_conta_mes = (
        _salario_antecipado_por_conta_e_mes(db, [c.id for c in contas], salario_id, range_completo)
        if salario_id is not None
        else {}
    )

    total = LinhaConferenciaSaldo(
        account_id=None,
        account_nome="Total em Conta Corrente (100%)",
        saldo_inicio=Decimal("0"),
        receitas=Decimal("0"),
        despesas=Decimal("0"),
        saldo_fim=Decimal("0"),
        salario_recebido=Decimal("0"),
        saldo_efetivo=Decimal("0"),
    )
    linhas: list[LinhaConferenciaSaldo] = []
    for conta in contas:
        saldo_por_mes = _saldo_real_por_conta_e_mes(db, conta, range_completo)
        receitas, despesas = _receita_despesa_bruta_mes(db, conta.id, ano, mes)
        salario_recebido = salario_por_conta_mes.get(conta.id, {}).get(mes_atual, Decimal("0"))
        saldo_inicio = saldo_por_mes[mes_ant]
        saldo_fim = saldo_por_mes[mes_atual]
        saldo_efetivo = saldo_fim - salario_recebido

        linhas.append(
            LinhaConferenciaSaldo(
                account_id=conta.id,
                account_nome=conta.apelido or conta.nome,
                saldo_inicio=saldo_inicio,
                receitas=receitas,
                despesas=despesas,
                saldo_fim=saldo_fim,
                salario_recebido=salario_recebido,
                saldo_efetivo=saldo_efetivo,
            )
        )
        total.saldo_inicio += saldo_inicio
        total.receitas += receitas
        total.despesas += despesas
        total.saldo_fim += saldo_fim
        total.salario_recebido += salario_recebido
        total.saldo_efetivo += saldo_efetivo

    return [total, *linhas]
