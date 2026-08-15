# SPRINT-010: Revisão de UX (Dashboard/Categorização) e Gestão de Passivos — Plano

- **PRD(s):** [PRD-010-revisao-ux-e-passivos](../prd/PRD-010-revisao-ux-e-passivos.md)
- **Data do plano:** 2026-08-15

## Objetivo da sprint

Ao final, a causa do NuTag aparecer como receita está identificada e
corrigida; o menu tem uma aba a menos (Início fundido em Dashboards) e
"Gestão de Contas" vira o último item; os gráficos do Dashboard mostram
mês/ano no tooltip (sem "v:"); o card Patrimônio abre a composição do
cálculo; qualquer transação do drill-down do Dashboard pode ter descrição/
categoria/ativo editados sem sair da tela; existe uma tela completa de
Gestão de Passivos (CRUD + quitação), espelhando Ativos; e a tela de
Categorização ganha filtro por ativo associado, filtro por categoria
(grupo), e um motor de sugestão de ativo do mesmo nível do motor de
categoria (regras + histórico + similaridade).

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | **Investigar NuTag na VM de dev** (SSH/paramiko): consultar transações reais com descrição contendo "NuTag", conferir `tipo`/conta de origem, determinar se é padrão sistemático (`_map_account_tipo`/`_map_transaction_tipo`) ou caso isolado | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md); [pluggy_integration/service.py:274-291](../../backend/app/pluggy_integration/service.py) |
| 2 | Aplicar correção pontual do NuTag conforme causa encontrada (fix de mapeamento + reprocessar, ou `UPDATE` direto nas linhas afetadas via script único) | Sonnet: implementação | resultado da task 1 |
| 3 | Migration nova: tabela `asset_categorization_rules`, mirror de `categorization_rules` trocando `subcategory_id`→`asset_id` | Sonnet: implementação | [models/categorization.py](../../backend/app/models/categorization.py) |
| 4 | `app/models/categorization.py`: model `AssetCategorizationRule` | Sonnet: implementação | [models/categorization.py](../../backend/app/models/categorization.py) |
| 5 | `app/categorization/engine.py`: `suggest_asset`/`suggest_asset_from_index` reescritos para 3 camadas (regra exata → histórico confirmado exato → similaridade `difflib >= 0.86`), mirror de `suggest_category`/`suggest_category_from_index`; novo `build_asset_rules_index`/`build_asset_historico_index` | Sonnet: implementação | [categorization/engine.py:43-159](../../backend/app/categorization/engine.py) |
| 6 | `app/categorization/service.py::list_transactions`: novos parâmetros `has_asset`/`group_id` (join `Subcategory`→`CategoryGroup`, filtro `PluggyTransaction.asset_id.is_(None)`/`.isnot(None)`) | Sonnet: implementação | [categorization/service.py:18-76](../../backend/app/categorization/service.py) |
| 7 | `app/categorization/router.py`: `has_asset`/`group_id` em `GET /transactions` | Sonnet: implementação | [categorization/router.py:26-47](../../backend/app/categorization/router.py) |
| 8 | `app/dashboards/service.py`: `_calcula_patrimonio` refatorado para reaproveitar um helper que retorna as 4 partes (sem duplicar query); novo `get_patrimonio_breakdown` | Sonnet: implementação | [dashboards/service.py:168-203](../../backend/app/dashboards/service.py) |
| 9 | `app/schemas/dashboards.py`/`router.py`: `PatrimonioBreakdownOut`; `GET /dashboards/patrimonio/breakdown` | Sonnet: implementação | [dashboards/router.py](../../backend/app/dashboards/router.py); [schemas/dashboards.py](../../backend/app/schemas/dashboards.py) |
| 10 | Mutations de edição de transação (`useUpdateDescription`, `useSetCategory`, `useSetTransactionAsset`, `useSetTransactionLiability`) passam a invalidar também `["pluggyTransactions"]` e as chaves de agregação do Dashboard (`dashboardSummary`, `dashboardByCategoria`, etc.) | Sonnet: implementação | [hooks/useSetCategory.ts](../../frontend/src/hooks/useSetCategory.ts); [hooks/useSetTransactionAsset.ts](../../frontend/src/hooks/useSetTransactionAsset.ts); [hooks/useUpdateDescription.ts](../../frontend/src/hooks/useUpdateDescription.ts); [hooks/useSetTransactionLiability.ts](../../frontend/src/hooks/useSetTransactionLiability.ts) |
| 11 | Extrair componente(s) de edição de linha de transação (descrição inline, `<select>` categoria, `<select>` ativo) de `CategorizationReviewPage.tsx` em componente(s) compartilhado(s); usar em `TransacoesPanel` (Dashboard) e `AssetDrilldown` (AssetsPage) | Sonnet + skill impeccable | [CategorizationReviewPage.tsx:228-308](../../frontend/src/pages/CategorizationReviewPage.tsx); [DashboardsPage.tsx:664-779](../../frontend/src/pages/DashboardsPage.tsx); [AssetsPage.tsx:411-417](../../frontend/src/pages/AssetsPage.tsx) |
| 12 | `CardSparkline.tsx`: prop `values: number[]` → `pontos: {mes,ano,total}[]` (mirror do formato de `TrendChart`); tooltip com rótulo "MM/AAAA" (sem "v:", via `name` no `<Line>` ou `content` customizado) e `itemStyle`/`labelStyle` com `fontSize` consistente | Sonnet + skill impeccable | [CardSparkline.tsx](../../frontend/src/components/CardSparkline.tsx); [TrendChart.tsx](../../frontend/src/components/TrendChart.tsx) |
| 13 | Atualizar todos os usos de `CardSparkline` (`DashboardsPage.tsx`, `AssetsPage.tsx`) para passar `pontos` em vez de `values` | Sonnet: implementação | [DashboardsPage.tsx:184-207](../../frontend/src/pages/DashboardsPage.tsx); [AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) |
| 14 | `DashboardsPage.tsx`: tile "Patrimônio" vira clicável (`DrillKind` ganha `"patrimonio"`, `drillTitle` atualizado); novo `PatrimonioBreakdown` (tabela de 4 linhas + total, linkando pros drill-downs de Ativos/Passivos/Saldo já existentes) | Sonnet + skill impeccable | [DashboardsPage.tsx:79-291](../../frontend/src/pages/DashboardsPage.tsx) |
| 15 | `frontend/src/api/liabilities.ts` (tipos + `fetchLiabilities`/`createLiability`/`updateLiability`/`settleLiability`/`deleteLiability`), mirror de `api/assets.ts` | Sonnet: implementação | [api/assets.ts](../../frontend/src/api/assets.ts) |
| 16 | Hooks novos: `useLiabilities`, `useCreateLiability`, `useUpdateLiability`, `useSettleLiability`, `useDeleteLiability`, mirror de `use{Assets,CreateAsset,UpdateAsset,SellAsset,DeleteAsset}.ts` (`useDeleteLiability` invalida `pluggyTransactions`/`dashboardPorPassivo*`/`categorizationTransactions`) | Sonnet: implementação | [hooks/useAssets.ts](../../frontend/src/hooks/useAssets.ts); [hooks/useDeleteAsset.ts](../../frontend/src/hooks/useDeleteAsset.ts) |
| 17 | `frontend/src/pages/LiabilitiesPage.tsx`: form criar/editar (nome, tipo, valor_total, saldo_devedor — sem `data_aquisicao`), ação "Quitar" (confirmação, sem form), seções Ativos/Quitados, drill-down com `TrendChart` + `usePluggyTransactions({ liabilityId, ... })` + `useLiabilityGastos(Tendencia)` já existentes, com edição inline (task 11) | Sonnet + skill impeccable | [AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) (mirror completo) |
| 18 | `ProtectedPage.tsx`: remover aba `inicio` (stub) e sua entrada em `NAV_ITEMS`; `dashboards` vira estado inicial; adicionar aba `passivos` (import `LiabilitiesPage`); mover `contas` para o final de `NAV_ITEMS` (ordem final: Dashboards, Categorizar, Ativos, Passivos, Gestão de contas) | Sonnet: implementação | [ProtectedPage.tsx:13-64](../../frontend/src/pages/ProtectedPage.tsx) |
| 19 | `CategorizationReviewPage.tsx`: filtros novos "associado a ativo" (todos/sim/não) e "categoria" (grupo, dropdown via `useCategoryGroups`); indicador visual débito/crédito por linha (reaproveitar `AccountTipoIcon` ou padrão equivalente) | Sonnet + skill impeccable | [CategorizationReviewPage.tsx:19-158](../../frontend/src/pages/CategorizationReviewPage.tsx) |
| 20 | `frontend/src/api/categorization.ts`/`hooks/useCategorizationTransactions.ts`: `has_asset`/`group_id` no filtro e na query key | Sonnet: implementação | [api/categorization.ts:41-64](../../frontend/src/api/categorization.ts); [hooks/useCategorizationTransactions.ts](../../frontend/src/hooks/useCategorizationTransactions.ts) |
| 21 | Testes backend: motor de sugestão de ativo (3 camadas, mirror exato dos testes de categoria), `has_asset`/`group_id` em `list_transactions`, `get_patrimonio_breakdown` (bate com `patrimonio` de `get_summary`), migration/model `AssetCategorizationRule` | Sonnet + skill tdd-workflow | testes de categoria existentes (mirror) |
| 22 | Testes frontend: `LiabilitiesPage.test.tsx` (mirror `AssetsPage.test.tsx`), `CardSparkline.test.tsx` atualizado (pontos com mês/ano, sem "v:"), edição inline no drill-down do Dashboard/AssetsPage, filtros novos de Categorização, nav sem aba Início e com Passivos/ordem nova | Sonnet + skill tdd-workflow | testes existentes equivalentes (mirror) |
| 23 | Deploy na VM de dev + validação manual real de todos os itens do PRD | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 24 | `scripts/browser-check/check-sprint10.mjs` (novo): navegação sem Início, tela de Passivos, filtros de Categorização, tooltip sem "v:", drill-down de Patrimônio, edição inline no Dashboard | Sonnet: implementação | [check-ativos.mjs](../../scripts/browser-check/check-ativos.mjs) (mirror) |
| 25 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` fechando Sprint 10) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 26 | Relatório de sprint, incluindo achado da investigação do NuTag (causa raiz documentada) | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** motor de sugestão de ativo em 3 camadas (regra
  exata, histórico exato, similaridade `>=0.86`, mesmos casos de borda já
  cobertos para categoria — sem sugestão, empate, abaixo do threshold);
  `list_transactions` com `has_asset=true/false/None` e `group_id`
  isolado e combinado com filtros existentes; `get_patrimonio_breakdown`
  batendo exatamente com `patrimonio` de `get_summary` em cenários com
  ativos/passivos/contas/cartões variados; CRUD de `Liability` (já
  existente, sem regressão).
- **Integração:** rotas novas (`GET /dashboards/patrimonio/breakdown`,
  filtros novos em `/categorization/transactions`) sem cookie → 401;
  isolamento entre dois usuários em cada uma.
- **Frontend (Vitest):** `LiabilitiesPage` (criar/editar/excluir/quitar,
  drill-down); `CardSparkline` com tooltip mostrando mês/ano sem "v:";
  edição de descrição/categoria/ativo funcionando a partir do drill-down
  do Dashboard e do de Ativos, com refetch automático; filtros novos de
  Categorização; nav sem aba Início, com Passivos, e "Gestão de Contas"
  por último.
- Meta ≥80% cobertura nos módulos tocados, mesmo padrão das sprints
  anteriores.

## Impacto no roadmap

Sprint cross-epic (não fecha nenhum épico sozinha): toca E3 (Categorização
— filtros e motor de sugestão de ativo), E5/E6 (Dashboards — tooltip,
Patrimônio, edição inline), E4 (Gestão de Passivos, item 9 do escopo
funcional original, cuja UI nunca tinha sido priorizada). A sprint
"Categorização: tabela moderna" (antes numerada como Sprint 10) passa a
ser **Sprint 11**, sem mudança de escopo, ainda sem PRD/plano.

## Riscos / dependências

- **A correção do NuTag depende do resultado da investigação (task 1)** —
  não dá pra planejar a task 2 em detalhe até ver o dado real; se a causa
  for um padrão sistemático de mapeamento (`_map_account_tipo`/
  `_map_transaction_tipo`), o fix pode afetar outras transações além de
  NuTag, exigindo reprocessamento mais amplo do que uma correção pontual —
  avaliar o alcance antes de aplicar.
- **Extração dos controles de edição de `CategorizationReviewPage.tsx`
  toca 3 telas em produção** (Categorização, Dashboard, Ativos/Passivos) —
  mesmo risco já mitigado nas Sprints 8/9 para `PeriodFilter`/
  `CardSparkline`/`TrendChart`: testes existentes dessas telas devem
  continuar 100% verdes após a extração.
- **Mudar a prop de `CardSparkline` (`values`→`pontos`) é breaking change
  interno** — os dois consumidores atuais (`DashboardsPage`,
  `AssetsPage`) precisam ser atualizados na mesma tarefa (task 13), não
  depois, para não deixar o build quebrado entre commits.
- **`asset_categorization_rules` é tabela nova sem precedente de uso real**
  — diferente de `categorization_rules` (que já tem 328 regras herdadas do
  v1), começa vazia; a suggestion engine para ativo depende mais do
  histórico confirmado (camada 2) até o usuário confirmar itens
  suficientes para regras/similaridade fazerem diferença. Vale registrar
  essa expectativa no relatório para não parecer regressão se a taxa de
  sugestão automática for baixa no início.
- **Escopo maior que sprints anteriores** (8 frentes, backend+frontend) —
  decisão consciente do CEO de manter como uma sprint só; se durante a
  execução alguma frente se mostrar bem mais complexa que o esperado
  (ex.: investigação do NuTag revelar um problema sistêmico maior),
  voltar ao CEO para decidir se corta escopo em vez de estourar a sessão.
