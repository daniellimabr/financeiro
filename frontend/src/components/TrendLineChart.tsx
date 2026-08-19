import type { MouseEvent as ReactMouseEvent } from "react";
import type { MouseHandlerDataParam } from "recharts";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PontoTendencia } from "../api/dashboards";
import { formatCurrency } from "../utils/format";
import { resolveClickedPonto } from "../utils/resolveClickedPonto";

export type TrendChartVariant = "spark" | "row" | "card";

interface ChartDatum {
  label: string;
  total: number;
  ano: number;
  mes: number;
}

interface TrendLineChartProps {
  pontos: PontoTendencia[] | undefined;
  color: string;
  variant: TrendChartVariant;
  onSelecionarMes?: (ponto: { ano: number; mes: number }) => void;
}

// Legenda do eixo X só nos meses de início de trimestre (jan/abr/jul/out) —
// o ponto de dado continua mensal (tooltip mostra o mês exato no hover), só
// o rótulo do eixo é reduzido pra não empilhar 12 labels. Só a variante
// "card" mostra eixo.
function formatQuarterTick(label: string): string {
  const [mesStr, anoStr] = label.split("/");
  const mes = Number(mesStr);
  if (mes % 3 !== 1) return "";
  const trimestre = Math.ceil(mes / 3);
  return `T${trimestre}/${anoStr.slice(-2)}`;
}

const VARIANT_HEIGHT: Record<TrendChartVariant, number> = {
  spark: 28,
  row: 18,
  card: 140,
};

// "row" usa dimensões numéricas fixas (não "100%") de propósito: o
// ResponsiveContainer só resolve porcentagem medindo o container via
// ResizeObserver, que jsdom não dispara nos testes — com número fixo o
// recharts calcula o tamanho estaticamente e o gráfico realmente monta.
const ROW_WIDTH = 144;

// Sprint 26: único componente de gráfico de linha do sistema, parametrizado
// por tamanho/interatividade — substitui CardSparkline.tsx, TrendChart.tsx e
// o RowTrend (SVG manual) que vivia em DashboardsPage.tsx. Os 3 já
// compartilhavam Recharts e ganharam a mesma necessidade (tooltip mês/ano +
// clique-para-filtrar), então consolidar evita 3 implementações divergentes
// do mesmo comportamento.
export function TrendLineChart({ pontos, color, variant, onSelecionarMes }: TrendLineChartProps) {
  if (variant !== "card" && (!pontos || pontos.length < 2)) return null;

  const data: ChartDatum[] = (pontos ?? []).map((p) => ({
    label: `${String(p.mes).padStart(2, "0")}/${p.ano}`,
    total: Number(p.total),
    ano: p.ano,
    mes: p.mes,
  }));

  const interactive = Boolean(onSelecionarMes);

  function handleClick(state: MouseHandlerDataParam, event: ReactMouseEvent) {
    if (!onSelecionarMes) return;
    const ponto = resolveClickedPonto(data, state.activeIndex);
    if (!ponto) return;
    // Evita disparar o onClick do elemento pai (ex.: o botão do dash-tile ou
    // do dash-row que abre/fecha o funil) — clique num ponto só filtra, não
    // deve também expandir/recolher.
    event.stopPropagation();
    onSelecionarMes(ponto);
  }

  const chart = (
    <LineChart
      data={data}
      margin={
        variant === "card"
          ? { top: 8, right: 16, bottom: 4, left: 4 }
          : { top: 2, right: 2, bottom: 2, left: 2 }
      }
      onClick={interactive ? handleClick : undefined}
      style={interactive ? { cursor: "pointer" } : undefined}
    >
      {variant === "card" ? (
        <XAxis
          dataKey="label"
          tickFormatter={formatQuarterTick}
          tick={{ fontSize: 11, fill: "var(--text)" }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
      ) : (
        <XAxis dataKey="label" hide />
      )}
      <YAxis hide />
      <Tooltip
        formatter={(value) => formatCurrency(value as number)}
        contentStyle={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 12,
          padding: variant === "card" ? undefined : "4px 8px",
        }}
        itemStyle={{ fontSize: 12 }}
        labelStyle={{ fontSize: 12, color: "var(--text-h)" }}
      />
      <Line
        type="monotone"
        dataKey="total"
        name="Valor"
        stroke={color}
        strokeWidth={2}
        dot={variant === "card" ? { r: 3 } : false}
        activeDot={{ r: variant === "card" ? 5 : 4 }}
        isAnimationActive={false}
      />
    </LineChart>
  );

  if (variant === "card") {
    return (
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height={VARIANT_HEIGHT.card}>
          {chart}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <span className={variant === "row" ? "trend" : "spark"} aria-hidden="true">
      <ResponsiveContainer
        width={variant === "row" ? ROW_WIDTH : "100%"}
        height={VARIANT_HEIGHT[variant]}
      >
        {chart}
      </ResponsiveContainer>
    </span>
  );
}
