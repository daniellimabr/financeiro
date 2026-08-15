import { useState, type FormEvent } from "react";

import type { Asset, AssetInput, AssetTipo } from "../api/assets";
import type { PeriodoFilter } from "../api/dashboards";
import { PeriodFilter } from "../components/PeriodFilter";
import { useAssetGastos } from "../hooks/useAssetGastos";
import { useAssets } from "../hooks/useAssets";
import { useCreateAsset } from "../hooks/useCreateAsset";
import { useDeleteAsset } from "../hooks/useDeleteAsset";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";
import { useSellAsset } from "../hooks/useSellAsset";
import { useUpdateAsset } from "../hooks/useUpdateAsset";
import { formatCurrency } from "../utils/format";

const TIPO_LABEL: Record<string, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  outro: "Outro",
};

const EMPTY_FORM: AssetInput = {
  nome: "",
  tipo: "outro",
  valorAtual: "",
  dataAquisicao: "",
};

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssetsPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const filter: PeriodoFilter = { ano, mes };

  const assetsQuery = useAssets();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const sellAsset = useSellAsset();
  const deleteAsset = useDeleteAsset();

  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<AssetInput>(EMPTY_FORM);

  const [sellingAssetId, setSellingAssetId] = useState<number | null>(null);
  const [sellForm, setSellForm] = useState({ valorVenda: "", dataVenda: hoje() });

  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);

  const assets = assetsQuery.data ?? [];
  const ativos = assets.filter((asset) => asset.status === "ativo");
  const baixados = assets.filter((asset) => asset.status === "baixado");
  const sellingAsset = assets.find((asset) => asset.id === sellingAssetId) ?? null;

  function openCreateForm() {
    setEditingAssetId(null);
    setFormState(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(asset: Asset) {
    setEditingAssetId(asset.id);
    setFormState({
      nome: asset.nome,
      tipo: asset.tipo as AssetTipo,
      valorAtual: asset.valor_atual,
      dataAquisicao: asset.data_aquisicao,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (editingAssetId !== null) {
      updateAsset.mutate({ assetId: editingAssetId, input: formState }, { onSuccess: closeForm });
    } else {
      createAsset.mutate(formState, { onSuccess: closeForm });
    }
  }

  function openSellDialog(assetId: number) {
    setSellingAssetId(assetId);
    setSellForm({ valorVenda: "", dataVenda: hoje() });
  }

  function submitSell(event: FormEvent) {
    event.preventDefault();
    if (sellingAssetId === null) return;
    sellAsset.mutate(
      { assetId: sellingAssetId, input: sellForm },
      { onSuccess: () => setSellingAssetId(null) }
    );
  }

  function handleDelete(assetId: number, nome: string) {
    if (
      window.confirm(
        `Excluir "${nome}"? Transações vinculadas não são excluídas, só desassociadas.`
      )
    ) {
      deleteAsset.mutate(assetId);
    }
  }

  function toggleDrilldown(assetId: number) {
    setExpandedAssetId((prev) => (prev === assetId ? null : assetId));
  }

  return (
    <section className="dash-page">
      <h2>Ativos</h2>

      <div className="dash-filter">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
        <button type="button" onClick={openCreateForm}>
          Novo ativo
        </button>
      </div>

      {(createAsset.isError || updateAsset.isError) && (
        <p role="alert">Não foi possível salvar o ativo.</p>
      )}
      {deleteAsset.isError && <p role="alert">Não foi possível excluir o ativo.</p>}

      {formOpen && (
        <div role="dialog" aria-label={editingAssetId !== null ? "Editar ativo" : "Novo ativo"}>
          <form className="dash-filter" onSubmit={submitForm}>
            <label>
              Nome
              <input
                aria-label="Nome"
                value={formState.nome}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, nome: event.target.value }))
                }
              />
            </label>
            <label>
              Tipo
              <select
                aria-label="Tipo do ativo"
                value={formState.tipo}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, tipo: event.target.value as AssetTipo }))
                }
              >
                <option value="imovel">Imóvel</option>
                <option value="veiculo">Veículo</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              Valor atual
              <input
                aria-label="Valor atual"
                type="number"
                step="0.01"
                min="0"
                value={formState.valorAtual}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, valorAtual: event.target.value }))
                }
              />
            </label>
            <label>
              Data de aquisição
              <input
                aria-label="Data de aquisição"
                type="date"
                value={formState.dataAquisicao}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, dataAquisicao: event.target.value }))
                }
              />
            </label>
            <button type="submit" disabled={createAsset.isPending || updateAsset.isPending}>
              Salvar
            </button>
            <button type="button" onClick={closeForm}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {sellingAsset && (
        <div role="dialog" aria-label={`Vender ${sellingAsset.nome}`}>
          <form className="dash-filter" onSubmit={submitSell}>
            <label>
              Valor de venda
              <input
                aria-label="Valor de venda"
                type="number"
                step="0.01"
                min="0"
                value={sellForm.valorVenda}
                required
                onChange={(event) =>
                  setSellForm((prev) => ({ ...prev, valorVenda: event.target.value }))
                }
              />
            </label>
            <label>
              Data de venda
              <input
                aria-label="Data de venda"
                type="date"
                value={sellForm.dataVenda}
                required
                onChange={(event) =>
                  setSellForm((prev) => ({ ...prev, dataVenda: event.target.value }))
                }
              />
            </label>
            {sellAsset.isError && <p role="alert">Não foi possível registrar a venda.</p>}
            <button type="submit" disabled={sellAsset.isPending}>
              Confirmar venda
            </button>
            <button type="button" onClick={() => setSellingAssetId(null)}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {assetsQuery.isLoading && <p>Carregando...</p>}
      {assetsQuery.isError && <p role="alert">Não foi possível carregar os ativos.</p>}
      {!assetsQuery.isLoading && ativos.length === 0 && (
        <p className="dash-empty">Nenhum ativo cadastrado.</p>
      )}

      <div className="dash-summary">
        {ativos.map((asset) => (
          <div key={asset.id} className="dash-tile">
            <span className="k">{TIPO_LABEL[asset.tipo] ?? asset.tipo}</span>
            <span className="v">{formatCurrency(asset.valor_atual)}</span>
            <strong>{asset.nome}</strong>
            <span className="tag">Adquirido em {asset.data_aquisicao}</span>
            <div className="dash-filter">
              <button
                type="button"
                aria-expanded={expandedAssetId === asset.id}
                onClick={() => toggleDrilldown(asset.id)}
              >
                {expandedAssetId === asset.id ? "Fechar gasto" : "Ver gasto no período"}
              </button>
              <button type="button" onClick={() => openEditForm(asset)}>
                Editar
              </button>
              <button type="button" onClick={() => openSellDialog(asset.id)}>
                Vender
              </button>
              <button type="button" onClick={() => handleDelete(asset.id, asset.nome)}>
                Excluir
              </button>
            </div>
            {expandedAssetId === asset.id && <AssetDrilldown assetId={asset.id} filter={filter} />}
          </div>
        ))}
      </div>

      <h3>Baixados</h3>
      {baixados.length === 0 ? (
        <p className="dash-empty">Nenhum ativo baixado.</p>
      ) : (
        <div className="dash-summary">
          {baixados.map((asset) => (
            <div key={asset.id} className="dash-tile baixado">
              <span className="k">{TIPO_LABEL[asset.tipo] ?? asset.tipo}</span>
              <span className="v">{formatCurrency(asset.valor_venda)}</span>
              <strong>{asset.nome}</strong>
              <span className="tag">Vendido em {asset.data_venda}</span>
              <div className="dash-filter">
                <button type="button" onClick={() => handleDelete(asset.id, asset.nome)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AssetDrilldown({ assetId, filter }: { assetId: number; filter: PeriodoFilter }) {
  const gastosQuery = useAssetGastos(filter);
  const transactionsQuery = usePluggyTransactions({
    ano: filter.ano,
    mes: filter.mes,
    assetId,
    competencia: true,
  });

  const total = gastosQuery.data?.find((item) => item.asset_id === assetId)?.total ?? "0";
  const transacoes = transactionsQuery.data ?? [];

  if (gastosQuery.isLoading || transactionsQuery.isLoading) return <p>Carregando...</p>;
  if (gastosQuery.isError || transactionsQuery.isError) {
    return <p role="alert">Não foi possível carregar o gasto do ativo.</p>;
  }

  return (
    <div className="dash-accordion-panel">
      <p>
        Gasto no período: <strong>{formatCurrency(total)}</strong>
      </p>
      {transacoes.length === 0 ? (
        <p className="dash-empty">Nenhuma transação vinculada neste período.</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.data}</td>
                  <td>{transaction.descricao}</td>
                  <td>{formatCurrency(transaction.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
