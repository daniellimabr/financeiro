import type { Asset } from "../api/assets";
import type { CategoryGroup, Subcategory } from "../api/categories";
import type { Investimento } from "../api/investimentos";

// Forma mínima compartilhada entre `CategorizedTransaction` (api/categorization.ts)
// e `PluggyTransaction` (api/pluggy.ts) — os dois já trazem esses campos.
export interface EditableTransaction {
  id: number;
  descricao: string;
  descricao_usuario: string | null;
  descricao_sugerida: string | null;
  subcategory_id: number | null;
  subcategoria_sugerida_id: number | null;
  asset_id: number | null;
  asset_sugerido_id: number | null;
  investimento_id: number | null;
  investimento_sugerido_id: number | null;
  data: string;
  data_editada_manualmente: boolean;
}

export function descricaoExibida(transaction: EditableTransaction): string {
  return transaction.descricao_usuario ?? transaction.descricao;
}

export function subcategoryLabel(
  subcategoryId: number,
  subcategories: Subcategory[] | undefined,
  groups: CategoryGroup[] | undefined
): string {
  const subcategory = subcategories?.find((s) => s.id === subcategoryId);
  if (!subcategory) return `Subcategoria ${subcategoryId}`;
  const group = groups?.find((g) => g.id === subcategory.group_id);
  return group ? `${group.nome} / ${subcategory.nome}` : subcategory.nome;
}

export function assetLabel(
  assetId: number | null | undefined,
  assets: Asset[] | undefined
): string {
  if (assetId === null || assetId === undefined) return "";
  return assets?.find((asset) => asset.id === assetId)?.nome ?? "";
}

export function investimentoLabel(
  investimentoId: number | null | undefined,
  investimentos: Investimento[] | undefined
): string {
  if (investimentoId === null || investimentoId === undefined) return "";
  return investimentos?.find((investimento) => investimento.id === investimentoId)?.nome ?? "";
}
