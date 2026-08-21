import { apiFetch } from "./client";

export interface Investimento {
  id: number;
  user_id: number;
  nome: string;
  valor_atual: string;
  created_at: string;
  updated_at: string;
}

export interface InvestimentoInput {
  nome: string;
}

export interface InvestimentoEvolucao {
  saldo_base: string;
  saldo_atual: string;
  total_aportes: string;
  total_resgates: string;
  rendimento_estimado: string;
}

export function fetchInvestimentos(): Promise<Investimento[]> {
  return apiFetch<Investimento[]>("/investimentos");
}

export function createInvestimento(input: InvestimentoInput): Promise<Investimento> {
  return apiFetch<Investimento>("/investimentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: input.nome }),
  });
}

export function updateInvestimento(
  investimentoId: number,
  input: InvestimentoInput
): Promise<Investimento> {
  return apiFetch<Investimento>(`/investimentos/${investimentoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: input.nome }),
  });
}

export function deleteInvestimento(investimentoId: number): Promise<void> {
  return apiFetch<void>(`/investimentos/${investimentoId}`, { method: "DELETE" });
}

export function fetchInvestimentoEvolucao(investimentoId: number): Promise<InvestimentoEvolucao> {
  return apiFetch<InvestimentoEvolucao>(`/investimentos/${investimentoId}/evolucao`);
}

export interface EvolucaoMensal {
  ano_mes: string;
  saldo: string;
  valorizacao: string;
  rendimento: string;
  dividendos: string;
  aportes: string;
  resgates: string;
  confianca: string;
}

export function fetchEvolucaoMensal(investimentoId: number): Promise<EvolucaoMensal[]> {
  return apiFetch<EvolucaoMensal[]>(`/investimentos/${investimentoId}/evolucao-mensal`);
}

// Evolução mensal somando todos os investimentos do usuário (Sprint 36,
// PRD-036b) — mesmo formato de `EvolucaoMensal`, fonte agregada no backend
// (holdings de todos os Investimento do usuário, mesma regra de confiança
// mista resolvida uma vez só em `get_evolucao_mensal_consolidada`).
export function fetchEvolucaoMensalConsolidada(): Promise<EvolucaoMensal[]> {
  return apiFetch<EvolucaoMensal[]>("/investimentos/evolucao-mensal");
}

export interface InvestimentoTransacao {
  data: string;
  tipo: string;
  descricao: string | null;
  valor: string;
  origem: "conta" | "holding";
  holding_nome: string | null;
}

export function fetchInvestimentoTransacoes(
  investimentoId: number,
  { ano, mes }: { ano?: number; mes?: number } = {}
): Promise<InvestimentoTransacao[]> {
  const params = new URLSearchParams();
  if (ano !== undefined) params.set("ano", String(ano));
  if (mes !== undefined) params.set("mes", String(mes));
  const query = params.toString();
  return apiFetch<InvestimentoTransacao[]>(
    `/investimentos/${investimentoId}/transacoes${query ? `?${query}` : ""}`
  );
}
