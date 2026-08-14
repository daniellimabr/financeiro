import { apiFetch } from "./client";

export interface Asset {
  id: number;
  user_id: number;
  nome: string;
  tipo: string;
  valor_atual: string;
  data_aquisicao: string;
  status: string;
  data_venda: string | null;
  valor_venda: string | null;
  created_at: string;
  updated_at: string;
}

export function fetchAssets(): Promise<Asset[]> {
  return apiFetch<Asset[]>("/assets");
}
