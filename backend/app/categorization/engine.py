from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.categorization.normalize import normalize_description
from app.models.asset import Asset
from app.models.categorization import CategorizationRule
from app.models.liability import Liability
from app.models.pluggy import PluggyTransaction, PluggyTransactionCategorizacaoStatus

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
    return suggest_asset_from_index(normalizado, build_assets_index(db, user_id))


def suggest_asset_from_index(
    normalizado: str, assets: list[tuple[int, str]]
) -> AssetSuggestion | None:
    if not normalizado:
        return None

    for asset_id, asset_normalizado in assets:
        if asset_normalizado and asset_normalizado in normalizado:
            return AssetSuggestion(asset_id=asset_id, confianca="media")

    return None


def build_assets_index(db: Session, user_id: int) -> list[tuple[int, str]]:
    assets = db.query(Asset).filter(Asset.user_id == user_id).order_by(Asset.id).all()
    return [(a.id, normalize_description(a.nome)) for a in assets]


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
