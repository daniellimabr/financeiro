from datetime import UTC, date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.categorization.competencia import caixa, competencia_padrao, competencia_salario
from app.categorization.service import salario_subcategory_id
from app.config import settings
from app.exceptions import InvalidStateError, NotFoundError
from app.models.category import SEM_CATEGORIA_ID
from app.models.investimento import Investimento
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyInvestment,
    PluggyInvestmentTransaction,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.pluggy_integration.client import PluggyClient

_SALARIO_AJUSTE_DEZ_2025_DESCRICAO = "Salário (ajuste dez/2025)"


def _salario_ajuste_dez_2025_pluggy_transaction_id(user_id: int) -> str:
    return f"manual-salario-dez2025-user{user_id}"


NOT_SYNCABLE_STATUSES = {
    PluggyItemStatus.updating,
    PluggyItemStatus.login_error,
    PluggyItemStatus.error,
    PluggyItemStatus.waiting_user_input,
}


def create_connect_token(client: PluggyClient, *, item_id: str | None = None) -> str:
    return client.create_connect_token(item_id=item_id)


def register_item(
    db: Session, client: PluggyClient, user_id: int, pluggy_item_id: str
) -> PluggyItem:
    existing = (
        db.query(PluggyItem).filter(PluggyItem.pluggy_item_id == pluggy_item_id).one_or_none()
    )
    if existing is not None:
        return existing

    raw = client.get_item(pluggy_item_id)
    item = PluggyItem(
        user_id=user_id,
        pluggy_item_id=pluggy_item_id,
        connector_id=raw["connector"]["id"],
        connector_name=raw["connector"]["name"],
        status=_map_item_status(raw["status"]),
        status_detail=raw.get("statusDetail"),
        cutoff_date=settings.pluggy_sync_cutoff_date,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_items(db: Session, user_id: int) -> list[PluggyItem]:
    return (
        db.query(PluggyItem)
        .filter(PluggyItem.user_id == user_id)
        .order_by(PluggyItem.created_at)
        .all()
    )


def get_item(db: Session, user_id: int, item_id: int) -> PluggyItem:
    item = (
        db.query(PluggyItem)
        .filter(PluggyItem.id == item_id, PluggyItem.user_id == user_id)
        .one_or_none()
    )
    if item is None:
        raise NotFoundError(f"Item Pluggy {item_id} não encontrado")
    return item


def list_accounts(db: Session, user_id: int) -> list[PluggyAccount]:
    return (
        db.query(PluggyAccount)
        .filter(PluggyAccount.user_id == user_id)
        .order_by(PluggyAccount.nome)
        .all()
    )


def get_account(db: Session, user_id: int, account_id: int) -> PluggyAccount:
    account = (
        db.query(PluggyAccount)
        .filter(PluggyAccount.id == account_id, PluggyAccount.user_id == user_id)
        .one_or_none()
    )
    if account is None:
        raise NotFoundError(f"Conta {account_id} não encontrada")
    return account


def update_account(
    db: Session,
    user_id: int,
    account_id: int,
    *,
    apelido: str | None,
    sync_enabled: bool,
    investimento_id: int | None = None,
) -> PluggyAccount:
    account = get_account(db, user_id, account_id)
    if investimento_id is not None:
        investimento = (
            db.query(Investimento)
            .filter(Investimento.id == investimento_id, Investimento.user_id == user_id)
            .one_or_none()
        )
        if investimento is None:
            raise NotFoundError(f"Investimento {investimento_id} não encontrado")
    account.apelido = apelido
    account.sync_enabled = sync_enabled
    account.investimento_id = investimento_id
    db.commit()
    db.refresh(account)
    return account


def update_saldo_inicial(
    db: Session, user_id: int, account_id: int, *, saldo_inicial: Decimal | None
) -> PluggyAccount:
    account = get_account(db, user_id, account_id)
    account.saldo_inicial = saldo_inicial
    db.commit()
    db.refresh(account)
    return account


def list_investments(
    db: Session, user_id: int, *, investimento_id: int | None = None
) -> list[PluggyInvestment]:
    query = db.query(PluggyInvestment).filter(PluggyInvestment.user_id == user_id)
    if investimento_id is not None:
        query = query.filter(PluggyInvestment.investimento_id == investimento_id)
    return query.order_by(PluggyInvestment.nome).all()


def get_investment(db: Session, user_id: int, investment_id: int) -> PluggyInvestment:
    investment = (
        db.query(PluggyInvestment)
        .filter(PluggyInvestment.id == investment_id, PluggyInvestment.user_id == user_id)
        .one_or_none()
    )
    if investment is None:
        raise NotFoundError(f"Posição de investimento {investment_id} não encontrada")
    return investment


def update_investment(
    db: Session, user_id: int, investment_id: int, *, investimento_id: int | None = None
) -> PluggyInvestment:
    investment = get_investment(db, user_id, investment_id)
    if investimento_id is not None:
        investimento = (
            db.query(Investimento)
            .filter(Investimento.id == investimento_id, Investimento.user_id == user_id)
            .one_or_none()
        )
        if investimento is None:
            raise NotFoundError(f"Investimento {investimento_id} não encontrado")
    investment.investimento_id = investimento_id
    db.commit()
    db.refresh(investment)
    return investment


def update_investment_saldo_inicial(
    db: Session, user_id: int, investment_id: int, *, saldo_inicial: Decimal | None
) -> PluggyInvestment:
    investment = get_investment(db, user_id, investment_id)
    investment.saldo_inicial = saldo_inicial
    db.commit()
    db.refresh(investment)
    return investment


def list_investment_transactions(
    db: Session, user_id: int, investment_id: int
) -> list[PluggyInvestmentTransaction]:
    get_investment(db, user_id, investment_id)
    return (
        db.query(PluggyInvestmentTransaction)
        .filter(
            PluggyInvestmentTransaction.user_id == user_id,
            PluggyInvestmentTransaction.investment_id == investment_id,
        )
        .order_by(PluggyInvestmentTransaction.data.desc())
        .all()
    )


def get_salario_ajuste_dez_2025(db: Session, user_id: int) -> PluggyTransaction | None:
    return (
        db.query(PluggyTransaction)
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.pluggy_transaction_id
            == _salario_ajuste_dez_2025_pluggy_transaction_id(user_id),
        )
        .one_or_none()
    )


