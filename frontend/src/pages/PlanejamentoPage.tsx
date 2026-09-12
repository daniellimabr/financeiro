import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { TransacaoTipo } from "../api/dashboards";
import type {
  CelulaGrade,
  ItemPlanejado,
  LinhaEventualGrade,
  LinhaSubcategoriaGrade,
} from "../api/planejamento";
import { fetchPluggyTransactions, type PluggyTransaction } from "../api/pluggy";
import { PeriodFilter } from "../components/PeriodFilter";
import { useConfirmarPlanejamentoValor } from "../hooks/useConfirmarPlanejamentoValor";
import { useConfirmarPlanejamentoValorEventual } from "../hooks/useConfirmarPlanejamentoValorEventual";
import { useCreateItemPlanejado } from "../hooks/useCreateItemPlanejado";
import { useDeleteItemPlanejado } from "../hooks/useDeleteItemPlanejado";
import { useDesvincularItemPlanejado } from "../hooks/useDesvincularItemPlanejado";
import { useItensPlanejados } from "../hooks/useItensPlanejados";
import { usePlanejamentoGrade } from "../hooks/usePlanejamentoGrade";
import { useRemoverPlanejamentoValor } from "../hooks/useRemoverPlanejamentoValor";
import { useRemoverPlanejamentoValorEventual } from "../hooks/useRemoverPlanejamentoValorEventual";
import { useUpdateItemPlanejado } from "../hooks/useUpdateItemPlanejado";
import { useVincularItemPlanejado } from "../hooks/useVincularItemPlanejado";
import { formatCurrency } from "../utils/format";

