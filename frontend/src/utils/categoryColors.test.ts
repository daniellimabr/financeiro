import { describe, expect, it } from "vitest";

import type { CategoryGroup, Subcategory } from "../api/categories";
import {
  buildColorIndexFromIds,
  buildGroupColorIndex,
  buildSubcategoryTintIndex,
  groupColorVar,
  subcategoryColorVar,
} from "./categoryColors";

function group(id: number, nome = `Grupo ${id}`): CategoryGroup {
  return { id, nome, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
}

function subcategory(id: number, groupId: number, nome = `Sub ${id}`): Subcategory {
  return {
    id,
    group_id: groupId,
    nome,
    natureza: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("buildColorIndexFromIds / groupColorVar", () => {
  it("assigns distinct slots in ascending id order", () => {
    const index = buildColorIndexFromIds([3, 1, 2]);

    expect(groupColorVar(1, index)).toBe("var(--cat-1)");
    expect(groupColorVar(2, index)).toBe("var(--cat-2)");
    expect(groupColorVar(3, index)).toBe("var(--cat-3)");
  });

  it("does not collide with 15 ids (regression: Empréstimos/Transferência Interna, i % 8)", () => {
    const ids = Array.from({ length: 15 }, (_, i) => i + 1);
    const index = buildColorIndexFromIds(ids);

    const slots = new Set(ids.map((id) => groupColorVar(id, index)));
    expect(slots.size).toBe(15);
  });

  it("wraps around after 16 ids instead of throwing", () => {
    const ids = Array.from({ length: 17 }, (_, i) => i + 1);
    const index = buildColorIndexFromIds(ids);

    expect(groupColorVar(1, index)).toBe("var(--cat-1)");
    expect(groupColorVar(17, index)).toBe("var(--cat-1)");
  });

  it("falls back to a neutral color for an unknown id", () => {
    const index = buildColorIndexFromIds([1]);

    expect(groupColorVar(999, index)).toBe("var(--text)");
  });

  it("is stable regardless of input order (identity, not rank)", () => {
    const a = buildColorIndexFromIds([1, 2, 3]);
    const b = buildColorIndexFromIds([3, 2, 1]);

    expect(groupColorVar(2, a)).toBe(groupColorVar(2, b));
  });

  it("works for any numeric id domain, not just category groups (e.g. ativos)", () => {
    const index = buildColorIndexFromIds([101, 205, 42]);

    expect(groupColorVar(42, index)).toBe("var(--cat-1)");
    expect(groupColorVar(101, index)).toBe("var(--cat-2)");
    expect(groupColorVar(205, index)).toBe("var(--cat-3)");
  });
});

describe("buildGroupColorIndex", () => {
  it("extracts ids from CategoryGroup objects", () => {
    const index = buildGroupColorIndex([group(3), group(1), group(2)]);

    expect(groupColorVar(1, index)).toBe("var(--cat-1)");
    expect(groupColorVar(2, index)).toBe("var(--cat-2)");
    expect(groupColorVar(3, index)).toBe("var(--cat-3)");
  });
});

describe("buildSubcategoryTintIndex / subcategoryColorVar", () => {
  it("derives a color-mix tint from the parent group's color", () => {
    const groupIndex = buildColorIndexFromIds([1]);
    const tintIndex = buildSubcategoryTintIndex([subcategory(10, 1), subcategory(11, 1)]);

    const first = subcategoryColorVar(10, 1, groupIndex, tintIndex);
    const second = subcategoryColorVar(11, 1, groupIndex, tintIndex);

    expect(first).toContain("var(--cat-1)");
    expect(second).toContain("var(--cat-1)");
    expect(first).not.toBe(second);
  });

  it("scopes tint index per group, so siblings in different groups can share a tint slot", () => {
    const tintIndex = buildSubcategoryTintIndex([subcategory(10, 1), subcategory(20, 2)]);

    // primeira subcategoria de cada grupo — mesmo slot de tint (0), grupos diferentes
    const groupIndex = buildColorIndexFromIds([1, 2]);
    const first = subcategoryColorVar(10, 1, groupIndex, tintIndex);
    const second = subcategoryColorVar(20, 2, groupIndex, tintIndex);

    expect(first).toContain("var(--cat-1)");
    expect(second).toContain("var(--cat-2)");
  });
});
