from sqlalchemy import func
from sqlalchemy.orm import Session

from app.categorization import engine
from app.categorization.normalize import normalize_description
from app.exceptions import InvalidStateError, NotFoundError
from app.models.asset import Asset
from app.models.categorization import CategorizationRule
from app.models.category import Subcategory
from app.models.pluggy import (
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionTipo,
)


def list_transactions(
    db: Session,
    user_id: int,
    *,
    status: str = "todas",
    tipo: PluggyTransactionTipo | None = None,
    ano: int | None = None,
    mes: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[PluggyTransaction], int]:
    query = db.query(PluggyTransaction).filter(PluggyTransaction.user_id == user_id)

    if status == "pendente":
        query = query.filter(
            PluggyTransaction.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente
        )
    elif status == "confirmada":
        query = query.filter(
            PluggyTransaction.categorizacao_status
            == PluggyTransactionCategorizacaoStatus.confirmada
        )
    # status == "todas": sem filtro adicional.

    if tipo is not None:
        query = query.filter(PluggyTransaction.tipo == tipo)
    if ano is not None:
        query = query.filter(func.extract("year", PluggyTransaction.data) == ano)
    if mes is not None:
        query = query.filter(func.extract("month", PluggyTransaction.data) == mes)

    total = query.count()
    items = (
        query.order_by(PluggyTransaction.data.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Sugestão só é relevante (e só é recalculada) para as linhas ainda
    # pendentes da página — recalcular para confirmadas seria custo sem uso,
    # já que a categoria confirmada não muda por causa de uma sugestão nova.
    pendentes_da_pagina = [
        tx
        for tx in items
        if tx.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente
    ]
    if pendentes_da_pagina:
        rules_by_pattern = engine.build_rules_index(db, user_id)
        historico = engine.build_historico_index(db, user_id)
        assets = engine.build_assets_index(db, user_id)
        for tx in pendentes_da_pagina:
            _apply_suggestions(db, tx, rules_by_pattern, historico, assets)
        db.commit()
        for tx in pendentes_da_pagina:
            db.refresh(tx)

    return items, total


def _apply_suggestions(
    db: Session,
    tx: PluggyTransaction,
    rules_by_pattern: dict[str, CategorizationRule],
    historico: list[engine.HistoricoTransacao],
    assets: list[tuple[int, str]],
) -> None:
    normalizado = normalize_description(tx.descricao)

    category_suggestion = engine.suggest_category_from_index(
        normalizado, rules_by_pattern, historico
    )
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

    asset_suggestion = engine.suggest_asset_from_index(normalizado, assets)
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


def set_category(
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


class BulkConfirmResult:
    def __init__(self, transaction_id: int, success: bool, error: str | None = None):
        self.transaction_id = transaction_id
        self.success = success
        self.error = error


def bulk_confirm(
    db: Session, user_id: int, items: list[tuple[int, int]]
) -> list[BulkConfirmResult]:
    results: list[BulkConfirmResult] = []
    for transaction_id, subcategory_id in items:
        tx = (
            db.query(PluggyTransaction)
            .filter(PluggyTransaction.id == transaction_id, PluggyTransaction.user_id == user_id)
            .one_or_none()
        )
        if tx is None:
            results.append(
                BulkConfirmResult(
                    transaction_id, False, f"Transação {transaction_id} não encontrada"
                )
            )
            continue

        subcategory = db.get(Subcategory, subcategory_id)
        if subcategory is None:
            results.append(
                BulkConfirmResult(
                    transaction_id, False, f"Subcategoria {subcategory_id} não encontrada"
                )
            )
            continue

        tx.subcategory_id = subcategory_id
        tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
        results.append(BulkConfirmResult(transaction_id, True))

    db.commit()
    return results


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


def _categoria_efetiva(tx: PluggyTransaction) -> int | None:
    if tx.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada:
        return tx.subcategory_id
    return tx.subcategoria_sugerida_id


def update_description(
    db: Session, user_id: int, transaction_id: int, nova_descricao: str
) -> tuple[PluggyTransaction, int]:
    tx = _get_transaction(db, user_id, transaction_id)

    descricao_original_exibida = tx.descricao_usuario or tx.descricao
    normalizado_original = normalize_description(descricao_original_exibida)
    origem_categoria = _categoria_efetiva(tx)

    tx.descricao_usuario = nova_descricao
    db.flush()

    propagated = 0
    if normalizado_original and origem_categoria is not None:
        candidatos = (
            db.query(PluggyTransaction)
            .filter(
                PluggyTransaction.user_id == user_id,
                PluggyTransaction.id != tx.id,
                PluggyTransaction.descricao_sugerida.is_(None),
            )
            .all()
        )
        for candidato in candidatos:
            descricao_candidato = candidato.descricao_usuario or candidato.descricao
            if normalize_description(descricao_candidato) != normalizado_original:
                continue
            if _categoria_efetiva(candidato) != origem_categoria:
                continue
            candidato.descricao_sugerida = nova_descricao
            candidato.descricao_sugestao_origem_id = tx.id
            propagated += 1

    db.commit()
    db.refresh(tx)
    return tx, propagated


def confirm_description_suggestion(
    db: Session, user_id: int, transaction_id: int
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)
    if tx.descricao_sugerida is None:
        raise InvalidStateError(
            f"Transação {transaction_id} não tem sugestão de descrição pendente"
        )

    tx.descricao_usuario = tx.descricao_sugerida
    tx.descricao_sugerida = None
    tx.descricao_sugestao_origem_id = None
    db.commit()
    db.refresh(tx)
    return tx


def dismiss_description_suggestion(
    db: Session, user_id: int, transaction_id: int
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)
    if tx.descricao_sugerida is None:
        raise InvalidStateError(
            f"Transação {transaction_id} não tem sugestão de descrição pendente"
        )

    tx.descricao_sugerida = None
    tx.descricao_sugestao_origem_id = None
    db.commit()
    db.refresh(tx)
    return tx
