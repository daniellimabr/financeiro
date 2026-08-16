import { describe, expect, it } from "vitest";

import type { CategoriaTotal } from "../api/dashboards";
import { groupCategoriaTotalsByGrupo } from "./categoriaGrouping";

function item(overrides: Partial<CategoriaTotal>): CategoriaTotal {
  return {
    group_id: 1,
    group_nome: "Grupo",
    subcategory_id: 1,
    subcategory_nome: "Sub",
    total: "0",
    percentual: "0",
    ...overrides,
  };
}

describe("groupCategoriaTotalsByGrupo", () => {
  it("sums totals per group_id and keeps each group's own subcategorias", () => {
    const grupos = groupCategoriaTotalsByGrupo([
      item({ group_id: 1, group_nome: "Moradia", subcategory_id: 10, total: "1000" }),
      item({ group_id: 2, group_nome: "Alimentação", subcategory_id: 11, total: "300" }),
      item({ group_id: 2, group_nome: "Alimentação", subcategory_id: 12, total: "200" }),
    ]);

    expect(grupos).toHaveLength(2);
    const alimentacao = grupos.find((g) => g.group_id === 2);
    expect(alimentacao?.total).toBe(500);
    expect(alimentacao?.subcategorias).toHaveLength(2);
  });

  it("computes percentual against the total of all items received, summing to 100%", () => {
    const grupos = groupCategoriaTotalsByGrupo([
      item({ group_id: 1, total: "700" }),
      item({ group_id: 2, total: "300" }),
    ]);

    const soma = grupos.reduce((sum, g) => sum + g.percentual, 0);
    expect(soma).toBeCloseTo(100, 8);
    expect(grupos.find((g) => g.group_id === 1)?.percentual).toBeCloseTo(70, 8);
    expect(grupos.find((g) => g.group_id === 2)?.percentual).toBeCloseTo(30, 8);
  });

  it("sorts groups and subcategorias descending by total", () => {
    const grupos = groupCategoriaTotalsByGrupo([
      item({ group_id: 1, subcategory_id: 10, total: "100" }),
      item({ group_id: 2, subcategory_id: 20, total: "900" }),
      item({ group_id: 1, subcategory_id: 11, total: "400" }),
    ]);

    expect(grupos.map((g) => g.group_id)).toEqual([2, 1]);
    expect(grupos[1].subcategorias.map((s) => s.subcategory_id)).toEqual([11, 10]);
  });

  it("returns an empty array and doesn't divide by zero for empty input", () => {
    expect(groupCategoriaTotalsByGrupo([])).toEqual([]);
  });
});
