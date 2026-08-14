from sqlalchemy.orm import Session

from app.categorization import engine
from app.exceptions import NotFoundError
from app.models.asset import Asset
from app.models.category import Subcategory
from app.models.pluggy import PluggyTransaction, PluggyTransactionCategorizacaoStatus


def list_pending_transactions(db: Session, user_id: int) -> list[PluggyTransaction]:
    pending = (
        db.query(PluggyTransaction)
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente,
        )
        .order_by(PluggyTransaction.data.desc())
        .all()
    )

    for tx in pending:
        _apply_suggestions(db, tx)
    db.commit()
    for tx in pending:
        db.refresh(tx)

    return pending


def _apply_suggestions(db: Session, tx: PluggyTransaction) -> None:
    category_suggestion = engine.suggest_category(db, tx.user_id, tx.descricao)
    if category_suggestion is not None:
        tx.subcategoria_sugerida_id = category_suggestion.subcategory_id
        tx.sugestao_confianca = category_suggestion.confianca
        tx.sugestao_fonte_tipo = category_suggestion.fonte_tipo
        tx.sugestao_fonte_id = category_suggestion.fonte_id
        tx.sugestao_score = category_suggestion.score
    else:
        tx.subcategoria_sugerida_id = None
        tx.sugestao_confianca = None
        tx.sugestao_fonte_tipo = None
        tx.sugestao_fonte_id = None
        tx.sugestao_score = None

    asset_suggestion = engine.suggest_asset(db, tx.user_id, tx.descricao)
    if asset_suggestion is not None:
        tx.asset_sugerido_id = asset_suggestion.asset_id
        tx.asset_sugestao_confianca = asset_suggestion.confianca
    else:
        tx.asset_sugerido_id = None
        tx.asset_sugestao_confianca = None

    db.flush()


def _get_transaction(db: Session, user_id: int, transaction_id: int) -> PluggyTransaction:
    tx = (
        db.query(PluggyTransaction)
        .filter(PluggyTransaction.id == transaction_id, PluggyTransaction.user_id == user_id)
        .one_or_none()
    )
    if tx is None:
        raise NotFoundError(f"Transação {transaction_id} não encontrada")
    return tx


def confirm_categorization(
    db: Session, user_id: int, transaction_id: int, subcategory_id: int
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)

    subcategory = db.get(Subcategory, subcategory_id)
    if subcategory is None:
        raise NotFoundError(f"Subcategoria {subcategory_id} não encontrada")

    tx.subcategory_id = subcategory_id
    tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
    db.commit()
    db.refresh(tx)
    return tx


def set_transaction_asset(
    db: Session, user_id: int, transaction_id: int, asset_id: int | None
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)

    if asset_id is not None:
        asset = db.query(Asset).filter(Asset.id == asset_id, Asset.user_id == user_id).one_or_none()
        if asset is None:
            raise NotFoundError(f"Ativo {asset_id} não encontrado")

    tx.asset_id = asset_id
    db.commit()
    db.refresh(tx)
    return tx
