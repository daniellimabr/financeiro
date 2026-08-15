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

export function fetchDashboardPorAtivo(filter: PeriodoFilter = {}): Promise<AtivoTotal[]> {
  return apiFetch<AtivoTotal[]>(`/dashboards/por-ativo${buildQuery({ ...filter })}`);
}
