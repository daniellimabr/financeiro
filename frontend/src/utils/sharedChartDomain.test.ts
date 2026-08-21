import { describe, expect, it } from "vitest";

import { computeSharedDomain } from "./sharedChartDomain";

describe("computeSharedDomain", () => {
  it("calcula o mínimo/máximo real entre duas séries, nunca por série isolada", () => {
    const receita = [7000, 7200, 7600, 7800, 8100, 8400];
    const despesa = [4800, 4900, 5000, 5050, 5100, 5120.3];
    const [min, max] = computeSharedDomain([receita, despesa]);
    // min/max reais são 4800/8400 — a folga (12%) fica pra fora desse range.
    expect(min).toBeLessThan(4800);
    expect(max).toBeGreaterThan(8400);
    expect(min).toBeGreaterThan(4800 - (8400 - 4800));
  });

  it("retorna [0, 0] para séries vazias", () => {
    expect(computeSharedDomain([[], []])).toEqual([0, 0]);
  });

  it("abre uma folga mínima quando todos os valores são iguais", () => {
    const [min, max] = computeSharedDomain([[100, 100, 100]]);
    expect(min).toBeLessThan(100);
    expect(max).toBeGreaterThan(100);
  });

  it("abre folga mínima de 1 quando a série constante é zero", () => {
    const [min, max] = computeSharedDomain([[0, 0]]);
    expect(min).toBe(-1);
    expect(max).toBe(1);
  });
});
