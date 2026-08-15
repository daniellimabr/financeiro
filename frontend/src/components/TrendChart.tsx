import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PontoTendencia } from "../api/dashboards";
import { formatCurrency } from "../utils/format";

export function TrendChart({ pontos, color }: { pontos: PontoTendencia[]; color: string }) {
  const data = pontos.map((p) => ({ nome: `${p.mes}/${p.ano}`, total: Number(p.total) }));
  return (
    <div className="dash-chart">
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="nome"
            tick={{ fontSize: 11, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
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
            dataKey="total"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
