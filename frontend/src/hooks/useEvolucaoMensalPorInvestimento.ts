import { useQueries } from "@tanstack/react-query";

import type { EvolucaoMensal, Investimento } from "../api/investimentos";
import { fetchEvolucaoMensal } from "../api/investimentos";

// Busca a série mensal de cada investimento em paralelo (Sprint 36,
// PRD-036b) — alimenta o ranking "Desempenho no mês" da tela consolidada.
// Mesma queryKey de `useEvolucaoMensal` (["evolucaoMensal", id]), então o
// cache é compartilhado: não duplica requisição se o card individual do
// investimento também usar o hook singular pra outra coisa.
export function useEvolucaoMensalPorInvestimento(investimentos: Investimento[]) {
  return useQueries({
    queries: investimentos.map((investimento) => ({
      queryKey: ["evolucaoMensal", investimento.id],
      queryFn: () => fetchEvolucaoMensal(investimento.id),
    })),
  });
}

// Monta o mapa investimentoId -> série mensal a partir do resultado de
// useQueries acima — função pura e testável separadamente da parte que
// depende de rede (mesmo raciocínio de trendByInvestimento em
// DashboardsPage, só que exportada porque a tela de Investimentos precisa
// reconstruir o mesmo mapa duas vezes: pro ranking e pro sparkline de cada
// tile de entrada).
export function montarSeriePorInvestimento(
  investimentos: Investimento[],
  resultados: { data?: EvolucaoMensal[] }[]
): Map<number, EvolucaoMensal[]> {
  const mapa = new Map<number, EvolucaoMensal[]>();
  investimentos.forEach((investimento, index) => {
    const serie = resultados[index]?.data;
    if (serie) mapa.set(investimento.id, serie);
  });
  return mapa;
}
