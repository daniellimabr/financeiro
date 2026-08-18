from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.categorization.normalize import normalize_description
from app.models.categorization import (
    AssetCategorizationRule,
    CategorizationRule,
    InvestimentoCategorizationRule,
)
from app.models.investimento import Investimento
from app.models.liability import Liability
from app.models.pluggy import (
    PluggyInvestment,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
)

SIMILARITY_THRESHOLD = 0.86


@dataclass
class CategorySuggestion:
    subcategory_id: int
    confianca: str
    fonte_tipo: str
    fonte_id: int | None
    score: float | None


@dataclass
class AssetSuggestion:
    asset_id: int
    confianca: str


@dataclass
class LiabilitySuggestion:
    liability_id: int
    confianca: str


@dataclass
class HistoricoTransacao:
    id: int
    subcategory_id: int
    normalizado: str


@dataclass
class HistoricoAtivo:
    id: int
    asset_id: int
    normalizado: str


@dataclass
class InvestimentoSuggestion:
    investimento_id: int
    confianca: str


@dataclass
class HistoricoInvestimento:
    id: int
    investimento_id: int
    normalizado: str


def suggest_category(db: Session, user_id: int, descricao: str) -> CategorySuggestion | None:
    normalizado = normalize_description(descricao)
    if not normalizado:
        return None
    return suggest_category_from_index(
        normalizado, build_rules_index(db, user_id), build_historico_index(db, user_id)
    )


def suggest_category_from_index(
    normalizado: str,
    rules_by_pattern: dict[str, CategorizationRule],
    historico: list[HistoricoTransacao],
) -> CategorySuggestion | None:
    if not normalizado:
        return None

    rule = rules_by_pattern.get(normalizado)
    if rule is not None:
        return CategorySuggestion(
            subcategory_id=rule.subcategory_id,
            confianca="alta",
            fonte_tipo="regra",
            fonte_id=rule.id,
            score=None,
        )

    for h in historico:
        if h.normalizado == normalizado:
            return CategorySuggestion(
                subcategory_id=h.subcategory_id,
                confianca="alta",
                fonte_tipo="historico_exato",
                fonte_id=h.id,
                score=None,
            )

    best_match: tuple[HistoricoTransacao, float] | None = None
    for h in historico:
        score = SequenceMatcher(None, normalizado, h.normalizado).ratio()
        if score >= SIMILARITY_THRESHOLD and (best_match is None or score > best_match[1]):
            best_match = (h, score)

    if best_match is not None:
        h, score = best_match
        return CategorySuggestion(
            subcategory_id=h.subcategory_id,
            confianca="alta",
            fonte_tipo="historico_similar",
            fonte_id=h.id,
            score=round(score, 3),
        )

    return None


def build_rules_index(db: Session, user_id: int) -> dict[str, CategorizationRule]:
    rules = (
        db.query(CategorizationRule)
        .filter(CategorizationRule.user_id == user_id)
        .order_by(CategorizationRule.id)
        .all()
    )
    index: dict[str, CategorizationRule] = {}
    for rule in rules:
        index.setdefault(rule.padrao_normalizado, rule)
    return index


def build_historico_index(db: Session, user_id: int) -> list[HistoricoTransacao]:
    return [
        HistoricoTransacao(
            id=tx.id,
            subcategory_id=tx.subcategory_id,
            normalizado=normalize_description(tx.descricao),
        )
        for tx in _confirmed_history(db, user_id)
    ]


def _confirmed_history(db: Session, user_id: int) -> list[PluggyTransaction]:
    return (
        db.query(PluggyTransaction)
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.categorizacao_status
            == PluggyTransactionCategorizacaoStatus.confirmada,
            PluggyTransaction.subcategory_id.isnot(None),
        )
        .order_by(PluggyTransaction.id)
        .all()
    )


def suggest_asset(db: Session, user_id: int, descricao: str) -> AssetSuggestion | None:
    normalizado = normalize_description(descricao)
    if not normalizado:
        return None
    return suggest_asset_from_index(
        normalizado, build_asset_rules_index(db, user_id), build_asset_historico_index(db, user_id)
    )