def upsert_salario_ajuste_dez_2025(
    db: Session,
    user_id: int,
    *,
    account_id: int,
    data: date,
    valor: Decimal | None,
    cutoff_dia: int,
) -> PluggyTransaction | None:
    account = get_account(db, user_id, account_id)
    tx = get_salario_ajuste_dez_2025(db, user_id)

    if valor is None:
        if tx is not None:
            db.delete(tx)
            db.commit()
        return None

    subcategory_id = salario_subcategory_id(db)
    if subcategory_id is None:
        raise NotFoundError("Subcategoria 'Salário' não encontrada no catálogo")

    if tx is None:
        tx = PluggyTransaction(
            account_id=account.id,
            user_id=user_id,
            pluggy_transaction_id=_salario_ajuste_dez_2025_pluggy_transaction_id(user_id),
        )
        db.add(tx)
    else:
        tx.account_id = account.id

    tx.descricao = _SALARIO_AJUSTE_DEZ_2025_DESCRICAO
    tx.valor = valor
    tx.tipo = PluggyTransactionTipo.credito
    tx.data = data
    if account.tipo == PluggyAccountTipo.cartao_credito:
        tx.data_competencia = competencia_padrao(data, account.tipo)
    else:
        tx.data_competencia = competencia_salario(data, cutoff_dia)
    tx.data_caixa = caixa(tx.data_competencia, account.tipo)
    tx.subcategory_id = subcategory_id
    tx.status = PluggyTransactionStatus.efetivada
    tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
    db.commit()
    db.refresh(tx)
    return tx


def list_transactions(
    db: Session,
    user_id: int,
    *,
    ano: int | None = None,
    mes: int | None = None,
    subcategory_id: int | None = None,
    account_tipo: PluggyAccountTipo | None = None,
    asset_id: int | None = None,
    liability_id: int | None = None,
    investimento_id: int | None = None,
    tipo: PluggyTransactionTipo | None = None,
    competencia: bool = False,
) -> list[PluggyTransaction]:
    query = db.query(PluggyTransaction).filter(PluggyTransaction.user_id == user_id)

    data_field = PluggyTransaction.data_competencia if competencia else PluggyTransaction.data
    if ano is not None:
        query = query.filter(func.extract("year", data_field) == ano)
    if mes is not None:
        query = query.filter(func.extract("month", data_field) == mes)
    if subcategory_id is not None:
        if subcategory_id == SEM_CATEGORIA_ID:
            query = query.filter(PluggyTransaction.subcategory_id.is_(None))
        else:
            query = query.filter(PluggyTransaction.subcategory_id == subcategory_id)
    if account_tipo is not None:
        query = query.join(PluggyAccount).filter(PluggyAccount.tipo == account_tipo)
    if asset_id is not None:
        query = query.filter(PluggyTransaction.asset_id == asset_id)
    if liability_id is not None:
        query = query.filter(PluggyTransaction.liability_id == liability_id)
    if investimento_id is not None:
        query = query.filter(PluggyTransaction.investimento_id == investimento_id)
    if tipo is not None:
        query = query.filter(PluggyTransaction.tipo == tipo)

    return (
        query.options(joinedload(PluggyTransaction.account))
        .order_by(PluggyTransaction.data.desc())
        .all()
    )


