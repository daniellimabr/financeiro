import type { PontoProjecao } from "../api/dashboards";

export type HipoteticaTipo = "despesa" | "receita";
export type HipoteticaFrequencia = "unica" | "mensal";

export interface Hipotetica {
  id: string;
  nome: string;
  valor: number;
  tipo: HipoteticaTipo;
  frequencia: HipoteticaFrequencia;
  // Só usado quando frequencia === "unica" — mês-alvo dentro do horizonte.
  ano?: number;
  mes?: number;
}

// Estado local da tela "Projeção" (nunca trafega para o backend, ver
// PRD-014) — aplica cada hipotética sobre os pontos já retornados por
// GET /dashboards/projecao, recalculando receita/despesa/saldo no cliente.
export function applyHipoteticas(
  pontos: PontoProjecao[],
  hipoteticas: Hipotetica[]
): PontoProjecao[] {
  return pontos.map((ponto) => {
    let receita = Number(ponto.receita);
    let despesa = Number(ponto.despesa);
    for (const hipotetica of hipoteticas) {
      const aplica =
        hipotetica.frequencia === "mensal" ||
        (hipotetica.ano === ponto.ano && hipotetica.mes === ponto.mes);
      if (!aplica) continue;
      if (hipotetica.tipo === "receita") {
        receita += hipotetica.valor;
      } else {
        despesa += hipotetica.valor;
      }
    }
    return {
      ...ponto,
      receita: receita.toFixed(2),
      despesa: despesa.toFixed(2),
      saldo: (receita - despesa).toFixed(2),
    };
  });
}
