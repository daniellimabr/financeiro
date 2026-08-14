import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmCategorization,
  fetchPendingCategorizations,
  setTransactionAsset,
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

  it("fetchPendingCategorizations performs a GET request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPendingCategorizations();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/pending");
  });

  it("confirmCategorization posts the subcategory_id to the confirm endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await confirmCategorization(1, 42);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/pending/1/confirm");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ subcategory_id: 42 });
  });

  it("setTransactionAsset puts the asset_id to the asset endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await setTransactionAsset(1, 7);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/categorization/pending/1/asset");
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
});
