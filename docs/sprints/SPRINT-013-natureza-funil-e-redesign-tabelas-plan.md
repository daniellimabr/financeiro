# SPRINT-013: Natureza — rótulo, funil completo, e redesign de tabelas/botões — Plano

- **PRD(s):** [PRD-013-natureza-funil-e-redesign-tabelas](../prd/PRD-013-natureza-funil-e-redesign-tabelas.md)
- **Data do plano:** 2026-08-16

## Objetivo da sprint

Ao final: (1) o rótulo "Custo eventual" some do app, vira só "Eventual";
(2) o funil da tela Natureza ganha o nível Categoria, virando
`Natureza → Categoria → Subcategoria → Transação`, com percentual somando
100% em cada nível; (3) toda tabela/lista do app (Categorização, Natureza,
drill-downs de Dashboard/Ativos/Passivos, breakdown de Patrimônio, Gestão
de Contas) usa a mesma linguagem visual — colgroup, hover, ordenação,
densidade — decidida via rodada `impeccable` antes de aplicar CSS em
massa, com `DESIGN.md` reescrito para documentar a decisão final. Maior
sprint do projeto até agora — ver "Riscos/dependências" para a
recomendação de checkpoints de revisão intermediários.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Rename "Custo eventual" → "Eventual": `naturezaLabels.ts` (fonte única), `<option>` hardcoded de `NaturezaPage.tsx` (trocar por `.map()` sobre `NATUREZA_ORDER`), prosa auxiliar, `NaturezaPage.test.tsx`, `check-sprint12.mjs` (seletor `/Custo eventual/` quebraria silenciosamente) | Sonnet: implementação | [naturezaLabels.ts](../../frontend/src/utils/naturezaLabels.ts); [NaturezaPage.tsx:190-235](../../frontend/src/pages/NaturezaPage.tsx) |
| 2 | `frontend/src/utils/categoriaGrouping.ts` novo: `groupCategoriaTotalsByGrupo(items)` — aritmética pura de agrupamento por `group_id`, percentual do total do pai, ordenação desc | Sonnet: implementação | [dashboards.ts](../../frontend/src/api/dashboards.ts) (shape de `CategoriaTotal`) |
| 3 | `DashboardsPage.tsx`: exportar `Row` (componente de linha puramente apresentacional, hoje privado) para reuso em `NaturezaPage`; opcional — migrar `useMemo` interno de `GrupoAccordion` para usar `categoriaGrouping.ts` (reduz duplicação de aritmética, sem tocar cor/trend) | Sonnet: implementação | [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) (`GrupoAccordion`, `SubcategoriaAccordion`, `Row`) |
| 4 | `NaturezaPage.tsx`: estado `expandedGrupos`/`expandedSubcategorias` (sanfona multi-nível, substitui `selectedSubcategoryId` single-select); `NaturezaGrupoAccordion` novo (nível Categoria, cor `naturezaColorVar` constante); `NaturezaSubcategoriaAccordion` (renomeado de `NaturezaSubcategoriaList`, desce um nível, percentual contra total do grupo) | Sonnet: implementação | [NaturezaPage.tsx](../../frontend/src/pages/NaturezaPage.tsx); `DrillState` em `DashboardsPage.tsx` (padrão de sanfona multi-nível a replicar) |
| 5 | Testes `NaturezaPage.test.tsx`: clique em Categoria antes de Subcategoria; percentuais somando 100% em cada nível novo; múltiplas categorias abertas ao mesmo tempo | Sonnet + skill tdd-workflow | fixtures existentes (2 grupos, reaproveitáveis) |
| 6 | `frontend/src/components/TransactionsTable.tsx` novo — extraído de `TransacoesPanel` (`DashboardsPage.tsx`), contrato existente + flags `showCategoria?`/`showAtivo?` (default `true`) | Sonnet: implementação | [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) (`TransacoesPanel`, `useTableSort`, `SortableHeader`) |
| 7 | Repontar consumidores: `DashboardsPage.tsx` (remove `TransacoesPanel` local), `NaturezaPage.tsx` (import atualizado), `AssetsPage.tsx` (`AssetDrilldown` usa `TransactionsTable` com `showAtivo={false}`, ganha Categoria editável + sort), `LiabilitiesPage.tsx` (`LiabilityDrilldown` usa `TransactionsTable`, ganha sort) | Sonnet: implementação | [AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) (`AssetDrilldown`); [LiabilitiesPage.tsx](../../frontend/src/pages/LiabilitiesPage.tsx) (`LiabilityDrilldown`) |
| 8 | Testes: atualizar imports de `TransacoesPanel` em `DashboardsPage.test.tsx`/`NaturezaPage.test.tsx`; `AssetsPage.test.tsx` ganha asserções de colunas Categoria/sort novas; `LiabilitiesPage.test.tsx` idem para sort | Sonnet + skill tdd-workflow | testes existentes de cada página |
| 9 | Rodada `impeccable` (fluxo de direção via Artifact, mesmo processo das Sprints 5/6/9/12): 2-3 candidatas de tabela unificada (colgroup/hover/densidade/sort) usando `AssetDrilldown` como referência "antes"; card de Ativo/Passivo com hierarquia de botão proposta (Default/Ghost); candidatas de cor "destrutiva" só se o CEO quiser testar essa direção | Sonnet + skill impeccable | `DESIGN.md`; dado real de `AssetDrilldown`/cards de Ativos |
| 10 | Aplicar direção escolhida em `index.css`: consolidar `.dash-table`/`.cat-review-table`/`.nat-table` na base unificada (colgroup, hover, densidade `--space-2`), variantes de botão se aprovadas, classe nova para listas simples | Sonnet: implementação | `index.css` (seções `.dash-table`, `.cat-review-table`, `.nat-table`, botão base) |
| 11 | Plugar `useTableSort`/`SortableHeader` onde falta: `CategorizationReviewPage.tsx`, tabela de classificação de `NaturezaPage.tsx` (Categoria/Subcategoria) | Sonnet: implementação | [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) (`useTableSort`, `SortableHeader`) |
| 12 | `AccountManagementPage.tsx`: lista de contas e diálogo de sincronização ganham o vocabulário visual de espaçamento/hover (sem virar accordion) | Sonnet: implementação | `index.css` (classe nova de lista simples) |
| 13 | `AssetsPage.tsx`/`LiabilitiesPage.tsx`: hierarquia de botão nos cards (Default para ação primária, Ghost para secundárias, Excluir/Quitar por último) | Sonnet: implementação | `DESIGN.md` (One Button Rule) |
| 14 | `DashboardsPage.tsx`: `PatrimonioBreakdownPanel` ganha colgroup (5 linhas fixas, trivial) | Sonnet: implementação | [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) |
| 15 | `DESIGN.md`: reescrever seção "Table" (remove "nível mais plano do funil por design", documenta tabela unificada com nota de histórico); atualizar "One Button Rule" só se cor nova for aprovada; nova subseção de listas simples; atualizar "Tertiary — Natureza" (rótulo) | Sonnet: implementação | `DESIGN.md` completo |
| 16 | Testes de regressão de CSS/estrutura: rodar suíte completa após mudanças de `index.css`/estrutura de tabela; checar `AccountManagementPage.test.tsx` (seletores por `<li>` podem quebrar mesmo sem mudar texto visível) | Sonnet + skill tdd-workflow | suíte frontend completa |
| 17 | `scripts/browser-check/check-sprint13.mjs` novo: rótulo "Eventual", funil de 4 níveis com percentuais somando 100%, hover/sort presentes nas 9 superfícies, desktop+mobile, sem erros de console — validado contra a VM de dev | Sonnet: implementação | [check-sprint12.mjs](../../scripts/browser-check/check-sprint12.mjs) |
| 18 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` fechando Sprint 13, reordenando Sprint 14/15) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 19 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** nenhuma mudança de backend prevista —
  rodar suíte completa só para confirmar zero regressão.
- **Componente/integração (Vitest + Testing Library):**
  - `NaturezaPage`: funil de 4 níveis (Natureza→Categoria→Subcategoria→
    Transação), percentuais somando 100% em cada nível, múltiplas
    categorias abertas simultaneamente, rótulo "Eventual" em todos os
    pontos (card, funil, tabela de classificação, prosa).
  - `TransactionsTable` (extraído): contrato preservado para os 3
    consumidores (Dashboard/Natureza, Ativos, Passivos), flags
    `showCategoria`/`showAtivo`.
  - `AssetsPage`: `AssetDrilldown` mostra e permite editar Categoria,
    ordena por Data/Valor.
  - `CategorizationReviewPage`: ordenação de coluna nova.
  - `AccountManagementPage`: lista/diálogo de sincronização com nova
    estrutura, sem quebrar interações existentes.
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa (backend +
  frontend) 100% verde antes de fechar, mesmo padrão de todas as sprints
  anteriores.

## Impacto no roadmap

Não fecha o épico E9 (só a Sprint 14, projeção de custos futuros, fecha).
Esta sprint entra na frente da fila por pedido do CEO — empurra
"projeção de custos futuros" (E9) de Sprint 13 para **Sprint 14**, e
"Configurações + competência de salário" (E7) de Sprint 14 para
**Sprint 15**. Nenhum épico já fechado (E1-E6, E8) é reaberto.

## Riscos / dependências

- **Maior risco da sprint:** três mudanças estruturalmente independentes
  na mesma sprint — reversão de uma regra de design documentada afetando
  9 superfícies, possível cor "destrutiva" nova, e colapso de 3
  implementações de tabela num componente compartilhado. Mitigação:
  sequenciar em checkpoints de revisão (após tarefas 1-5 — rename + funil,
  independentes do redesign; após a rodada `impeccable`/tarefa 9, antes de
  aplicar CSS em massa; final) mesmo sendo uma sprint só — mesmo padrão
  que a Sprint 11 já mostrou necessário (3 rodadas de feedback pós-entrega
  numa fração deste escopo).
- **Certo:** `NaturezaPage.test.tsx` e `AssetsPage.test.tsx` quebram
  (estrutura de clique de 2 níveis, colunas novas) — reescrita esperada,
  não uma surpresa.
- **Médio:** extrair `TransactionsTable` e repontar 4 páginas é mecânico,
  mas prop divergente entre os 3 consumidores atuais pode gerar erro de TS
  em call site esquecido — rodar `tsc -b` cedo, não só no fim.
- **Médio:** se `GrupoAccordion` migrar para `categoriaGrouping.ts`,
  diferença de arredondamento/ordenação pode mudar output visível —
  `DashboardsPage.test.tsx` cobre, mas vale rodar antes/depois lado a lado.
- **Médio:** `AccountManagementPage.test.tsx` provavelmente faz query por
  `<li>` — mudar a estrutura de linha pode quebrar seletor mesmo sem mudar
  texto visível.
- **Médio:** sort client-side em `CategorizationReviewPage` só ordena a
  página atual (paginação server-side, 20 itens) — não é bug, mas vale
  deixar explícito na validação para não virar "achado" de revisão depois
  (mesmo padrão de expectativa que a Sprint 11 já teve que gerenciar).
- **Sem migration nem mudança de contrato em endpoint existente** — risco
  de regressão de backend é baixo; o risco real desta sprint é inteiramente
  de frontend/design.
