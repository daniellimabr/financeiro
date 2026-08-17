from datetime import date
from decimal import Decimal

from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.asset import Asset, AssetTipo
from app.models.category import CategoryGroup, Natureza, Subcategory
from app.models.liability import Liability, LiabilityTipo
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


def _subcategory(db_session, nome="Mercado", natureza=None):
    group = CategoryGroup(nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome=nome, natureza=natureza)
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


def _liability(db_session, user, nome="Financiamento"):
    liability = Liability(
        user_id=user.id,
        nome=nome,
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)
    return liability


def _account(db_session, user, *, tipo=PluggyAccountTipo.corrente, saldo_inicial=None):
    n = next(_SEQ)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-acc-{user.id}-{n}",
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
        pluggy_account_id=f"acc-{user.id}-{n}",
        tipo=tipo,
        nome="Conta",
        saldo=Decimal("0"),
        saldo_inicial=saldo_inicial,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def _transaction(
    db_session,
    user,
    *,
    valor,
    tipo,
    subcategory_id=None,
    data=date(2026, 1, 15),
    asset_id=None,
    liability_id=None,
    account=None,
):
    if account is None:
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
        pluggy_transaction_id=f"tx-{user.id}-{valor}-{tipo}-{next(_SEQ)}",
        descricao="Transacao",
        valor=Decimal(valor),
        tipo=tipo,
        data=data,
        data_competencia=data,
        subcategory_id=subcategory_id,
        asset_id=asset_id,
        liability_id=liability_id,
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


def test_por_passivo_without_cookie_returns_401(client):
    assert client.get("/dashboards/por-passivo").status_code == 401


def test_por_passivo_tendencia_without_cookie_returns_401(client):
    response = client.get("/dashboards/por-passivo/tendencia", params={"ano": 2026, "mes": 1})
    assert response.status_code == 401


def test_saldo_por_conta_without_cookie_returns_401(client):
    assert client.get("/dashboards/saldo-por-conta").status_code == 401


def test_por_passivo_returns_totals_for_period(client, db_session):
    user = _authenticate(client, db_session)
    liability = _liability(db_session, user)
    _transaction(
        db_session,
        user,
        valor="-250.00",
        tipo=PluggyTransactionTipo.debito,
        liability_id=liability.id,
    )

    response = client.get("/dashboards/por-passivo", params={"ano": 2026, "mes": 1})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["liability_id"] == liability.id
    assert body[0]["liability_nome"] == "Financiamento"
    assert Decimal(body[0]["total"]) == Decimal("250.00")


def test_por_passivo_isolated_by_user(client, db_session):
    other = User(google_sub="google-por-passivo", email="por-passivo@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_liability = _liability(db_session, other, nome="Financiamento moto")
    _transaction(
        db_session,
        other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        liability_id=other_liability.id,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/dashboards/por-passivo", params={"ano": 2026, "mes": 1})

    assert response.status_code == 200
    assert response.json() == []


def test_por_passivo_tendencia_returns_series_zero_filled(client, db_session):
    user = _authenticate(client, db_session)
    liability = _liability(db_session, user)
    _transaction(
        db_session,
        user,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        liability_id=liability.id,
        data=date(2026, 1, 15),
    )

    response = client.get(
        "/dashboards/por-passivo/tendencia",
        params={"ano": 2026, "mes": 1, "meses": 3},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["liability_id"] == liability.id
    assert len(body[0]["pontos"]) == 3
    janeiro = next(p for p in body[0]["pontos"] if p["ano"] == 2026 and p["mes"] == 1)
    assert Decimal(janeiro["total"]) == Decimal("100.00")


def test_saldo_por_conta_returns_current_balance_ignoring_period(client, db_session):
    user = _authenticate(client, db_session)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id="item-saldo-1",
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
        pluggy_account_id="acc-saldo-1",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("1234.56"),
    )
    db_session.add(account)
    db_session.commit()

    response = client.get("/dashboards/saldo-por-conta")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["account_id"] == account.id
    assert Decimal(body[0]["saldo"]) == Decimal("1234.56")


def test_patrimonio_breakdown_without_cookie_returns_401(client):
    assert client.get("/dashboards/patrimonio/breakdown").status_code == 401


def test_patrimonio_breakdown_returns_parts_matching_summary(client, db_session):
    user = _authenticate(client, db_session)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id="item-breakdown-1",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        PluggyAccount(
            item_id=item.id,
            user_id=user.id,
            pluggy_account_id="acc-breakdown-1",
            tipo=PluggyAccountTipo.corrente,
            nome="Conta",
            saldo=Decimal("1000.00"),
        )
    )
    db_session.commit()
    asset = _asset(db_session, user)

    response = client.get("/dashboards/patrimonio/breakdown")
    summary = client.get("/dashboards/summary").json()

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["ativos"]) == Decimal("50000.00")
    assert Decimal(body["saldo_contas"]) == Decimal("1000.00")
    assert Decimal(body["total"]) == Decimal(summary["patrimonio"])
    del asset


