import { apiFetch } from "./client";

export type CategorizationStatus = "pendente" | "confirmada" | "todas";
export type TransactionTipo = "debito" | "credito";

export interface CategorizedTransaction {
  id: number;
  account_id: number;
  user_id: number;
  descricao: string;
  descricao_usuario: string | null;
  descricao_sugerida: string | null;
  descricao_sugestao_origem_id: number | null;
  valor: string;
  tipo: TransactionTipo;
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
  liability_id: number | null;
  liability_sugerido_id: number | null;
  liability_sugestao_confianca: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionsPage {
  items: CategorizedTransaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface TransactionsFilter {
  status?: CategorizationStatus;
  tipo?: TransactionTipo;
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

export function fetchTransactions(filter: TransactionsFilter = {}): Promise<TransactionsPage> {
  const { status, tipo, ano, mes, page, pageSize } = filter;
  return apiFetch<TransactionsPage>(
    `/categorization/transactions${buildQuery({ status, tipo, ano, mes, page, page_size: pageSize })}`
  );
}

export function setCategory(
  transactionId: number,
  subcategoryId: number
): Promise<CategorizedTransaction> {
  return apiFetch<CategorizedTransaction>(
    `/categorization/transactions/${transactionId}/category`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategory_id: subcategoryId }),
    }
  );
}

export interface BulkConfirmItem {
  transactionId: number;
  subcategoryId: number;
}

export interface BulkConfirmResult {
  transaction_id: number;
  success: boolean;
  error: string | null;
}

export function bulkConfirm(items: BulkConfirmItem[]): Promise<{ results: BulkConfirmResult[] }> {
  return apiFetch<{ results: BulkConfirmResult[] }>("/categorization/transactions/bulk-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((item) => ({
        transaction_id: item.transactionId,
        subcategory_id: item.subcategoryId,
      })),
    }),
  });
}

export function setTransactionAsset(
  transactionId: number,
  assetId: number | null
): Promise<CategorizedTransaction> {
  return apiFetch<CategorizedTransaction>(`/categorization/transactions/${transactionId}/asset`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset_id: assetId }),
  });
}

export function setTransactionLiability(
  transactionId: number,
  liabilityId: number | null
): Promise<CategorizedTransaction> {
  return apiFetch<CategorizedTransaction>(
    `/categorization/transactions/${transactionId}/liability`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liability_id: liabilityId }),
    }
  );
}

export interface DescriptionUpdateResult {
  transaction: CategorizedTransaction;
  propagated: number;
}

export function updateDescription(
  transactionId: number,
  descricao: string
): Promise<DescriptionUpdateResult> {
  return apiFetch<DescriptionUpdateResult>(
    `/categorization/transactions/${transactionId}/description`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao }),
    }
  );
}

export function confirmDescriptionSuggestion(
  transactionId: number
): Promise<CategorizedTransaction> {
  return apiFetch<CategorizedTransaction>(
    `/categorization/transactions/${transactionId}/description/confirm`,
    { method: "POST" }
  );
}

export function dismissDescriptionSuggestion(
  transactionId: number
): Promise<CategorizedTransaction> {
  return apiFetch<CategorizedTransaction>(
    `/categorization/transactions/${transactionId}/description/dismiss`,
    { method: "POST" }
  );
}
