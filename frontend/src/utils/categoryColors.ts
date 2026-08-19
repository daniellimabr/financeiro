import type { CategoryGroup, Subcategory } from "../api/categories";

// 16 matizes validados (dataviz skill, scripts/validate_palette.js) em
// --cat-1..--cat-16 (index.css) — expandido de 8 na Sprint 24 pra eliminar a
// colisão matemática de `i % 8` com >8 grupos cadastrados. Atribuição por
// índice estável (id da entidade em ordem crescente), nunca por ranking do
// período — a mesma entidade mantém a mesma cor independente do filtro
// ano/mês (ver skill dataviz: "color follows the entity, never its rank").
// Reaproveitada tanto por categoria/grupo (funil de despesas/receitas)
// quanto por ativo (drilldown de Ativos) — mesma fonte de verdade.
const PALETTE_SIZE = 16;
const TINT_STEPS = [85, 65, 45, 25];

export function buildColorIndexFromIds(ids: number[]): Map<number, number> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  sorted.forEach((id, i) => map.set(id, i % PALETTE_SIZE));
  return map;
}

export function groupColorVar(id: number, index: Map<number, number>): string {
  const slot = index.get(id);
  return slot === undefined ? "var(--text)" : `var(--cat-${slot + 1})`;
}

export function buildSubcategoryTintIndex(subcategories: Subcategory[]): Map<number, number> {
  const byGroup = new Map<number, Subcategory[]>();
  for (const sub of [...subcategories].sort((a, b) => a.id - b.id)) {
    const list = byGroup.get(sub.group_id) ?? [];
    list.push(sub);
    byGroup.set(sub.group_id, list);
  }
  const map = new Map<number, number>();
  for (const list of byGroup.values()) {
    list.forEach((sub, i) => map.set(sub.id, i % TINT_STEPS.length));
  }
  return map;
}

export function subcategoryColorVar(
  subcategoryId: number,
  groupId: number,
  groupIndex: Map<number, number>,
  tintIndex: Map<number, number>
): string {
  const base = groupColorVar(groupId, groupIndex);
  const tintSlot = tintIndex.get(subcategoryId) ?? 0;
  const pct = TINT_STEPS[tintSlot];
  return `color-mix(in oklch, ${base} ${pct}%, var(--surface))`;
}

// Helper de conveniência pros call sites que ainda têm a lista de grupos
// (não só os ids) — mesma função de índice, só extrai os ids primeiro.
export function buildGroupColorIndex(groups: CategoryGroup[]): Map<number, number> {
  return buildColorIndexFromIds(groups.map((g) => g.id));
}
