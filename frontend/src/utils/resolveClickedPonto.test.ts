import { describe, expect, it } from "vitest";

import { resolveClickedPonto } from "./resolveClickedPonto";

const DATA = [
  { ano: 2025, mes: 11 },
  { ano: 2025, mes: 12 },
  { ano: 2026, mes: 1 },
];

describe("resolveClickedPonto", () => {
  it("resolves a numeric activeIndex to the corresponding ano/mes", () => {
    expect(resolveClickedPonto(DATA, 2)).toEqual({ ano: 2026, mes: 1 });
  });

  it("resolves a string activeIndex (recharts internal tooltip index)", () => {
    expect(resolveClickedPonto(DATA, "1")).toEqual({ ano: 2025, mes: 12 });
  });

  it("returns undefined for an out-of-range or missing index", () => {
    expect(resolveClickedPonto(DATA, 99)).toBeUndefined();
    expect(resolveClickedPonto(DATA, undefined)).toBeUndefined();
    expect(resolveClickedPonto(DATA, null)).toBeUndefined();
  });
});
