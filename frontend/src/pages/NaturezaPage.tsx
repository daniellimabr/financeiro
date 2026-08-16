import { useMemo, useState } from "react";

import type { Subcategory } from "../api/categories";
import {
  SEM_CATEGORIA_ID,
  type CategoriaTotal,
  type PeriodoHistorico,
  type PontoTendencia,
  type TransacaoTipo,
} from "../api/dashboards";
import { CardSparkline } from "../components/CardSparkline";
import { PeriodFilter } from "../components/PeriodFilter";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardByNatureza } from "../hooks/useDashboardByNatureza";
import { useDashboardNaturezaTendencia } from "../hooks/useDashboardNaturezaTendencia";
import { useSubcategories } from "../hooks/useSubcategories";
import { useUpdateSubcategoryNatureza } from "../hooks/useUpdateSubcategoryNatureza";
import { groupCategoriaTotalsByGrupo } from "../utils/categoriaGrouping";
import { formatCurrency } from "../utils/format";
import {
  NATUREZA_ORDER,
  naturezaColorVar,
  naturezaLabel,
  type NaturezaValue,
} from "../utils/naturezaLabels";
import { Row, TransacoesPanel } from "./DashboardsPage";

function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((existing) => existing !== id) : [...list, id];
}

const PERIODO_HISTORICO: PeriodoHistorico = 6;

function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}

// Mesma regra de negócio do backend (COALESCE Subcategory.natureza,
// 'eventual'): subcategoria sem natureza definida OU transação sem
// subcategoria (sentinel SEM_CATEGORIA_ID) caem em "eventual".
function subcategoryNatureza(
  subcategoryId: number,
  subcategories: Subcategory[] | undefined
): NaturezaValue {
  if (subcategoryId === SEM_CATEGORIA_ID) return "eventual";
  const sub = subcategories?.find((s) => s.id === subcategoryId);
  return sub?.natureza === "fixa" || sub?.natureza === "variavel" ? sub.natureza : "eventual";
}

