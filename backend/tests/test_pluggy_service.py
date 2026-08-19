from datetime import date
from decimal import Decimal

import pytest

from app.categorization.service import salario_subcategory_id
from app.dashboards import service as dashboards_service
from app.exceptions import InvalidStateError, NotFoundError
from app.models.category import CategoryGroup, Subcategory
from app.models.investimento import Investimento
from app.models.pluggy import PluggyAccount, PluggyTransaction
from app.models.user import User
from app.pluggy_integration import service


class FakePluggyClient:
    def __init__(
        self,
        *,
        item,
        accounts=None,
        transactions_by_account=None,
        investments=None,
        investment_transactions_by_investment=None,
    ):
        self.item = item
        self.accounts = accounts or []
        self.transactions_by_account = transactions_by_account or {}
        self.investments = investments or []
        self.investment_transactions_by_investment = investment_transactions_by_investment or {}
        self.get_accounts_calls = 0

    def get_item(self, pluggy_item_id):
        return self.item

    def get_accounts(self, pluggy_item_id):
        self.get_accounts_calls += 1
        return self.accounts

    def get_transactions(self, pluggy_account_id, *, from_date=None):
        return self.transactions_by_account.get(pluggy_account_id, [])

    def get_investments(self, pluggy_item_id):
        return self.investments

    def get_investment_transactions(self, pluggy_investment_id, *, from_date=None):
        return self.investment_transactions_by_investment.get(pluggy_investment_id, [])

    def create_connect_token(self, *, item_id=None):
        return "connect-token"


def _item_raw(**overrides):
    data = {
        "id": "item-ext-1",
        "status": "UPDATED",
        "connector": {"id": 1, "name": "Banco Fake"},
    }
    data.update(overrides)
    return data


def _account_raw(**overrides):
    data = {
        "id": "acc-ext-1",
        "type": "BANK",
        "subtype": "CHECKING_ACCOUNT",
        "name": "Conta Corrente",
        "number": "1234",
        "balance": 100.50,
        "currencyCode": "BRL",
    }
    data.update(overrides)
    return data


def _transaction_raw(**overrides):
    data = {
        "id": "tx-ext-1",
        "description": "Mercado",
        "amount": -50.25,
        "type": "DEBIT",
        "date": "2026-01-15T00:00:00.000Z",
        "status": "POSTED",
        "category": "Alimentação",
    }
    data.update(overrides)
    return data


def _investment_raw(**overrides):
    # Formato real confirmado no Bloco 1 (Sprint 20) contra o sandbox Pluggy.
    data = {
        "id": "inv-ext-1",
        "type": "FIXED_INCOME",
        "subtype": "CDB",
        "name": "CDB - NU FINANCEIRA",
        "code": None,
        "isin": None,
        "quantity": 1967409.5229,
        "amountOriginal": 19674.095229,
        "balance": 22762.07,
        "currencyCode": "BRL",
    }
    data.update(overrides)
    return data


def _investment_transaction_raw(**overrides):
    data = {
        "id": "invtx-ext-1",
        "type": "SELL",
        "description": None,
        "amount": 1398.87,
        "quantity": 109999.8270035,
        "date": "2026-02-22T00:00:00.000Z",
    }
    data.update(overrides)
    return data


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def other_user(db_session):
    user = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_register_item_creates_item_with_default_cutoff_date(db_session, user):
    client = FakePluggyClient(item=_item_raw())

    item = service.register_item(db_session, client, user.id, "item-ext-1")

    assert item.user_id == user.id
    assert item.connector_name == "Banco Fake"
    assert item.status.value == "updated"
    assert item.cutoff_date == date(2026, 1, 1)


def test_register_item_twice_does_not_duplicate(db_session, user):
    client = FakePluggyClient(item=_item_raw())

    first = service.register_item(db_session, client, user.id, "item-ext-1")
    second = service.register_item(db_session, client, user.id, "item-ext-1")

    assert first.id == second.id
    assert service.list_items(db_session, user.id) == [first]


