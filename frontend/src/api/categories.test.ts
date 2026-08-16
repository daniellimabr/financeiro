import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCategoryGroups, fetchSubcategories, updateSubcategory } from "./categories";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("categories api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchCategoryGroups performs a GET request to /category-groups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCategoryGroups();

    expect(fetchMock.mock.calls[0][0]).toBe("/category-groups");
  });

  it("fetchSubcategories performs a GET request to /subcategories", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSubcategories();

    expect(fetchMock.mock.calls[0][0]).toBe("/subcategories");
  });

  it("updateSubcategory sends a PUT with the full payload (group_id, nome, natureza)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await updateSubcategory(12, { groupId: 2, nome: "Restaurante", natureza: "fixa" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/subcategories/12");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      group_id: 2,
      nome: "Restaurante",
      natureza: "fixa",
    });
  });

  it("updateSubcategory allows sending natureza as null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await updateSubcategory(12, { groupId: 2, nome: "Restaurante", natureza: null });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string).natureza).toBeNull();
  });
});
