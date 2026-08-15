import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTableSort } from "./useTableSort";

interface Item {
  id: number;
  nome: string;
  valor: number;
}

const ITEMS: Item[] = [
  { id: 1, nome: "Banana", valor: 30 },
  { id: 2, nome: "Abacaxi", valor: 10 },
  { id: 3, nome: "Cereja", valor: 20 },
];

function getValue(item: Item, key: "nome" | "valor") {
  return item[key];
}

describe("useTableSort", () => {
  it("sorts by the initial key and direction", () => {
    const { result } = renderHook(() =>
      useTableSort<Item, "nome" | "valor">(ITEMS, getValue, "valor", "asc")
    );

    expect(result.current.sorted.map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it("toggles direction when the same key is clicked again", () => {
    const { result } = renderHook(() =>
      useTableSort<Item, "nome" | "valor">(ITEMS, getValue, "valor", "asc")
    );

    act(() => result.current.toggleSort("valor"));

    expect(result.current.direction).toBe("desc");
    expect(result.current.sorted.map((i) => i.id)).toEqual([1, 3, 2]);
  });

  it("switches to ascending when a different key is clicked", () => {
    const { result } = renderHook(() =>
      useTableSort<Item, "nome" | "valor">(ITEMS, getValue, "valor", "desc")
    );

    act(() => result.current.toggleSort("nome"));

    expect(result.current.sortKey).toBe("nome");
    expect(result.current.direction).toBe("asc");
    expect(result.current.sorted.map((i) => i.id)).toEqual([2, 1, 3]);
  });

  it("does not mutate the original items array", () => {
    const original = [...ITEMS];
    renderHook(() => useTableSort<Item, "nome" | "valor">(ITEMS, getValue, "valor", "asc"));

    expect(ITEMS).toEqual(original);
  });
});