export function NaturezaPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [tipo, setTipo] = useState<TransacaoTipo>("debito");
  const [selectedNatureza, setSelectedNatureza] = useState<NaturezaValue | null>(null);
  const [expandedGrupos, setExpandedGrupos] = useState<number[]>([]);
  const [expandedSubcategorias, setExpandedSubcategorias] = useState<number[]>([]);

  const filter: { ano: number; mes: number } = { ano, mes };

  const naturezaQuery = useDashboardByNatureza(tipo, filter);
  const tendenciaQuery = useDashboardNaturezaTendencia(tipo, ano, mes, PERIODO_HISTORICO);
  // Funil natureza → subcategoria reaproveita /por-categoria (já traz total
  // por subcategoria) e agrupa localmente por natureza via useSubcategories
  // — sem endpoint novo dedicado, mesma técnica que GrupoAccordion usa para
  // agrupar por CategoryGroup em DashboardsPage.
  const categoriaQuery = useDashboardByCategoria(tipo, filter);
  const { data: groups } = useCategoryGroups();
  const { data: subcategories } = useSubcategories();
  const updateNatureza = useUpdateSubcategoryNatureza();

  const trendByNatureza = useMemo(() => {
    const map = new Map<string, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.natureza, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  const subcategoriasPorNatureza = useMemo(() => {
    const map = new Map<NaturezaValue, CategoriaTotal[]>();
    for (const item of categoriaQuery.data ?? []) {
      const natureza = subcategoryNatureza(item.subcategory_id, subcategories);
      const lista = map.get(natureza) ?? [];
      lista.push(item);
      map.set(natureza, lista);
    }
    for (const lista of map.values()) lista.sort((a, b) => Number(b.total) - Number(a.total));
    return map;
  }, [categoriaQuery.data, subcategories]);

  const gruposComSubcategorias = useMemo(() => {
    const porGrupo = new Map<number, Subcategory[]>();
    for (const sub of subcategories ?? []) {
      const lista = porGrupo.get(sub.group_id) ?? [];
      lista.push(sub);
      porGrupo.set(sub.group_id, lista);
    }
    return (groups ?? [])
      .map((group) => ({
        group,
        subcategorias: (porGrupo.get(group.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
      }))
      .filter((entry) => entry.subcategorias.length > 0);
  }, [groups, subcategories]);

  function toggleNatureza(natureza: NaturezaValue) {
    setSelectedNatureza((prev) => (prev === natureza ? null : natureza));
    setExpandedGrupos([]);
    setExpandedSubcategorias([]);
  }

  function toggleGrupo(id: number) {
    setExpandedGrupos((prev) => toggleId(prev, id));
  }

  function toggleSubcategoria(id: number) {
    setExpandedSubcategorias((prev) => toggleId(prev, id));
  }

  return (
    <section className="dash-page">
      <h2>Natureza</h2>

      <div className="dash-filter">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
        <div className="dash-toggle" role="group" aria-label="Tipo de transação">
          <button type="button" aria-pressed={tipo === "debito"} onClick={() => setTipo("debito")}>
            Despesa
          </button>
          <button
            type="button"
            aria-pressed={tipo === "credito"}
            onClick={() => setTipo("credito")}
          >
            Receita
          </button>
        </div>
      </div>

      {naturezaQuery.isLoading && <p>Carregando...</p>}
      {naturezaQuery.isError && <p role="alert">Não foi possível carregar a natureza.</p>}

      {naturezaQuery.data && (
        <div className="dash-summary">
          {NATUREZA_ORDER.map((natureza) => {
            const item = naturezaQuery.data?.find((n) => n.natureza === natureza);
            const color = naturezaColorVar(natureza);
            return (
              <button
                key={natureza}
                type="button"
                className="dash-tile clickable"
                onClick={() => toggleNatureza(natureza)}
                aria-expanded={selectedNatureza === natureza}
              >
                <span className="k">{naturezaLabel(natureza)}</span>
                <span className="v" style={{ color }}>
                  {formatCurrency(item?.total ?? "0")}
                </span>
                <span className="tag">{formatPercent(item?.percentual ?? "0")} do período</span>
                <CardSparkline pontos={trendByNatureza.get(natureza)} color={color} />
              </button>
            );
          })}
        </div>
      )}

      {selectedNatureza && (
        <div className="dash-funnel">
          <div className="dash-funnel-head">
            <h2>{naturezaLabel(selectedNatureza)}</h2>
            <button type="button" className="dash-back" onClick={() => setSelectedNatureza(null)}>
              Fechar
            </button>
          </div>

          {categoriaQuery.isLoading && <p>Carregando...</p>}
          {categoriaQuery.isError && (
            <p role="alert">Não foi possível carregar as subcategorias.</p>
          )}

          <NaturezaGrupoAccordion
            natureza={selectedNatureza}
            itens={subcategoriasPorNatureza.get(selectedNatureza) ?? []}
            isLoading={categoriaQuery.isLoading}
            filter={filter}
            tipo={tipo}
            expandedGrupos={expandedGrupos}
            expandedSubcategorias={expandedSubcategorias}
            onToggleGrupo={toggleGrupo}
            onToggleSubcategoria={toggleSubcategoria}
          />
        </div>
      )}

      <h3>Classificar subcategorias</h3>
      <p className="dash-empty">
        Subcategorias sem classificação contam como Eventual nos cards acima.
      </p>

      {updateNatureza.isError && <p role="alert">Não foi possível salvar a natureza.</p>}

      <div className="dash-table-wrap">
        <table className="dash-table nat-table">
          <colgroup>
            <col className="col-grupo" />
            <col className="col-subcategoria" />
            <col className="col-natureza" />
          </colgroup>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Natureza</th>
            </tr>
          </thead>
          <tbody>
            {gruposComSubcategorias.map(({ group, subcategorias }) =>
              subcategorias.map((sub, index) => (
                <tr key={sub.id}>
                  {index === 0 && <td rowSpan={subcategorias.length}>{group.nome}</td>}
                  <td>{sub.nome}</td>
                  <td>
                    <select
                      aria-label={`Natureza de ${sub.nome}`}
                      value={sub.natureza ?? "eventual"}
                      onChange={(event) =>
                        updateNatureza.mutate({ subcategory: sub, natureza: event.target.value })
                      }
                    >
                      {NATUREZA_ORDER.map((natureza) => (
                        <option key={natureza} value={natureza}>
                          {naturezaLabel(natureza)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NaturezaGrupoAccordion({
  natureza,
  itens,
  isLoading,
  filter,
  tipo,
  expandedGrupos,
  expandedSubcategorias,
  onToggleGrupo,
  onToggleSubcategoria,
}: {
  natureza: NaturezaValue;
  itens: CategoriaTotal[];
  isLoading: boolean;
  filter: { ano: number; mes: number };
  tipo: TransacaoTipo;
  expandedGrupos: number[];
  expandedSubcategorias: number[];
  onToggleGrupo: (id: number) => void;
  onToggleSubcategoria: (id: number) => void;
}) {
  const grupos = useMemo(() => groupCategoriaTotalsByGrupo(itens), [itens]);

  if (!isLoading && grupos.length === 0) {
    return <p className="dash-empty">Nenhuma transação nesta natureza no período.</p>;
  }

  // Cor de natureza é constante em todo o funil (grupo e subcategoria) —
  // deliberadamente dessaturada pra não competir com a paleta categórica
  // (--cat-N) usada no funil espelho de Dashboards (ver PRD-013).
  const color = naturezaColorVar(natureza);
  const max = grupos[0]?.total ?? 1;

  return (
    <ul className="dash-list dash-accordion">
      {grupos.map((grupo) => (
        <li key={grupo.group_id}>
          <div className="dash-accordion-item">
            <Row
              nome={grupo.group_nome}
              total={String(grupo.total)}
              percentual={grupo.percentual.toFixed(2)}
              max={max}
              color={color}
              expanded={expandedGrupos.includes(grupo.group_id)}
              onClick={() => onToggleGrupo(grupo.group_id)}
            />
            {expandedGrupos.includes(grupo.group_id) && (
              <div className="dash-accordion-panel">
                <NaturezaSubcategoriaAccordion
                  color={color}
                  grupoTotal={grupo.total}
                  subcategorias={grupo.subcategorias}
                  filter={filter}
                  tipo={tipo}
                  expandedSubcategorias={expandedSubcategorias}
                  onToggleSubcategoria={onToggleSubcategoria}
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function NaturezaSubcategoriaAccordion({
  color,
  grupoTotal,
  subcategorias,
  filter,
  tipo,
  expandedSubcategorias,
  onToggleSubcategoria,
}: {
  color: string;
  grupoTotal: number;
  subcategorias: CategoriaTotal[];
  filter: { ano: number; mes: number };
  tipo: TransacaoTipo;
  expandedSubcategorias: number[];
  onToggleSubcategoria: (id: number) => void;
}) {
  const max = Number(subcategorias[0]?.total ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {subcategorias.map((item) => {
        const percentual =
          grupoTotal > 0 ? ((Number(item.total) / grupoTotal) * 100).toFixed(2) : "0.00";
        const expanded = expandedSubcategorias.includes(item.subcategory_id);
        return (
          <li key={item.subcategory_id}>
            <div className="dash-accordion-item">
              <Row
                nome={item.subcategory_nome}
                total={item.total}
                percentual={percentual}
                max={max}
                color={color}
                expanded={expanded}
                onClick={() => onToggleSubcategoria(item.subcategory_id)}
              />
              {expanded && (
                <div className="dash-accordion-panel">
                  <TransacoesPanel
                    filter={filter}
                    categoriaId={item.subcategory_id}
                    tipo={tipo}
                    totalParaPercentual={item.total}
                    emptyMessage="Nenhuma transação nesta categoria."
                  />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