def sync_item(db: Session, client: PluggyClient, user_id: int, item_id: int) -> PluggyItem:
    item = get_item(db, user_id, item_id)

    raw_item = client.get_item(item.pluggy_item_id)
    item.status = _map_item_status(raw_item["status"])
    item.status_detail = raw_item.get("statusDetail")

    if item.status in NOT_SYNCABLE_STATUSES:
        db.commit()
        db.refresh(item)
        raise InvalidStateError(
            f"Item {item_id} está em status '{item.status}' e não pode ser sincronizado"
        )

    accounts_raw = client.get_accounts(item.pluggy_item_id)
    for account_raw in accounts_raw:
        existing = (
            db.query(PluggyAccount)
            .filter(PluggyAccount.pluggy_account_id == account_raw["id"])
            .one_or_none()
        )
        if existing is not None and not existing.sync_enabled:
            # Conta removida da lista de sync pelo usuário — nem saldo nem
            # transações são atualizados enquanto sync_enabled=False.
            continue

        account = _upsert_account(db, item, account_raw)
        transactions_raw = client.get_transactions(account_raw["id"], from_date=item.cutoff_date)
        for tx_raw in transactions_raw:
            tx_date = _parse_date(tx_raw["date"])
            if tx_date < item.cutoff_date:
                continue
            _upsert_transaction(db, account, tx_raw, tx_date)

    # Investments é buscado para todo item, mesmo os que também retornam
    # contas via /accounts (achado real do Bloco 1, Sprint 20: XP retorna
    # ambos, sem sobreposição — holdings e contas bancárias são fontes
    # distintas para o mesmo item).
    investments_raw = client.get_investments(item.pluggy_item_id)
    for investment_raw in investments_raw:
        investment = _upsert_investment(db, item, investment_raw)
        investment_transactions_raw = client.get_investment_transactions(
            investment_raw["id"], from_date=item.cutoff_date
        )
        for investment_tx_raw in investment_transactions_raw:
            _upsert_investment_transaction(db, investment, investment_tx_raw)

    item.last_synced_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item


class SyncItemResult:
    def __init__(
        self, item_id: int, success: bool, error: str | None = None, item: PluggyItem | None = None
    ):
        self.item_id = item_id
        self.success = success
        self.error = error
        self.item = item


def sync_items(
    db: Session, client: PluggyClient, user_id: int, item_ids: list[int] | None = None
) -> list[SyncItemResult]:
    ids = item_ids if item_ids is not None else [item.id for item in list_items(db, user_id)]

    results: list[SyncItemResult] = []
    for item_id in ids:
        try:
            synced = sync_item(db, client, user_id, item_id)
            results.append(SyncItemResult(item_id, True, None, synced))
        except NotFoundError as exc:
            results.append(SyncItemResult(item_id, False, str(exc)))
        except InvalidStateError as exc:
            results.append(SyncItemResult(item_id, False, str(exc)))
    return results


def _upsert_account(db: Session, item: PluggyItem, raw: dict) -> PluggyAccount:
    account = (
        db.query(PluggyAccount).filter(PluggyAccount.pluggy_account_id == raw["id"]).one_or_none()
    )
    if account is None:
        account = PluggyAccount(item_id=item.id, user_id=item.user_id, pluggy_account_id=raw["id"])
        db.add(account)

    account.tipo = _map_account_tipo(raw)
    account.nome = raw.get("name") or raw.get("marketingName") or ""
    account.numero_mascarado = raw.get("number")
    account.saldo = Decimal(str(raw["balance"]))
    account.moeda = raw.get("currencyCode", "BRL")

    credit_data = raw.get("creditData") or {}
    account.limite_credito = (
        Decimal(str(credit_data["creditLimit"]))
        if credit_data.get("creditLimit") is not None
        else None
    )
    account.fatura_vencimento = (
        date.fromisoformat(credit_data["balanceDueDate"])
        if credit_data.get("balanceDueDate")
        else None
    )

    db.flush()
    return account


def _upsert_investment(db: Session, item: PluggyItem, raw: dict) -> PluggyInvestment:
    investment = (
        db.query(PluggyInvestment)
        .filter(PluggyInvestment.pluggy_investment_id == raw["id"])
        .one_or_none()
    )
    if investment is None:
        investment = PluggyInvestment(
            item_id=item.id, user_id=item.user_id, pluggy_investment_id=raw["id"]
        )
        db.add(investment)

    investment.tipo = raw.get("type") or ""
    investment.subtipo = raw.get("subtype")
    investment.nome = raw.get("name") or ""
    # `code` (ticker) e `isin` são campos distintos no payload real (Bloco 1) —
    # `code` cobre ações (ex.: HAPV3); CDBs não têm nenhum dos dois, títulos do
    # Tesouro têm os dois idênticos. Um único campo `codigo` livre é suficiente
    # para exibição (critério de aceite 4 do PRD-020).
    investment.codigo = raw.get("code") or raw.get("isin")
    investment.quantidade = (
        Decimal(str(raw["quantity"])) if raw.get("quantity") is not None else None
    )
    investment.valor_investido = (
        Decimal(str(raw["amountOriginal"])) if raw.get("amountOriginal") is not None else None
    )
    investment.valor_atual = Decimal(str(raw["balance"]))
    investment.moeda = raw.get("currencyCode", "BRL")

    db.flush()
    return investment


