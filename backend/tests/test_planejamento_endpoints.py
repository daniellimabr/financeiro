from datetime import date
from decimal import Decimal

from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.category import CategoryGroup, Natureza, Subcategory
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_SEQ = iter(range(1, 100_000))


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def _subcategory(db_session, user, nome="Mercado", natureza=Natureza.variavel):
    group = CategoryGroup(user_id=user.id, nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(user_id=user.id, group_id=group.id, nome=nome, natureza=natureza)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def _account(db_session, user):
    n = next(_SEQ)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{n}",
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
        pluggy_account_id=f"acc-{n}",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def _transaction(db_session, user, account, subcategory, *, valor, tipo, ano, mes):
    n = next(_SEQ)
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{n}",
        descricao=f"Transacao {n}",
        valor=Decimal(valor),
        tipo=tipo,
        data=date(ano, mes, 10),
        data_competencia=date(ano, mes, 10),
        subcategory_id=subcategory.id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


# --- GET /planejamento/grade --------------------------------------------------


def test_get_grade_without_cookie_returns_401(client):
    response = client.get("/planejamento/grade", params={"ano_base": 2026, "mes_base": 6})
    assert response.status_code == 401


def test_get_grade_returns_subcategorias_fixa_variavel(client, db_session):
    user = _authenticate(client, db_session)
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    response = client.get("/planejamento/grade", params={"ano_base": 2026, "mes_base": 6})

    assert response.status_code == 200
    body = response.json()
    assert len(body["periodo"]) == 16
    assert len(body["subcategorias"]) == 1
    assert body["subcategorias"][0]["subcategory_id"] == sub.id


def test_get_grade_isolated_by_user(client, db_session):
    other = User(google_sub="google-other", email="other@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    other_sub = _subcategory(db_session, other)
    _transaction(
        db_session,
        other,
        other_account,
        other_sub,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/planejamento/grade", params={"ano_base": 2026, "mes_base": 6})

    assert response.status_code == 200
    assert response.json()["subcategorias"] == []


# --- PUT/DELETE /planejamento/valores/{subcategory_id} ------------------------


def test_confirmar_e_remover_valor(client, db_session):
    user = _authenticate(client, db_session)
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    put_response = client.put(
        f"/planejamento/valores/{sub.id}", json={"ano": 2026, "mes": 7, "valor": "999.00"}
    )
    assert put_response.status_code == 200
    assert put_response.json()["valor"] == "999.00"

    grade = client.get("/planejamento/grade", params={"ano_base": 2026, "mes_base": 6}).json()
    linha = next(row for row in grade["subcategorias"] if row["subcategory_id"] == sub.id)
    celula = next(c for c in linha["celulas"] if c["ano"] == 2026 and c["mes"] == 7)
    assert celula["origem"] == "confirmado"

    delete_response = client.delete(
        f"/planejamento/valores/{sub.id}", params={"ano": 2026, "mes": 7}
    )
    assert delete_response.status_code == 204

    grade2 = client.get("/planejamento/grade", params={"ano_base": 2026, "mes_base": 6}).json()
    linha2 = next(row for row in grade2["subcategorias"] if row["subcategory_id"] == sub.id)
    celula2 = next(c for c in linha2["celulas"] if c["ano"] == 2026 and c["mes"] == 7)
    assert celula2["origem"] == "sugerido"


def test_remover_valor_inexistente_returns_404(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.delete(f"/planejamento/valores/{sub.id}", params={"ano": 2026, "mes": 7})

    assert response.status_code == 404


def test_confirmar_valor_subcategoria_inexistente_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.put(
        "/planejamento/valores/999999", json={"ano": 2026, "mes": 7, "valor": "100.00"}
    )

    assert response.status_code == 404


# --- CRUD /planejamento/itens ---------------------------------------------------


def test_create_list_update_delete_item_planejado(client, db_session):
    _authenticate(client, db_session)

    create_response = client.post(
        "/planejamento/itens",
        json={
            "nome": "Presente",
            "tipo": "debito",
            "valor": "300.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    )
    assert create_response.status_code == 201
    item_id = create_response.json()["id"]

    list_response = client.get("/planejamento/itens")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    update_response = client.put(
        f"/planejamento/itens/{item_id}",
        json={
            "nome": "Presente de aniversário",
            "tipo": "debito",
            "valor": "350.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["nome"] == "Presente de aniversário"

    delete_response = client.delete(f"/planejamento/itens/{item_id}")
    assert delete_response.status_code == 204
    assert client.get("/planejamento/itens").json() == []


def test_update_and_delete_item_planejado_inexistente_returns_404(client, db_session):
    _authenticate(client, db_session)

    update_response = client.put(
        "/planejamento/itens/999999",
        json={
            "nome": "Fantasma",
            "tipo": "debito",
            "valor": "10.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    )
    assert update_response.status_code == 404

    delete_response = client.delete("/planejamento/itens/999999")
    assert delete_response.status_code == 404

    desvincular_response = client.post("/planejamento/itens/999999/desvincular")
    assert desvincular_response.status_code == 404


def test_create_item_planejado_unico_com_data_fim_returns_422(client, db_session):
    _authenticate(client, db_session)

    response = client.post(
        "/planejamento/itens",
        json={
            "nome": "Item inválido",
            "tipo": "debito",
            "valor": "300.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
            "data_fim": "2026-12-01",
        },
    )

    assert response.status_code == 422


# --- vincular/desvincular -------------------------------------------------------


def test_vincular_e_desvincular_item_planejado(client, db_session):
    user = _authenticate(client, db_session)
    account = _account(db_session, user)
    sub = _subcategory(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )
    item_id = client.post(
        "/planejamento/itens",
        json={
            "nome": "Presente",
            "tipo": "debito",
            "valor": "300.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    ).json()["id"]

    vincular_response = client.post(
        f"/planejamento/itens/{item_id}/vincular", json={"transacao_id": tx.id}
    )
    assert vincular_response.status_code == 200
    assert vincular_response.json()["transacao_vinculada_id"] == tx.id

    desvincular_response = client.post(f"/planejamento/itens/{item_id}/desvincular")
    assert desvincular_response.status_code == 200
    assert desvincular_response.json()["transacao_vinculada_id"] is None


def test_vincular_rejeita_transacao_de_outro_usuario(client, db_session):
    other = User(google_sub="google-other-vinc", email="other-vinc@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_account = _account(db_session, other)
    other_sub = _subcategory(db_session, other)
    tx_other = _transaction(
        db_session,
        other,
        other_account,
        other_sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    item_id = client.post(
        "/planejamento/itens",
        json={
            "nome": "Presente",
            "tipo": "debito",
            "valor": "300.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    ).json()["id"]

    response = client.post(
        f"/planejamento/itens/{item_id}/vincular", json={"transacao_id": tx_other.id}
    )

    assert response.status_code == 404


def test_vincular_rejeita_transacao_ja_vinculada(client, db_session):
    user = _authenticate(client, db_session)
    account = _account(db_session, user)
    sub = _subcategory(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )
    item1_id = client.post(
        "/planejamento/itens",
        json={
            "nome": "Item 1",
            "tipo": "debito",
            "valor": "300.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    ).json()["id"]
    item2_id = client.post(
        "/planejamento/itens",
        json={
            "nome": "Item 2",
            "tipo": "debito",
            "valor": "300.00",
            "data_inicio": "2026-08-01",
            "recorrente": False,
        },
    ).json()["id"]
    client.post(f"/planejamento/itens/{item1_id}/vincular", json={"transacao_id": tx.id})

    response = client.post(f"/planejamento/itens/{item2_id}/vincular", json={"transacao_id": tx.id})

    assert response.status_code == 400
