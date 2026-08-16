import { useState } from "react";

import type { PeriodoHistorico } from "../api/dashboards";
import { fetchConnectToken } from "../api/pluggy";
import { PeriodFilter } from "../components/PeriodFilter";
import { useEvolucaoSaldoPorConta } from "../hooks/useEvolucaoSaldoPorConta";
import { usePluggyAccounts } from "../hooks/usePluggyAccounts";
import { usePluggyItems } from "../hooks/usePluggyItems";
import { useRegisterPluggyItem } from "../hooks/useRegisterPluggyItem";
import { useSyncPluggyItems } from "../hooks/useSyncPluggyItems";
import { useUpdatePluggyAccount } from "../hooks/useUpdatePluggyAccount";
import { useUpdateSaldoInicial } from "../hooks/useUpdateSaldoInicial";
import { loadPluggyConnect } from "../pluggy/loadPluggyConnect";
import { formatCurrency } from "../utils/format";

const ACCOUNT_TIPO_LABEL: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao_credito: "Cartão de crédito",
  investimento: "Investimento",
};

export function AccountManagementPage() {
  const { data: items } = usePluggyItems();
  const { data: accounts, isLoading } = usePluggyAccounts();
  const registerItem = useRegisterPluggyItem();
  const updateAccount = useUpdatePluggyAccount();
  const syncItems = useSyncPluggyItems();

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [apelidoDraft, setApelidoDraft] = useState("");

  const updateSaldoInicial = useUpdateSaldoInicial();
  const [editingSaldoInicialId, setEditingSaldoInicialId] = useState<number | null>(null);
  const [saldoInicialDraft, setSaldoInicialDraft] = useState("");

  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncSelection, setSyncSelection] = useState<Record<number, boolean>>({});

  const now = new Date();
  const [auditoriaAno, setAuditoriaAno] = useState(now.getFullYear());
  const [auditoriaMes, setAuditoriaMes] = useState(now.getMonth() + 1);
  const [auditoriaMeses, setAuditoriaMeses] = useState<PeriodoHistorico>(12);
  const evolucaoQuery = useEvolucaoSaldoPorConta(auditoriaAno, auditoriaMes, auditoriaMeses);

  async function handleConnect() {
    setConnectError(null);
    setConnecting(true);
    try {
      await loadPluggyConnect();
      const { access_token: connectToken } = await fetchConnectToken();
      const widget = new window.PluggyConnect({
        connectToken,
        includeSandbox: true,
        onSuccess: (itemData) => {
          registerItem.mutate(itemData.item.id);
        },
        onError: () => {
          setConnectError("Não foi possível conectar a conta bancária.");
        },
      });
      widget.init();
    } catch {
      setConnectError("Não foi possível abrir o widget de conexão.");
    } finally {
      setConnecting(false);
    }
  }

  function connectorName(itemId: number): string {
    return items?.find((item) => item.id === itemId)?.connector_name ?? "Conta";
  }

  function startEditing(accountId: number, currentApelido: string | null, currentNome: string) {
    setEditingAccountId(accountId);
    setApelidoDraft(currentApelido ?? currentNome);
  }

  function saveApelido(accountId: number, syncEnabled: boolean) {
    const value = apelidoDraft.trim();
    updateAccount.mutate({ accountId, apelido: value || null, syncEnabled });
    setEditingAccountId(null);
  }

  function toggleSyncEnabled(accountId: number, apelido: string | null, syncEnabled: boolean) {
    updateAccount.mutate({ accountId, apelido, syncEnabled: !syncEnabled });
  }

  function startEditingSaldoInicial(accountId: number, currentSaldoInicial: string | null) {
    setEditingSaldoInicialId(accountId);
    setSaldoInicialDraft(currentSaldoInicial ?? "");
  }

  function saveSaldoInicial(accountId: number) {
    const value = saldoInicialDraft.trim();
    updateSaldoInicial.mutate({ accountId, saldoInicial: value === "" ? null : value });
    setEditingSaldoInicialId(null);
  }

  function openSyncDialog() {
    const initial: Record<number, boolean> = {};
    for (const account of accounts ?? []) initial[account.id] = account.sync_enabled;
    setSyncSelection(initial);
    setSyncDialogOpen(true);
  }

  function confirmSync() {
    const selectedAccountIds = new Set(
      Object.entries(syncSelection)
        .filter(([, checked]) => checked)
        .map(([id]) => Number(id))
    );
    const itemIds = Array.from(
      new Set(
        (accounts ?? [])
          .filter((account) => selectedAccountIds.has(account.id))
          .map((account) => account.item_id)
      )
    );
    syncItems.mutate(itemIds, {
      onSuccess: () => setSyncDialogOpen(false),
    });
  }

  return (
    <section className="dash-page">
      <h2>Gestão de contas</h2>

      <div className="dash-filter">
        <button onClick={handleConnect} disabled={connecting}>
          Conectar conta bancária
        </button>
        <button
          type="button"
          onClick={openSyncDialog}
          disabled={!accounts || accounts.length === 0}
        >
          Sincronizar MeuPluggy
        </button>
      </div>
      {connectError && <p role="alert">{connectError}</p>}
      {syncItems.isError && <p role="alert">Não foi possível sincronizar as contas.</p>}

      {syncDialogOpen && (
        <div role="dialog" aria-label="Sincronizar MeuPluggy" className="dash-filter">
          <div>
            <p>Selecione as contas a sincronizar:</p>
            <ul className="simple-list">
              {accounts?.map((account) => (
                <li key={account.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={syncSelection[account.id] ?? false}
                      onChange={(event) =>
                        setSyncSelection((prev) => ({
                          ...prev,
                          [account.id]: event.target.checked,
                        }))
                      }
                    />
                    {account.apelido ?? account.nome} ({connectorName(account.item_id)})
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" onClick={confirmSync} disabled={syncItems.isPending}>
              Confirmar sincronização
            </button>
            <button type="button" onClick={() => setSyncDialogOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <h3>Contas conectadas</h3>
      {isLoading && <p>Carregando...</p>}
      {accounts && accounts.length === 0 && <p>Nenhuma conta conectada.</p>}
      <ul className="simple-list">
        {accounts?.map((account) => (
          <li key={account.id}>
            {editingAccountId === account.id ? (
              <>
                <input
                  aria-label={`Apelido de ${account.nome}`}
                  value={apelidoDraft}
                  autoFocus
                  onChange={(event) => setApelidoDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveApelido(account.id, account.sync_enabled);
                    if (event.key === "Escape") setEditingAccountId(null);
                  }}
                />
                <button type="button" onClick={() => saveApelido(account.id, account.sync_enabled)}>
                  Salvar
                </button>
                <button type="button" onClick={() => setEditingAccountId(null)}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <strong>{account.apelido ?? account.nome}</strong>
                {" — "}
                {connectorName(account.item_id)} ·{" "}
                {ACCOUNT_TIPO_LABEL[account.tipo] ?? account.tipo} · {formatCurrency(account.saldo)}
                {!account.sync_enabled && " · fora da sincronização"}
                <button
                  type="button"
                  onClick={() => startEditing(account.id, account.apelido, account.nome)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toggleSyncEnabled(account.id, account.apelido, account.sync_enabled)
                  }
                >
                  {account.sync_enabled ? "Remover da sincronização" : "Incluir na sincronização"}
                </button>
              </>
            )}
            <div className="tag">
              Saldo inicial (31/12/2025):{" "}
              {editingSaldoInicialId === account.id ? (
                <>
                  <input
                    aria-label={`Saldo inicial de ${account.nome}`}
                    type="number"
                    step="0.01"
                    value={saldoInicialDraft}
                    autoFocus
                    onChange={(event) => setSaldoInicialDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveSaldoInicial(account.id);
                      if (event.key === "Escape") setEditingSaldoInicialId(null);
                    }}
                  />
                  <button type="button" onClick={() => saveSaldoInicial(account.id)}>
                    Salvar
                  </button>
                  <button type="button" onClick={() => setEditingSaldoInicialId(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  {account.saldo_inicial !== null
                    ? formatCurrency(account.saldo_inicial)
                    : "não informado"}
                  <button
                    type="button"
                    onClick={() => startEditingSaldoInicial(account.id, account.saldo_inicial)}
                  >
                    Editar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3>Auditoria de saldo por conta</h3>
      <p className="dash-empty">
        Ferramenta de conferência: saldo calculado mês a mês (saldo inicial + soma cumulativa da
        data real de cada transação, desde 01/01/2026) — compare com o extrato bancário real.
      </p>
      <div className="dash-filter">
        <PeriodFilter
          ano={auditoriaAno}
          mes={auditoriaMes}
          onChange={(next) => {
            if (next.ano !== undefined) setAuditoriaAno(next.ano);
            if (next.mes !== undefined) setAuditoriaMes(next.mes);
          }}
        />
        <label>
          Meses
          <select
            aria-label="Meses de auditoria"
            value={auditoriaMeses}
            onChange={(event) => setAuditoriaMeses(Number(event.target.value) as PeriodoHistorico)}
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </label>
      </div>

      {evolucaoQuery.isLoading && <p>Carregando...</p>}
      {evolucaoQuery.isError && <p role="alert">Não foi possível carregar a auditoria de saldo.</p>}
      {evolucaoQuery.data && evolucaoQuery.data.length === 0 && (
        <p className="dash-empty">Nenhuma conta com saldo inicial informado.</p>
      )}
      {evolucaoQuery.data && evolucaoQuery.data.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <colgroup>
              <col className="col-componente" />
              {evolucaoQuery.data[0].pontos.map((p) => (
                <col key={`${p.ano}-${p.mes}`} className="col-valor" />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Conta</th>
                {evolucaoQuery.data[0].pontos.map((p) => (
                  <th key={`${p.ano}-${p.mes}`}>
                    {String(p.mes).padStart(2, "0")}/{p.ano}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evolucaoQuery.data.map((conta) => (
                <tr key={conta.account_id}>
                  <td>{conta.account_nome}</td>
                  {conta.pontos.map((p) => (
                    <td key={`${p.ano}-${p.mes}`}>{formatCurrency(p.total)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
