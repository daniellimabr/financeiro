import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PontoTendencia } from "../api/dashboards";
import { formatCurrency } from "../utils/format";

export interface ComparativoGrupo {
  group_id: number;
  group_nome: string;
  trend: PontoTendencia[] | undefined;
  color: string;
}

// Gráfico comparativo de categorias (Sprint 27, PRD-027 critério 5) —
// composição por categoria ao longo dos últimos meses (mesma janela do
// seletor de histórico 3/6/12), dentro do funil Despesa/Receita. Reaproveita
// o mesmo dado de tendência por subcategoria já buscado por GrupoAccordion
// (GET /dashboards/por-categoria/tendencia, somado por grupo via sumTrends)
// — sem chamada de rede nova. Independente do estado de "ocultar gasto": a
// simulação de item oculto é escopada ao mês/total exibido no funil, não à
// série histórica deste gráfico (ver PRD-027, escopo).
export function CategoriaComparativoChart({ grupos }: { grupos: ComparativoGrupo[] }) {
  const comparaveis = grupos.filter(
    (grupo): grupo is ComparativoGrupo & { trend: PontoTendencia[] } =>
      grupo.trend !== undefined && grupo.trend.length > 1
  );

  if (comparaveis.length === 0) return null;

  const meses = comparaveis[0]?.trend ?? [];
  const data = meses.map((ponto, i) => {
    const row: Record<string, string | number> = {
      label: `${String(ponto.mes).padStart(2, "0")}/${ponto.ano}`,
    };
    for (const grupo of comparaveis) {
      row[grupo.group_nome] = Number(grupo.trend[i]?.total ?? 0);
    }
    return row;
  });

  return (
    <div className="dash-chart dash-chart-comparativo">
      <h3>Comparativo por categoria</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="label"
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
          {comparaveis.map((grupo) => (
            <Area
              key={grupo.group_id}
              type="monotone"
              dataKey={grupo.group_nome}
              stackId="categorias"
              stroke={grupo.color}
              fill={grupo.color}
              fillOpacity={0.55}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {/* Legenda em HTML puro, fora do Recharts — o <Legend> embutido do
          Recharts usa position:absolute por padrão (não reserva espaço de
          layout) e o ResponsiveContainer tem altura fixa (220px), então uma
          legenda com muitas categorias reais (a fixture de teste local só
          usa 2, por isso isso nunca apareceu antes) simplesmente ultrapassa
          o rodapé do container sem empurrar o conteúdo abaixo — na prática
          sobrepunha e bloqueava cliques em elementos do funil acima dela.
          Achado real em QA ao vivo (check-sprint27.mjs) contra a VM de dev. */}
      <ul className="dash-chart-legend">
        {comparaveis.map((grupo) => (
          <li key={grupo.group_id}>
            <span className="swatch" style={{ background: grupo.color }} aria-hidden="true" />
            {grupo.group_nome}
          </li>
        ))}
      </ul>
    </div>
  );
}
