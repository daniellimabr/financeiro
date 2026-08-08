import time
from datetime import date
from urllib.parse import parse_qs, urlparse

import httpx

API_KEY_TTL_SECONDS = 60 * 60 * 1.8  # api key da Pluggy expira em ~2h; renova com folga


class PluggyClient:
    """Cliente HTTP para a API Pluggy. Autentica via API key cacheada em memória."""

    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        base_url: str,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._http = http_client or httpx.Client(base_url=base_url, timeout=30.0)
        self._api_key: str | None = None
        self._api_key_fetched_at: float | None = None

    def _fetch_api_key(self) -> str:
        response = self._http.post(
            "/auth",
            json={"clientId": self._client_id, "clientSecret": self._client_secret},
        )
        response.raise_for_status()
        return response.json()["apiKey"]

    def _get_api_key(self) -> str:
        now = time.monotonic()
        is_cached_valid = (
            self._api_key is not None
            and self._api_key_fetched_at is not None
            and (now - self._api_key_fetched_at) < API_KEY_TTL_SECONDS
        )
        if not is_cached_valid:
            self._api_key = self._fetch_api_key()
            self._api_key_fetched_at = now
        return self._api_key

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        headers = kwargs.pop("headers", {})
        headers["X-API-KEY"] = self._get_api_key()
        response = self._http.request(method, path, headers=headers, **kwargs)
        response.raise_for_status()
        return response

    def create_connect_token(self, *, item_id: str | None = None) -> str:
        payload: dict = {}
        if item_id is not None:
            payload["itemId"] = item_id
        response = self._request("POST", "/connect_token", json=payload)
        return response.json()["accessToken"]

    def get_item(self, pluggy_item_id: str) -> dict:
        return self._request("GET", f"/items/{pluggy_item_id}").json()

    def get_accounts(self, pluggy_item_id: str) -> list[dict]:
        response = self._request("GET", "/accounts", params={"itemId": pluggy_item_id})
        return response.json()["results"]

    def get_transactions(
        self, pluggy_account_id: str, *, from_date: date | None = None
    ) -> list[dict]:
        # GET /transactions (paginação por página) está deprecado pela Pluggy e já
        # retorna 410 Gone — usa /v2/transactions, paginação por cursor (`next`/`after`).
        # v2 não aceita `pageSize` nem `from` (rejeita com 400) — o filtro de data é
        # `dateFrom`, e o tamanho de página é fixo (confirmado empiricamente contra o
        # sandbox real; a doc pública da Pluggy diverge da API de fato em ambos os pontos).
        transactions: list[dict] = []
        params: dict = {"accountId": pluggy_account_id}
        if from_date is not None:
            params["dateFrom"] = from_date.isoformat()
        while True:
            data = self._request("GET", "/v2/transactions", params=params).json()
            transactions.extend(data["results"])
            next_value = data.get("next")
            if not next_value:
                break
            # `next` já foi observado como cursor puro; trata também o formato de
            # query string (`?accountId=...&after=...`) citado na doc, por segurança.
            after = parse_qs(urlparse(next_value).query).get("after", [None])[0] or next_value
            params = {**params, "after": after}
        return transactions
