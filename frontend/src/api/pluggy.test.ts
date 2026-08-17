import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchConnectToken,
  fetchPluggyAccounts,
  fetchPluggyItems,
  fetchPluggyTransactions,
  registerPluggyItem,
  syncPluggyItem,
  syncPluggyItems,
  updatePluggyAccount,
} from "./pluggy";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("pluggy api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchConnectToken posts to /pluggy/connect-token and returns the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: "connect-token-abc" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchConnectToken();

    expect(result.access_token).toBe("connect-token-abc");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/pluggy/connect-token");
    expect(init.method).toBe("POST");
  });

  it("registerPluggyItem posts the pluggy_item_id in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await registerPluggyItem("item-ext-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/pluggy/items");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ pluggy_item_id: "item-ext-1" });
  });

  it("syncPluggyItem posts to the item's sync endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await syncPluggyItem(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/pluggy/items/1/sync");
    expect(init.method).toBe("POST");
  });

  it("fetchPluggyItems, fetchPluggyAccounts and fetchPluggyTransactions perform GET requests", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPluggyItems();
    await fetchPluggyAccounts();
    await fetchPluggyTransactions();

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/pluggy/items",
      "/pluggy/accounts",
      "/pluggy/transactions",
    ]);
  });

  it("updatePluggyAccount puts apelido and sync_enabled to the account endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePluggyAccount(1, { apelido: "Conta principal", syncEnabled: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/pluggy/accounts/1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      apelido: "Conta principal",
      sync_enabled: false,
      investimento_id: null,
    });
  });

  it("syncPluggyItems posts the item_ids list to the sync endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await syncPluggyItems([1, 2]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/pluggy/sync");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ item_ids: [1, 2] });
  });

  it("syncPluggyItems sends item_ids null when called without arguments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await syncPluggyItems();

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ item_ids: null });
  });
});
