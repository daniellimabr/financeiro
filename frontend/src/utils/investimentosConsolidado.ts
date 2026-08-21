import type { PontoTendencia } from "../api/dashboards";
import type { EvolucaoMensal } from "../api/investimentos";

export type CampoEvolucaoMensal = "saldo" | "rendimento" | "aportes" | "resgates";

function parseAnoMes(anoMes: string): { ano: number; mes: number } {
  const [ano, mes] = anoMes.split("-").map(Number);
  return { ano, mes };
}

// Converte a série "YYYY-MM" que a API de evolução mensal retorna pro
// formato {ano, mes, total} que TrendLineChart/KpiTile já sabem desenhar
// (mesmo formato de PontoTendencia usado pelas tendências de Receita/
// Despesa do Dashboard) — mantém o gráfico/sparkline consolidado de
// Investimentos reaproveitando o componente existente sem adaptação.
export function evolucaoMensalParaPontos(
  serie: EvolucaoMensal[],
  campo: CampoEvolucaoMensal
): PontoTendencia[] {
  return serie.map((ponto) => ({
    ...parseAnoMes(ponto.ano_mes),
    total: ponto[campo],
  }));
}

// Localiza o ponto do mês filtrado (ano/mes da toolbar) e o ponto do mês
// imediatamente anterior NA SÉRIE (não necessariamente ano/mês-1 no
// calendário — um mês sem nenhum snapshot simplesmente não aparece na
// série) — usados pro valor exibido no KpiTile e pro delta% vs. anterior.
export function encontrarMesEAnterior(
  serie: EvolucaoMensal[],
  ano: number,
  mes: number
): { atual: EvolucaoMensal | undefined; anterior: EvolucaoMensal | undefined } {
  const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;
  const index = serie.findIndex((ponto) => ponto.ano_mes === anoMes);
  if (index === -1) return { atual: undefined, anterior: undefined };
  return { atual: serie[index], anterior: index > 0 ? serie[index - 1] : undefined };
}

// true se algum ponto da série estiver marcado "reconstruido" — mesmo
// texto/tratamento já usado em InvestimentoSerieHistorica (Sprint 21),
// reaproveitado aqui pro badge do painel consolidado.
export function temMesReconstruido(serie: EvolucaoMensal[]): boolean {
  return serie.some((ponto) => ponto.confianca === "reconstruido");
}
