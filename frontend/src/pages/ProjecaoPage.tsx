import { useMemo, useState, type FormEvent } from "react";

import type { PeriodoHistorico } from "../api/dashboards";
import { ProjectionChart } from "../components/ProjectionChart";
import { PeriodFilter } from "../components/PeriodFilter";
import { useDashboardProjecao } from "../hooks/useDashboardProjecao";
import { useDashboardTendencia } from "../hooks/useDashboardTendencia";
import {
  applyHipoteticas,
  type Hipotetica,
  type HipoteticaFrequencia,
  type HipoteticaTipo,
} from "../utils/projecao";
import { formatCurrency } from "../utils/format";

const EMPTY_FORM = {
  nome: "",
  valor: "",
  tipo: "despesa" as HipoteticaTipo,
  frequencia: "unica" as HipoteticaFrequencia,
  mesAlvo: "",
};

function mediaCampo(
  pontos: { receita: string; despesa: string; saldo: string }[],
  campo: "receita" | "despesa" | "saldo"
): number {
  if (pontos.length === 0) return 0;
  return pontos.reduce((sum, p) => sum + Number(p[campo]), 0) / pontos.length;
}

export function ProjecaoPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [horizonte, setHorizonte] = useState<PeriodoHistorico>(6);
  const [hipoteticas, setHipoteticas] = useState<Hipotetica[]>([]);
  const [formState, setFormState] = useState(EMPTY_FORM);

  const historicoQuery = useDashboardTendencia(ano, mes, horizonte);
  const projecaoQuery = useDashboardProjecao(ano, mes, horizonte);

  const mesesFuturos = useMemo(
    () => (projecaoQuery.data ?? []).map((p) => ({ ano: p.ano, mes: p.mes })),
    [projecaoQuery.data]
  );

  const projecaoAjustada = useMemo(
    () => applyHipoteticas(projecaoQuery.data ?? [], hipoteticas),
    [projecaoQuery.data, hipoteticas]
  );

  const mediaReceita = mediaCampo(projecaoAjustada, "receita");
  const mediaDespesa = mediaCampo(projecaoAjustada, "despesa");
  const mediaSaldo = mediaCampo(projecaoAjustada, "saldo");

  function submitHipotetica(event: FormEvent) {
    event.preventDefault();
    const valor = Number(formState.valor);
    if (!formState.nome.trim() || !valor) return;

    let alvo: { ano?: number; mes?: number } = {};
    if (formState.frequencia === "unica") {
      const [anoStr, mesStr] = (
        formState.mesAlvo || `${mesesFuturos[0]?.ano}-${mesesFuturos[0]?.mes}`
      ).split("-");
      alvo = { ano: Number(anoStr), mes: Number(mesStr) };
    }

    setHipoteticas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome: formState.nome.trim(),
        valor,
        tipo: formState.tipo,
        frequencia: formState.frequencia,
        ...alvo,
      },
    ]);
    setFormState(EMPTY_FORM);
  }

  function removeHipotetica(id: string) {
    setHipoteticas((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <section className="dash-page">
      <h2>Projeção</h2>

      <div className="dash-filter">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
        <label>
          Horizonte
          <select
            aria-label="Horizonte de projeção"
            value={horizonte}
            onChange={(event) => setHorizonte(Number(event.target.value) as PeriodoHistorico)}
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </label>
      </div>

      {(historicoQuery.isLoading || projecaoQuery.isLoading) && <p>Carregando...</p>}
      {(historicoQuery.isError || projecaoQuery.isError) && (
        <p role="alert">Não foi possível carregar a projeção.</p>
      )}

      <div className="dash-summary">
        <div className="dash-tile">
          <span className="k">Receita projetada</span>
          <span className="v receita">{formatCurrency(mediaReceita)}</span>
          <span className="tag">média mensal do horizonte</span>
        </div>
        <div className="dash-tile">
          <span className="k">Despesa projetada</span>
          <span className="v despesa">{formatCurrency(mediaDespesa)}</span>
          <span className="tag">média mensal do horizonte</span>
        </div>
        <div className="dash-tile">
          <span className="k">Saldo projetado</span>
          <span className="v">{formatCurrency(mediaSaldo)}</span>
          <span className="tag">média mensal do horizonte</span>
        </div>
      </div>

      {historicoQuery.data && projecaoQuery.data && (
        <>
          <ProjectionChart historico={historicoQuery.data} projecao={projecaoAjustada} />
          <p className="dash-empty">
            Linha sólida: histórico real. Linha tracejada: projeção (média dos últimos meses de
            subcategorias fixo/variável recorrente) — sem crescimento, inflação ou sazonalidade.
          </p>
        </>
      )}

      <h3>Simular hipotéticas</h3>
      <p className="dash-empty">Simulação efêmera: some ao recarregar a página, nunca é salva.</p>

      <form className="dash-filter" onSubmit={submitHipotetica}>
        <label>
          Nome
          <input
            aria-label="Nome da hipotética"
            value={formState.nome}
            onChange={(event) => setFormState((prev) => ({ ...prev, nome: event.target.value }))}
            required
          />
        </label>
        <label>
          Valor
          <input
            aria-label="Valor da hipotética"
            type="number"
            step="0.01"
            min="0.01"
            value={formState.valor}
            onChange={(event) => setFormState((prev) => ({ ...prev, valor: event.target.value }))}
            required
          />
        </label>
        <label>
          Tipo
          <select
            aria-label="Tipo da hipotética"
            value={formState.tipo}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, tipo: event.target.value as HipoteticaTipo }))
            }
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </label>
        <label>
          Frequência
          <select
            aria-label="Frequência da hipotética"
            value={formState.frequencia}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                frequencia: event.target.value as HipoteticaFrequencia,
              }))
            }
          >
            <option value="unica">Única</option>
            <option value="mensal">Mensal (todos os meses do horizonte)</option>
          </select>
        </label>
        {formState.frequencia === "unica" && (
          <label>
            Mês-alvo
            <select
              aria-label="Mês-alvo da hipotética"
              value={formState.mesAlvo}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, mesAlvo: event.target.value }))
              }
            >
              {mesesFuturos.map((m) => (
                <option key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>
                  {m.mes}/{m.ano}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit">Adicionar</button>
      </form>

      {hipoteticas.length === 0 ? (
        <p className="dash-empty">Nenhuma hipotética adicionada.</p>
      ) : (
        <ul className="simple-list">
          {hipoteticas.map((h) => (
            <li key={h.id}>
              <span className="nm">{h.nome}</span>
              <span
                className="amt"
                style={{ color: h.tipo === "receita" ? "var(--receita)" : "var(--despesa)" }}
              >
                {h.tipo === "receita" ? "+" : "-"}
                {formatCurrency(h.valor)}
              </span>
              <span className="tag">
                {h.frequencia === "mensal" ? "todos os meses" : `${h.mes}/${h.ano}`}
              </span>
              <button
                className="btn-ghost btn-quiet btn-danger"
                type="button"
                onClick={() => removeHipotetica(h.id)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
