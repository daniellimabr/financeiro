import { apiFetch } from "./client";

export type AssetTipo = "imovel" | "veiculo" | "outro";

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

export interface AssetInput {
  nome: string;
  tipo: AssetTipo;
  valorAtual: string;
  dataAquisicao: string;
}

export interface AssetSellInput {
  valorVenda: string;
  dataVenda: string;
}

export function fetchAssets(): Promise<Asset[]> {
  return apiFetch<Asset[]>("/assets");
}

export function createAsset(input: AssetInput): Promise<Asset> {
  return apiFetch<Asset>("/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: input.nome,
      tipo: input.tipo,
      valor_atual: input.valorAtual,
      data_aquisicao: input.dataAquisicao,
    }),
  });
}

export function updateAsset(assetId: number, input: AssetInput): Promise<Asset> {
  return apiFetch<Asset>(`/assets/${assetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: input.nome,
      tipo: input.tipo,
      valor_atual: input.valorAtual,
      data_aquisicao: input.dataAquisicao,
    }),
  });
}

export function sellAsset(assetId: number, input: AssetSellInput): Promise<Asset> {
  return apiFetch<Asset>(`/assets/${assetId}/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor_venda: input.valorVenda, data_venda: input.dataVenda }),
  });
}

export function deleteAsset(assetId: number): Promise<void> {
  return apiFetch<void>(`/assets/${assetId}`, { method: "DELETE" });
}
