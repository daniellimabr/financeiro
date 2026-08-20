import { apiFetch } from "./client";

export type OrcamentoTipo = "eventual" | "recorrente";

export interface Orcamento {
  id: number;
  subcategory_id: number;
  tipo: OrcamentoTipo;
  valor: string;
  ano: number | null;
  mes: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoInput {
  subcategoryId: number;
  tipo: OrcamentoTipo;
  valor: string;
  ano?: number | null;
  mes?: number | null;
  dataInicio?: string | null;
  dataFim?: string | null;
}

function toBody(input: OrcamentoInput) {
  return {
    subcategory_id: input.subcategoryId,
    tipo: input.tipo,
    valor: input.valor,
    ano: input.ano ?? null,
    mes: input.mes ?? null,
    data_inicio: input.dataInicio ?? null,
    data_fim: input.dataFim ?? null,
  };
}

export function fetchOrcamentos(): Promise<Orcamento[]> {
  return apiFetch<Orcamento[]>("/orcamentos");
}

export function createOrcamento(input: OrcamentoInput): Promise<Orcamento> {
  return apiFetch<Orcamento>("/orcamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(input)),
  });
}

export function updateOrcamento(orcamentoId: number, input: OrcamentoInput): Promise<Orcamento> {
  return apiFetch<Orcamento>(`/orcamentos/${orcamentoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(input)),
  });
}

export function deleteOrcamento(orcamentoId: number): Promise<void> {
  return apiFetch<void>(`/orcamentos/${orcamentoId}`, { method: "DELETE" });
}
