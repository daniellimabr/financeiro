import { apiFetch } from "./client";

export interface PendingTransaction {
  id: number;
  account_id: number;
  user_id: number;
  descricao: string;
  valor: string;
  tipo: string;
  data: string;
  status: string;
  categorizacao_status: string;
  subcategory_id: number | null;
  subcategoria_sugerida_id: number | null;
  sugestao_confianca: string | null;
  sugestao_fonte_tipo: string | null;
  sugestao_score: string | null;
  asset_id: number | null;
  asset_sugerido_id: number | null;
  asset_sugestao_confianca: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingTransactionsPage {
  items: PendingTransaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface PendingCategorizationsFilter {
  ano?: number;
  mes?: number;
  page?: number;
  pageSize?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function fetchPendingCategorizations(
  filter: PendingCategorizationsFilter = {}
): Promise<PendingTransactionsPage> {
  const { ano, mes, page, pageSize } = filter;
  return apiFetch<PendingTransactionsPage>(
    `/categorization/pending${buildQuery({ ano, mes, page, page_size: pageSize })}`
  );
}

export function confirmCategorization(
  transactionId: number,
  subcategoryId: number
): Promise<PendingTransaction> {
  return apiFetch<PendingTransaction>(`/categorization/pending/${transactionId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subcategory_id: subcategoryId }),
  });
}

export function setTransactionAsset(
  transactionId: number,
  assetId: number | null
): Promise<PendingTransaction> {
  return apiFetch<PendingTransaction>(`/categorization/pending/${transactionId}/asset`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset_id: assetId }),
  });
}
