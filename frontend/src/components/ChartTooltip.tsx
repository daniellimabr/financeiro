import type { TooltipContentProps } from "recharts";

import { formatCurrency } from "../utils/format";

// Tooltip/crosshair reutilizável do sistema "Analyst Console" (Sprint 34,
// épico E10) — mesmo visual em qualquer LineChart do Recharts que precise de
// "passe o mouse, veja mês + valor exato" (hoje: comparativo Receita vs.
// Despesa; serve às próximas telas do épico também, ver PRD-034). Content
// customizado do <Tooltip> do Recharts + `chartCursorProps` pro crosshair
// vertical — não reimplementa a interação do zero, só estiliza a que o
// Recharts já oferece (evita duplicar a lógica de mousemove/hit-area que o
// TrendLineChart.tsx já resolve pros outros gráficos do app).
const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export interface ChartTooltipDatum {
  ano: number;
  mes: number;
  total: number;
}

export function formatMonthShort(mes: number, ano: number): string {
  const label = MESES_ABREV[mes - 1] ?? String(mes);
  return `${label}/${String(ano).slice(-2)}`;
}

// Crosshair vertical no ponto ativo — passar como prop `cursor` do <Tooltip>.
export const chartCursorProps = {
  stroke: "var(--ac-border-strong)",
  strokeWidth: 1,
};

export function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as ChartTooltipDatum | undefined;
  if (!point) return null;

  return (
    <div className="ac-chart-tooltip">
      <span className="ac-chart-tooltip-month">{formatMonthShort(point.mes, point.ano)}</span>
      {formatCurrency(point.total)}
    </div>
  );
}