def test_sync_item_creates_accounts_and_transactions(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        # Horário fixado ao meio-dia UTC — não cruza a virada de dia em BRT
        # (ver testes dedicados de fuso horário para o caso de fronteira).
        transactions_by_account={"acc-ext-1": [_transaction_raw(date="2026-01-15T12:00:00.000Z")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    synced = service.sync_item(db_session, client, user.id, item.id)

    assert synced.last_synced_at is not None
    accounts = service.list_accounts(db_session, user.id)
    assert len(accounts) == 1
    assert accounts[0].user_id == user.id
    assert accounts[0].tipo.value == "corrente"

    transactions = service.list_transactions(db_session, user.id)
    assert len(transactions) == 1
    assert transactions[0].user_id == user.id
    assert transactions[0].subcategory_id is None
    assert transactions[0].data_competencia == date(2026, 1, 15)
    assert transactions[0].valor == Decimal("-50.25")


def test_sync_item_persists_credit_data_for_credit_card(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[
            _account_raw(
                type="CREDIT",
                subtype="CREDIT_CARD",
                creditData={"creditLimit": 15300, "balanceDueDate": "2026-08-06"},
            )
        ],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    account = service.list_accounts(db_session, user.id)[0]
    assert account.limite_credito == Decimal("15300")
    assert account.fatura_vencimento == date(2026, 8, 6)


def test_sync_item_without_credit_data_leaves_credit_fields_none(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    account = service.list_accounts(db_session, user.id)[0]
    assert account.limite_credito is None
    assert account.fatura_vencimento is None


def test_sync_item_writes_data_competencia_equal_to_data_on_resync(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    service.sync_item(db_session, client, user.id, item.id)

    transactions = service.list_transactions(db_session, user.id)
    assert len(transactions) == 1
    assert transactions[0].data_competencia == transactions[0].data


def test_resync_does_not_discard_salario_competencia_shift_of_confirmed_transaction(
    db_session, user
):
    # Bug real encontrado em produção (Sprint 16, sessão de correção
    # 2026-08-17): resync sempre reescrevia data_competencia pro valor
    # padrão, mesmo em transação já confirmada com deslocamento de
    # competência (Salário) — apagava silenciosamente o ajuste do usuário a
    # cada re-sincronização.
    from app.categorization import service as categorization_service

    salario = _salario_subcategory(db_session)
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw(date="2026-07-30T12:00:00.000Z")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    tx = service.list_transactions(db_session, user.id)[0]
    confirmed = categorization_service.set_category(db_session, user.id, tx.id, salario.id)
    assert confirmed.data_competencia == date(2026, 8, 30)  # dia 30 >= cutoff padrão (25)

    service.sync_item(db_session, client, user.id, item.id)

    resynced = service.list_transactions(db_session, user.id)[0]
    assert resynced.data_competencia == date(2026, 8, 30)
    assert resynced.data_caixa == date(2026, 8, 30)


def test_resync_still_resets_data_competencia_of_pending_transaction(db_session, user):
    # Contraste com o teste acima: sem confirmação, o resync continua livre
    # pra corrigir data_competencia pro valor padrão (nenhum ajuste de
    # categoria a preservar).
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    tx = service.list_transactions(db_session, user.id)[0]
    tx.data_competencia = date(2099, 1, 1)  # simula um valor "estragado" a corrigir
    db_session.commit()

    service.sync_item(db_session, client, user.id, item.id)

    resynced = service.list_transactions(db_session, user.id)[0]
    assert resynced.data_competencia == resynced.data


def test_sync_item_twice_does_not_duplicate_accounts_or_transactions(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    service.sync_item(db_session, client, user.id, item.id)

    assert db_session.query(PluggyAccount).count() == 1
    assert db_session.query(PluggyTransaction).count() == 1


def test_sync_item_updates_transaction_status_from_pendente_to_efetivada(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw(status="PENDING")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    first = service.list_transactions(db_session, user.id)[0]
    assert first.status.value == "pendente"

    client.transactions_by_account["acc-ext-1"] = [_transaction_raw(status="POSTED")]
    service.sync_item(db_session, client, user.id, item.id)

    second = service.list_transactions(db_session, user.id)[0]
    assert second.id == first.id
    assert second.status.value == "efetivada"


def test_sync_item_excludes_transactions_before_cutoff_date(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={
            "acc-ext-1": [
                _transaction_raw(id="tx-before", date="2025-12-31T00:00:00.000Z"),
                _transaction_raw(id="tx-after", date="2026-01-15T00:00:00.000Z"),
            ]
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    transactions = service.list_transactions(db_session, user.id)
    assert [t.pluggy_transaction_id for t in transactions] == ["tx-after"]


@pytest.mark.parametrize("status", ["UPDATING", "LOGIN_ERROR", "ERROR", "WAITING_USER_INPUT"])
def test_sync_item_with_non_syncable_status_raises_and_writes_nothing(db_session, user, status):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    client.item = _item_raw(status=status)

    with pytest.raises(InvalidStateError):
        service.sync_item(db_session, client, user.id, item.id)

    assert db_session.query(PluggyAccount).count() == 0
    assert db_session.query(PluggyTransaction).count() == 0
    assert client.get_accounts_calls == 0


def test_sync_item_of_other_user_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw())
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    with pytest.raises(NotFoundError):
        service.sync_item(db_session, client, other_user.id, item.id)


@pytest.mark.parametrize(
    ("type_", "subtype", "expected"),
    [
        ("CREDIT", "CREDIT_CARD", "cartao_credito"),
        ("BANK", "SAVINGS_ACCOUNT", "poupanca"),
        ("BANK", "CHECKING_ACCOUNT", "corrente"),
        ("INVESTMENT", "INVESTMENT", "investimento"),
    ],
)
def test_sync_item_maps_account_tipo(db_session, user, type_, subtype, expected):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw(type=type_, subtype=subtype)],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    accounts = service.list_accounts(db_session, user.id)
    assert accounts[0].tipo.value == expected


def test_list_accounts_and_transactions_isolated_by_user(db_session, user, other_user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    assert service.list_accounts(db_session, other_user.id) == []
    assert service.list_transactions(db_session, other_user.id) == []
    assert len(service.list_accounts(db_session, user.id)) == 1
    assert len(service.list_transactions(db_session, user.id)) == 1


def test_list_transactions_filters_by_investimento_id(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investimento = Investimento(user_id=user.id, nome="Reserva de emergência")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)
    tx = service.list_transactions(db_session, user.id)[0]
    tx.investimento_id = investimento.id
    db_session.commit()

    linked = service.list_transactions(db_session, user.id, investimento_id=investimento.id)
    unrelated = service.list_transactions(db_session, user.id, investimento_id=999)

    assert [t.id for t in linked] == [tx.id]
    assert unrelated == []


# --- apelido / sync_enabled (Sprint 7) --------------------------------------


def test_apelido_preserved_across_resync(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(), accounts=[_account_raw()], transactions_by_account={}
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    account = service.list_accounts(db_session, user.id)[0]
    service.update_account(
        db_session, user.id, account.id, apelido="Conta do dia a dia", sync_enabled=True
    )

    client.accounts = [_account_raw(name="Nome atualizado pela Pluggy")]
    service.sync_item(db_session, client, user.id, item.id)

    reloaded = service.list_accounts(db_session, user.id)[0]
    assert reloaded.apelido == "Conta do dia a dia"
    assert reloaded.nome == "Nome atualizado pela Pluggy"


def test_sync_item_skips_account_with_sync_disabled(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    account = service.list_accounts(db_session, user.id)[0]
    service.update_account(db_session, user.id, account.id, apelido=None, sync_enabled=False)

    client.accounts = [_account_raw(balance=999.99)]
    client.transactions_by_account["acc-ext-1"] = [
        _transaction_raw(id="tx-ext-2", description="Nova transacao")
    ]
    service.sync_item(db_session, client, user.id, item.id)

    reloaded = service.list_accounts(db_session, user.id)[0]
    assert reloaded.saldo == Decimal("100.50")  # não atualizado
    assert len(service.list_transactions(db_session, user.id)) == 1  # nenhuma transação nova


def test_update_account_sets_apelido_and_sync_enabled(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]

    updated = service.update_account(
        db_session, user.id, account.id, apelido="Poupança conjunta", sync_enabled=False
    )

    assert updated.apelido == "Poupança conjunta"
    assert updated.sync_enabled is False


def test_update_account_links_investimento(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]
    investimento = Investimento(user_id=user.id, nome="Reserva de emergência")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)

    linked = service.update_account(
        db_session,
        user.id,
        account.id,
        apelido=None,
        sync_enabled=True,
        investimento_id=investimento.id,
    )
    assert linked.investimento_id == investimento.id

    unlinked = service.update_account(
        db_session, user.id, account.id, apelido=None, sync_enabled=True, investimento_id=None
    )
    assert unlinked.investimento_id is None


def test_update_account_other_users_investimento_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]
    other_investimento = Investimento(user_id=other_user.id, nome="Do outro")
    db_session.add(other_investimento)
    db_session.commit()
    db_session.refresh(other_investimento)

    with pytest.raises(NotFoundError):
        service.update_account(
            db_session,
            user.id,
            account.id,
            apelido=None,
            sync_enabled=True,
            investimento_id=other_investimento.id,
        )


def test_update_account_other_users_account_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]

    with pytest.raises(NotFoundError):
        service.update_account(
            db_session, other_user.id, account.id, apelido="X", sync_enabled=True
        )


# --- Sprint 22: excluir conta (Gestão de Contas) --------------------------


def test_delete_account_removes_account_and_transactions(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    client.transactions_by_account["acc-ext-1"] = [_transaction_raw()]
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]
    assert len(service.list_transactions(db_session, user.id)) == 1

    service.delete_account(db_session, user.id, account.id)

    assert service.list_accounts(db_session, user.id) == []
    assert service.list_transactions(db_session, user.id) == []


def test_delete_account_desassocia_descricao_sugestao_origem(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw(), _account_raw(id="acc-ext-2", name="Outra conta")],
        transactions_by_account={
            "acc-ext-1": [_transaction_raw(id="tx-origem", description="Mercado")],
            "acc-ext-2": [_transaction_raw(id="tx-dependente", description="Mercado 2")],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    accounts = service.list_accounts(db_session, user.id)
    tx_origem = (
        db_session.query(PluggyTransaction)
        .filter(PluggyTransaction.pluggy_transaction_id == "tx-origem")
        .one()
    )
    tx_dependente = (
        db_session.query(PluggyTransaction)
        .filter(PluggyTransaction.pluggy_transaction_id == "tx-dependente")
        .one()
    )
    account_a = next(a for a in accounts if a.id == tx_origem.account_id)
    tx_dependente.descricao_sugestao_origem_id = tx_origem.id
    db_session.commit()

    service.delete_account(db_session, user.id, account_a.id)

    db_session.refresh(tx_dependente)
    assert tx_dependente.descricao_sugestao_origem_id is None


def test_delete_account_never_touches_investment_holdings_of_same_item(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        investments=[_investment_raw()],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]
    assert len(service.list_investments(db_session, user.id)) == 1

    service.delete_account(db_session, user.id, account.id)

    assert len(service.list_investments(db_session, user.id)) == 1


def test_delete_account_other_user_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]

    with pytest.raises(NotFoundError):
        service.delete_account(db_session, other_user.id, account.id)


def test_delete_account_second_attempt_raises_not_found(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]

    service.delete_account(db_session, user.id, account.id)

    with pytest.raises(NotFoundError):
        service.delete_account(db_session, user.id, account.id)


def test_sync_items_syncs_all_items_when_none_specified(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(), accounts=[_account_raw()], transactions_by_account={"acc-ext-1": []}
    )
    item_a = service.register_item(db_session, client, user.id, "item-ext-1")
    client.item = _item_raw(id="item-ext-2")
    item_b = service.register_item(db_session, client, user.id, "item-ext-2")

    results = service.sync_items(db_session, client, user.id, None)

    assert {r.item_id for r in results} == {item_a.id, item_b.id}
    assert all(r.success for r in results)


def test_sync_items_reports_failure_per_item_without_blocking_others(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], transactions_by_account={})
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    results = service.sync_items(db_session, client, user.id, [item.id, 999])

    by_id = {r.item_id: r for r in results}
    assert by_id[item.id].success is True
    assert by_id[999].success is False


def test_sync_items_filter_does_not_bypass_sync_enabled_per_account(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]
    service.update_account(db_session, user.id, account.id, apelido=None, sync_enabled=False)

    client.accounts = [_account_raw(balance=999.99)]
    service.sync_items(db_session, client, user.id, [item.id])

    reloaded = service.list_accounts(db_session, user.id)[0]
    assert reloaded.saldo == Decimal("100.50")


def _synced_account(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    return service.list_accounts(db_session, user.id)[0]


def _salario_subcategory(db_session):
    group = CategoryGroup(nome="Receitas")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome="Salário")
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


# --- update_saldo_inicial ----------------------------------------------------


def test_update_saldo_inicial_sets_value(db_session, user):
    account = _synced_account(db_session, user)

    updated = service.update_saldo_inicial(
        db_session, user.id, account.id, saldo_inicial=Decimal("1500.00")
    )

    assert updated.saldo_inicial == Decimal("1500.00")


def test_update_saldo_inicial_can_clear_value(db_session, user):
    account = _synced_account(db_session, user)
    service.update_saldo_inicial(db_session, user.id, account.id, saldo_inicial=Decimal("1500.00"))

    cleared = service.update_saldo_inicial(db_session, user.id, account.id, saldo_inicial=None)

    assert cleared.saldo_inicial is None


def test_update_saldo_inicial_other_users_account_raises_not_found(db_session, user, other_user):
    account = _synced_account(db_session, user)

    with pytest.raises(NotFoundError):
        service.update_saldo_inicial(
            db_session, other_user.id, account.id, saldo_inicial=Decimal("100.00")
        )


# --- upsert_salario_ajuste_dez_2025 ------------------------------------------


def test_upsert_salario_ajuste_creates_confirmed_transaction_with_competencia(db_session, user):
    _salario_subcategory(db_session)
    account = _synced_account(db_session, user)

    tx = service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 30),
        valor=Decimal("5000.00"),
        cutoff_dia=25,
    )

    assert tx is not None
    assert tx.valor == Decimal("5000.00")
    assert tx.data == date(2025, 12, 30)
    assert tx.data_competencia == date(2026, 1, 30)
    assert tx.categorizacao_status.value == "confirmada"
    assert tx.subcategory_id == salario_subcategory_id(db_session)
    assert tx.tipo.value == "credito"
    assert tx.data_caixa == tx.data_competencia


def test_upsert_salario_ajuste_called_twice_updates_instead_of_duplicating(db_session, user):
    _salario_subcategory(db_session)
    account = _synced_account(db_session, user)
    service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 30),
        valor=Decimal("5000.00"),
        cutoff_dia=25,
    )

    updated = service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 28),
        valor=Decimal("5200.00"),
        cutoff_dia=25,
    )

    assert db_session.query(PluggyTransaction).count() == 1
    assert updated.valor == Decimal("5200.00")
    assert updated.data == date(2025, 12, 28)


def test_upsert_salario_ajuste_valor_none_deletes_existing_row(db_session, user):
    _salario_subcategory(db_session)
    account = _synced_account(db_session, user)
    service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 30),
        valor=Decimal("5000.00"),
        cutoff_dia=25,
    )

    result = service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 30),
        valor=None,
        cutoff_dia=25,
    )

    assert result is None
    assert db_session.query(PluggyTransaction).count() == 0


