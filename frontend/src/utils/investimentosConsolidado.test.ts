import { describe, expect, it } from "vitest";

import type { EvolucaoMensal } from "../api/investimentos";
import {
  encontrarMesEAnterior,
  evolucaoMensalParaPontos,
  temMesReconstruido,
} from "./investimentosConsolidado";

function ponto(overrides: Partial<EvolucaoMensal> & { ano_mes: string }): EvolucaoMensal {
  return {
    saldo: "0",
    valorizacao: "0",
    rendimento: "0",
    dividendos: "0",
    aportes: "0",
    resgates: "0",
    confianca: "real",
    ...overrides,
  };
}

describe("evolucaoMensalParaPontos", () => {
  it("converte ano_mes 'YYYY-MM' pro formato {ano, mes, total}", () => {
    const serie = [
      ponto({ ano_mes: "2026-06", saldo: "1000.00" }),
      ponto({ ano_mes: "2026-07", saldo: "1200.00" }),
    ];

    expect(evolucaoMensalParaPontos(serie, "saldo")).toEqual([
      { ano: 2026, mes: 6, total: "1000.00" },
      { ano: 2026, mes: 7, total: "1200.00" },
    ]);
  });

  it("lê o campo pedido, não sempre saldo", () => {
    const serie = [ponto({ ano_mes: "2026-06", rendimento: "150.00" })];

    expect(evolucaoMensalParaPontos(serie, "rendimento")).toEqual([
      { ano: 2026, mes: 6, total: "150.00" },
    ]);
  });

  it("retorna array vazio pra série vazia", () => {
    expect(evolucaoMensalParaPontos([], "saldo")).toEqual([]);
  });
});

describe("encontrarMesEAnterior", () => {
  const serie = [
    ponto({ ano_mes: "2026-05", saldo: "900.00" }),
    ponto({ ano_mes: "2026-06", saldo: "1000.00" }),
    ponto({ ano_mes: "2026-07", saldo: "1200.00" }),
  ];

  it("encontra o mês atual e o anterior na série", () => {
    const resultado = encontrarMesEAnterior(serie, 2026, 7);
    expect(resultado.atual?.saldo).toBe("1200.00");
    expect(resultado.anterior?.saldo).toBe("1000.00");
  });

  it("anterior é undefined quando o mês atual é o primeiro da série", () => {
    const resultado = encontrarMesEAnterior(serie, 2026, 5);
    expect(resultado.atual?.saldo).toBe("900.00");
    expect(resultado.anterior).toBeUndefined();
  });

  it("atual e anterior são undefined quando o mês filtrado não está na série", () => {
    const resultado = encontrarMesEAnterior(serie, 2025, 1);
    expect(resultado.atual).toBeUndefined();
    expect(resultado.anterior).toBeUndefined();
  });

  it("não confunde meses com o mesmo número em anos diferentes", () => {
    const serieDoisAnos = [
      ponto({ ano_mes: "2025-07", saldo: "500.00" }),
      ponto({ ano_mes: "2026-07", saldo: "1200.00" }),
    ];
    const resultado = encontrarMesEAnterior(serieDoisAnos, 2026, 7);
    expect(resultado.atual?.saldo).toBe("1200.00");
    expect(resultado.anterior?.saldo).toBe("500.00");
  });
});

describe("temMesReconstruido", () => {
  it("true quando algum ponto é reconstruido", () => {
    const serie = [
      ponto({ ano_mes: "2026-06", confianca: "real" }),
      ponto({ ano_mes: "2026-07", confianca: "reconstruido" }),
    ];
    expect(temMesReconstruido(serie)).toBe(true);
  });

  it("false quando todos os pontos são reais", () => {
    const serie = [
      ponto({ ano_mes: "2026-06", confianca: "real" }),
      ponto({ ano_mes: "2026-07", confianca: "real" }),
    ];
    expect(temMesReconstruido(serie)).toBe(false);
  });

  it("false pra série vazia", () => {
    expect(temMesReconstruido([])).toBe(false);
  });
});
