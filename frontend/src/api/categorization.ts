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

export function fetchPendingCategorizations(): Promise<PendingTransaction[]> {
  return apiFetch<PendingTransaction[]>("/categorization/pending");
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