def test_upsert_salario_ajuste_valor_none_without_existing_row_is_noop(db_session, user):
    account = _synced_account(db_session, user)

    result = service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 30),
        valor=None,
        cutoff_dia=25,
    )

    assert result is None
    assert db_session.query(PluggyTransaction).count() == 0


def test_upsert_salario_ajuste_isolated_by_user(db_session, user, other_user):
    _salario_subcategory(db_session)
    account_user = _synced_account(db_session, user)

    with pytest.raises(NotFoundError):
        service.upsert_salario_ajuste_dez_2025(
            db_session,
            other_user.id,
            account_id=account_user.id,
            data=date(2025, 12, 30),
            valor=Decimal("5000.00"),
            cutoff_dia=25,
        )


def test_get_salario_ajuste_dez_2025_returns_none_when_absent(db_session, user):
    assert service.get_salario_ajuste_dez_2025(db_session, user.id) is None


# --- bug de fuso horário em _parse_date (Sprint 16) -------------------------


def test_parse_date_converts_utc_timestamp_near_midnight_brt_to_previous_day():
    # Caso de verificação do PRD-016: "BRASA E DRINKS", date bruto
    # 2026-01-23T01:34:27Z (22:34:27 em 22/01 no horário de Brasília, UTC-3).
    assert service._parse_date("2026-01-23T01:34:27.000Z") == date(2026, 1, 22)


