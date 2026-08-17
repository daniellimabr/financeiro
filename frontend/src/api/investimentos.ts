import { apiFetch } from "./client";

export interface Investimento {
  id: number;
  user_id: number;
  nome: string;
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