def test_patrimonio_breakdown_isolated_by_user(client, db_session):
    other = User(google_sub="google-breakdown", email="breakdown@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    item = PluggyItem(
        user_id=other.id,
        pluggy_item_id="item-breakdown-2",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        PluggyAccount(
            item_id=item.id,
            user_id=other.id,
            pluggy_account_id="acc-breakdown-2",
            tipo=PluggyAccountTipo.corrente,
            nome="Conta de outro",
            saldo=Decimal("999.00"),
        )
    )
    db_session.commit()

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/dashboards/patrimonio/breakdown")

    assert response.status_code == 200
    assert Decimal(response.json()["total"]) == Decimal("0")


def test_saldo_por_conta_isolated_by_user(client, db_session):
    other = User(google_sub="google-saldo-conta", email="saldo-conta@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    item = PluggyItem(
        user_id=other.id,
        pluggy_item_id="item-saldo-2",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        PluggyAccount(
            item_id=item.id,
            user_id=other.id,
            pluggy_account_id="acc-saldo-2",
            tipo=PluggyAccountTipo.corrente,
            nome="Conta de outro",
            saldo=Decimal("999.00"),
        )
    )
    db_session.commit()

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/dashboards/saldo-por-conta")

    assert response.status_code == 200
    assert response.json() == []


def test_por_natureza_without_cookie_returns_401(client):
    assert client.get("/dashboards/por-natureza", params={"tipo": "debito"}).status_code == 401


def test_por_natureza_tendencia_without_cookie_returns_401(client):
    response = client.get(
        "/dashboards/por-natureza/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1},
    )
    assert response.status_code == 401


