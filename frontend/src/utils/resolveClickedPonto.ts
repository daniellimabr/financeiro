import type { MouseHandlerDataParam } from "recharts";

// `activeIndex` vem tipado como number | string | null pelo recharts (uso
// interno de índice como chave de tooltip) — normaliza pro índice numérico
// do array `data` local. Compartilhada entre TrendLineChart e
// ProjectionChart (Sprint 26), os 2 lugares que resolvem clique-em-ponto
// pra {ano, mes}.
export function resolveClickedPonto(
  data: { ano: number; mes: number }[],
  activeIndex: MouseHandlerDataParam["activeIndex"]
): { ano: number; mes: number } | undefined {
  const index = typeof activeIndex === "string" ? Number(activeIndex) : activeIndex;
  if (typeof index !== "number" || !Number.isInteger(index)) return undefined;
  const ponto = data[index];
  return ponto ? { ano: ponto.ano, mes: ponto.mes } : undefined;
}