def test_parse_date_utc_timestamp_well_after_midnight_brt_stays_same_day():
    # 2026-01-23T15:00:00Z = 12:00 em 23/01 no horário de Brasília — não
    # cruza a virada de dia.
    assert service._parse_date("2026-01-23T15:00:00.000Z") == date(2026, 1, 23)


def test_parse_date_utc_timestamp_at_brt_midnight_boundary_stays_same_day():
    # 2026-01-23T03:00:00Z = 00:00 em 23/01 no horário de Brasília — fronteira
    # exata, não deve retroceder.
    assert service._parse_date("2026-01-23T03:00:00.000Z") == date(2026, 1, 23)


# --- competência de cartão de crédito no sync (Sprint 16) -------------------


def test_sync_item_credit_card_shifts_data_competencia_to_next_month(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw(type="CREDIT", subtype="CREDIT_CARD")],
        transactions_by_account={"acc-ext-1": [_transaction_raw(date="2026-01-15T12:00:00.000Z")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    tx = service.list_transactions(db_session, user.id)[0]
    assert tx.data == date(2026, 1, 15)
    assert tx.data_competencia == date(2026, 2, 15)
    assert tx.data_caixa == date(2026, 3, 15)


def test_sync_item_non_credit_card_keeps_data_caixa_equal_to_data_competencia(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    tx = service.list_transactions(db_session, user.id)[0]
    assert tx.data_competencia == tx.data
    assert tx.data_caixa == tx.data_competencia


# --- data_editada_manualmente sobrevive a resync (Sprint 18) ----------------


def test_resync_preserves_manually_edited_date_on_corrente_account(db_session, user):
    from app.categorization import service as categorization_service

    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw(date="2026-01-15T12:00:00.000Z")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    tx = service.list_transactions(db_session, user.id)[0]
    edited = categorization_service.update_data(db_session, user.id, tx.id, date(2026, 1, 13))
    assert edited.data == date(2026, 1, 13)
    assert edited.data_editada_manualmente is True

    # resync traz um valor bruto diferente (ex.: banco reenvia o payload) —
    # não deve sobrescrever a data editada manualmente.
    client.transactions_by_account["acc-ext-1"] = [
        _transaction_raw(date="2026-01-17T12:00:00.000Z")
    ]
    service.sync_item(db_session, client, user.id, item.id)

    resynced = service.list_transactions(db_session, user.id)[0]
    assert resynced.data == date(2026, 1, 13)
    assert resynced.data_competencia == date(2026, 1, 13)
    assert resynced.data_caixa == date(2026, 1, 13)


def test_resync_preserves_manually_edited_date_on_credit_card_account(db_session, user):
    from app.categorization import service as categorization_service

    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw(type="CREDIT", subtype="CREDIT_CARD")],
        transactions_by_account={"acc-ext-1": [_transaction_raw(date="2026-01-15T12:00:00.000Z")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    tx = service.list_transactions(db_session, user.id)[0]
    edited = categorization_service.update_data(db_session, user.id, tx.id, date(2026, 1, 13))
    assert edited.data == date(2026, 1, 13)
    assert edited.data_competencia == date(2026, 2, 13)
    assert edited.data_caixa == date(2026, 3, 13)

    # cartão desloca incondicionalmente no resync — a trava precisa segurar
    # os 3 campos, não só `data`.
    client.transactions_by_account["acc-ext-1"] = [
        _transaction_raw(date="2026-01-17T12:00:00.000Z")
    ]
    service.sync_item(db_session, client, user.id, item.id)

    resynced = service.list_transactions(db_session, user.id)[0]
    assert resynced.data == date(2026, 1, 13)
    assert resynced.data_competencia == date(2026, 2, 13)
    assert resynced.data_caixa == date(2026, 3, 13)


def test_resync_still_overwrites_date_of_non_manually_edited_transaction(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw(date="2026-01-15T12:00:00.000Z")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    client.transactions_by_account["acc-ext-1"] = [
        _transaction_raw(date="2026-01-17T12:00:00.000Z")
    ]
    service.sync_item(db_session, client, user.id, item.id)

    resynced = service.list_transactions(db_session, user.id)[0]
    assert resynced.data == date(2026, 1, 17)
    assert resynced.data_editada_manualmente is False


# --- regressão: sentinela de salário flui por get_summary/get_tendencia/    -
# --- get_por_categoria sem nenhum código especial nessas três funções -------


def test_salario_ajuste_flows_through_dashboards_aggregations_without_special_case(
    db_session, user
):
    from app.models.pluggy import PluggyTransactionTipo

    salario = _salario_subcategory(db_session)
    account = _synced_account(db_session, user)

    tx = service.upsert_salario_ajuste_dez_2025(
        db_session,
        user.id,
        account_id=account.id,
        data=date(2025, 12, 30),
        valor=Decimal("5000.00"),
        cutoff_dia=25,
    )
    assert tx.data_competencia == date(2026, 1, 30)

    summary = dashboards_service.get_summary(db_session, user.id, ano=2026, mes=1)
    tendencia = dashboards_service.get_tendencia(db_session, user.id, ano=2026, mes=1, meses=1)
    por_categoria = dashboards_service.get_por_categoria(
        db_session, user.id, tipo=PluggyTransactionTipo.credito, ano=2026, mes=1
    )

    assert summary.receita == Decimal("5000.00")
    assert tendencia[0].receita == Decimal("5000.00")
    salario_bucket = next(c for c in por_categoria if c.subcategory_id == salario.id)
    assert salario_bucket.total == Decimal("5000.00")


# --- Investments da Pluggy (Sprint 20) ---------------------------------------


def test_sync_item_creates_investments_and_investment_transactions(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw()],
        investment_transactions_by_investment={
            "inv-ext-1": [_investment_transaction_raw()],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    investments = service.list_investments(db_session, user.id)
    assert len(investments) == 1
    investment = investments[0]
    assert investment.user_id == user.id
    assert investment.item_id == item.id
    assert investment.tipo == "FIXED_INCOME"
    assert investment.subtipo == "CDB"
    assert investment.quantidade == Decimal("1967409.5229")
    assert investment.valor_atual == Decimal("22762.07")

    transactions = service.list_investment_transactions(db_session, user.id, investment.id)
    assert len(transactions) == 1
    assert transactions[0].tipo == "SELL"
    assert transactions[0].valor == Decimal("1398.87")
    assert transactions[0].data == date(2026, 2, 22)


def test_sync_item_creates_investments_for_item_without_any_account(db_session, user):
    # Achado real do Bloco 1 (Sprint 20): "Nubank Investimentos" sincroniza
    # sem erro mas GET /accounts retorna zero contas — holdings não dependem
    # de nenhuma PluggyAccount existir.
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    assert service.list_accounts(db_session, user.id) == []
    assert len(service.list_investments(db_session, user.id)) == 1


def test_sync_item_twice_does_not_duplicate_investments_or_transactions(db_session, user):
    from app.models.pluggy import PluggyInvestment, PluggyInvestmentTransaction

    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw()],
        investment_transactions_by_investment={
            "inv-ext-1": [_investment_transaction_raw()],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    service.sync_item(db_session, client, user.id, item.id)

    assert db_session.query(PluggyInvestment).count() == 1
    assert db_session.query(PluggyInvestmentTransaction).count() == 1


def test_resync_updates_investment_valor_atual_from_pluggy(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    client.investments = [_investment_raw(balance=30000.00)]
    service.sync_item(db_session, client, user.id, item.id)

    investment = service.list_investments(db_session, user.id)[0]
    assert investment.valor_atual == Decimal("30000.00")


def test_resync_preserves_investimento_link_and_saldo_inicial(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]

    investimento = Investimento(user_id=user.id, nome="Reserva")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)
    service.update_investment(db_session, user.id, investment.id, investimento_id=investimento.id)
    service.update_investment_saldo_inicial(
        db_session, user.id, investment.id, saldo_inicial=Decimal("20000.00")
    )

    client.investments = [_investment_raw(balance=30000.00)]
    service.sync_item(db_session, client, user.id, item.id)

    reloaded = service.list_investments(db_session, user.id)[0]
    assert reloaded.investimento_id == investimento.id
    assert reloaded.saldo_inicial == Decimal("20000.00")
    assert reloaded.valor_atual == Decimal("30000.00")


def test_list_investments_isolated_by_user(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    assert service.list_investments(db_session, other_user.id) == []
    assert len(service.list_investments(db_session, user.id)) == 1


def test_list_investments_filters_by_investimento_id(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw(id="inv-1"), _investment_raw(id="inv-2")],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investimento = Investimento(user_id=user.id, nome="Reserva")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)
    investments = service.list_investments(db_session, user.id)
    service.update_investment(
        db_session, user.id, investments[0].id, investimento_id=investimento.id
    )

    linked = service.list_investments(db_session, user.id, investimento_id=investimento.id)

    assert [i.id for i in linked] == [investments[0].id]


def test_update_investment_links_and_unlinks(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    investimento = Investimento(user_id=user.id, nome="Reserva")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)

    linked = service.update_investment(
        db_session, user.id, investment.id, investimento_id=investimento.id
    )
    assert linked.investimento_id == investimento.id

    unlinked = service.update_investment(db_session, user.id, investment.id, investimento_id=None)
    assert unlinked.investimento_id is None


def test_update_investment_other_users_investimento_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    other_investimento = Investimento(user_id=other_user.id, nome="Do outro")
    db_session.add(other_investimento)
    db_session.commit()
    db_session.refresh(other_investimento)

    with pytest.raises(NotFoundError):
        service.update_investment(
            db_session, user.id, investment.id, investimento_id=other_investimento.id
        )


def test_update_investment_other_users_investment_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]

    with pytest.raises(NotFoundError):
        service.update_investment(db_session, other_user.id, investment.id, investimento_id=None)


def test_update_investment_saldo_inicial_sets_and_clears_value(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]

    updated = service.update_investment_saldo_inicial(
        db_session, user.id, investment.id, saldo_inicial=Decimal("1000.00")
    )
    assert updated.saldo_inicial == Decimal("1000.00")

    cleared = service.update_investment_saldo_inicial(
        db_session, user.id, investment.id, saldo_inicial=None
    )
    assert cleared.saldo_inicial is None


def test_list_investment_transactions_isolated_by_user(db_session, user, other_user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw()],
        investment_transactions_by_investment={
            "inv-ext-1": [_investment_transaction_raw()],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]

    with pytest.raises(NotFoundError):
        service.list_investment_transactions(db_session, other_user.id, investment.id)


# --- Sprint 21: sugestão holding->Investimento ---------------------------


def test_sync_item_applies_codigo_exato_suggestion_for_unlinked_holding(db_session, user):
    investimento = Investimento(user_id=user.id, nome="Ações XP")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)

    client = FakePluggyClient(
        item=_item_raw(), accounts=[], investments=[_investment_raw(code="HAPV3", isin="BR123")]
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    linked = service.list_investments(db_session, user.id)[0]
    service.update_investment(db_session, user.id, linked.id, investimento_id=investimento.id)

    client2 = FakePluggyClient(
        item=_item_raw(id="item-ext-2"),
        accounts=[],
        investments=[_investment_raw(id="inv-ext-2", code="HAPV3", isin="BR123")],
    )
    item2 = service.register_item(db_session, client2, user.id, "item-ext-2")
    service.sync_item(db_session, client2, user.id, item2.id)

    novo = next(i for i in service.list_investments(db_session, user.id) if i.id != linked.id)
    assert novo.investimento_id is None
    assert novo.investimento_sugerido_id == investimento.id
    assert novo.investimento_sugestao_confianca == "alta"
    assert novo.investimento_sugestao_fonte_tipo == "codigo_exato"


def test_sync_item_never_overwrites_manually_linked_holding(db_session, user):
    investimento_manual = Investimento(user_id=user.id, nome="Manual")
    db_session.add(investimento_manual)
    db_session.commit()
    db_session.refresh(investimento_manual)

    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.update_investment(
        db_session, user.id, investment.id, investimento_id=investimento_manual.id
    )

    # Novo sync — mesmo que exista uma holding parecida por nome, o vínculo
    # manual não pode ser sobrescrito nem a sugestão recalculada.
    outro_investimento = Investimento(user_id=user.id, nome="CDB - NU FINANCEIRA")
    db_session.add(outro_investimento)
    db_session.commit()
    service.sync_item(db_session, client, user.id, item.id)

    db_session.refresh(investment)
    assert investment.investimento_id == investimento_manual.id
    assert investment.investimento_sugerido_id is None


def test_sync_item_no_match_leaves_suggestion_fields_none(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(), accounts=[], investments=[_investment_raw(name="Sem nada parecido")]
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    investment = service.list_investments(db_session, user.id)[0]
    assert investment.investimento_sugerido_id is None
    assert investment.investimento_sugestao_confianca is None


# --- Sprint 21: baseline dez/2025 -----------------------------------------


def test_propose_baseline_purchase_after_baseline_date_is_zero_alta(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw(purchaseDate="2026-01-19T03:00:00.000Z")],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    proposal = service.propose_baseline_dez_2025(db_session, client, user.id)

    assert len(proposal) == 1
    assert proposal[0].saldo_inicial_proposto == Decimal("0")
    assert proposal[0].confianca == "alta"


def test_propose_baseline_fixed_rate_uses_compound_interest(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[
            _investment_raw(
                purchaseDate="2025-01-01T03:00:00.000Z",
                rateType=None,
                fixedAnnualRate=10.0,
                amountOriginal=1000.0,
                balance=1099.73,
            )
        ],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    proposal = service.propose_baseline_dez_2025(db_session, client, user.id)

    line = proposal[0]
    assert line.confianca == "alta"
    assert Decimal("1090") < line.saldo_inicial_proposto < Decimal("1100")


def test_propose_baseline_cdi_indexed_falls_back_to_reverse_flow(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[
            _investment_raw(
                purchaseDate="2025-05-12T03:00:00.000Z", rateType="CDI", balance=22762.07
            )
        ],
        investment_transactions_by_investment={
            "inv-ext-1": [
                _investment_transaction_raw(
                    id="tx1", type="BUY", amount=5000.00, date="2026-03-01T00:00:00.000Z"
                )
            ],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    proposal = service.propose_baseline_dez_2025(db_session, client, user.id)

    line = proposal[0]
    assert line.confianca == "estimada"
    assert line.saldo_inicial_proposto == Decimal("22762.07") - Decimal("5000.00")


def test_propose_baseline_ignores_buy_transaction_before_cutoff(db_session, user):
    """Achado real do Bloco 0 da Sprint 22: uma BUY registrada *antes* do
    corte (a compra original da posição, não um aporte novo) não pode ser
    subtraída do saldo atual — senão o baseline reverso subestima o capital
    que já existia em 31/12/2025 (bug real: 3 holdings de "Quitar o AP"
    ficaram ~R$22k abaixo do correto por causa disso)."""
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[
            _investment_raw(
                purchaseDate="2025-10-06T03:00:00.000Z", rateType="CDI", balance=5496.86
            )
        ],
        investment_transactions_by_investment={
            "inv-ext-1": [
                _investment_transaction_raw(
                    id="tx1", type="BUY", amount=5000.00, date="2025-10-06T00:00:00.000Z"
                )
            ],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    proposal = service.propose_baseline_dez_2025(db_session, client, user.id)

    line = proposal[0]
    assert line.confianca == "estimada"
    # Sem o fix, isso daria 5496.86 - 5000.00 = 496.86 (bug real observado).
    assert line.saldo_inicial_proposto == Decimal("5496.86")


def test_confirm_baseline_persists_saldo_inicial(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]

    updated = service.confirm_baseline_dez_2025(
        db_session, user.id, [(investment.id, Decimal("20000.00"))]
    )

    assert updated[0].saldo_inicial == Decimal("20000.00")


def test_confirm_baseline_other_user_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]

    with pytest.raises(NotFoundError):
        service.confirm_baseline_dez_2025(
            db_session, other_user.id, [(investment.id, Decimal("1.00"))]
        )


# --- Sprint 21: série histórica mensal ------------------------------------


def test_reconstruct_historical_snapshots_accumulates_flow_per_month(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw(balance=5800.00)],
        investment_transactions_by_investment={
            "inv-ext-1": [
                _investment_transaction_raw(
                    id="tx1", type="BUY", amount=1000.00, date="2026-02-10T00:00:00.000Z"
                ),
                _investment_transaction_raw(
                    id="tx2", type="SELL", amount=200.00, date="2026-03-05T00:00:00.000Z"
                ),
            ],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("5000.00"))])

    snapshots = service.reconstruct_historical_snapshots(db_session, user.id)

    jan = next(s for s in snapshots if s.ano_mes == "2026-01")
    assert jan.saldo == Decimal("5000.00")
    assert jan.confianca == "reconstruido"
    fev = next(s for s in snapshots if s.ano_mes == "2026-02")
    assert fev.saldo == Decimal("6000.00")
    assert fev.aportes == Decimal("1000.00")
    mar = next(s for s in snapshots if s.ano_mes == "2026-03")
    assert mar.saldo == Decimal("5800.00")
    assert mar.resgates == Decimal("200.00")


def test_reconstruct_historical_snapshots_skips_holdings_without_baseline(db_session, user):
    client = FakePluggyClient(item=_item_raw(), accounts=[], investments=[_investment_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    assert service.reconstruct_historical_snapshots(db_session, user.id) == []


# --- Sprint 22: redistribuição pró-rata do rendimento reconstruído --------


def test_reconstruct_historical_snapshots_distributes_growth_instead_of_dumping(db_session, user):
    """Achado real da Sprint 22: baseline 5000, valor atual hoje 5674 (sem
    nenhum aporte/resgate registrado) — resíduo de 674 tem que ficar
    espalhado pelos meses reconstruídos + mês corrente, nunca concentrado
    inteiro num único mês (o bug que gerou o pico de R$22k em "Quitar o AP")."""
    client = FakePluggyClient(
        item=_item_raw(), accounts=[], investments=[_investment_raw(balance=5674.00)]
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("5000.00"))])
    db_session.refresh(investment)

    snapshots = service.reconstruct_historical_snapshots(db_session, user.id)
    db_session.refresh(investment)
    atual = service.snapshot_current_month(db_session, investment)
    db_session.commit()

    residual_total = Decimal("674.00")
    soma_reconstruido = sum((s.rendimento for s in snapshots), Decimal("0"))
    assert soma_reconstruido + atual.rendimento == residual_total
    # Nenhum mês isolado carrega o resíduo inteiro — prova de que foi
    # espalhado, não dumped num só (nem no mês corrente, nem num reconstruído).
    assert atual.rendimento < residual_total
    for snap in snapshots:
        assert snap.rendimento < residual_total
        assert snap.rendimento > Decimal("0")


def test_reconstruct_historical_snapshots_idempotent(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(), accounts=[], investments=[_investment_raw(balance=5674.00)]
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("5000.00"))])
    db_session.refresh(investment)

    snaps1 = service.reconstruct_historical_snapshots(db_session, user.id)
    primeira = {s.ano_mes: (s.saldo, s.rendimento) for s in snaps1}
    snaps2 = service.reconstruct_historical_snapshots(db_session, user.id)
    segunda = {s.ano_mes: (s.saldo, s.rendimento) for s in snaps2}

    assert primeira == segunda


def test_reconstruct_historical_snapshots_zero_weight_before_purchase(db_session, user):
    """Holding comprada em 30/04/2026 (depois do baseline, saldo_inicial=0) —
    meses de jan a mar/2026 não podem receber nenhuma fatia do crescimento:
    a posição simplesmente não existia ainda."""
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw(balance=13802.53)],
        investment_transactions_by_investment={
            "inv-ext-1": [
                _investment_transaction_raw(
                    id="tx1", type="BUY", amount=13383.41, date="2026-04-30T00:00:00.000Z"
                ),
            ],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("0.00"))])
    db_session.refresh(investment)

    snapshots = service.reconstruct_historical_snapshots(db_session, user.id)

    for ano_mes in ("2026-01", "2026-02", "2026-03"):
        snap = next(s for s in snapshots if s.ano_mes == ano_mes)
        assert snap.saldo == Decimal("0")
        assert snap.rendimento == Decimal("0")


def test_reconstruct_historical_snapshots_ignores_buy_transaction_before_baseline(db_session, user):
    """Achado real do Bloco 0 da Sprint 22 (mesma classe de bug de
    _net_aportes_desde_cutoff, desta vez no cálculo do resíduo total da
    própria reconstrução): a compra original de uma holding pré-existente ao
    baseline (dated antes de 31/12/2025) não pode ser contada como "aporte"
    no cálculo do crescimento observado — ela já está embutida em
    saldo_inicial. Sem o fix, um resíduo fantasma de -5000 aparecia
    concentrado no mês corrente mesmo com baseline == valor atual (nenhum
    crescimento real a distribuir)."""
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[_investment_raw(balance=5496.86)],
        investment_transactions_by_investment={
            "inv-ext-1": [
                _investment_transaction_raw(
                    id="tx1", type="BUY", amount=5000.00, date="2025-10-06T00:00:00.000Z"
                ),
            ],
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("5496.86"))])
    db_session.refresh(investment)

    snapshots = service.reconstruct_historical_snapshots(db_session, user.id)
    for snap in snapshots:
        assert snap.rendimento == Decimal("0")
        assert snap.saldo == Decimal("5496.86")

    db_session.refresh(investment)
    atual = service.snapshot_current_month(db_session, investment)
    assert atual.rendimento == Decimal("0")


