import { describe, expect, it } from "vitest";

import type { PontoProjecao } from "../api/dashboards";
import { applyHipoteticas, type Hipotetica } from "./projecao";

function pontos(): PontoProjecao[] {
  return [
    { ano: 2026, mes: 2, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
    { ano: 2026, mes: 3, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
    { ano: 2026, mes: 4, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  ];
}

describe("applyHipoteticas", () => {
  it("returns unmodified values when there are no hipoteticas", () => {
    const resultado = applyHipoteticas(pontos(), []);

    expect(resultado).toEqual(pontos());
  });

  it("unica hipotetica only affects the target month", () => {
    const hipotetica: Hipotetica = {
      id: "1",
      nome: "Reforma",
      valor: 5000,
      tipo: "despesa",
      frequencia: "unica",
      ano: 2026,
      mes: 3,
    };

    const resultado = applyHipoteticas(pontos(), [hipotetica]);

    expect(resultado[0].despesa).toBe("900.00");
    expect(resultado[1].despesa).toBe("5900.00");
    expect(resultado[1].saldo).toBe("-3900.00");
    expect(resultado[2].despesa).toBe("900.00");
  });

  it("mensal hipotetica affects every month in the horizon", () => {
    const hipotetica: Hipotetica = {
      id: "1",
      nome: "Freelance",
      valor: 300,
      tipo: "receita",
      frequencia: "mensal",
    };

    const resultado = applyHipoteticas(pontos(), [hipotetica]);

    expect(resultado.every((p) => p.receita === "2300.00")).toBe(true);
    expect(resultado.every((p) => p.saldo === "1400.00")).toBe(true);
  });

  it("multiple hipoteticas sum correctly on the same month", () => {
    const hipoteticas: Hipotetica[] = [
      {
        id: "1",
        nome: "Carro",
        valor: 40000,
        tipo: "despesa",
        frequencia: "unica",
        ano: 2026,
        mes: 4,
      },
      {
        id: "2",
        nome: "Bônus",
        valor: 1000,
        tipo: "receita",
        frequencia: "unica",
        ano: 2026,
        mes: 4,
      },
      { id: "3", nome: "Freelance", valor: 200, tipo: "receita", frequencia: "mensal" },
    ];

    const resultado = applyHipoteticas(pontos(), hipoteticas);

    const abril = resultado[2];
    expect(abril.receita).toBe("3200.00");
    expect(abril.despesa).toBe("40900.00");
    expect(abril.saldo).toBe("-37700.00");
    expect(resultado[0].receita).toBe("2200.00");
  });

  it("target month outside the horizon does not affect any point", () => {
    const hipotetica: Hipotetica = {
      id: "1",
      nome: "Fora do horizonte",
      valor: 999,
      tipo: "despesa",
      frequencia: "unica",
      ano: 2027,
      mes: 1,
    };

    const resultado = applyHipoteticas(pontos(), [hipotetica]);

    expect(resultado).toEqual(pontos());
  });
});
