from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.categorization.normalize import normalize_description
from app.models.asset import Asset
from app.models.categorization import CategorizationRule
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


def suggest_category(db: Session, user_id: int, descricao: str) -> CategorySuggestion | None:
    normalizado = normalize_description(descricao)
    if not normalizado:
        return None

    rule = (
        db.query(CategorizationRule)
        .filter(
            CategorizationRule.user_id == user_id,
            CategorizationRule.padrao_normalizado == normalizado,
        )
        .order_by(CategorizationRule.id)
        .first()
    )
    if rule is not None:
        return CategorySuggestion(
            subcategory_id=rule.subcategory_id,
            confianca="alta",
            fonte_tipo="regra",
            fonte_id=rule.id,
            score=None,
        )

    historico = _confirmed_history(db, user_id)

    for tx in historico:
        if normalize_description(tx.descricao) == normalizado:
            return CategorySuggestion(
                subcategory_id=tx.subcategory_id,
                confianca="alta",
                fonte_tipo="historico_exato",
                fonte_id=tx.id,
                score=None,
            )

    best_match: tuple[PluggyTransaction, float] | None = None
    for tx in historico:
        score = SequenceMatcher(None, normalizado, normalize_description(tx.descricao)).ratio()
        if score >= SIMILARITY_THRESHOLD and (best_match is None or score > best_match[1]):
            best_match = (tx, score)

    if best_match is not None:
        tx, score = best_match
        return CategorySuggestion(
            subcategory_id=tx.subcategory_id,
            confianca="alta",
            fonte_tipo="historico_similar",
            fonte_id=tx.id,
            score=round(score, 3),
        )

    return None


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

    assets = db.query(Asset).filter(Asset.user_id == user_id).order_by(Asset.id).all()
    for asset in assets:
        asset_normalizado = normalize_description(asset.nome)
        if asset_normalizado and asset_normalizado in normalizado:
            return AssetSuggestion(asset_id=asset.id, confianca="media")

    return None