const MES_ABREV = [
  "",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const JANELA_HISTORICO = 3; // índice das 3 primeiras colunas (realizado, só leitura)
const IDX_ATUAL = JANELA_HISTORICO; // índice da coluna do mês corrente
const HORIZONTE_FUTURO = 6; // espelha app/planejamento/service.py HORIZONTE_FUTURO
const TOTAL_COLUNAS = JANELA_HISTORICO + 1 + HORIZONTE_FUTURO; // histórico + atual + futuro

// Confirmar um valor ainda sugerido propaga do mês clicado até a última
// coluna exibida (espelha `_meses_ate_fim_horizonte` do backend) — o
// número de meses afetados varia com a coluna clicada, não é sempre
// HORIZONTE_FUTURO (bug pós-deploy da Sprint 38: editar o mês corrente ou
// uma coluna futura que não a primeira deixava a última coluna de fora).
function mesesAfetadosPelaPropagacao(idx: number): number {
  return TOTAL_COLUNAS - idx;
}

function colunaLabel(ano: number, mes: number): string {
  return `${MES_ABREV[mes]}/${String(ano).slice(2)}`;
}

// Editar uma célula ainda sugerida propaga o valor pros próximos meses do
// horizonte (regra do backend); reeditar uma já confirmada corrige só
// aquele mês. `eraSugerido` é guardado no momento do clique pra mostrar o
// aviso certo. A linha Eventual não tem subcategory_id (agrega várias),
// por isso o discriminador `kind`.
type EditingCell =
  | { kind: "subcategoria"; subcategoryId: number; ano: number; mes: number; eraSugerido: boolean }
  | { kind: "eventual"; tipo: TransacaoTipo; ano: number; mes: number; eraSugerido: boolean };

export function PlanejamentoPage() {
  const now = new Date();
  const [anoBase, setAnoBase] = useState(now.getFullYear());
  const [mesBase, setMesBase] = useState(now.getMonth() + 1);

  const gradeQuery = usePlanejamentoGrade(anoBase, mesBase);
  const confirmar = useConfirmarPlanejamentoValor();
  const remover = useRemoverPlanejamentoValor();
  const confirmarEventual = useConfirmarPlanejamentoValorEventual();
  const removerEventual = useRemoverPlanejamentoValorEventual();

  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draft, setDraft] = useState("");

  function startEditing(
    subcategoryId: number,
    ano: number,
    mes: number,
    valorAtual: string,
    eraSugerido: boolean
  ) {
    setEditing({ kind: "subcategoria", subcategoryId, ano, mes, eraSugerido });
    setDraft(valorAtual);
  }

  function startEditingEventual(
    tipo: TransacaoTipo,
    ano: number,
    mes: number,
    valorAtual: string,
    eraSugerido: boolean
  ) {
    setEditing({ kind: "eventual", tipo, ano, mes, eraSugerido });
    setDraft(valorAtual);
  }

  function saveEditing() {
    if (!editing) return;
    const valor = draft.trim();
    if (valor === "") return;
    if (editing.kind === "subcategoria") {
      confirmar.mutate(
        {
          subcategoryId: editing.subcategoryId,
          anoBase,
          mesBase,
          ano: editing.ano,
          mes: editing.mes,
          valor,
        },
        { onSuccess: () => setEditing(null) }
      );
    } else {
      confirmarEventual.mutate(
        { tipo: editing.tipo, anoBase, mesBase, ano: editing.ano, mes: editing.mes, valor },
        { onSuccess: () => setEditing(null) }
      );
    }
  }

  function usarSugestao(subcategoryId: number, ano: number, mes: number) {
    remover.mutate({ subcategoryId, ano, mes }, { onSuccess: () => setEditing(null) });
  }

  function usarSugestaoEventual(tipo: TransacaoTipo, ano: number, mes: number) {
    removerEventual.mutate({ tipo, ano, mes }, { onSuccess: () => setEditing(null) });
  }

  const grade = gradeQuery.data;
  const despesas = grade?.subcategorias.filter((linha) => linha.tipo === "debito") ?? [];
  const receitas = grade?.subcategorias.filter((linha) => linha.tipo === "credito") ?? [];
  const eventualDespesa = grade?.eventuais.find((linha) => linha.tipo === "debito");
  const eventualReceita = grade?.eventuais.find((linha) => linha.tipo === "credito");

  function renderCell(linha: LinhaSubcategoriaGrade, celula: CelulaGrade, idx: number) {
    const isEditing =
      editing?.kind === "subcategoria" &&
      editing.subcategoryId === linha.subcategory_id &&
      editing.ano === celula.ano &&
      editing.mes === celula.mes;
    const className = idx === IDX_ATUAL ? "col-atual" : undefined;

    if (idx < JANELA_HISTORICO) {
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <span className="planejamento-val-realizado">{formatCurrency(celula.valor)}</span>
        </td>
      );
    }

    if (isEditing) {
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <div className="planejamento-cell-edit">
            <input
              aria-label={`Valor de ${linha.subcategory_nome} em ${colunaLabel(celula.ano, celula.mes)}`}
              type="number"
              step="0.01"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveEditing();
                if (event.key === "Escape") setEditing(null);
              }}
            />
            <button type="button" className="ac-btn ac-btn-primary" onClick={saveEditing}>
              Salvar
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
          {editing?.eraSugerido && (
            <p className="planejamento-cell-hint">
              Vale deste mês até o fim do horizonte ({mesesAfetadosPelaPropagacao(idx)} meses)
            </p>
          )}
        </td>
      );
    }

    const valClass =
      celula.origem === "confirmado" ? "planejamento-val-confirmado" : "planejamento-val-sugerido";

    const valorButton = (
      <button
        type="button"
        className={valClass}
        style={{ background: "none", border: "none", font: "inherit", padding: 0 }}
        onClick={() =>
          startEditing(
            linha.subcategory_id,
            celula.ano,
            celula.mes,
            String(celula.valor),
            celula.origem !== "confirmado"
          )
        }
        title={celula.origem === "confirmado" ? "Editar valor confirmado" : "Confirmar sugestão"}
      >
        {formatCurrency(celula.valor)}
      </button>
    );

    if (idx === IDX_ATUAL && celula.realizado_parcial !== null && celula.status !== null) {
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <div className="planejamento-atual-stack">
            {valorButton}
            <span className={`planejamento-atual-realizado ${celula.status}`}>
              {formatCurrency(celula.realizado_parcial)} real.
            </span>
          </div>
        </td>
      );
    }

    return (
      <td key={`${celula.ano}-${celula.mes}`} className={className}>
        {valorButton}
        {celula.origem === "confirmado" && (
          <button
            type="button"
            className="ac-btn ac-btn-ghost"
            style={{ marginLeft: 4, padding: "1px 6px", fontSize: 10 }}
            title="Voltar a usar a sugestão"
            onClick={() => usarSugestao(linha.subcategory_id, celula.ano, celula.mes)}
          >
            ×
          </button>
        )}
      </td>
    );
  }

  function renderReadOnlyCell(celula: CelulaGrade, idx: number, valueClassName: string) {
    const className = idx === IDX_ATUAL ? "col-atual" : undefined;
    if (idx === IDX_ATUAL && celula.realizado_parcial !== null && celula.status !== null) {
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <div className="planejamento-atual-stack">
            <span className={valueClassName}>{formatCurrency(celula.valor)}</span>
            <span className={`planejamento-atual-realizado ${celula.status}`}>
              {formatCurrency(celula.realizado_parcial)} real.
            </span>
          </div>
        </td>
      );
    }
    return (
      <td key={`${celula.ano}-${celula.mes}`} className={className}>
        <span className={valueClassName}>{formatCurrency(celula.valor)}</span>
      </td>
    );
  }

  function renderEventualEditableCell(tipo: TransacaoTipo, celula: CelulaGrade, idx: number) {
    const isEditing =
      editing?.kind === "eventual" &&
      editing.tipo === tipo &&
      editing.ano === celula.ano &&
      editing.mes === celula.mes;
    const className = idx === IDX_ATUAL ? "col-atual" : undefined;

    if (isEditing) {
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <div className="planejamento-cell-edit">
            <input
              aria-label={`Valor de Eventual em ${colunaLabel(celula.ano, celula.mes)}`}
              type="number"
              step="0.01"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveEditing();
                if (event.key === "Escape") setEditing(null);
              }}
            />
            <button type="button" className="ac-btn ac-btn-primary" onClick={saveEditing}>
              Salvar
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
          {editing?.eraSugerido && (
            <p className="planejamento-cell-hint">
              Vale deste mês até o fim do horizonte ({mesesAfetadosPelaPropagacao(idx)} meses)
            </p>
          )}
        </td>
      );
    }

    const valClass =
      celula.origem === "confirmado" ? "planejamento-val-confirmado" : "planejamento-val-sugerido";

    const valorButton = (
      <button
        type="button"
        className={valClass}
        style={{ background: "none", border: "none", font: "inherit", padding: 0 }}
        onClick={() =>
          startEditingEventual(
            tipo,
            celula.ano,
            celula.mes,
            String(celula.valor),
            celula.origem !== "confirmado"
          )
        }
        title={celula.origem === "confirmado" ? "Editar valor confirmado" : "Confirmar sugestão"}
      >
        {formatCurrency(celula.valor)}
      </button>
    );

    if (idx === IDX_ATUAL && celula.realizado_parcial !== null && celula.status !== null) {
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <div className="planejamento-atual-stack">
            {valorButton}
            <span className={`planejamento-atual-realizado ${celula.status}`}>
              {formatCurrency(celula.realizado_parcial)} real.
            </span>
          </div>
        </td>
      );
    }

    return (
      <td key={`${celula.ano}-${celula.mes}`} className={className}>
        {valorButton}
        {celula.origem === "confirmado" && (
          <button
            type="button"
            className="ac-btn ac-btn-ghost"
            style={{ marginLeft: 4, padding: "1px 6px", fontSize: 10 }}
            title="Voltar a usar a sugestão"
            onClick={() => usarSugestaoEventual(tipo, celula.ano, celula.mes)}
          >
            ×
          </button>
        )}
      </td>
    );
  }

  function renderEventualRow(linha: LinhaEventualGrade) {
    return (
      <tr className="planejamento-eventual-row">
        <td className="col-nome">
          Eventual
          <span className="planejamento-item-tag hipotetico">média histórica</span>
        </td>
        {linha.celulas.map((celula, idx) =>
          idx < JANELA_HISTORICO
            ? renderReadOnlyCell(celula, idx, "planejamento-val-realizado")
            : renderEventualEditableCell(linha.tipo, celula, idx)
        )}
      </tr>
    );
  }

  function renderTotalCellsRow(label: string, celulas: CelulaGrade[]) {
    return (
      <tr className="total-row">
        <td className="col-nome">{label}</td>
        {celulas.map((celula, idx) =>
          renderReadOnlyCell(celula, idx, "planejamento-val-confirmado")
        )}
      </tr>
    );
  }

  function renderSaldoCell(celula: CelulaGrade, idx: number) {
    const className = idx === IDX_ATUAL ? "col-atual" : undefined;
    const sinalPlanejado = celula.status === "alerta" ? "alerta" : "dentro";
    if (idx === IDX_ATUAL && celula.realizado_parcial !== null) {
      const sinalRealizado = Number(celula.realizado_parcial) < 0 ? "alerta" : "dentro";
      return (
        <td key={`${celula.ano}-${celula.mes}`} className={className}>
          <div className="planejamento-atual-stack">
            <span className={`planejamento-val-saldo ${sinalPlanejado}`}>
              {formatCurrency(celula.valor)}
            </span>
            <span className={`planejamento-atual-realizado ${sinalRealizado}`}>
              {formatCurrency(celula.realizado_parcial)} real.
            </span>
          </div>
        </td>
      );
    }
    return (
      <td key={`${celula.ano}-${celula.mes}`} className={className}>
        <span className={`planejamento-val-saldo ${sinalPlanejado}`}>
          {formatCurrency(celula.valor)}
        </span>
      </td>
    );
  }

  return (
    <section className="ac-page">
      <div className="ac-toolbar">
        <div className="ac-toolbar-left">
          <PeriodFilter
            ano={anoBase}
            mes={mesBase}
            onChange={(next) => {
              if (next.ano !== undefined) setAnoBase(next.ano);
              if (next.mes !== undefined) setMesBase(next.mes);
            }}
          />
        </div>
      </div>

      {gradeQuery.isLoading && <p>Carregando...</p>}
      {gradeQuery.isError && <p role="alert">Não foi possível carregar a Mesa de Planejamento.</p>}
      {(confirmar.isError ||
        remover.isError ||
        confirmarEventual.isError ||
        removerEventual.isError) && <p role="alert">Não foi possível salvar o valor planejado.</p>}

      {grade && (
        <div className="ac-panel">
          <div className="ac-panel-head">
            <h2>
              Planejamento — {colunaLabel(grade.periodo[0][0], grade.periodo[0][1])} a{" "}
              {colunaLabel(
                grade.periodo[grade.periodo.length - 1][0],
                grade.periodo[grade.periodo.length - 1][1]
              )}
            </h2>
            <span className="ac-panel-meta">
              3 meses de histórico · mês corrente · {HORIZONTE_FUTURO} meses futuros
            </span>
          </div>
          <div className="planejamento-grid-scroll">
            <table className="planejamento-grade">
              <thead>
                <tr>
                  <th className="col-nome">Linha</th>
                  {grade.periodo.map(([ano, mes], idx) => (
                    <th
                      key={`${ano}-${mes}`}
                      className={idx === IDX_ATUAL ? "col-atual" : undefined}
                    >
                      {colunaLabel(ano, mes)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="section-row">
                  <td colSpan={grade.periodo.length + 1}>Receitas</td>
                </tr>
                {receitas.length === 0 && (
                  <tr>
                    <td colSpan={grade.periodo.length + 1} className="ac-empty">
                      Nenhuma subcategoria fixa/variável de receita com histórico.
                    </td>
                  </tr>
                )}
                {receitas.map((linha) => (
                  <tr key={linha.subcategory_id}>
                    <td className="col-nome">{linha.subcategory_nome}</td>
                    {linha.celulas.map((celula, idx) => renderCell(linha, celula, idx))}
                  </tr>
                ))}
                {eventualReceita && renderEventualRow(eventualReceita)}
                {renderTotalCellsRow("Total receitas", grade.total_receitas)}

                <tr className="section-row">
                  <td colSpan={grade.periodo.length + 1}>Despesas</td>
                </tr>
                {despesas.length === 0 && (
                  <tr>
                    <td colSpan={grade.periodo.length + 1} className="ac-empty">
                      Nenhuma subcategoria fixa/variável de despesa com histórico.
                    </td>
                  </tr>
                )}
                {despesas.map((linha) => (
                  <tr key={linha.subcategory_id}>
                    <td className="col-nome">{linha.subcategory_nome}</td>
                    {linha.celulas.map((celula, idx) => renderCell(linha, celula, idx))}
                  </tr>
                ))}
                {eventualDespesa && renderEventualRow(eventualDespesa)}
                {renderTotalCellsRow("Total despesas", grade.total_despesas)}

                <tr className="section-row">
                  <td colSpan={grade.periodo.length + 1}>Itens planejados</td>
                </tr>
                {grade.itens.length === 0 && (
                  <tr>
                    <td colSpan={grade.periodo.length + 1} className="ac-empty">
                      Nenhum item planejado ainda.
                    </td>
                  </tr>
                )}
                {grade.itens.map((item) => (
                  <tr key={item.item_id}>
                    <td className="col-nome">
                      {item.nome}
                      <span
                        className={`planejamento-item-tag ${item.cumprido ? "cumprido" : "hipotetico"}`}
                      >
                        {item.cumprido ? "cumprido" : "hipotético"}
                      </span>
                      {item.recorrente && (
                        <span className="planejamento-item-tag recorrente">recorrente</span>
                      )}
                    </td>
                    {item.celulas.map((celula, idx) => {
                      const className = idx === IDX_ATUAL ? "col-atual" : undefined;
                      if (celula.origem === "vazio") {
                        return (
                          <td key={`${celula.ano}-${celula.mes}`} className={className}>
                            <span className="planejamento-val-vazio">—</span>
                          </td>
                        );
                      }
                      const cls =
                        celula.origem === "cumprido"
                          ? "planejamento-val-cumprido"
                          : "planejamento-val-hipotetico";
                      return (
                        <td key={`${celula.ano}-${celula.mes}`} className={className}>
                          <span className={cls}>{formatCurrency(celula.valor)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="total-row planejamento-saldo-row">
                  <td className="col-nome">Saldo simulado</td>
                  {grade.saldo.map((celula, idx) => renderSaldoCell(celula, idx))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ItensPlanejadosPanel anoBase={anoBase} mesBase={mesBase} />
    </section>
  );
}

const EMPTY_FORM = {
  nome: "",
  tipo: "debito" as TransacaoTipo,
  valor: "",
  dataInicio: "",
  recorrente: false,
  dataFim: "",
};

function ItensPlanejadosPanel({ anoBase, mesBase }: { anoBase: number; mesBase: number }) {
  const itensQuery = useItensPlanejados();
  const createItem = useCreateItemPlanejado();
  const updateItem = useUpdateItemPlanejado();
  const deleteItem = useDeleteItemPlanejado();
  const desvincular = useDesvincularItemPlanejado();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [vinculandoId, setVinculandoId] = useState<number | null>(null);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(item: ItemPlanejado) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      tipo: item.tipo,
      valor: item.valor,
      dataInicio: item.data_inicio,
      recorrente: item.recorrente,
      dataFim: item.data_fim ?? "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function submitForm() {
    const input = {
      nome: form.nome,
      tipo: form.tipo,
      valor: form.valor,
      dataInicio: form.dataInicio,
      recorrente: form.recorrente,
      dataFim: form.recorrente && form.dataFim ? form.dataFim : null,
    };
    if (editingId !== null) {
      updateItem.mutate({ itemId: editingId, input }, { onSuccess: closeForm });
    } else {
      createItem.mutate(input, { onSuccess: closeForm });
    }
  }

  function handleDelete(item: ItemPlanejado) {
    if (window.confirm(`Excluir o item planejado "${item.nome}"?`)) {
      deleteItem.mutate(item.id);
    }
  }

  return (
    <div className="ac-panel">
      <div className="ac-panel-head">
        <h2>Itens planejados</h2>
        <button type="button" className="ac-btn ac-btn-primary" onClick={openCreateForm}>
          Novo item
        </button>
      </div>

      {(createItem.isError || updateItem.isError) && (
        <p role="alert">Não foi possível salvar o item planejado.</p>
      )}
      {deleteItem.isError && <p role="alert">Não foi possível excluir o item planejado.</p>}

      {formOpen && (
        <div className="planejamento-picker" style={{ marginBottom: 12 }}>
          <div className="ac-form-row">
            <label>
              Nome
              <input
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
              />
            </label>
          </div>
          <div className="ac-form-row">
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(event) =>
                  setForm({ ...form, tipo: event.target.value as TransacaoTipo })
                }
              >
                <option value="debito">Débito (despesa)</option>
                <option value="credito">Crédito (receita)</option>
              </select>
            </label>
            <label>
              Valor
              <input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(event) => setForm({ ...form, valor: event.target.value })}
              />
            </label>
          </div>
          <div className="ac-form-row">
            <label>
              {form.recorrente ? "Início" : "Mês-alvo"}
              <input
                type="date"
                value={form.dataInicio}
                onChange={(event) => setForm({ ...form, dataInicio: event.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.recorrente}
                onChange={(event) => setForm({ ...form, recorrente: event.target.checked })}
              />
              Recorrente
            </label>
            {form.recorrente && (
              <label>
                Fim (opcional)
                <input
                  type="date"
                  value={form.dataFim}
                  onChange={(event) => setForm({ ...form, dataFim: event.target.value })}
                />
              </label>
            )}
          </div>
          <button type="button" className="ac-btn ac-btn-primary" onClick={submitForm}>
            {editingId !== null ? "Salvar" : "Criar"}
          </button>
          <button type="button" className="ac-btn ac-btn-ghost" onClick={closeForm}>
            Cancelar
          </button>
        </div>
      )}

      {itensQuery.isLoading && <p>Carregando...</p>}
      {itensQuery.isError && <p role="alert">Não foi possível carregar os itens planejados.</p>}
      {!itensQuery.isLoading && (itensQuery.data ?? []).length === 0 && (
        <p className="ac-empty">Nenhum item planejado ainda.</p>
      )}

      {(itensQuery.data ?? []).map((item) => (
        <div key={item.id} className="planejamento-item-card">
          <div>
            <div className="planejamento-item-card-nome">
              {item.nome}
              <span
                className={`planejamento-item-tag ${item.transacao_vinculada_id !== null ? "cumprido" : "hipotetico"}`}
              >
                {item.transacao_vinculada_id !== null ? "cumprido" : "hipotético"}
              </span>
              {item.recorrente && (
                <span className="planejamento-item-tag recorrente">recorrente</span>
              )}
            </div>
            <div className="planejamento-item-card-meta">
              {item.recorrente
                ? `Recorrente desde ${item.data_inicio}${item.data_fim ? ` até ${item.data_fim}` : ""}`
                : `Único em ${item.data_inicio}`}
              {" · "}
              {item.tipo === "debito" ? "Despesa" : "Receita"}
            </div>
          </div>
          <div className="planejamento-item-card-right">
            <span className="planejamento-item-card-valor">{formatCurrency(item.valor)}</span>
            {item.transacao_vinculada_id !== null ? (
              <button
                type="button"
                className="ac-btn ac-btn-ghost"
                onClick={() => desvincular.mutate(item.id)}
              >
                Desvincular
              </button>
            ) : (
              <button
                type="button"
                className="ac-btn"
                onClick={() => setVinculandoId(vinculandoId === item.id ? null : item.id)}
              >
                Vincular
              </button>
            )}
            <button
              type="button"
              className="ac-btn ac-btn-ghost"
              onClick={() => openEditForm(item)}
            >
              Editar
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-ghost ac-btn-danger"
              onClick={() => handleDelete(item)}
            >
              Excluir
            </button>
          </div>

          {vinculandoId === item.id && (
            <VincularPicker
              item={item}
              anoBase={anoBase}
              mesBase={mesBase}
              onVinculado={() => setVinculandoId(null)}
              onCancel={() => setVinculandoId(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function VincularPicker({
  item,
  anoBase,
  mesBase,
  onVinculado,
  onCancel,
}: {
  item: ItemPlanejado;
  anoBase: number;
  mesBase: number;
  onVinculado: () => void;
  onCancel: () => void;
}) {
  const [ano, setAno] = useState(anoBase);
  const [mes, setMes] = useState(mesBase);
  const vincular = useVincularItemPlanejado();

  const transacoesQuery = useQuery({
    queryKey: ["planejamentoVincularCandidatas", item.tipo, ano, mes],
    queryFn: () => fetchPluggyTransactions({ tipo: item.tipo, ano, mes }),
  });

  return (
    <div className="planejamento-picker">
      <div className="ac-form-row">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
      </div>
      {transacoesQuery.isLoading && <p>Buscando transações...</p>}
      {transacoesQuery.isError && (
        <p role="alert">Não foi possível buscar transações candidatas.</p>
      )}
      {transacoesQuery.data?.length === 0 && (
        <p className="ac-empty">Nenhuma transação de {item.tipo} nesse período.</p>
      )}
      {transacoesQuery.data?.map((tx: PluggyTransaction) => (
        <div key={tx.id} className="planejamento-picker-row">
          <span>
            {tx.descricao_usuario ?? tx.descricao} — {formatCurrency(tx.valor)} ({tx.data})
          </span>
          <button
            type="button"
            className="ac-btn ac-btn-primary"
            onClick={() =>
              vincular.mutate({ itemId: item.id, transacaoId: tx.id }, { onSuccess: onVinculado })
            }
          >
            Vincular
          </button>
        </div>
      ))}
      {vincular.isError && <p role="alert">Não foi possível vincular essa transação.</p>}
      <button type="button" className="ac-btn ac-btn-ghost" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
