from datetime import date
from decimal import Decimal

from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.asset import Asset, AssetTipo
from app.models.category import CategoryGroup, Subcategory
from app.models.liability import Liability, LiabilityTipo
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def _subcategory(db_session, nome="Comer fora"):
    group = CategoryGroup(nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome=nome)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def _transaction(
    db_session,
    user,
    descricao="Mercado Sao Joao",
    *,
    tipo=PluggyTransactionTipo.debito,
    status_categorizacao=PluggyTransactionCategorizacaoStatus.pendente,
    subcategory_id=None,
):
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{user.id}-{descricao}",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    account = PluggyAccount(
        item_id=item.id,
        user_id=user.id,
        pluggy_account_id=f"acc-{user.id}-{descricao}",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{user.id}-{descricao}",
        descricao=descricao,
        valor=Decimal("-10.00"),
        tipo=tipo,
        data=date(2026, 1, 15),
        status=PluggyTransactionStatus.efetivada,
        categorizacao_status=status_categorizacao,
        subcategory_id=subcategory_id,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def _pending_transaction(db_session, user, descricao="Mercado Sao Joao"):
    return _transaction(db_session, user, descricao)


def _confirmed_transaction(db_session, user, subcategory, descricao):
    return _transaction(
        db_session,
        user,
        descricao,
        status_categorizacao=PluggyTransactionCategorizacaoStatus.confirmada,
        subcategory_id=subcategory.id,
    )


# --- 401 sem cookie ----------------------------------------------------


def test_list_transactions_without_cookie_returns_401(client):
    assert client.get("/categorization/transactions").status_code == 401


def test_set_category_without_cookie_returns_401(client):
    response = client.put("/categorization/transactions/1/category", json={"subcategory_id": 1})
    assert response.status_code == 401


def test_bulk_confirm_without_cookie_returns_401(client):
    response = client.post(
        "/categorization/transactions/bulk-confirm",
        json={"items": [{"transaction_id": 1, "subcategory_id": 1}]},
    )
    assert response.status_code == 401


def test_set_asset_without_cookie_returns_401(client):
    response = client.put("/categorization/transactions/1/asset", json={"asset_id": None})
    assert response.status_code == 401


def test_update_description_without_cookie_returns_401(client):
    response = client.put("/categorization/transactions/1/description", json={"descricao": "Nova"})
    assert response.status_code == 401


def test_confirm_description_suggestion_without_cookie_returns_401(client):
    response = client.post("/categorization/transactions/1/description/confirm")
    assert response.status_code == 401


def test_dismiss_description_suggestion_without_cookie_returns_401(client):
    response = client.post("/categorization/transactions/1/description/dismiss")
    assert response.status_code == 401


# --- listagem/filtros -----------------------------------------------------


