import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bulkConfirm,
  confirmDescriptionSuggestion,
  dismissDescriptionSuggestion,
  fetchTransactions,
  setCategory,
  setTransactionAsset,
  updateDescription,
} from "./categorization";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("categorization api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchTransactions performs a GET request with no query by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchTransactions();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions");
  });

  it("fetchTransactions builds the query string from status/tipo/ano/mes/page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchTransactions({
      status: "confirmada",
      tipo: "debito",
      ano: 2026,
      mes: 1,
      page: 2,
      pageSize: 10,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "/categorization/transactions?status=confirmada&tipo=debito&ano=2026&mes=1&page=2&page_size=10"
    );
  });

  it("setCategory puts the subcategory_id to the category endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await setCategory(1, 42);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions/1/category");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ subcategory_id: 42 });
  });

  it("bulkConfirm posts the items list to the bulk-confirm endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await bulkConfirm([
      { transactionId: 1, subcategoryId: 10 },
      { transactionId: 2, subcategoryId: 20 },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions/bulk-confirm");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      items: [
        { transaction_id: 1, subcategory_id: 10 },
        { transaction_id: 2, subcategory_id: 20 },
      ],
    });
  });

  it("setTransactionAsset puts the asset_id to the asset endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await setTransactionAsset(1, 7);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions/1/asset");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ asset_id: 7 });
  });

  it("setTransactionAsset can clear the association with null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await setTransactionAsset(1, null);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ asset_id: null });
  });

  it("updateDescription puts the new descricao to the description endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ transaction: { id: 1 }, propagated: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateDescription(1, "Padaria do Zé");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions/1/description");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ descricao: "Padaria do Zé" });
    expect(result.propagated).toBe(2);
  });

  it("confirmDescriptionSuggestion posts to the description/confirm endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await confirmDescriptionSuggestion(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions/1/description/confirm");
    expect(init.method).toBe("POST");
  });

  it("dismissDescriptionSuggestion posts to the description/dismiss endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await dismissDescriptionSuggestion(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/transactions/1/description/dismiss");
    expect(init.method).toBe("POST");
  });
});
