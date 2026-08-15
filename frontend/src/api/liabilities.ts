import { apiFetch } from "./client";

export type LiabilityTipo = "financiamento" | "outro";

export interface Liability {
  id: number;
  user_id: number;
  nome: string;
  tipo: string;
  valor_total: string;
  saldo_devedor: string;
  status: string;
  data_quitacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiabilityInput {
  nome: string;
  tipo: LiabilityTipo;
  valorTotal: string;
  saldoDevedor: string;
}

export function fetchLiabilities(): Promise<Liability[]> {
  return apiFetch<Liability[]>("/liabilities");
}

export function createLiability(input: LiabilityInput): Promise<Liability> {
  return apiFetch<Liability>("/liabilities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: input.nome,
      tipo: input.tipo,
      valor_total: input.valorTotal,
      saldo_devedor: input.saldoDevedor,
    }),
  });
}

export function updateLiability(liabilityId: number, input: LiabilityInput): Promise<Liability> {
  return apiFetch<Liability>(`/liabilities/${liabilityId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: input.nome,
      tipo: input.tipo,
      valor_total: input.valorTotal,
      saldo_devedor: input.saldoDevedor,
    }),
  });
}

export function settleLiability(liabilityId: number): Promise<Liability> {
  return apiFetch<Liability>(`/liabilities/${liabilityId}/settle`, { method: "POST" });
}

export function deleteLiability(liabilityId: number): Promise<void> {
  return apiFetch<void>(`/liabilities/${liabilityId}`, { method: "DELETE" });
}