def suggest_asset_from_index(
    normalizado: str,
    rules_by_pattern: dict[str, AssetCategorizationRule],
    historico: list[HistoricoAtivo],
) -> AssetSuggestion | None:
    if not normalizado:
        return None

    rule = rules_by_pattern.get(normalizado)
    if rule is not None:
        return AssetSuggestion(asset_id=rule.asset_id, confianca="alta")

    for h in historico:
        if h.normalizado == normalizado:
            return AssetSuggestion(asset_id=h.asset_id, confianca="alta")

    best_match: tuple[HistoricoAtivo, float] | None = None
    for h in historico:
        score = SequenceMatcher(None, normalizado, h.normalizado).ratio()
        if score >= SIMILARITY_THRESHOLD and (best_match is None or score > best_match[1]):
            best_match = (h, score)

    if best_match is not None:
        h, _score = best_match
        return AssetSuggestion(asset_id=h.asset_id, confianca="alta")

    return None


def build_asset_rules_index(db: Session, user_id: int) -> dict[str, AssetCategorizationRule]:
    rules = (
        db.query(AssetCategorizationRule)
        .filter(AssetCategorizationRule.user_id == user_id)
        .order_by(AssetCategorizationRule.id)
        .all()
    )
    index: dict[str, AssetCategorizationRule] = {}
    for rule in rules:
        index.setdefault(rule.padrao_normalizado, rule)
    return index


def build_asset_historico_index(db: Session, user_id: int) -> list[HistoricoAtivo]:
    return [
        HistoricoAtivo(
            id=tx.id, asset_id=tx.asset_id, normalizado=normalize_description(tx.descricao)
        )
        for tx in _confirmed_asset_history(db, user_id)
    ]


def _confirmed_asset_history(db: Session, user_id: int) -> list[PluggyTransaction]:
    return (
        db.query(PluggyTransaction)
        .filter(PluggyTransaction.user_id == user_id, PluggyTransaction.asset_id.isnot(None))
        .order_by(PluggyTransaction.id)
        .all()
    )


def suggest_investimento(
    db: Session, user_id: int, descricao: str
) -> InvestimentoSuggestion | None:
    normalizado = normalize_description(descricao)
    if not normalizado:
        return None
    return suggest_investimento_from_index(
        normalizado,
        build_investimento_rules_index(db, user_id),
        build_investimento_historico_index(db, user_id),
    )


def suggest_investimento_from_index(
    normalizado: str,
    rules_by_pattern: dict[str, InvestimentoCategorizationRule],
    historico: list[HistoricoInvestimento],
) -> InvestimentoSuggestion | None:
    if not normalizado:
        return None

    rule = rules_by_pattern.get(normalizado)
    if rule is not None:
        return InvestimentoSuggestion(investimento_id=rule.investimento_id, confianca="alta")

    for h in historico:
        if h.normalizado == normalizado:
            return InvestimentoSuggestion(investimento_id=h.investimento_id, confianca="alta")

    best_match: tuple[HistoricoInvestimento, float] | None = None
    for h in historico:
        score = SequenceMatcher(None, normalizado, h.normalizado).ratio()
        if score >= SIMILARITY_THRESHOLD and (best_match is None or score > best_match[1]):
            best_match = (h, score)

    if best_match is not None:
        h, _score = best_match
        return InvestimentoSuggestion(investimento_id=h.investimento_id, confianca="alta")

    return None


def build_investimento_rules_index(
    db: Session, user_id: int
) -> dict[str, InvestimentoCategorizationRule]:
    rules = (
        db.query(InvestimentoCategorizationRule)
        .filter(InvestimentoCategorizationRule.user_id == user_id)
        .order_by(InvestimentoCategorizationRule.id)
        .all()
    )
    index: dict[str, InvestimentoCategorizationRule] = {}
    for rule in rules:
        index.setdefault(rule.padrao_normalizado, rule)
    return index


def build_investimento_historico_index(db: Session, user_id: int) -> list[HistoricoInvestimento]:
    return [
        HistoricoInvestimento(
            id=tx.id,
            investimento_id=tx.investimento_id,
            normalizado=normalize_description(tx.descricao),
        )
        for tx in _confirmed_investimento_history(db, user_id)
    ]


def _confirmed_investimento_history(db: Session, user_id: int) -> list[PluggyTransaction]:
    return (
        db.query(PluggyTransaction)
        .filter(PluggyTransaction.user_id == user_id, PluggyTransaction.investimento_id.isnot(None))
        .order_by(PluggyTransaction.id)
        .all()
    )


