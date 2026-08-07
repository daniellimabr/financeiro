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
  numero_mascarado: string | null;
  saldo: string;
  moeda: string;
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

export function fetchPluggyTransactions(): Promise<PluggyTransaction[]> {
  return apiFetch<PluggyTransaction[]>("/pluggy/transactions");
}
