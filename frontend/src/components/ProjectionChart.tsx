import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PontoProjecao, TendenciaMes } from "../api/dashboards";
import { formatCurrency } from "../utils/format";

interface ChartPonto {
  nome: string;
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
}: {
  historico: TendenciaMes[];
  projecao: PontoProjecao[];
}) {
  const data: ChartPonto[] = [
    ...historico.map((p, index) => {
      const isMesBase = index === historico.length - 1;
      return {
        nome: `${p.mes}/${p.ano}`,
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
      receitaProjetada: Number(p.receita),
      despesaProjetada: Number(p.despesa),
      saldoProjetada: Number(p.saldo),
    })),
  ];

  return (
    <div className="dash-chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
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