def suggest_liability(db: Session, user_id: int, descricao: str) -> LiabilitySuggestion | None:
    normalizado = normalize_description(descricao)
    if not normalizado:
        return None
    return suggest_liability_from_index(normalizado, build_liabilities_index(db, user_id))


def suggest_liability_from_index(
    normalizado: str, liabilities: list[tuple[int, str]]
) -> LiabilitySuggestion | None:
    if not normalizado:
        return None

    for liability_id, liability_normalizado in liabilities:
        if liability_normalizado and liability_normalizado in normalizado:
            return LiabilitySuggestion(liability_id=liability_id, confianca="media")

    return None


def build_liabilities_index(db: Session, user_id: int) -> list[tuple[int, str]]:
    liabilities = (
        db.query(Liability).filter(Liability.user_id == user_id).order_by(Liability.id).all()
    )
    return [(liab.id, normalize_description(liab.nome)) for liab in liabilities]


@dataclass
class HoldingInvestimentoSuggestion:
    investimento_id: int
    confianca: str
    fonte_tipo: str
    fonte_id: int | None
    score: float | None


@dataclass
class HoldingCodigoHistorico:
    codigo: str
    investimento_id: int
    holding_id: int


def suggest_holding_investimento(
    db: Session, user_id: int, holding: PluggyInvestment
) -> HoldingInvestimentoSuggestion | None:
    """Sugere um Investimento pra uma holding sincronizada da Pluggy ainda sem
    vínculo. Camada 1: código (ticker/ISIN) exato contra holdings já vinculadas
    manualmente pelo mesmo usuário — mais forte que texto aqui porque a mesma
    posição reaparece com o mesmo código a cada sync. Camada 2: similaridade de
    nome (difflib) contra o catálogo de `Investimento`. Sem camada de regra
    importada — não existe dado legado de vínculo holding↔Investimento
    (PRD-021, "Fora de escopo").
    """
    return suggest_holding_investimento_from_index(
        holding.codigo,
        normalize_description(holding.nome),
        build_holding_codigo_index(db, user_id, exclude_holding_id=holding.id),
        build_investimentos_nome_index(db, user_id),
    )


def suggest_holding_investimento_from_index(
    codigo: str | None,
    nome_normalizado: str,
    codigo_index: dict[str, HoldingCodigoHistorico],
    investimentos: list[tuple[int, str]],
) -> HoldingInvestimentoSuggestion | None:
    if codigo:
        match = codigo_index.get(codigo)
        if match is not None:
            return HoldingInvestimentoSuggestion(
                investimento_id=match.investimento_id,
                confianca="alta",
                fonte_tipo="codigo_exato",
                fonte_id=match.holding_id,
                score=None,
            )

    if not nome_normalizado:
        return None

    best_match: tuple[int, float] | None = None
    for investimento_id, nome_investimento_normalizado in investimentos:
        score = SequenceMatcher(None, nome_normalizado, nome_investimento_normalizado).ratio()
        if score >= SIMILARITY_THRESHOLD and (best_match is None or score > best_match[1]):
            best_match = (investimento_id, score)

    if best_match is not None:
        investimento_id, score = best_match
        return HoldingInvestimentoSuggestion(
            investimento_id=investimento_id,
            confianca="alta",
            fonte_tipo="nome_similar",
            fonte_id=None,
            score=round(score, 3),
        )

    return None


def build_holding_codigo_index(
    db: Session, user_id: int, exclude_holding_id: int
) -> dict[str, HoldingCodigoHistorico]:
    holdings = (
        db.query(PluggyInvestment)
        .filter(
            PluggyInvestment.user_id == user_id,
            PluggyInvestment.investimento_id.isnot(None),
            PluggyInvestment.codigo.isnot(None),
            PluggyInvestment.id != exclude_holding_id,
        )
        .order_by(PluggyInvestment.id)
        .all()
    )
    index: dict[str, HoldingCodigoHistorico] = {}
    for h in holdings:
        index.setdefault(
            h.codigo,
            HoldingCodigoHistorico(
                codigo=h.codigo, investimento_id=h.investimento_id, holding_id=h.id
            ),
        )
    return index


def build_investimentos_nome_index(db: Session, user_id: int) -> list[tuple[int, str]]:
    investimentos = (
        db.query(Investimento)
        .filter(Investimento.user_id == user_id)
        .order_by(Investimento.id)
        .all()
    )
    return [(inv.id, normalize_description(inv.nome)) for inv in investimentos]
