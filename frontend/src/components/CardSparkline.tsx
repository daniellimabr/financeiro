import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import type { PontoTendencia } from "../api/dashboards";
import { formatCurrency } from "../utils/format";

export function CardSparkline({
  pontos,
  color,
}: {
  pontos: PontoTendencia[] | undefined;
  color: string;
}) {
  if (!pontos || pontos.length < 2) return null;
  const data = pontos.map((p) => ({
    label: `${String(p.mes).padStart(2, "0")}/${p.ano}`,
    total: Number(p.total),
  }));
  return (
    <span className="spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height={28}>
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <XAxis dataKey="label" hide />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              padding: "4px 8px",
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
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </span>
  );
}
