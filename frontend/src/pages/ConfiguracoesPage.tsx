import { useState, type FormEvent } from "react";

import type { CurrentUser } from "../api/auth";
import { usePluggyAccounts } from "../hooks/usePluggyAccounts";
import { useLogout } from "../hooks/useLogout";
import { useSalarioAjusteDezembro } from "../hooks/useSalarioAjusteDezembro";
import { useUpdateSalarioAjusteDezembro } from "../hooks/useUpdateSalarioAjusteDezembro";
import { useUpdateUserSettings } from "../hooks/useUpdateUserSettings";
import { AccountManagementPage } from "./AccountManagementPage";

interface ConfiguracoesPageProps {
  user: CurrentUser;
}

export function ConfiguracoesPage({ user }: ConfiguracoesPageProps) {
  const logout = useLogout();

  const updateSettings = useUpdateUserSettings();
  const [cutoffDraft, setCutoffDraft] = useState(String(user.salario_competencia_cutoff_dia));

  const { data: accounts } = usePluggyAccounts();
  const ajusteQuery = useSalarioAjusteDezembro();
  const updateAjuste = useUpdateSalarioAjusteDezembro();

  // Campos ficam "não tocados" (null) até o usuário editar — enquanto isso,
  // exibem o valor já salvo (ajusteQuery.data). Evita sincronizar estado
  // local a partir de uma query em useEffect (cascading render).
  const [ajusteAccountIdDraft, setAjusteAccountIdDraft] = useState<number | "" | null>(null);
  const [ajusteDataDraft, setAjusteDataDraft] = useState<string | null>(null);
  const [ajusteValorDraft, setAjusteValorDraft] = useState<string | null>(null);

  const ajusteAccountId = ajusteAccountIdDraft ?? ajusteQuery.data?.account_id ?? "";
  const ajusteData = ajusteDataDraft ?? ajusteQuery.data?.data ?? "2025-12-30";
  const ajusteValor = ajusteValorDraft ?? ajusteQuery.data?.valor ?? "";

  function submitCutoff(event: FormEvent) {
    event.preventDefault();
    const value = Number(cutoffDraft);
    if (!Number.isInteger(value) || value < 1 || value > 28) return;
    updateSettings.mutate(value);
  }

  function submitAjusteSalario(event: FormEvent) {
    event.preventDefault();
    if (ajusteAccountId === "") return;
    updateAjuste.mutate({
      accountId: ajusteAccountId,
      data: ajusteData,
      valor: ajusteValor.trim() === "" ? null : ajusteValor,
    });
  }

  return (
    <section className="dash-page">
      <h2>Configurações</h2>

      <h3>Perfil</h3>
      <p>
        <strong>{user.name}</strong>
      </p>
      <p>{user.email}</p>
      <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
        Sair
      </button>
      {logout.isError && <p role="alert">Não foi possível sair.</p>}

      <h3>Competência de Salário</h3>
      <p className="dash-empty">
        Transações confirmadas na subcategoria "Salário" com dia do pagamento maior ou igual ao dia
        de corte têm a competência deslocada para o mês seguinte.
      </p>
      <form className="dash-filter" onSubmit={submitCutoff}>
        <label>
          Dia de corte
          <input
            aria-label="Dia de corte de competência de salário"
            type="number"
            min={1}
            max={28}
            value={cutoffDraft}
            onChange={(event) => setCutoffDraft(event.target.value)}
          />
        </label>
        <button type="submit" disabled={updateSettings.isPending}>
          Salvar dia de corte
        </button>
        {updateSettings.isSuccess && <span className="tag">Salvo.</span>}
        {updateSettings.isError && <p role="alert">Não foi possível salvar o dia de corte.</p>}
      </form>

      <h3>Salário de dezembro/2025</h3>
      <p className="dash-empty">
        O corte de sincronização (01/01/2026) não trouxe o salário pago em dezembro/2025 — informe
        aqui para que ele apareça como receita normal no drill-down de janeiro/2026. Deixe o valor
        em branco para remover.
      </p>
      <form className="dash-filter" onSubmit={submitAjusteSalario}>
        <label>
          Conta
          <select
            aria-label="Conta do salário de dezembro/2025"
            value={ajusteAccountId}
            onChange={(event) =>
              setAjusteAccountIdDraft(event.target.value === "" ? "" : Number(event.target.value))
            }
          >
            <option value="">Selecione</option>
            {accounts?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.apelido ?? account.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data do pagamento
          <input
            aria-label="Data do pagamento do salário de dezembro/2025"
            type="date"
            value={ajusteData}
            onChange={(event) => setAjusteDataDraft(event.target.value)}
          />
        </label>
        <label>
          Valor
          <input
            aria-label="Valor do salário de dezembro/2025"
            type="number"
            step="0.01"
            min="0"
            placeholder="Deixe em branco para remover"
            value={ajusteValor}
            onChange={(event) => setAjusteValorDraft(event.target.value)}
          />
        </label>
        <button type="submit" disabled={updateAjuste.isPending || ajusteAccountId === ""}>
          Salvar
        </button>
        {updateAjuste.isError && <p role="alert">Não foi possível salvar o ajuste.</p>}
      </form>

      <h3>Gestão de Contas</h3>
      <AccountManagementPage />
    </section>
  );
}
