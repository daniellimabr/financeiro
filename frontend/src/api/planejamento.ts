import { apiFetch } from "./client";
import type { TransacaoTipo } from "./dashboards";

export type CelulaOrigem =
  "realizado" | "sugerido" | "confirmado" | "hipotetico" | "cumprido" | "vazio";

export interface CelulaGrade {
  ano: number;
  mes: number;
  valor: string;
  origem: CelulaOrigem;
  realizado_parcial: string | null;
  status: "dentro" | "alerta" | null;
  transacao_vinculada_id: number | null;
}

export interface LinhaSubcategoriaGrade {
  subcategory_id: number;
  subcategory_nome: string;
  group_id: number;
  group_nome: string;
  tipo: TransacaoTipo;
  celulas: CelulaGrade[];
}

export interface LinhaItemGrade {
  item_id: number;
  nome: string;
  tipo: TransacaoTipo;
  recorrente: boolean;
  cumprido: boolean;
  celulas: CelulaGrade[];
}

export interface LinhaEventualGrade {
  tipo: TransacaoTipo;
  celulas: CelulaGrade[];
}

export interface Grade {
  periodo: [number, number][];
  subcategorias: LinhaSubcategoriaGrade[];
  itens: LinhaItemGrade[];
  eventuais: LinhaEventualGrade[];
  total_despesas: CelulaGrade[];
  total_receitas: CelulaGrade[];
  saldo: CelulaGrade[];
}

export function fetchPlanejamentoGrade(anoBase: number, mesBase: number): Promise<Grade> {
  return apiFetch<Grade>(`/planejamento/grade?ano_base=${anoBase}&mes_base=${mesBase}`);
}

export function confirmarPlanejamentoValor(
  subcategoryId: number,
  input: { ano: number; mes: number; valor: string }
): Promise<unknown> {
  return apiFetch(`/planejamento/valores/${subcategoryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function removerPlanejamentoValor(
  subcategoryId: number,
  ano: number,
  mes: number
): Promise<void> {
  return apiFetch<void>(`/planejamento/valores/${subcategoryId}?ano=${ano}&mes=${mes}`, {
    method: "DELETE",
  });
}

export interface ItemPlanejado {
  id: number;
  nome: string;
  tipo: TransacaoTipo;
  valor: string;
  data_inicio: string;
  recorrente: boolean;
  data_fim: string | null;
  transacao_vinculada_id: number | null;
}

export interface ItemPlanejadoInput {
  nome: string;
  tipo: TransacaoTipo;
  valor: string;
  dataInicio: string;
  recorrente: boolean;
  dataFim: string | null;
}

function toBody(input: ItemPlanejadoInput) {
  return {
    nome: input.nome,
    tipo: input.tipo,
    valor: input.valor,
    data_inicio: input.dataInicio,
    recorrente: input.recorrente,
    data_fim: input.dataFim,
  };
}

export function fetchItensPlanejados(): Promise<ItemPlanejado[]> {
  return apiFetch<ItemPlanejado[]>("/planejamento/itens");
}

export function createItemPlanejado(input: ItemPlanejadoInput): Promise<ItemPlanejado> {
  return apiFetch<ItemPlanejado>("/planejamento/itens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(input)),
  });
}

export function updateItemPlanejado(
  itemId: number,
  input: ItemPlanejadoInput
): Promise<ItemPlanejado> {
  return apiFetch<ItemPlanejado>(`/planejamento/itens/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(input)),
  });
}

export function deleteItemPlanejado(itemId: number): Promise<void> {
  return apiFetch<void>(`/planejamento/itens/${itemId}`, { method: "DELETE" });
}

export function vincularItemPlanejado(itemId: number, transacaoId: number): Promise<ItemPlanejado> {
  return apiFetch<ItemPlanejado>(`/planejamento/itens/${itemId}/vincular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transacao_id: transacaoId }),
  });
}

export function desvincularItemPlanejado(itemId: number): Promise<ItemPlanejado> {
  return apiFetch<ItemPlanejado>(`/planejamento/itens/${itemId}/desvincular`, {
    method: "POST",
  });
}