def test_por_natureza_returns_three_buckets_with_totals(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session, user, valor="-1000.00", tipo=PluggyTransactionTipo.debito, subcategory_id=sub.id
    )

    response = client.get(
        "/dashboards/por-natureza", params={"tipo": "debito", "ano": 2026, "mes": 1}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    fixa = next(n for n in body if n["natureza"] == "fixa")
    assert Decimal(fixa["total"]) == Decimal("1000.00")
    eventual = next(n for n in body if n["natureza"] == "eventual")
    assert Decimal(eventual["total"]) == Decimal("0")


def test_por_natureza_null_natureza_falls_back_to_eventual(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, nome="Diversos", natureza=None)
    _transaction(
        db_session, user, valor="-50.00", tipo=PluggyTransactionTipo.debito, subcategory_id=sub.id
    )

    response = client.get(
        "/dashboards/por-natureza", params={"tipo": "debito", "ano": 2026, "mes": 1}
    )

    assert response.status_code == 200
    body = response.json()
    eventual = next(n for n in body if n["natureza"] == "eventual")
    assert Decimal(eventual["total"]) == Decimal("50.00")


def test_por_natureza_isolated_by_user(client, db_session):
    other = User(google_sub="google-natureza", email="natureza@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_sub = _subcategory(db_session, nome="Aluguel de outro", natureza=Natureza.fixa)
    _transaction(
        db_session,
        other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=other_sub.id,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get(
        "/dashboards/por-natureza", params={"tipo": "debito", "ano": 2026, "mes": 1}
    )

    assert response.status_code == 200
    assert all(Decimal(n["total"]) == Decimal("0") for n in response.json())


def test_por_natureza_tendencia_returns_series_zero_filled(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        user,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=sub.id,
        data=date(2026, 1, 15),
    )

    response = client.get(
        "/dashboards/por-natureza/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1, "meses": 3},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    fixa = next(n for n in body if n["natureza"] == "fixa")
    assert len(fixa["pontos"]) == 3
    janeiro = next(p for p in fixa["pontos"] if p["ano"] == 2026 and p["mes"] == 1)
    assert Decimal(janeiro["total"]) == Decimal("1000.00")


def test_por_natureza_tendencia_isolated_by_user(client, db_session):
    other = User(google_sub="google-natureza-tendencia", email="nat-tend@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_sub = _subcategory(db_session, nome="Aluguel de outro", natureza=Natureza.fixa)
    _transaction(
        db_session,
        other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=other_sub.id,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get(
        "/dashboards/por-natureza/tendencia",
        params={"tipo": "debito", "ano": 2026, "mes": 1, "meses": 3},
    )

    assert response.status_code == 200
    assert all(Decimal(p["total"]) == Decimal("0") for n in response.json() for p in n["pontos"])


def test_projecao_without_cookie_returns_401(client):
    response = client.get("/dashboards/projecao", params={"ano": 2026, "mes": 1})
    assert response.status_code == 401


def test_projecao_returns_horizon_with_constant_value(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        user,
        valor="-1200.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=sub.id,
        data=date(2026, 1, 15),
    )

    response = client.get(
        "/dashboards/projecao",
        params={"ano": 2026, "mes": 1, "meses_futuros": 3, "janela_media": 1},
    )

    assert response.status_code == 200
    body = response.json()
    assert [(p["ano"], p["mes"]) for p in body] == [(2026, 2), (2026, 3), (2026, 4)]
    assert all(Decimal(p["despesa"]) == Decimal("1200.00") for p in body)


def test_projecao_respects_ano_mes_meses_futuros_janela_media_params(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, nome="Aluguel", natureza=Natureza.fixa)
    _transaction(
        db_session,
        user,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=sub.id,
        data=date(2026, 1, 15),
    )

    response = client.get(
        "/dashboards/projecao",
        params={"ano": 2026, "mes": 1, "meses_futuros": 6, "janela_media": 3},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 6
    assert all(Decimal(p["despesa"]) == Decimal("333.33") for p in body)


def test_projecao_isolated_by_user(client, db_session):
    other = User(google_sub="google-projecao", email="projecao@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_sub = _subcategory(db_session, nome="Aluguel de outro", natureza=Natureza.fixa)
    _transaction(
        db_session,
        other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        subcategory_id=other_sub.id,
    )

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/dashboards/projecao", params={"ano": 2026, "mes": 1})

    assert response.status_code == 200
    assert all(Decimal(p["despesa"]) == Decimal("0") for p in response.json())


# --- GET /dashboards/evolucao-saldo-por-conta ---------------------------------


def test_evolucao_saldo_por_conta_without_cookie_returns_401(client):
    response = client.get("/dashboards/evolucao-saldo-por-conta", params={"ano": 2026, "mes": 1})
    assert response.status_code == 401


def test_evolucao_saldo_por_conta_accumulates_and_excludes_accounts_without_saldo_inicial(
    client, db_session
):
    user = _authenticate(client, db_session)
    conta_com_saldo = _account(db_session, user, saldo_inicial=Decimal("1000.00"))
    _account(db_session, user, saldo_inicial=None)
    _transaction(
        db_session,
        user,
        valor="500.00",
        tipo=PluggyTransactionTipo.credito,
        data=date(2026, 1, 10),
        account=conta_com_saldo,
    )

    response = client.get(
        "/dashboards/evolucao-saldo-por-conta", params={"ano": 2026, "mes": 1, "meses": 1}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["account_id"] == conta_com_saldo.id
    assert Decimal(body[0]["pontos"][0]["total"]) == Decimal("1500.00")


def test_evolucao_saldo_por_conta_isolated_by_user(client, db_session):
    other = User(google_sub="google-evolucao", email="evolucao@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _account(db_session, other, saldo_inicial=Decimal("999.00"))

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get(
        "/dashboards/evolucao-saldo-por-conta", params={"ano": 2026, "mes": 1, "meses": 3}
    )

    assert response.status_code == 200
    assert response.json() == []


# --- GET /dashboards/saldo-acumulado ------------------------------------------


def test_saldo_acumulado_without_cookie_returns_401(client):
    response = client.get("/dashboards/saldo-acumulado", params={"ano": 2026, "mes": 1})
    assert response.status_code == 401


def test_saldo_acumulado_anchors_on_saldo_inicial_sum(client, db_session):
    user = _authenticate(client, db_session)
    _account(db_session, user, saldo_inicial=Decimal("1000.00"))
    _account(db_session, user, saldo_inicial=Decimal("500.00"))

    response = client.get("/dashboards/saldo-acumulado", params={"ano": 2026, "mes": 1, "meses": 1})

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body[0]["total"]) == Decimal("1500.00")


def test_saldo_acumulado_isolated_by_user(client, db_session):
    other = User(google_sub="google-acumulado", email="acumulado@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _account(db_session, other, saldo_inicial=Decimal("999.00"))

    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")

    response = client.get("/dashboards/saldo-acumulado", params={"ano": 2026, "mes": 1, "meses": 1})

    assert response.status_code == 200
    assert Decimal(response.json()[0]["total"]) == Decimal("0")
