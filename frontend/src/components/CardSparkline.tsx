import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { formatCurrency } from "../utils/format";

export function CardSparkline({ values, color }: { values: number[] | undefined; color: string }) {
  if (!values || values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <span className="spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height={28}>
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <XAxis dataKey="i" hide />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            labelFormatter={() => ""}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              padding: "4px 8px",
            }}
          />
          <Line
            type="monotone"
            dataKey="v"
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
