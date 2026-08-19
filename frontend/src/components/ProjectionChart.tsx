import type { MouseEvent as ReactMouseEvent } from "react";
import type { MouseHandlerDataParam } from "recharts";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PontoProjecao, TendenciaMes } from "../api/dashboards";
import { formatCurrency } from "../utils/format";
import { resolveClickedPonto } from "../utils/resolveClickedPonto";

interface ChartPonto {
  nome: string;
  ano: number;
  mes: number;
  real: boolean;
  receitaReal?: number;
  despesaReal?: number;
  saldoReal?: number;
  receitaProjetada?: number;
  despesaProjetada?: number;
  saldoProjetada?: number;
}

// Primeiro gráfico do projeto a combinar 2 fontes na mesma série visual
// (ver riscos do plano da Sprint 14): o mês-base (último ponto do histórico)
// entra em ambos os campos Real/Projetada, então a linha sólida e a
// tracejada compartilham esse ponto e aparecem visualmente conectadas, sem
// gap.
export function ProjectionChart({
  historico,
  projecao,
  onSelecionarMes,
}: {
  historico: TendenciaMes[];
  projecao: PontoProjecao[];
  onSelecionarMes?: (ponto: { ano: number; mes: number }) => void;
}) {
  const data: ChartPonto[] = [
    ...historico.map((p, index) => {
      const isMesBase = index === historico.length - 1;
      return {
        nome: `${p.mes}/${p.ano}`,
        ano: p.ano,
        mes: p.mes,
        real: true,
        receitaReal: Number(p.receita),
        despesaReal: Number(p.despesa),
        saldoReal: Number(p.saldo),
        ...(isMesBase
          ? {
              receitaProjetada: Number(p.receita),
              despesaProjetada: Number(p.despesa),
              saldoProjetada: Number(p.saldo),
            }
          : {}),
      };
    }),
    ...projecao.map((p) => ({
      nome: `${p.mes}/${p.ano}`,
      ano: p.ano,
      mes: p.mes,
      real: false,
      receitaProjetada: Number(p.receita),
      despesaProjetada: Number(p.despesa),
      saldoProjetada: Number(p.saldo),
    })),
  ];

  // Clique-para-filtrar só se aplica a pontos de histórico real — um ponto
  // projetado não é "um mês" que a tela possa filtrar de verdade (é média
  // repetida, ver get_projecao). resolveClickedPonto (mesma lógica pura do
  // TrendLineChart) resolve o índice pro ponto do array local; o guard
  // `real` descarta o clique se caiu num ponto só-projetado.
  function handleClick(state: MouseHandlerDataParam, event: ReactMouseEvent) {
    if (!onSelecionarMes) return;
    const index =
      typeof state.activeIndex === "string" ? Number(state.activeIndex) : state.activeIndex;
    if (typeof index !== "number" || !data[index]?.real) return;
    const ponto = resolveClickedPonto(data, index);
    if (!ponto) return;
    event.stopPropagation();
    onSelecionarMes(ponto);
  }

  return (
    <div className="dash-chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
          onClick={onSelecionarMes ? handleClick : undefined}
          style={onSelecionarMes ? { cursor: "pointer" } : undefined}
        >
          <XAxis
            dataKey="nome"
            tick={{ fontSize: 11, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-h)" }}
          />
          <Line
            type="monotone"
            dataKey="receitaReal"
            name="Receita"
            stroke="var(--receita)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="receitaProjetada"
            name="Receita projetada"
            stroke="var(--receita)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="despesaReal"
            name="Despesa"
            stroke="var(--despesa)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="despesaProjetada"
            name="Despesa projetada"
            stroke="var(--despesa)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="saldoReal"
            name="Saldo"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="saldoProjetada"
            name="Saldo projetado"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