def _upsert_investment_transaction(
    db: Session, investment: PluggyInvestment, raw: dict
) -> PluggyInvestmentTransaction:
    tx = (
        db.query(PluggyInvestmentTransaction)
        .filter(PluggyInvestmentTransaction.pluggy_investment_transaction_id == raw["id"])
        .one_or_none()
    )
    if tx is None:
        tx = PluggyInvestmentTransaction(
            investment_id=investment.id,
            user_id=investment.user_id,
            pluggy_investment_transaction_id=raw["id"],
        )
        db.add(tx)

    tx.tipo = raw.get("type") or ""
    tx.descricao = raw.get("description")
    tx.valor = Decimal(str(raw["amount"]))
    tx.quantidade = Decimal(str(raw["quantity"])) if raw.get("quantity") is not None else None
    tx.data = _parse_investment_date(raw["date"])
    db.flush()
    return tx


def _upsert_transaction(
    db: Session, account: PluggyAccount, raw: dict, tx_date: date
) -> PluggyTransaction:
    tx = (
        db.query(PluggyTransaction)
        .filter(PluggyTransaction.pluggy_transaction_id == raw["id"])
        .one_or_none()
    )
    if tx is None:
        tx = PluggyTransaction(
            account_id=account.id,
            user_id=account.user_id,
            pluggy_transaction_id=raw["id"],
        )
        db.add(tx)

    tx.descricao = raw.get("description", "")
    tx.valor = Decimal(str(raw["amount"]))
    tx.tipo = _map_transaction_tipo(raw["type"])
    # Data editada manualmente pelo usuário (tela Categorizar) é uma trava
    # explícita contra o valor bruto da Pluggy — sobrevive a todo resync
    # futuro para a mesma transação (PRD-018).
    if not tx.data_editada_manualmente:
        tx.data = tx_date
        # Cartão sempre desloca incondicionalmente (mesmo valor de novo, sem
        # risco de perder ajuste manual). Transação já confirmada em outra conta
        # pode ter data_competencia deslocada por categoria (ex.: Salário, via
        # set_category/bulk_confirm) — resync não deve descartar esse ajuste.
        if (
            account.tipo == PluggyAccountTipo.cartao_credito
            or tx.categorizacao_status != PluggyTransactionCategorizacaoStatus.confirmada
        ):
            tx.data_competencia = competencia_padrao(tx_date, account.tipo)
            tx.data_caixa = caixa(tx.data_competencia, account.tipo)
    tx.categoria_pluggy = raw.get("category")
    tx.status = _map_transaction_status(raw.get("status", "POSTED"))
    db.flush()
    return tx


def _map_item_status(raw: str) -> PluggyItemStatus:
    return PluggyItemStatus(raw.lower())


def _map_account_tipo(raw: dict) -> PluggyAccountTipo:
    subtype = (raw.get("subtype") or "").upper()
    tipo = (raw.get("type") or "").upper()
    if tipo == "CREDIT":
        return PluggyAccountTipo.cartao_credito
    if subtype == "SAVINGS_ACCOUNT":
        return PluggyAccountTipo.poupanca
    if subtype == "CHECKING_ACCOUNT":
        return PluggyAccountTipo.corrente
    return PluggyAccountTipo.investimento


def _map_transaction_tipo(raw: str) -> PluggyTransactionTipo:
    return PluggyTransactionTipo.debito if raw.upper() == "DEBIT" else PluggyTransactionTipo.credito


def _map_transaction_status(raw: str) -> PluggyTransactionStatus:
    if raw.upper() == "PENDING":
        return PluggyTransactionStatus.pendente
    return PluggyTransactionStatus.efetivada


_BRT = ZoneInfo("America/Sao_Paulo")


def _parse_date(raw: str) -> date:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(_BRT).date()


def _parse_investment_date(raw: str) -> date:
    # `date`/`tradeDate` de /investments/{id}/transactions vêm como meia-noite
    # UTC (convenção de "só a data", achado do Bloco 1, Sprint 20) — diferente
    # do timestamp de evento de /v2/transactions, que exige conversão pra BRT
    # (_parse_date). Aplicar a mesma conversão aqui deslocaria a data um dia
    # pra trás incorretamente.
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
