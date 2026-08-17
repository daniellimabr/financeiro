from datetime import date
from decimal import Decimal

import pytest

from app.categorization.service import salario_subcategory_id
from app.dashboards import service as dashboards_service
from app.exceptions import InvalidStateError, NotFoundError
from app.models.category import CategoryGroup, Subcategory
from app.models.pluggy import PluggyAccount, PluggyTransaction
from app.models.user import User
from app.pluggy_integration import service


class FakePluggyClient:
    def __init__(self, *, item, accounts=None, transactions_by_account=None):
        self.item = item
        self.accounts = accounts or []
        self.transactions_by_account = transactions_by_account or {}
        self.get_accounts_calls = 0

    def get_item(self, pluggy_item_id):
        return self.item

    def get_accounts(self, pluggy_item_id):
        self.get_accounts_calls += 1
        return self.accounts

    def get_transactions(self, pluggy_account_id, *, from_date=None):
        return self.transactions_by_account.get(pluggy_account_id, [])

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


def test_update_account_other_users_account_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw(), accounts=[_account_raw()])
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)
    account = service.list_accounts(db_session, user.id)[0]

    with pytest.raises(NotFoundError):
        service.update_account(
            db_session, other_user.id, account.id, apelido="X", sync_enabled=True
        )


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
