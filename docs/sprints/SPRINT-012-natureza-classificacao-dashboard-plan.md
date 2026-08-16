# SPRINT-012: Natureza — classificação e dashboard de visibilidade — Plano

- **PRD(s):** [PRD-012-natureza-classificacao-dashboard](../prd/PRD-012-natureza-classificacao-dashboard.md)
- **Data do plano:** 2026-08-15

## Objetivo da sprint

Ao final, o CEO consegue classificar cada subcategoria como Fixo
recorrente/Variável recorrente/Custo eventual (subcategoria não classificada
conta como Custo eventual por padrão) numa tela nova "Natureza", que também
mostra um dashboard de visibilidade (3 cards com total/percentual/sparkline
por natureza, filtrável por período e despesa/receita, com drill-down até
transação) — sem nenhuma migration, reaproveitando o campo `Subcategory.natureza`
dormente desde a Sprint 2.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Backend: `get_por_natureza`/`get_tendencia_por_natureza` em `app/dashboards/service.py`, espelhando `get_por_categoria`/`get_tendencia_por_categoria`, agrupando por `func.coalesce(Subcategory.natureza, Natureza.eventual)` | Sonnet: implementação | [dashboards/service.py:262-299](../../backend/app/dashboards/service.py) (get_por_categoria); [dashboards/service.py:376-431](../../backend/app/dashboards/service.py) (get_tendencia_por_categoria); [models/category.py:15-18](../../backend/app/models/category.py) (enum Natureza) |
| 2 | Dataclasses `NaturezaTotal`/`TendenciaNatureza` + schemas `NaturezaTotalOut`/`TendenciaNaturezaOut` em `app/schemas/dashboards.py`, endpoints `GET /dashboards/por-natureza` e `GET /dashboards/por-natureza/tendencia` em `app/dashboards/router.py` | Sonnet: implementação | [schemas/dashboards.py:19-27](../../backend/app/schemas/dashboards.py) (CategoriaTotalOut); [dashboards/router.py:44-52](../../backend/app/dashboards/router.py) (por-categoria); [dashboards/router.py:80-91](../../backend/app/dashboards/router.py) (tendencia) |
| 3 | Testes backend: `test_dashboards_service.py` (agrupamento fixa/variavel/eventual, fallback null→eventual, transação sem subcategoria cai em eventual, exclusão `excluir_de_totais`, isolamento por usuário) + `test_dashboards_endpoints.py` (rotas novas, 401 sem auth) | Sonnet + skill tdd-workflow | testes existentes de `por-categoria`/`por-ativo` no mesmo arquivo |
| 4 | `api/categories.ts`: `updateSubcategory(id, payload)` (só há fetch hoje); `hooks/useUpdateSubcategoryNatureza.ts` (mutation + invalida `["subcategories"]` e queries de `por-natureza`) | Sonnet: implementação | [api/categories.ts](../../frontend/src/api/categories.ts) (só GET hoje); [categories/router.py:79-92](../../backend/app/categories/router.py) (PUT subcategory, payload completo) |
| 5 | `api/dashboards.ts` + hooks `useDashboardByNatureza`/`useDashboardNaturezaTendencia`, espelhando `useDashboardByCategoria`/`useDashboardCategoriaTendencia`; `utils/naturezaLabels.ts` (mapa enum→rótulo, única fonte dos 3 rótulos) | Sonnet: implementação | `frontend/src/api/dashboards.ts`; `frontend/src/hooks/` (hooks de categoria existentes) |
| 6 | `pages/NaturezaPage.tsx`: dashboard de visibilidade (`PeriodFilter` + toggle despesa/receita + 3 cards com `CardSparkline` + funil de drill-down natureza→subcategoria→transação, reaproveitando `TransacoesPanel`/`TransactionEditCells`) | Sonnet + skill impeccable | [pages/AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) (padrão período+toggle+cards+drilldown); [pages/DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) (funil `dash-funnel`); `DESIGN.md` |
| 7 | `pages/NaturezaPage.tsx`: seção de classificação — tabela de subcategorias agrupada por `CategoryGroup`, seletor de 3 opções por linha (usa `naturezaLabels`), salva via `useUpdateSubcategoryNatureza` | Sonnet + skill impeccable | [pages/CategorizationReviewPage.tsx](../../frontend/src/pages/CategorizationReviewPage.tsx) (padrão de tabela agrupada + colgroup) |
| 8 | Definir os 3 tons de cor de natureza (não reaproveitar a paleta categórica de 8 matizes já reservada para grupos/subcategorias) via skill `impeccable`, mesmo fluxo de decisão visual das Sprints 5/6/9; CSS novo em `index.css` | Sonnet + skill impeccable | `DESIGN.md`; [index.css](../../frontend/src/index.css) (tokens `--cat-1`..`--cat-8`, `--receita`/`--despesa`) |
| 9 | `ProtectedPage.tsx`: nova aba "Natureza" em `NAV_ITEMS`, entre "Passivos" e "Gestão de contas" | Sonnet: implementação | [ProtectedPage.tsx:14-22](../../frontend/src/pages/ProtectedPage.tsx) |
| 10 | Testes frontend: `NaturezaPage.test.tsx` novo (cards, drill-down, tabela de classificação, edição dispara mutation e invalida cache), `ProtectedPage.test.tsx` atualizado, `api/categories.test.ts`/`api/dashboards.test.ts` atualizados | Sonnet + skill tdd-workflow | testes existentes de `AssetsPage.test.tsx`/`CategorizationReviewPage.test.tsx` |
| 11 | `scripts/browser-check/check-sprint12.mjs` novo: cards com valores corretos, drill-down até transação, edição de natureza persistindo após reload, mobile, sem erros de console — validado contra a VM de dev | Sonnet: implementação | [scripts/browser-check/check-sprint9.mjs](../../scripts/browser-check/check-sprint9.mjs) (script mais recente equivalente) |
| 12 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` fechando Sprint 12, criando épico E9) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 13 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `get_por_natureza`/`get_tendencia_por_natureza` —
  agrupamento correto por natureza, `null`→eventual, transação sem
  subcategoria→eventual, exclusão de `excluir_de_totais`, isolamento por
  `user_id`, cálculo de percentual.
- **Integração (pytest, TestClient):** `GET /dashboards/por-natureza` e
  `/tendencia` — 401 sem auth, filtro `tipo`/`ano`/`mes`/`meses`, isolamento
  entre usuários.
- **Componente/integração (Vitest + Testing Library):** `NaturezaPage` —
  renderiza 3 cards com totais corretos a partir de fixtures, clique em card
  abre drill-down, seleção de natureza numa linha da tabela chama
  `updateSubcategory` e invalida cache (`refetch` reflete no card sem
  reload), toggle despesa/receita, filtro de período.
- Meta ≥80% cobertura nos módulos novos/tocados, mesmo padrão das sprints
  anteriores. Suíte completa (backend + frontend) 100% verde antes de
  fechar.

## Impacto no roadmap

Cria o **épico E9 — Natureza e projeção de custos**, cobrindo esta sprint
(classificação + dashboard) e a Sprint 13 (projeção de custos futuros,
`/plan` própria e futura). Não fecha E9 sozinha. Sprint 14 (Configurações +
competência de salário) fica registrada como continuação de **E7 — Conta e
perfil** (já existente, aberto), também `/plan` própria e futura. Não altera
nenhum épico já fechado (E1-E6, E8).

## Riscos / dependências

- **Rótulos de exibição divergem dos valores do enum no banco** (`fixa` →
  "Fixo recorrente" etc.) — `utils/naturezaLabels.ts` precisa ser a única
  fonte desse mapeamento (card, seletor, funil) para não haver rótulo
  divergente em dois lugares, mesmo cuidado já tomado com `subcategoryLabel`
  na Sprint 11.
- **`PUT /subcategories/{id}` exige payload completo** (`group_id`, `nome`,
  `natureza`) — o hook de update precisa enviar o `group_id`/`nome` atuais
  junto da nova `natureza` (não é um PATCH parcial); usar os dados já
  carregados por `useSubcategories` como base do payload.
- **Primeira tela a combinar "dashboard" e "tela de gestão/edição"** no
  mesmo componente — os dois já têm padrões prontos (drill-down de
  Dashboard/Ativos/Passivos; tabela editável de Categorização), mas nunca
  coexistiram numa página só; vale confirmar com o CEO se a divisão em 2
  seções na mesma tela funciona bem visualmente antes de fechar (task 8,
  skill `impeccable`).
- **Sem migration nem mudança de contrato em endpoints existentes** — risco
  de regressão é baixo; o maior risco é escopo (ver PRD-012, "Fora de
  escopo") — não deixar a tela crescer para virar CRUD completo de
  categoria/grupo, que não foi pedido.
