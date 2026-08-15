from datetime import date
from decimal import Decimal

from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.asset import Asset, AssetTipo
from app.models.category import CategoryGroup, Subcategory
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


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def _subcategory(db_session, nome="Mercado"):
    group = CategoryGroup(nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome=nome)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def _asset(db_session, user, nome="Carro"):
    asset = Asset(
        user_id=user.id,
        nome=nome,
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset


def _transaction(
    db_session, user, *, valor, tipo, subcategory_id=None, data=date(2026, 1, 15), asset_id=None
):
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{user.id}-{valor}-{tipo}",
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
        pluggy_account_id=f"acc-{user.id}-{valor}-{tipo}",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{user.id}-{valor}-{tipo}",
        descricao="Transacao",
        valor=Decimal(valor),
        tipo=tipo,
        data=data,
        data_competencia=data,
        subcategory_id=subcategory_id,
        asset_id=asset_id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_summary_without_cookie_returns_401(client):
    assert client.get("/dashboards/summary").status_code == 401


def test_por_categoria_without_cookie_returns_401(client):
    assert client.get("/dashboards/por-categoria", params={"tipo": "debito"}).status_code == 401


def test_por_meio_pagamento_without_cookie_returns_401(client):
    assert (
        client.get("/dashboards/por-meio-pagamento", params={"tipo": "debito"}).status_code == 401
    )


def test_por_ativo_without_cookie_returns_401(client):
    assert client.get("/dashboards/por-ativo", params={"tipo": "debito"}).status_code == 401


def test_por_ativo_tendencia_without_cookie_returns_401(client):
    response = client.get(
        "/dashboards/por-ativo/tendencia", params={"tipo": "debito", "ano": 2026, "mes": 1}
    )
    assert response.status_code == 401


def test_summary_returns_totals_for_period(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session)
    _transaction(
        db_session, user, valor="-100.00", tipo=PluggyTransactionTipo.debito, subcategory_id=sub.id
    )
    _transaction(db_session, user, valor="500.00", tipo=PluggyTransactionTipo.credito)

    response = client.get("/dashboards/summary", params={"ano": 2026, "mes": 1})

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["despesa"]) == Decimal("100.00")
    assert Decimal(body["receita"]) == Decimal("500.00")
    assert Decimal(body["saldo"]) == Decimal("400.00")


