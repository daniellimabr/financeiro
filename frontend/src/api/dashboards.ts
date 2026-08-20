import { apiFetch } from "./client";

export type TransacaoTipo = "debito" | "credito";

// Regime de leitura (Sprint 16) — toggle Competência (default)/Caixa
// exposto pelas agregações de Dashboards; não altera nada gravado, só qual
// coluna de data (data_competencia/data_caixa) as agregações usam.
export type Regime = "competencia" | "caixa";

interface RegimeFilter {
  regime?: Regime;
}

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
  ativos_totais: string;
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

export interface OrcamentoStatus {
  subcategory_id: number;
  orcado: string;
  realizado: string;
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

export interface NaturezaTotal {
  natureza: string;
  total: string;
  percentual: string;
}

export interface TendenciaNatureza {
  natureza: string;
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

export interface InvestimentoTotal {
  investimento_id: number;
  investimento_nome: string;
  total: string;
}

export interface TendenciaInvestimento {
  investimento_id: number;
  investimento_nome: string;
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

export interface PatrimonioBreakdown {
  ativos_totais: string;
  passivos: string;
  saldo_acumulado_mes: string;
  total: string;
}

export interface SaldoConta {
  account_id: number;
  account_nome: string;
  account_tipo: string;
  saldo: string;
  limite_credito: string | null;
}

export interface EvolucaoSaldoConta {
  account_id: number;
  account_nome: string;
  account_tipo: string;
  saldo_inicial: string;
  pontos: PontoTendencia[];
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

export function fetchDashboardSummary(
  filter: PeriodoFilter & RegimeFilter = {}
): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(`/dashboards/summary${buildQuery({ ...filter })}`);
}

export function fetchDashboardPorCategoria(
  tipo: TransacaoTipo,
  filter: PeriodoFilter & RegimeFilter = {}
): Promise<CategoriaTotal[]> {
  return apiFetch<CategoriaTotal[]>(`/dashboards/por-categoria${buildQuery({ tipo, ...filter })}`);
}

export function fetchDashboardPorOrcamento(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & RegimeFilter
): Promise<OrcamentoStatus[]> {
  return apiFetch<OrcamentoStatus[]>(`/dashboards/por-orcamento${buildQuery({ tipo, ...filter })}`);
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
  filter: Required<PeriodoFilter> & RegimeFilter & { meses: PeriodoHistorico }
): Promise<TendenciaMes[]> {
  return apiFetch<TendenciaMes[]>(`/dashboards/tendencia${buildQuery({ ...filter })}`);
}

export function fetchDashboardPorCategoriaTendencia(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & RegimeFilter & { meses: PeriodoHistorico }
): Promise<TendenciaCategoria[]> {
  return apiFetch<TendenciaCategoria[]>(
    `/dashboards/por-categoria/tendencia${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorNatureza(
  tipo: TransacaoTipo,
  filter: PeriodoFilter = {}
): Promise<NaturezaTotal[]> {
  return apiFetch<NaturezaTotal[]>(`/dashboards/por-natureza${buildQuery({ tipo, ...filter })}`);
}

export function fetchDashboardPorNaturezaTendencia(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & { meses: PeriodoHistorico }
): Promise<TendenciaNatureza[]> {
  return apiFetch<TendenciaNatureza[]>(
    `/dashboards/por-natureza/tendencia${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorAtivo(
  tipo: TransacaoTipo,
  filter: PeriodoFilter & RegimeFilter = {}
): Promise<AtivoTotal[]> {
  return apiFetch<AtivoTotal[]>(`/dashboards/por-ativo${buildQuery({ tipo, ...filter })}`);
}

export function fetchDashboardPorAtivoTendencia(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & RegimeFilter & { meses: PeriodoHistorico }
): Promise<TendenciaAtivo[]> {
  return apiFetch<TendenciaAtivo[]>(
    `/dashboards/por-ativo/tendencia${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorInvestimento(
  tipo: TransacaoTipo,
  filter: PeriodoFilter & RegimeFilter = {}
): Promise<InvestimentoTotal[]> {
  return apiFetch<InvestimentoTotal[]>(
    `/dashboards/por-investimento${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorInvestimentoTendencia(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & RegimeFilter & { meses: PeriodoHistorico }
): Promise<TendenciaInvestimento[]> {
  return apiFetch<TendenciaInvestimento[]>(
    `/dashboards/por-investimento/tendencia${buildQuery({ tipo, ...filter })}`
  );
}

export function fetchDashboardPorPassivo(
  filter: PeriodoFilter & RegimeFilter = {}
): Promise<PassivoTotal[]> {
  return apiFetch<PassivoTotal[]>(`/dashboards/por-passivo${buildQuery({ ...filter })}`);
}

export function fetchDashboardPorPassivoTendencia(
  filter: Required<PeriodoFilter> & RegimeFilter & { meses: PeriodoHistorico }
): Promise<TendenciaPassivo[]> {
  return apiFetch<TendenciaPassivo[]>(
    `/dashboards/por-passivo/tendencia${buildQuery({ ...filter })}`
  );
}

export function fetchSaldoPorConta(): Promise<SaldoConta[]> {
  return apiFetch<SaldoConta[]>("/dashboards/saldo-por-conta");
}

export function fetchPatrimonioBreakdown(
  regime: Regime = "competencia"
): Promise<PatrimonioBreakdown> {
  return apiFetch<PatrimonioBreakdown>(`/dashboards/patrimonio/breakdown${buildQuery({ regime })}`);
}

export function fetchEvolucaoSaldoPorConta(
  filter: Required<PeriodoFilter> & { meses?: number }
): Promise<EvolucaoSaldoConta[]> {
  return apiFetch<EvolucaoSaldoConta[]>(
    `/dashboards/evolucao-saldo-por-conta${buildQuery({ ...filter })}`
  );
}

export function fetchSaldoAcumulado(
  filter: Required<PeriodoFilter> & RegimeFilter & { meses?: number }
): Promise<PontoTendencia[]> {
  return apiFetch<PontoTendencia[]>(`/dashboards/saldo-acumulado${buildQuery({ ...filter })}`);
}
