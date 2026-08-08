from datetime import date

import httpx
import pytest

from app.pluggy_integration.client import API_KEY_TTL_SECONDS, PluggyClient


def _make_client(handler) -> PluggyClient:
    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport, base_url="https://api.pluggy.test")
    return PluggyClient(
        client_id="cid",
        client_secret="csecret",  # pragma: allowlist secret
        base_url="https://api.pluggy.test",
        http_client=http_client,
    )


def test_get_api_key_is_cached_across_requests():
    auth_calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            auth_calls.append(request)
            return httpx.Response(200, json={"apiKey": "key-1"})  # pragma: allowlist secret
        assert request.headers["X-API-KEY"] == "key-1"
        return httpx.Response(200, json={"id": "item-1", "status": "UPDATED"})

    client = _make_client(handler)

    client.get_item("item-1")
    client.get_item("item-1")

    assert len(auth_calls) == 1


def test_api_key_is_refetched_after_ttl_expires():
    auth_calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            auth_calls.append(request)
            return httpx.Response(200, json={"apiKey": f"key-{len(auth_calls)}"})
        return httpx.Response(200, json={"id": "item-1", "status": "UPDATED"})

    client = _make_client(handler)
    client.get_item("item-1")
    assert len(auth_calls) == 1

    client._api_key_fetched_at -= API_KEY_TTL_SECONDS + 1
    client.get_item("item-1")

    assert len(auth_calls) == 2


def test_get_transactions_paginates_until_last_page():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "key-1"})  # pragma: allowlist secret
        assert request.url.path == "/v2/transactions"
        assert "pageSize" not in request.url.params
        if "after" not in request.url.params:
            assert request.url.params["dateFrom"] == "2026-01-01"
            return httpx.Response(
                200,
                json={"results": [{"id": "tx-1"}, {"id": "tx-2"}], "next": "cursor-abc"},
            )
        assert request.url.params["after"] == "cursor-abc"
        return httpx.Response(200, json={"results": [{"id": "tx-3"}], "next": None})

    client = _make_client(handler)

    transactions = client.get_transactions("account-1", from_date=date(2026, 1, 1))

    assert [t["id"] for t in transactions] == ["tx-1", "tx-2", "tx-3"]

    def handler_query_string_next(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "key-1"})  # pragma: allowlist secret
        if "after" not in request.url.params:
            return httpx.Response(
                200,
                json={
                    "results": [{"id": "tx-1"}],
                    "next": "?accountId=account-1&after=cursor-xyz",
                },
            )
        assert request.url.params["after"] == "cursor-xyz"
        return httpx.Response(200, json={"results": [{"id": "tx-2"}], "next": None})

    client = _make_client(handler_query_string_next)

    transactions = client.get_transactions("account-1")

    assert [t["id"] for t in transactions] == ["tx-1", "tx-2"]


def test_http_error_propagates():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "key-1"})  # pragma: allowlist secret
        return httpx.Response(500, json={"message": "internal error"})

    client = _make_client(handler)

    with pytest.raises(httpx.HTTPStatusError):
        client.get_accounts("item-1")


def test_create_connect_token_returns_access_token():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "key-1"})  # pragma: allowlist secret
        assert request.url.path == "/connect_token"
        return httpx.Response(200, json={"accessToken": "connect-token-abc"})

    client = _make_client(handler)

    token = client.create_connect_token()

    assert token == "connect-token-abc"


def test_create_connect_token_with_item_id_sends_item_id_in_payload():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "key-1"})  # pragma: allowlist secret
        captured["body"] = request.content
        return httpx.Response(200, json={"accessToken": "connect-token-abc"})

    client = _make_client(handler)

    client.create_connect_token(item_id="item-ext-1")

    assert b'"itemId":"item-ext-1"' in captured["body"]
