import type { CategoryGroup, Subcategory } from "../api/categories";

// 8 matizes validados (dataviz skill) em --cat-1..--cat-8 (index.css).
// Atribuição por índice estável (id do grupo/subcategoria em ordem
// crescente), nunca por ranking do período — a mesma categoria mantém a
// mesma cor independente do filtro ano/mês (ver skill dataviz: "color
// follows the entity, never its rank").
const PALETTE_SIZE = 8;
const TINT_STEPS = [85, 65, 45, 25];

export function buildGroupColorIndex(groups: CategoryGroup[]): Map<number, number> {
  const sorted = [...groups].sort((a, b) => a.id - b.id);
  const map = new Map<number, number>();
  sorted.forEach((group, i) => map.set(group.id, i % PALETTE_SIZE));
  return map;
}

export function groupColorVar(groupId: number, index: Map<number, number>): string {
  const slot = index.get(groupId);
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
