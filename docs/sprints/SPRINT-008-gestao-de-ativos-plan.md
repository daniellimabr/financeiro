# SPRINT-008: Gestão de Ativos — Plano

- **PRD(s):** [PRD-008-gestao-de-ativos](../prd/PRD-008-gestao-de-ativos.md)
- **Data do plano:** 2026-08-15

## Objetivo da sprint

Ao final, o usuário cadastra, edita, vende e exclui ativos por uma tela
própria (`AssetsPage`, aba "Ativos"), vê cards com o valor atual de cada
ativo ativo (ativos vendidos ficam numa seção "Baixados" separada), e pode
abrir um drill-down por ativo mostrando quanto gastou nele no período
filtrado e quais transações compõem esse total.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | `app/dashboards/service.py`/`router.py`: novo `get_por_ativo`/`GET /dashboards/por-ativo?ano=&mes=`, reaproveitando `_base_query`/`_apply_periodo`, `LEFT JOIN` `PluggyTransaction.asset_id`→`Asset.id`, só despesas | Sonnet: implementação | PRD-008 §Critério 5, §Regras de negócio; [dashboards/service.py](../../backend/app/dashboards/service.py) |
| 2 | `app/pluggy_integration/service.py`/`router.py`: parâmetro opcional `asset_id` em `list_transactions`/`GET /pluggy/transactions`, mesmo padrão de `subcategory_id` | Sonnet: implementação | PRD-008 §Critério 6; [pluggy_integration/service.py:109](../../backend/app/pluggy_integration/service.py) |
| 3 | `app/assets/service.py`: verificar comportamento real de `DELETE /assets/{id}` quando há transações com `asset_id` apontando pro ativo — se houver FK restritiva, desassociar (`asset_id`/`asset_sugerido_id` → `NULL`) antes de excluir; registrar o comportamento real encontrado | Sonnet: implementação | PRD-008 §Critério 4, §Regras de negócio; [assets/service.py](../../backend/app/assets/service.py) |
| 4 | Testes backend: `get_por_ativo` (vazio, sem despesa, isolamento); filtro `asset_id` combinado com outros filtros e isolamento; exclusão de ativo com transações vinculadas | Sonnet + skill tdd-workflow | PRD-008 §Critérios 4-9 |
| 5 | `frontend/src/api/assets.ts`: `createAsset`, `updateAsset`, `sellAsset`, `deleteAsset` | Sonnet: implementação | [api/pluggy.ts:82-91](../../frontend/src/api/pluggy.ts) (padrão de mapeamento) |
| 6 | Hooks novos: `useCreateAsset`, `useUpdateAsset`, `useSellAsset`, `useDeleteAsset`, `useAssetGastos` (`GET /dashboards/por-ativo`); estender `usePluggyTransactions`/`fetchPluggyTransactions` com `assetId` | Sonnet: implementação | [hooks/useUpdatePluggyAccount.ts](../../frontend/src/hooks/useUpdatePluggyAccount.ts) |
| 7 | Extrair `frontend/src/components/PeriodFilter.tsx` (mês/ano) a partir da duplicação em `DashboardsPage.tsx`/`CategorizationReviewPage.tsx`; migrar as duas telas para o componente | Sonnet: implementação | [DashboardsPage.tsx:50-63,148-176](../../frontend/src/pages/DashboardsPage.tsx); [CategorizationReviewPage.tsx:16-29,142-170](../../frontend/src/pages/CategorizationReviewPage.tsx) |
| 8 | `frontend/src/pages/AssetsPage.tsx` (nova): `PeriodFilter` + grid `.dash-summary`/`.dash-tile` de ativos ativos, formulário criar/editar (dialog inline, padrão `AccountManagementPage`), ação vender (dialog `valor_venda`/`data_venda`), excluir (confirmação simples), drill-down de gasto+transações por ativo (accordion, padrão `TransacoesPanel`), seção "Baixados" com opacidade reduzida | Sonnet + skill impeccable | PRD-008 §Escopo; [AccountManagementPage.tsx](../../frontend/src/pages/AccountManagementPage.tsx); [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) (accordion) |
| 9 | `frontend/src/pages/ProtectedPage.tsx`: aba "Ativos" nova (`Tab`, `NAV_ITEMS`, import, render condicional) | Sonnet: implementação | [ProtectedPage.tsx](../../frontend/src/pages/ProtectedPage.tsx) |
| 10 | Testes Vitest: `AssetsPage.test.tsx` (listar ativos/baixados, criar, editar, vender + idempotência, excluir, drill-down); `PeriodFilter.test.tsx`; ajustar `DashboardsPage.test.tsx`/`CategorizationReviewPage.test.tsx` pra extração | Sonnet + skill tdd-workflow | [AccountManagementPage.test.tsx](../../frontend/src/pages/AccountManagementPage.test.tsx) (scaffold) |
| 11 | Deploy na VM de dev + validação manual real | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 12 | `scripts/browser-check/check-ativos.mjs` (novo): grid de cards, criar ativo, abrir drill-down, screenshot desktop+mobile; cancelar antes de excluir/vender dado real | Sonnet: implementação | Padrão de [check-sprint7.mjs](../../scripts/browser-check/check-sprint7.mjs) |
| 13 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md` — mover Gestão de Ativos de "O que ainda não existe" pra implementado, registrar `PeriodFilter`/hooks/`check-ativos.mjs`; `roadmap.md` — fechar Sprint 8) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 14 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `get_por_ativo` — período sem despesa, ativo sem
  nenhuma transação vinculada, exclusão correta de créditos do total,
  isolamento entre usuários. Filtro `asset_id` em `list_transactions` —
  combinado com `ano`/`mes`/`subcategory_id`, isolamento. Comportamento de
  `delete_asset` com transações vinculadas (desassociação, não exclusão
  de transação).
- **Integração:** `GET /dashboards/por-ativo` e o filtro `asset_id` em
  `GET /pluggy/transactions` sem cookie → 401; isolamento entre usuários.
- **Frontend (Vitest):** criar/editar/vender/excluir ativo dispara a
  chamada correta e invalida a query certa; venda de ativo já baixado
  reporta erro (idempotência refletida do 400 do backend); card ativo abre
  drill-down mostrando gasto + transações do período; `PeriodFilter`
  isolado (mudança de mês/ano dispara `onChange`).
- Meta ≥80% cobertura nos módulos tocados, mesmo padrão das sprints
  anteriores.

## Impacto no roadmap

Fecha E6 parte 2. Deixa Sprint 9 (E6 parte 3 — cards Ativos/Passivos no
Dashboard, drilldowns, `liability_id`, ordenação, tooltip) como próxima
candidata — já registrada no roadmap com o gap de `liability_id`
sinalizado com antecedência.

## Riscos / dependências

- **`DELETE /assets/{id}` com transações vinculadas** — comportamento real
  da FK (`ON DELETE`) não foi confirmado na sessão de planejamento, só
  inferido; primeira tarefa de execução deve checar isso cedo, já que
  afeta se a task 3 precisa de código novo ou é só validação.
- **Extração de `PeriodFilter` toca duas telas já em produção** —
  `DashboardsPage`/`CategorizationReviewPage` — regressão de comportamento
  aí quebraria funcionalidade existente, não só a nova; testes existentes
  dessas duas telas devem continuar 100% verdes após a migração, sem
  mudança de asserts (só refatoração de implementação).
- **`/dashboards/por-ativo` sem bucket "sem ativo"** — decisão de design
  registrada no PRD-008; se o CEO validar a tela e sentir falta de ver
  "despesas sem ativo associado" ali, é uma revisão de escopo pequena, não
  um retrabalho de schema.
