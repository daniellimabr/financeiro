import type { CategoriaTotal } from "../api/dashboards";

// Aritmética pura de agrupamento por CategoryGroup, extraída de
// GrupoAccordion (DashboardsPage.tsx) pra reuso em NaturezaPage — só soma
// por group_id, percentual do total do conjunto recebido, e ordenação desc.
// Cor/dado/tendência continuam proprietários de cada tela (ver PRD-013,
// "Regras de negócio").
export interface GrupoCategoriaTotal {
  group_id: number;
  group_nome: string;
  total: number;
  percentual: number;
  subcategorias: CategoriaTotal[];
}

export function groupCategoriaTotalsByGrupo(items: CategoriaTotal[]): GrupoCategoriaTotal[] {
  const totalGeral = items.reduce((sum, item) => sum + Number(item.total), 0);
  const porGrupo = new Map<number, GrupoCategoriaTotal>();
  for (const item of items) {
    const grupo = porGrupo.get(item.group_id) ?? {
      group_id: item.group_id,
      group_nome: item.group_nome,
      total: 0,
      percentual: 0,
      subcategorias: [],
    };
    grupo.total += Number(item.total);
    grupo.subcategorias.push(item);
    porGrupo.set(item.group_id, grupo);
  }
  return [...porGrupo.values()]
    .map((grupo) => ({
      ...grupo,
      percentual: totalGeral > 0 ? (grupo.total / totalGeral) * 100 : 0,
      subcategorias: [...grupo.subcategorias].sort((a, b) => Number(b.total) - Number(a.total)),
    }))
    .sort((a, b) => b.total - a.total);
}