def test_snapshot_current_month_is_idempotent(db_session, user):
    from app.models.pluggy import PluggyInvestmentSnapshot

    client = FakePluggyClient(
        item=_item_raw(), accounts=[], investments=[_investment_raw(balance=6000.00)]
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("5000.00"))])
    db_session.refresh(investment)

    service.snapshot_current_month(db_session, investment)
    db_session.commit()
    service.snapshot_current_month(db_session, investment)
    db_session.commit()

    hoje = date.today()
    ano_mes = f"{hoje.year:04d}-{hoje.month:02d}"
    rows = (
        db_session.query(PluggyInvestmentSnapshot)
        .filter(
            PluggyInvestmentSnapshot.investment_id == investment.id,
            PluggyInvestmentSnapshot.ano_mes == ano_mes,
        )
        .all()
    )
    assert len(rows) == 1
    assert rows[0].confianca == "real"


def test_snapshot_current_month_fixed_income_residual_is_rendimento(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(), accounts=[], investments=[_investment_raw(balance=5500.00)]
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("5000.00"))])
    db_session.refresh(investment)

    snapshot = service.snapshot_current_month(db_session, investment)

    assert snapshot.rendimento == Decimal("500.00")
    assert snapshot.valorizacao == Decimal("0")
    assert snapshot.dividendos is None


def test_snapshot_current_month_equity_residual_is_valorizacao(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[],
        investments=[
            _investment_raw(
                type="EQUITY", subtype="STOCK", code="HAPV3", isin="BR123", balance=120.00
            )
        ],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    investment = service.list_investments(db_session, user.id)[0]
    service.confirm_baseline_dez_2025(db_session, user.id, [(investment.id, Decimal("100.00"))])
    db_session.refresh(investment)

    snapshot = service.snapshot_current_month(db_session, investment)

    assert snapshot.valorizacao == Decimal("20.00")
    assert snapshot.rendimento == Decimal("0")
    assert snapshot.dividendos == Decimal("0")