def test_list_transactions_default_status_returns_pending_and_confirmed(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    _pending_transaction(db_session, user, "Pendente")
    _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    response = client.get("/categorization/transactions")

    assert response.status_code == 200
    assert response.json()["total"] == 2


def test_list_transactions_status_pendente(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    tx = _pending_transaction(db_session, user, "Pendente")
    _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    response = client.get("/categorization/transactions", params={"status": "pendente"})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == tx.id


def test_list_transactions_status_confirmada(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    _pending_transaction(db_session, user, "Pendente")
    tx_confirmada = _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    response = client.get("/categorization/transactions", params={"status": "confirmada"})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == tx_confirmada.id


def test_list_transactions_status_todas(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    _pending_transaction(db_session, user, "Pendente")
    _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    response = client.get("/categorization/transactions", params={"status": "todas"})

    assert response.json()["total"] == 2


def test_list_transactions_filters_by_tipo(client, db_session):
    user = _authenticate(client, db_session)
    tx_debito = _transaction(db_session, user, "Debito", tipo=PluggyTransactionTipo.debito)
    _transaction(db_session, user, "Credito", tipo=PluggyTransactionTipo.credito)

    response = client.get("/categorization/transactions", params={"tipo": "debito"})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == tx_debito.id


def test_list_transactions_filters_by_ano_mes(client, db_session):
    user = _authenticate(client, db_session)
    tx_jan = _pending_transaction(db_session, user, "Compra janeiro")
    tx_jan.data = date(2026, 1, 10)
    tx_fev = _pending_transaction(db_session, user, "Compra fevereiro")
    tx_fev.data = date(2026, 2, 10)
    db_session.commit()

    response = client.get("/categorization/transactions", params={"ano": 2026, "mes": 1})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [item["id"] for item in body["items"]] == [tx_jan.id]


def test_list_transactions_paginates(client, db_session):
    user = _authenticate(client, db_session)
    for i in range(5):
        _pending_transaction(db_session, user, f"Pendente {i}")

    first_page = client.get(
        "/categorization/transactions", params={"page": 1, "page_size": 2}
    ).json()
    second_page = client.get(
        "/categorization/transactions", params={"page": 2, "page_size": 2}
    ).json()

    assert first_page["total"] == 5
    assert second_page["total"] == 5
    assert len(first_page["items"]) == 2
    assert len(second_page["items"]) == 2


def test_list_transactions_filters_by_has_asset(client, db_session):
    user = _authenticate(client, db_session)
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    tx_com_asset = _pending_transaction(db_session, user, "Com ativo")
    tx_com_asset.asset_id = asset.id
    _pending_transaction(db_session, user, "Sem ativo")
    db_session.commit()

    response = client.get("/categorization/transactions", params={"has_asset": True})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == tx_com_asset.id


def test_list_transactions_filters_by_group_id(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session, nome="Comer fora")
    other_subcategory = _subcategory(db_session, nome="Supermercado")
    tx_grupo = _confirmed_transaction(db_session, user, subcategory, "Grupo alvo")
    _confirmed_transaction(db_session, user, other_subcategory, "Outro grupo")

    response = client.get(
        "/categorization/transactions",
        params={"status": "todas", "group_id": subcategory.group_id},
    )

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == tx_grupo.id


def test_list_transactions_filters_by_account_id(client, db_session):
    user = _authenticate(client, db_session)
    tx_conta_alvo = _pending_transaction(db_session, user, "Conta alvo")
    _pending_transaction(db_session, user, "Outra conta")

    response = client.get(
        "/categorization/transactions",
        params={"account_id": tx_conta_alvo.account_id},
    )

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == tx_conta_alvo.id


def test_list_transactions_account_id_does_not_leak_other_users_transactions(client, db_session):
    user = _authenticate(client, db_session)
    other_user = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)
    tx_other = _pending_transaction(db_session, other_user, "Conta do outro usuario")
    del user

    response = client.get(
        "/categorization/transactions",
        params={"account_id": tx_other.account_id},
    )

    assert response.json()["items"] == []


def test_user_a_does_not_see_or_act_on_user_bs_transactions(client, db_session):
    user_a = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    tx_b_owner = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(tx_b_owner)
    db_session.commit()
    db_session.refresh(tx_b_owner)
    tx_b = _pending_transaction(db_session, tx_b_owner)
    subcategory = _subcategory(db_session)
    del user_a

    list_response = client.get("/categorization/transactions")
    assert list_response.json()["items"] == []

    category_response = client.put(
        f"/categorization/transactions/{tx_b.id}/category",
        json={"subcategory_id": subcategory.id},
    )
    assert category_response.status_code == 404

    asset_response = client.put(
        f"/categorization/transactions/{tx_b.id}/asset", json={"asset_id": None}
    )
    assert asset_response.status_code == 404

    liability_response = client.put(
        f"/categorization/transactions/{tx_b.id}/liability", json={"liability_id": None}
    )
    assert liability_response.status_code == 404

    description_response = client.put(
        f"/categorization/transactions/{tx_b.id}/description", json={"descricao": "Nova"}
    )
    assert description_response.status_code == 404

    bulk_response = client.post(
        "/categorization/transactions/bulk-confirm",
        json={"items": [{"transaction_id": tx_b.id, "subcategory_id": subcategory.id}]},
    )
    assert bulk_response.status_code == 200
    assert bulk_response.json()["results"][0]["success"] is False


# --- set_category -----------------------------------------------------------


def test_set_category_confirms_and_reedit_works(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session, nome="Comer fora")
    other_subcategory = _subcategory(db_session, nome="Supermercado")
    tx = _pending_transaction(db_session, user)

    confirm_response = client.put(
        f"/categorization/transactions/{tx.id}/category", json={"subcategory_id": subcategory.id}
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["subcategory_id"] == subcategory.id
    assert confirm_response.json()["categorizacao_status"] == "confirmada"

    reedit_response = client.put(
        f"/categorization/transactions/{tx.id}/category",
        json={"subcategory_id": other_subcategory.id},
    )
    assert reedit_response.status_code == 200
    assert reedit_response.json()["subcategory_id"] == other_subcategory.id


def test_set_category_with_invalid_subcategory_returns_404(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)

    response = client.put(
        f"/categorization/transactions/{tx.id}/category", json={"subcategory_id": 999}
    )

    assert response.status_code == 404


# --- bulk-confirm -------------------------------------------------------


def test_bulk_confirm_confirms_valid_rows_and_reports_failures(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    tx_valid = _pending_transaction(db_session, user, "Valida")

    response = client.post(
        "/categorization/transactions/bulk-confirm",
        json={
            "items": [
                {"transaction_id": tx_valid.id, "subcategory_id": subcategory.id},
                {"transaction_id": 999, "subcategory_id": subcategory.id},
            ]
        },
    )

    assert response.status_code == 200
    results = {r["transaction_id"]: r for r in response.json()["results"]}
    assert results[tx_valid.id]["success"] is True
    assert results[999]["success"] is False

    confirmed = client.get("/categorization/transactions", params={"status": "confirmada"}).json()
    assert confirmed["total"] == 1


# --- asset -----------------------------------------------------------------


def test_set_and_clear_asset_association(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    set_response = client.put(
        f"/categorization/transactions/{tx.id}/asset", json={"asset_id": asset.id}
    )
    assert set_response.status_code == 200
    assert set_response.json()["asset_id"] == asset.id

    clear_response = client.put(
        f"/categorization/transactions/{tx.id}/asset", json={"asset_id": None}
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["asset_id"] is None


def test_set_asset_with_invalid_asset_id_returns_404(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)

    response = client.put(f"/categorization/transactions/{tx.id}/asset", json={"asset_id": 999})

    assert response.status_code == 404


# --- liability ---------------------------------------------------------------


def test_set_liability_without_cookie_returns_401(client):
    response = client.put("/categorization/transactions/1/liability", json={"liability_id": None})
    assert response.status_code == 401


def test_set_and_clear_liability_association(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)
    liability = Liability(
        user_id=user.id,
        nome="Financiamento",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)

    set_response = client.put(
        f"/categorization/transactions/{tx.id}/liability", json={"liability_id": liability.id}
    )
    assert set_response.status_code == 200
    assert set_response.json()["liability_id"] == liability.id

    clear_response = client.put(
        f"/categorization/transactions/{tx.id}/liability", json={"liability_id": None}
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["liability_id"] is None


def test_set_liability_with_invalid_liability_id_returns_404(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)

    response = client.put(
        f"/categorization/transactions/{tx.id}/liability", json={"liability_id": 999}
    )

    assert response.status_code == 404


def test_set_liability_other_users_liability_returns_404(client, db_session):
    other = User(
        google_sub="google-liability-other", email="liability-other@example.com", name="Bob"
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_liability = Liability(
        user_id=other.id,
        nome="Financiamento de outro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(other_liability)
    db_session.commit()
    db_session.refresh(other_liability)

    user = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    tx = _pending_transaction(db_session, user)

    response = client.put(
        f"/categorization/transactions/{tx.id}/liability",
        json={"liability_id": other_liability.id},
    )

    assert response.status_code == 404


# --- descrição editável / propagação ----------------------------------------


def test_update_description_propagates_pending_suggestion_to_matching_transaction(
    client, db_session
):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 5678")

    response = client.put(
        f"/categorization/transactions/{origem.id}/description", json={"descricao": "Padaria do Zé"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transaction"]["descricao_usuario"] == "Padaria do Zé"
    assert body["propagated"] == 1

    listed = client.get("/categorization/transactions", params={"status": "todas"}).json()
    candidato_out = next(item for item in listed["items"] if item["id"] == candidato.id)
    assert candidato_out["descricao_sugerida"] == "Padaria do Zé"
    assert candidato_out["descricao_sugestao_origem_id"] == origem.id
    assert candidato_out["descricao_usuario"] is None


def test_confirm_description_suggestion_applies_it(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 5678")
    client.put(
        f"/categorization/transactions/{origem.id}/description", json={"descricao": "Padaria do Zé"}
    )

    response = client.post(f"/categorization/transactions/{candidato.id}/description/confirm")

    assert response.status_code == 200
    body = response.json()
    assert body["descricao_usuario"] == "Padaria do Zé"
    assert body["descricao_sugerida"] is None


def test_dismiss_description_suggestion_clears_it(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 5678")
    client.put(
        f"/categorization/transactions/{origem.id}/description", json={"descricao": "Padaria do Zé"}
    )

    response = client.post(f"/categorization/transactions/{candidato.id}/description/dismiss")

    assert response.status_code == 200
    body = response.json()
    assert body["descricao_sugerida"] is None
    assert body["descricao_usuario"] is None


def test_confirm_description_suggestion_without_pending_returns_400(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)

    response = client.post(f"/categorization/transactions/{tx.id}/description/confirm")

    assert response.status_code == 400
