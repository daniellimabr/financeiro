import { apiFetch } from "./client";

export type TransacaoTipo = "debito" | "credito";

// Sentinel usado pelo backend (app.models.category.SEM_CATEGORIA_ID) para
// representar "sem subcategoria atribuída" em group_id/subcategory_id e nos
// filtros categoria_id/subcategory_id.
export const SEM_CATEGORIA_ID = 0;

export interface DashboardSummary {
  receita: string;
  despesa: string;
  saldo: string;
  patrimonio: string;
  ativos: string;
  passivos: string;
}

export interface CategoriaTotal {
  group_id: number;
  group_nome: string;
  subcategory_id: number;
  subcategory_nome: string;
  total: string;
  percentual: string;
}

export interface MeioPagamentoTotal {
  account_tipo: string;
  total: string;
  percentual: string;
}

export interface TendenciaMes {
  ano: number;
  mes: number;
  receita: string;
  despesa: string;
  saldo: string;
}

export interface PontoTendencia {
  ano: number;
  mes: number;
  total: string;
}

export interface TendenciaCategoria {
  subcategory_id: number;
  subcategory_nome: string;
  pontos: PontoTendencia[];
}

export interface AtivoTotal {
  asset_id: number;
  asset_nome: string;
  total: string;
}

export interface TendenciaAtivo {
  asset_id: number;
  asset_nome: string;
  pontos: PontoTendencia[];
}

export interface PassivoTotal {
  liability_id: number;
  liability_nome: string;
  total: string;
}

export interface TendenciaPassivo {
  liability_id: number;
  liability_nome: string;
  pontos: PontoTendencia[];
}

export interface SaldoConta {
  account_id: number;
  account_nome: string;
  account_tipo: string;
  saldo: string;
  limite_credito: string | null;
}

// Período histórico oferecido pelo seletor de tendência (3/6/12 meses).
export type PeriodoHistorico = 3 | 6 | 12;

export interface PeriodoFilter {
  ano?: number;
  mes?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function fetchDashboardSummary(filter: PeriodoFilter = {}): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(`/dashboards/summary${buildQuery({ ...filter })}`);
}

export function fetchDashboardPorCategoria(
  tipo: TransacaoTipo,
  filter: PeriodoFilter = {}
): Promise<CategoriaTotal[]> {
  return apiFetch<CategoriaTotal[]>(`/dashboards/por-categoria${buildQuery({ tipo, ...filter })}`);
}

export function fetchDashboardPorMeioPagamento(
  tipo: TransacaoTipo,
  filter: PeriodoFilter & { categoriaId?: number } = {}
): Promise<MeioPagamentoTotal[]> {
  const { categoriaId, ...periodo } = filter;
  return apiFetch<MeioPagamentoTotal[]>(
    `/dashboards/por-meio-pagamento${buildQuery({ tipo, ...periodo, categoria_id: categoriaId })}`
  );
}

export function fetchDashboardTendencia(
  filter: Required<PeriodoFilter> & { meses: PeriodoHistorico }
): Promise<TendenciaMes[]> {
  return apiFetch<TendenciaMes[]>(`/dashboards/tendencia${buildQuery({ ...filter })}`);
}

export function fetchDashboardPorCategoriaTendencia(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & { meses: PeriodoHistorico }
): Promise<TendenciaCategoria[]> {
  return apiFetch<TendenciaCategoria[]>(
    `/dashboards/por-categoria/tendencia${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorAtivo(
  tipo: TransacaoTipo,
  filter: PeriodoFilter = {}
): Promise<AtivoTotal[]> {
  return apiFetch<AtivoTotal[]>(`/dashboards/por-ativo${buildQuery({ tipo, ...filter })}`);
}

export function fetchDashboardPorAtivoTendencia(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & { meses: PeriodoHistorico }
): Promise<TendenciaAtivo[]> {
  return apiFetch<TendenciaAtivo[]>(
    `/dashboards/por-ativo/tendencia${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorPassivo(filter: PeriodoFilter = {}): Promise<PassivoTotal[]> {
  return apiFetch<PassivoTotal[]>(`/dashboards/por-passivo${buildQuery({ ...filter })}`);
}

export function fetchDashboardPorPassivoTendencia(
  filter: Required<PeriodoFilter> & { meses: PeriodoHistorico }
): Promise<TendenciaPassivo[]> {
  return apiFetch<TendenciaPassivo[]>(
    `/dashboards/por-passivo/tendencia${buildQuery({ ...filter })}`
  );
}

export function fetchSaldoPorConta(): Promise<SaldoConta[]> {
  return apiFetch<SaldoConta[]>("/dashboards/saldo-por-conta");
}
