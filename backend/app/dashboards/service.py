from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from sqlalchemy import func, or_
from sqlalchemy.orm import Query, Session

from app.models.asset import Asset, AssetStatus
from app.models.category import SEM_CATEGORIA_ID, CategoryGroup, Natureza, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability, LiabilityStatus
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyTransaction,
    PluggyTransactionTipo,
)

Regime = Literal["competencia", "caixa"]


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
    ativos: Decimal
    passivos: Decimal
    saldo_liquido_acumulado: Decimal
    saldo_investimentos: Decimal
    total: Decimal


@dataclass
class PontoProjecao:
    ano: int
    mes: int
    receita: Decimal
    despesa: Decimal
    saldo: Decimal


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


def _pagamento_fatura_subcategory_id(db: Session) -> int | None:
    row = (
        db.query(Subcategory.id)
        .join(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(
            Subcategory.nome == _PAGAMENTO_FATURA_SUBCATEGORY_NOME,
            CategoryGroup.nome == _TRANSFERENCIA_INTERNA_GROUP_NOME,
        )
        .one_or_none()
    )
    return row[0] if row else None


def _base_query(
    db: Session, user_id: int, *, excluir_investimento: bool = False, regime: Regime = "competencia"
) -> Query:
    query = (
        db.query(PluggyTransaction)
        .join(PluggyAccount, PluggyTransaction.account_id == PluggyAccount.id)
        .outerjoin(Subcategory, PluggyTransaction.subcategory_id == Subcategory.id)
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
        pagamento_fatura_id = _pagamento_fatura_subcategory_id(db)
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

    if excluir_investimento:
        # Variação de valor de mercado de investimento não é uma transação —
        # usado só pelo Saldo Acumulado (get_saldo_acumulado), não pelas
        # agregações normais de Receita/Despesa.
        query = query.filter(PluggyAccount.tipo != PluggyAccountTipo.investimento)
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


def _saldo_liquido_fallback(db: Session, user_id: int) -> Decimal:
    """Contas líquidas (não-investimento) sem `saldo_inicial` não entram na
    âncora/acumulação de get_saldo_acumulado — entram aqui pelo saldo ao vivo,
    fora da acumulação, sem quebrar o cálculo das demais contas (PRD-016,
    critério 6). Cartão de crédito sem saldo_inicial mantém a convenção de
    sinal de _base_query: saldo representa dívida, entra subtraindo.
    """
    rows = (
        db.query(PluggyAccount.tipo, func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo != PluggyAccountTipo.investimento,
            PluggyAccount.saldo_inicial.is_(None),
        )
        .group_by(PluggyAccount.tipo)
        .all()
    )
    total = Decimal("0")
    for tipo, saldo in rows:
        saldo = _to_decimal(saldo)
        total += -saldo if tipo == PluggyAccountTipo.cartao_credito else saldo
    return total


def _patrimonio_breakdown(
    db: Session, user_id: int, *, regime: Regime = "competencia"
) -> PatrimonioBreakdown:
    ativos, passivos = _ativos_e_passivos(db, user_id)

    hoje = date.today()
    pontos_acumulado = get_saldo_acumulado(
        db, user_id, ano=hoje.year, mes=hoje.month, meses=1, regime=regime
    )
    saldo_liquido_acumulado = pontos_acumulado[0].total if pontos_acumulado else Decimal("0")
    saldo_liquido_acumulado += _saldo_liquido_fallback(db, user_id)

    saldo_investimentos = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.tipo == PluggyAccountTipo.investimento,
        )
        .scalar()
    )
    saldo_investimentos = _to_decimal(saldo_investimentos)

    return PatrimonioBreakdown(
        ativos=ativos,
        passivos=passivos,
        saldo_liquido_acumulado=saldo_liquido_acumulado,
        saldo_investimentos=saldo_investimentos,
        total=saldo_liquido_acumulado + saldo_investimentos + ativos - passivos,
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
    excluir_investimento: bool = False,
) -> dict[tuple[int, int], dict[str, Decimal]]:
    """Soma receita/despesa por mês (por competência ou caixa) num range
    arbitrário de meses — reaproveitado por get_tendencia (últimos N meses
    terminando no filtro) e get_saldo_acumulado (range fixo desde jan/2026,
    excluindo investimento)."""
    inicio, fim = _date_bounds(periodo)
    coluna = _competencia_column(regime)

    query = _base_query(
        db, user_id, excluir_investimento=excluir_investimento, regime=regime
    ).filter(
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


def _future_month_range(ano: int, mes: int, meses_futuros: int) -> list[tuple[int, int]]:
    """Próximos `meses_futuros` meses após (ano, mes), em ordem cronológica."""
    periodo = []
    y, m = ano, mes
    for _ in range(meses_futuros):
        m += 1
        if m == 13:
            m = 1
            y += 1
        periodo.append((y, m))
    return periodo


def get_projecao(
    db: Session,
    user_id: int,
    *,
    ano: int,
    mes: int,
    meses_futuros: int = 6,
    janela_media: int = 3,
) -> list[PontoProjecao]:
    # Base da média: só subcategorias `fixa`/`variavel` (exclusão direta, sem
    # COALESCE — diferente de get_por_natureza, que precisa de um bucket
    # "eventual" pros 3 cards zero-filled; aqui `eventual`/sem natureza
    # simplesmente não entram na projeção, mesma premissa de não recorrência).
    janela = _month_range(ano, mes, janela_media)
    inicio, fim = _date_bounds(janela)

    query = (
        _base_query(db, user_id)
        .filter(Subcategory.natureza.in_([Natureza.fixa, Natureza.variavel]))
        .filter(
            PluggyTransaction.data_competencia >= inicio,
            PluggyTransaction.data_competencia < fim,
        )
    )
    rows = (
        query.with_entities(PluggyTransaction.tipo, func.sum(func.abs(PluggyTransaction.valor)))
        .group_by(PluggyTransaction.tipo)
        .all()
    )
    totais = {tipo: _to_decimal(total) for tipo, total in rows}
    divisor = Decimal(janela_media)
    receita_media = (totais.get(PluggyTransactionTipo.credito, Decimal("0")) / divisor).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    despesa_media = (totais.get(PluggyTransactionTipo.debito, Decimal("0")) / divisor).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    saldo_media = receita_media - despesa_media

    return [
        PontoProjecao(ano=y, mes=m, receita=receita_media, despesa=despesa_media, saldo=saldo_media)
        for y, m in _future_month_range(ano, mes, meses_futuros)
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


# Mesmo id determinístico usado em
# pluggy_integration.service._salario_ajuste_dez_2025_pluggy_transaction_id —
# duplicado aqui (string de 1 linha) para não acoplar dashboards a
# pluggy_integration por causa de um único lookup.
def _salario_ajuste_dez_2025_pluggy_transaction_id(user_id: int) -> str:
    return f"manual-salario-dez2025-user{user_id}"


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

    fim_exclusivo = _date_bounds([janela[-1]])[1]
    range_completo = _months_between((2026, 1), janela[-1])

    accounts = (
        db.query(PluggyAccount)
        .filter(PluggyAccount.user_id == user_id, PluggyAccount.saldo_inicial.isnot(None))
        .order_by(PluggyAccount.nome)
        .all()
    )

    resultado = []
    for account in accounts:
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
            saldo += movimento_por_mes.get((y, m), Decimal("0"))
            saldo_por_mes[(y, m)] = saldo

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


def get_saldo_acumulado(
    db: Session, user_id: int, *, ano: int, mes: int, meses: int = 6, regime: Regime = "competencia"
) -> list[PontoTendencia]:
    # Âncora ("saldo acumulado de dez/2025") = soma de saldo_inicial das
    # contas (excluindo investimento — variação de valor de mercado não é uma
    # transação, PRD-016) menos o valor da transação sentinela de salário de
    # dez/2025 (se existir) — ver regra de negócio no PRD-015: saldo_inicial
    # já inclui fisicamente esse dinheiro, mas por competência ele "pertence"
    # a jan/2026 e já entra de volta sozinho na receita desse mês.
    soma_saldo_inicial = (
        db.query(func.coalesce(func.sum(PluggyAccount.saldo_inicial), 0))
        .filter(
            PluggyAccount.user_id == user_id,
            PluggyAccount.saldo_inicial.isnot(None),
            PluggyAccount.tipo != PluggyAccountTipo.investimento,
        )
        .scalar()
    )
    valor_sentinela = (
        db.query(PluggyTransaction.valor)
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.pluggy_transaction_id
            == _salario_ajuste_dez_2025_pluggy_transaction_id(user_id),
        )
        .scalar()
    )
    ancora = _to_decimal(soma_saldo_inicial) - (
        _to_decimal(valor_sentinela) if valor_sentinela is not None else Decimal("0")
    )

    range_completo = _months_between((2026, 1), (ano, mes))
    totais = _receita_despesa_por_periodo(
        db, user_id, range_completo, regime=regime, excluir_investimento=True
    )

    saldo = ancora
    saldo_por_mes: dict[tuple[int, int], Decimal] = {}
    for y, m in range_completo:
        saldo += totais[(y, m)]["receita"] - totais[(y, m)]["despesa"]
        saldo_por_mes[(y, m)] = saldo

    janela = _month_range(ano, mes, meses)
    return [
        PontoTendencia(ano=y, mes=m, total=saldo_por_mes.get((y, m), ancora)) for y, m in janela
    ]
