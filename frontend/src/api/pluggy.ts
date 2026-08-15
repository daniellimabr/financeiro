import { apiFetch } from "./client";

export interface ConnectTokenResponse {
  access_token: string;
}

export interface PluggyItem {
  id: number;
  user_id: number;
  pluggy_item_id: string;
  connector_id: number;
  connector_name: string;
  status: string;
  status_detail: string | null;
  cutoff_date: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PluggyAccount {
  id: number;
  item_id: number;
  user_id: number;
  pluggy_account_id: string;
  tipo: string;
  nome: string;
  apelido: string | null;
  numero_mascarado: string | null;
  saldo: string;
  moeda: string;
  sync_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PluggyTransaction {
  id: number;
  account_id: number;
  user_id: number;
  pluggy_transaction_id: string;
  descricao: string;
  valor: string;
  tipo: string;
  data: string;
  data_competencia: string | null;
  subcategory_id: number | null;
  categoria_pluggy: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function fetchConnectToken(itemId?: string): Promise<ConnectTokenResponse> {
  return apiFetch<ConnectTokenResponse>("/pluggy/connect-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId ?? null }),
  });
}

export function fetchPluggyItems(): Promise<PluggyItem[]> {
  return apiFetch<PluggyItem[]>("/pluggy/items");
}

export function registerPluggyItem(pluggyItemId: string): Promise<PluggyItem> {
  return apiFetch<PluggyItem>("/pluggy/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pluggy_item_id: pluggyItemId }),
  });
}

export function syncPluggyItem(itemId: number): Promise<PluggyItem> {
  return apiFetch<PluggyItem>(`/pluggy/items/${itemId}/sync`, { method: "POST" });
}

export function fetchPluggyAccounts(): Promise<PluggyAccount[]> {
  return apiFetch<PluggyAccount[]>("/pluggy/accounts");
}

export function updatePluggyAccount(
  accountId: number,
  payload: { apelido: string | null; syncEnabled: boolean }
): Promise<PluggyAccount> {
  return apiFetch<PluggyAccount>(`/pluggy/accounts/${accountId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apelido: payload.apelido, sync_enabled: payload.syncEnabled }),
  });
}

export interface SyncItemResult {
  item_id: number;
  success: boolean;
  error: string | null;
  item: PluggyItem | null;
}

export function syncPluggyItems(itemIds?: number[]): Promise<{ results: SyncItemResult[] }> {
  return apiFetch<{ results: SyncItemResult[] }>("/pluggy/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds ?? null }),
  });
}

export interface PluggyTransactionFilters {
  ano?: number;
  mes?: number;
  subcategoryId?: number;
  accountTipo?: string;
  assetId?: number;
  tipo?: string;
  competencia?: boolean;
}

export function fetchPluggyTransactions(
  filters: PluggyTransactionFilters = {}
): Promise<PluggyTransaction[]> {
  const params = new URLSearchParams();
  if (filters.ano !== undefined) params.set("ano", String(filters.ano));
  if (filters.mes !== undefined) params.set("mes", String(filters.mes));
  if (filters.subcategoryId !== undefined) {
    params.set("subcategory_id", String(filters.subcategoryId));
  }
  if (filters.accountTipo !== undefined) params.set("account_tipo", filters.accountTipo);
  if (filters.assetId !== undefined) params.set("asset_id", String(filters.assetId));
  if (filters.tipo !== undefined) params.set("tipo", filters.tipo);
  if (filters.competencia) params.set("competencia", "true");

  const query = params.toString();
  return apiFetch<PluggyTransaction[]>(`/pluggy/transactions${query ? `?${query}` : ""}`);
}
