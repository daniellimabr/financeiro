// Única fonte dos rótulos de exibição de `natureza` (card, seletor da
// tabela de classificação, funil) — mesmo cuidado tomado com
// `subcategoryLabel` na Sprint 11, pra nunca haver rótulo divergente em
// dois lugares. `null`/valor desconhecido cai em "Custo eventual" (regra de
// negócio: subcategoria não classificada é eventual por padrão).
export type NaturezaValue = "fixa" | "variavel" | "eventual";

export const NATUREZA_ORDER: NaturezaValue[] = ["fixa", "variavel", "eventual"];

const NATUREZA_LABELS: Record<NaturezaValue, string> = {
  fixa: "Fixo recorrente",
  variavel: "Variável recorrente",
  eventual: "Custo eventual",
};

function toNaturezaValue(value: string | null | undefined): NaturezaValue {
  return value === "fixa" || value === "variavel" ? value : "eventual";
}

export function naturezaLabel(value: string | null | undefined): string {
  return NATUREZA_LABELS[toNaturezaValue(value)];
}

export function naturezaColorVar(value: string | null | undefined): string {
  return `var(--nat-${toNaturezaValue(value)})`;
}

export function naturezaBgVar(value: string | null | undefined): string {
  return `var(--nat-${toNaturezaValue(value)}-bg)`;
}
