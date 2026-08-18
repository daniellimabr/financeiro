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
  saldo_inicial: string | null;
  investimento_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PluggyTransaction {
  id: number;
  account_id: number;
  user_id: number;
  pluggy_transaction_id: string;
  descricao: string;
  descricao_usuario: string | null;
  descricao_sugerida: string | null;
  valor: string;
  tipo: string;
  data: string;
  data_competencia: string | null;
  data_editada_manualmente: boolean;
  subcategory_id: number | null;
  subcategoria_sugerida_id: number | null;
  categoria_pluggy: string | null;
  status: string;
  account_tipo: string;
  asset_id: number | null;
  asset_sugerido_id: number | null;
  investimento_id: number | null;
  investimento_sugerido_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PluggyInvestment {
  id: number;
  item_id: number;
  user_id: number;
  pluggy_investment_id: string;
  tipo: string;
  subtipo: string | null;
  nome: string;
  codigo: string | null;
  quantidade: string | null;
  valor_investido: string | null;
  valor_atual: string;
  saldo_inicial: string | null;
  moeda: string;
  investimento_id: number | null;
  investimento_sugerido_id: number | null;
  investimento_sugestao_confianca: string | null;
  investimento_sugestao_fonte_tipo: string | null;
  investimento_sugestao_fonte_id: number | null;
  investimento_sugestao_score: string | null;
  created_at: string;
  updated_at: string;
}

export interface BaselineProposalLine {
  investment_id: number;
  nome: string;
  tipo: string;
  codigo: string | null;
  saldo_atual: string;
  saldo_inicial_proposto: string;
  confianca: string;
  motivo: string;
}

export function fetchBaselineProposal(): Promise<BaselineProposalLine[]> {
  return apiFetch<BaselineProposalLine[]>("/pluggy/investments/baseline-dez-2025");
}

export function confirmBaselineProposal(
  linhas: { investmentId: number; saldoInicial: string }[]
): Promise<PluggyInvestment[]> {
  return apiFetch<PluggyInvestment[]>("/pluggy/investments/baseline-dez-2025", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      linhas: linhas.map((linha) => ({
        investment_id: linha.investmentId,
        saldo_inicial: linha.saldoInicial,
      })),
    }),
  });
}

export interface PluggyInvestmentTransaction {
  id: number;
  investment_id: number;
  user_id: number;
  pluggy_investment_transaction_id: string;
  tipo: string;
  descricao: string | null;
  valor: string;
  quantidade: string | null;
  data: string;
  created_at: string;
  updated_at: string;
}

export function fetchPluggyInvestments(investimentoId?: number): Promise<PluggyInvestment[]> {
  const query = investimentoId !== undefined ? `?investimento_id=${investimentoId}` : "";
  return apiFetch<PluggyInvestment[]>(`/pluggy/investments${query}`);
}

export function updatePluggyInvestment(
  investmentId: number,
  investimentoId: number | null
): Promise<PluggyInvestment> {
  return apiFetch<PluggyInvestment>(`/pluggy/investments/${investmentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ investimento_id: investimentoId }),
  });
}

export function updatePluggyInvestmentSaldoInicial(
  investmentId: number,
  saldoInicial: string | null
): Promise<PluggyInvestment> {
  return apiFetch<PluggyInvestment>(`/pluggy/investments/${investmentId}/saldo-inicial`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ saldo_inicial: saldoInicial }),
  });
}

export function fetchPluggyInvestmentTransactions(
  investmentId: number
): Promise<PluggyInvestmentTransaction[]> {
  return apiFetch<PluggyInvestmentTransaction[]>(
    `/pluggy/investments/${investmentId}/transactions`
  );
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
  payload: { apelido: string | null; syncEnabled: boolean; investimentoId?: number | null }
): Promise<PluggyAccount> {
  return apiFetch<PluggyAccount>(`/pluggy/accounts/${accountId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apelido: payload.apelido,
      sync_enabled: payload.syncEnabled,
      investimento_id: payload.investimentoId ?? null,
    }),
  });
}

export function deleteAccount(accountId: number): Promise<void> {
  return apiFetch<void>(`/pluggy/accounts/${accountId}`, { method: "DELETE" });
}

export function updatePluggyAccountSaldoInicial(
  accountId: number,
  saldoInicial: string | null
): Promise<PluggyAccount> {
  return apiFetch<PluggyAccount>(`/pluggy/accounts/${accountId}/saldo-inicial`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ saldo_inicial: saldoInicial }),
  });
}

export interface SalarioAjusteDezembro {
  account_id: number;
  data: string;
  valor: string;
}

export function fetchSalarioAjusteDezembro(): Promise<SalarioAjusteDezembro | null> {
  return apiFetch<SalarioAjusteDezembro | null>("/pluggy/ajuste-salario-dezembro");
}

export function updateSalarioAjusteDezembro(payload: {
  accountId: number;
  data: string;
  valor: string | null;
}): Promise<SalarioAjusteDezembro | null> {
  return apiFetch<SalarioAjusteDezembro | null>("/pluggy/ajuste-salario-dezembro", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: payload.accountId,
      data: payload.data,
      valor: payload.valor,
    }),
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
  liabilityId?: number;
  investimentoId?: number;
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
  if (filters.liabilityId !== undefined) params.set("liability_id", String(filters.liabilityId));
  if (filters.investimentoId !== undefined) {
    params.set("investimento_id", String(filters.investimentoId));
  }
  if (filters.tipo !== undefined) params.set("tipo", filters.tipo);
  if (filters.competencia) params.set("competencia", "true");

  const query = params.toString();
  return apiFetch<PluggyTransaction[]>(`/pluggy/transactions${query ? `?${query}` : ""}`);
}