def test_por_categoria_returns_grouped_totals(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session)
    _transaction(
        db_session, user, valor="-100.00", tipo=PluggyTransactionTipo.debito, subcategory_id=sub.id
    )

    response = client.get(
        "/dashboards/por-categoria", params={"tipo": "debito", "ano": 2026, "mes": 1}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["subcategory_id"] == sub.id
    assert Decimal(body[0]["total"]) == Decimal("100.00")


def test_por_meio_pagamento_returns_grouped_totals(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(db_session, user, valor="-100.00", tipo=PluggyTransactionTipo.debito)

    response = client.get(
        "/dashboards/por-meio-pagamento", params={"tipo": "debito", "ano": 2026, "mes": 1}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["account_tipo"] == "corrente"
    assert Decimal(body[0]["total"]) == Decimal("100.00")


def test_por_ativo_returns_totals_for_period(client, db_session):
    user = _authenticate(client, db_session)
    asset = _asset(db_session, user)
    _transaction(
        db_session,
        user,
        valor="-250.00",
        tipo=PluggyTransactionTipo.debito,
        asset_id=asset.id,
    )

    response = client.get("/dashboards/por-ativo", params={"tipo": "debito", "ano": 2026, "mes": 1})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["asset_id"] == asset.id
    assert body[0]["asset_nome"] == "Carro"
    assert Decimal(body[0]["total"]) == Decimal("250.00")


def test_por_ativo_isolated_by_user(client, db_session):
    other = User(google_sub="google-por-ativo", email="por-ativo@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_asset = _asset(db_session, other, nome="Moto")
    _transaction(
        db_session,
        other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        asset_id=other_asset.id,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/dashboards/por-ativo", params={"tipo": "debito", "ano": 2026, "mes": 1})

    assert response.status_code == 200
    assert response.json() == []


def test_por_ativo_tendencia_returns_series_zero_filled(client, db_session):
    user = _authenticate(client, db_session)
    asset = _asset(db_session, user)
    _transaction(
        db_session,
        user,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        asset_id=asset.id,
        data=date(2026, 1, 15),
    )

    response = client.get(
        "/dashboards/por-ativo/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1, "meses": 3},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["asset_id"] == asset.id
    assert len(body[0]["pontos"]) == 3
    janeiro = next(p for p in body[0]["pontos"] if p["ano"] == 2026 and p["mes"] == 1)
    assert Decimal(janeiro["total"]) == Decimal("100.00")


def test_por_ativo_tendencia_isolated_by_user(client, db_session):
    other = User(
        google_sub="google-tendencia-ativo", email="tendencia-ativo@example.com", name="Bob"
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_asset = _asset(db_session, other, nome="Moto")
    _transaction(
        db_session,
        other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        asset_id=other_asset.id,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get(
        "/dashboards/por-ativo/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1, "meses": 3},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_user_does_not_see_other_users_totals(client, db_session):
    other = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _transaction(db_session, other, valor="-999.00", tipo=PluggyTransactionTipo.debito)

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    summary = client.get("/dashboards/summary", params={"ano": 2026, "mes": 1}).json()
    assert Decimal(summary["despesa"]) == Decimal("0")

    por_categoria = client.get(
        "/dashboards/por-categoria", params={"tipo": "debito", "ano": 2026, "mes": 1}
    ).json()
    assert por_categoria == []

    por_meio_pagamento = client.get(
        "/dashboards/por-meio-pagamento", params={"tipo": "debito", "ano": 2026, "mes": 1}
    ).json()
    assert por_meio_pagamento == []


def test_tendencia_without_cookie_returns_401(client):
    assert client.get("/dashboards/tendencia", params={"ano": 2026, "mes": 1}).status_code == 401


def test_por_categoria_tendencia_without_cookie_returns_401(client):
    response = client.get(
        "/dashboards/por-categoria/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1},
    )
    assert response.status_code == 401


def test_tendencia_returns_series_combining_meses_and_periodo_filter(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(
        db_session, user, valor="-100.00", tipo=PluggyTransactionTipo.debito, data=date(2026, 1, 15)
    )
    _transaction(
        db_session, user, valor="500.00", tipo=PluggyTransactionTipo.credito, data=date(2026, 1, 16)
    )

    response = client.get("/dashboards/tendencia", params={"ano": 2026, "mes": 1, "meses": 3})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    assert [p["mes"] for p in body] == [11, 12, 1]
    janeiro = next(p for p in body if p["ano"] == 2026 and p["mes"] == 1)
    assert Decimal(janeiro["receita"]) == Decimal("500.00")
    assert Decimal(janeiro["despesa"]) == Decimal("100.00")


def test_por_categoria_tendencia_returns_series_per_subcategory(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session)
    _transaction(
        db_session,
        user,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=sub.id,
        data=date(2026, 1, 15),
    )

    response = client.get(
        "/dashboards/por-categoria/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1, "meses": 6},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["subcategory_id"] == sub.id
    assert len(body[0]["pontos"]) == 6
    janeiro = next(p for p in body[0]["pontos"] if p["ano"] == 2026 and p["mes"] == 1)
    assert Decimal(janeiro["total"]) == Decimal("100.00")


def test_user_does_not_see_other_users_tendencia(client, db_session):
    other = User(google_sub="google-3", email="c@example.com", name="Carol")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _transaction(db_session, other, valor="-999.00", tipo=PluggyTransactionTipo.debito)

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    tendencia = client.get(
        "/dashboards/tendencia", params={"ano": 2026, "mes": 1, "meses": 3}
    ).json()
    assert all(Decimal(p["despesa"]) == Decimal("0") for p in tendencia)

    tendencia_categoria = client.get(
        "/dashboards/por-categoria/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1, "meses": 3},
    ).json()
    assert tendencia_categoria == []
