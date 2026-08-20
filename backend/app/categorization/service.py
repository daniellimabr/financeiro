from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.categorization import engine
from app.categorization.competencia import caixa, competencia_padrao, competencia_salario
from app.categorization.normalize import normalize_description
from app.exceptions import InvalidStateError, NotFoundError
from app.models.asset import Asset
from app.models.categorization import (
    AssetCategorizationRule,
    CategorizationRule,
    InvestimentoCategorizationRule,
)
from app.models.category import CategoryGroup, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_SALARIO_SUBCATEGORY_NOME = "Salário"
_SALARIO_GROUP_NOME = "Receitas"


def salario_subcategory_id(db: Session, user_id: int) -> int | None:
    row = (
        db.query(Subcategory.id)
        .join(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(
            Subcategory.user_id == user_id,
            Subcategory.nome == _SALARIO_SUBCATEGORY_NOME,
            CategoryGroup.nome == _SALARIO_GROUP_NOME,
        )
        .one_or_none()
    )
    return row[0] if row else None


def _recompute_data_competencia(
    tx: PluggyTransaction, subcategory_id: int, salario_id: int | None, cutoff_dia: int
) -> None:
    account_tipo = tx.account_tipo
    if account_tipo == PluggyAccountTipo.cartao_credito:
        tx.data_competencia = competencia_padrao(tx.data, account_tipo)
    elif salario_id is not None and subcategory_id == salario_id:
        tx.data_competencia = competencia_salario(tx.data, cutoff_dia)
    else:
        tx.data_competencia = tx.data
    tx.data_caixa = caixa(tx.data_competencia, account_tipo)


def list_transactions(
    db: Session,
    user_id: int,
    *,
    status: str = "todas",
    tipo: PluggyTransactionTipo | None = None,
    ano: int | None = None,
    mes: int | None = None,
    has_asset: bool | None = None,
    group_id: int | None = None,
    account_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[PluggyTransaction], int]:
    query = (
        db.query(PluggyTransaction)
        .join(PluggyAccount, PluggyTransaction.account_id == PluggyAccount.id)
        .filter(PluggyTransaction.user_id == user_id)
        .filter(PluggyAccount.tipo != PluggyAccountTipo.investimento)
    )

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
    if has_asset is not None:
        if has_asset:
            query = query.filter(PluggyTransaction.asset_id.isnot(None))
        else:
            query = query.filter(PluggyTransaction.asset_id.is_(None))
    if group_id is not None:
        query = query.join(Subcategory, PluggyTransaction.subcategory_id == Subcategory.id).filter(
            Subcategory.group_id == group_id
        )
    if account_id is not None:
        query = query.filter(PluggyTransaction.account_id == account_id)

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
        asset_rules = engine.build_asset_rules_index(db, user_id)
        asset_historico = engine.build_asset_historico_index(db, user_id)
        liabilities = engine.build_liabilities_index(db, user_id)
        investimento_rules = engine.build_investimento_rules_index(db, user_id)
        investimento_historico = engine.build_investimento_historico_index(db, user_id)
        for tx in pendentes_da_pagina:
            _apply_suggestions(
                db,
                tx,
                rules_by_pattern,
                historico,
                asset_rules,
                asset_historico,
                liabilities,
                investimento_rules,
                investimento_historico,
            )
        db.commit()
        for tx in pendentes_da_pagina:
            db.refresh(tx)

    return items, total


def _apply_suggestions(
    db: Session,
    tx: PluggyTransaction,
    rules_by_pattern: dict[str, CategorizationRule],
    historico: list[engine.HistoricoTransacao],
    asset_rules: dict[str, AssetCategorizationRule],
    asset_historico: list[engine.HistoricoAtivo],
    liabilities: list[tuple[int, str]],
    investimento_rules: dict[str, InvestimentoCategorizationRule],
    investimento_historico: list[engine.HistoricoInvestimento],
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

    if not tx.asset_confirmado_manualmente:
        asset_suggestion = engine.suggest_asset_from_index(
            normalizado, asset_rules, asset_historico
        )
        if asset_suggestion is not None:
            tx.asset_sugerido_id = asset_suggestion.asset_id
            tx.asset_sugestao_confianca = asset_suggestion.confianca
        else:
            tx.asset_sugerido_id = None
            tx.asset_sugestao_confianca = None

    if not tx.liability_confirmado_manualmente:
        liability_suggestion = engine.suggest_liability_from_index(normalizado, liabilities)
        if liability_suggestion is not None:
            tx.liability_sugerido_id = liability_suggestion.liability_id
            tx.liability_sugestao_confianca = liability_suggestion.confianca
        else:
            tx.liability_sugerido_id = None
            tx.liability_sugestao_confianca = None

    if not tx.investimento_confirmado_manualmente:
        investimento_suggestion = engine.suggest_investimento_from_index(
            normalizado, investimento_rules, investimento_historico
        )
        if investimento_suggestion is not None:
            tx.investimento_sugerido_id = investimento_suggestion.investimento_id
            tx.investimento_sugestao_confianca = investimento_suggestion.confianca
        else:
            tx.investimento_sugerido_id = None
            tx.investimento_sugestao_confianca = None

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

    subcategory = (
        db.query(Subcategory)
        .filter(Subcategory.id == subcategory_id, Subcategory.user_id == user_id)
        .one_or_none()
    )
    if subcategory is None:
        raise NotFoundError(f"Subcategoria {subcategory_id} não encontrada")

    user = db.get(User, user_id)
    salario_id = salario_subcategory_id(db, user_id)

    tx.subcategory_id = subcategory_id
    tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
    tx.subcategoria_sugerida_id = None
    tx.sugestao_confianca = None
    tx.sugestao_fonte_tipo = None
    tx.sugestao_fonte_id = None
    tx.sugestao_score = None
    _recompute_data_competencia(tx, subcategory_id, salario_id, user.salario_competencia_cutoff_dia)
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
    user = db.get(User, user_id)
    salario_id = salario_subcategory_id(db, user_id)

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

        subcategory = (
            db.query(Subcategory)
            .filter(Subcategory.id == subcategory_id, Subcategory.user_id == user_id)
            .one_or_none()
        )
        if subcategory is None:
            results.append(
                BulkConfirmResult(
                    transaction_id, False, f"Subcategoria {subcategory_id} não encontrada"
                )
            )
            continue

        tx.subcategory_id = subcategory_id
        tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
        tx.subcategoria_sugerida_id = None
        tx.sugestao_confianca = None
        tx.sugestao_fonte_tipo = None
        tx.sugestao_fonte_id = None
        tx.sugestao_score = None
        _recompute_data_competencia(
            tx, subcategory_id, salario_id, user.salario_competencia_cutoff_dia
        )
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
    tx.asset_sugerido_id = None
    tx.asset_sugestao_confianca = None
    tx.asset_confirmado_manualmente = True
    db.commit()
    db.refresh(tx)
    return tx


def set_transaction_liability(
    db: Session, user_id: int, transaction_id: int, liability_id: int | None
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)

    if liability_id is not None:
        liability = (
            db.query(Liability)
            .filter(Liability.id == liability_id, Liability.user_id == user_id)
            .one_or_none()
        )
        if liability is None:
            raise NotFoundError(f"Passivo {liability_id} não encontrado")

    tx.liability_id = liability_id
    tx.liability_sugerido_id = None
    tx.liability_sugestao_confianca = None
    tx.liability_confirmado_manualmente = True
    db.commit()
    db.refresh(tx)
    return tx


def set_transaction_investimento(
    db: Session, user_id: int, transaction_id: int, investimento_id: int | None
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)

    if investimento_id is not None:
        investimento = (
            db.query(Investimento)
            .filter(Investimento.id == investimento_id, Investimento.user_id == user_id)
            .one_or_none()
        )
        if investimento is None:
            raise NotFoundError(f"Investimento {investimento_id} não encontrado")

    tx.investimento_id = investimento_id
    tx.investimento_sugerido_id = None
    tx.investimento_sugestao_confianca = None
    tx.investimento_confirmado_manualmente = True
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


def update_data(
    db: Session, user_id: int, transaction_id: int, nova_data: date
) -> PluggyTransaction:
    tx = _get_transaction(db, user_id, transaction_id)

    if nova_data > date.today():
        raise InvalidStateError("Data não pode ser no futuro")

    user = db.get(User, user_id)
    salario_id = salario_subcategory_id(db, user_id)

    tx.data = nova_data
    tx.data_editada_manualmente = True
    _recompute_data_competencia(
        tx, tx.subcategory_id, salario_id, user.salario_competencia_cutoff_dia
    )
    db.commit()
    db.refresh(tx)
    return tx


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
