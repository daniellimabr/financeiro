# SPRINT-009: Dashboards analíticos — Ativos/Passivos e refinamentos — Plano

- **PRD(s):** [PRD-009-dashboards-ativos-passivos](../prd/PRD-009-dashboards-ativos-passivos.md)
- **Data do plano:** 2026-08-15

## Objetivo da sprint

Ao final, o Dashboard mostra cards "Ativos" e "Passivos" (além dos já
existentes Receita/Despesa/Saldo/Patrimônio), cada um abrindo um
drill-down real (Ativos com toggle despesa/receita, Passivos só despesa,
Saldo por conta sempre atual); o funil de categoria expande direto para a
lista de transações (sem o nível "meio de pagamento", que vira ícone por
linha); gráficos têm tooltip e eixo X mais enxuto; tabelas de transação
são ordenáveis por coluna.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Migration `0009`: `liability_id`/`liability_sugerido_id`/`liability_sugestao_confianca` em `pluggy_transactions`, mirror de `0006` (asset) | Sonnet: implementação | [0006_add_categorization_and_asset_fields_to_pluggy_transactions.py](../../backend/alembic/versions/0006_add_categorization_and_asset_fields_to_pluggy_transactions.py) |
| 2 | `app/models/pluggy.py`: 3 colunas novas no model `PluggyTransaction`, mirror linhas 155-157 (asset) | Sonnet: implementação | [models/pluggy.py:155-157](../../backend/app/models/pluggy.py) |
| 3 | `app/categorization/engine.py`: `LiabilitySuggestion`/`suggest_liability`/`suggest_liability_from_index`/`build_liabilities_index`, mirror exato do bloco de asset (heurística substring, confiança "media") | Sonnet: implementação | [categorization/engine.py:23-27,130-152](../../backend/app/categorization/engine.py) |
| 4 | `app/categorization/service.py`: `list_transactions`/`_apply_suggestions` passam a considerar passivo; novo `set_transaction_liability` mirror de `set_transaction_asset` | Sonnet: implementação | [categorization/service.py:17-74,77-110,182-195](../../backend/app/categorization/service.py) |
| 5 | `app/schemas/categorization.py`/`router.py`: `TransactionOut` ganha campos de passivo; `LiabilityAssociationIn`; `PUT /categorization/transactions/{id}/liability` | Sonnet: implementação | [categorization/router.py:78-88](../../backend/app/categorization/router.py) |
| 6 | `app/pluggy_integration/service.py`/`router.py`: filtro `liability_id` em `list_transactions`/`GET /pluggy/transactions`, mirror do bloco `asset_id` | Sonnet: implementação | [pluggy_integration/service.py:109-140](../../backend/app/pluggy_integration/service.py) |
| 7 | `app/liabilities/service.py::delete_liability`: adicionar desassociação de `liability_id`/`liability_sugerido_id` antes de excluir — mirror exato de `delete_asset` (risco real: FK sem `ON DELETE`, mesmo achado da Sprint 8) | Sonnet: implementação | [assets/service.py:64-77](../../backend/app/assets/service.py); [liabilities/service.py:67-70](../../backend/app/liabilities/service.py) |
| 8 | `app/schemas/pluggy.py::PluggyTransactionOut`: campo `account_tipo` via `@property` no model `PluggyTransaction` (lê `self.account.tipo`); eager-load (`joinedload`) em `list_transactions` pra evitar N+1 | Sonnet: implementação | [schemas/pluggy.py:80-96](../../backend/app/schemas/pluggy.py); [models/pluggy.py:163](../../backend/app/models/pluggy.py) |
| 9 | `app/dashboards/service.py`: `_calcula_patrimonio` refatorado com helper `_ativos_e_passivos` (reuso, sem duplicar query); `get_summary`/`Summary` ganham `ativos`/`passivos`; novo `get_por_passivo`/`get_tendencia_por_passivo` (mirror de ativo, sem `tipo`, hardcode débito); novo `get_saldo_por_conta` (sem ano/mes) | Sonnet: implementação | [dashboards/service.py:142-186,365-447](../../backend/app/dashboards/service.py) |
| 10 | `app/schemas/dashboards.py`/`router.py`: `SummaryOut`+ativos/passivos; `PassivoTotalOut`/`TendenciaPassivoOut`/`SaldoContaOut`; `GET /por-passivo`, `.../tendencia`, `GET /saldo-por-conta` | Sonnet: implementação | [schemas/dashboards.py](../../backend/app/schemas/dashboards.py); [dashboards/router.py:82-105](../../backend/app/dashboards/router.py) |
| 11 | Testes backend: sugestão de passivo (engine+service), `set_transaction_liability` (404 cross-user), `delete_liability` desassociando (crítico, mirror `test_asset_service.py`), `get_por_passivo`/`get_tendencia_por_passivo`/`get_saldo_por_conta`, `get_summary` com ativos/passivos, filtro `liability_id`, `account_tipo` na resposta | Sonnet + skill tdd-workflow | [test_asset_service.py](../../backend/tests/test_asset_service.py) (scaffold a mirror) |
| 12 | `frontend/src/api/dashboards.ts`: `PassivoTotal`/`TendenciaPassivo`/`fetchDashboardPorPassivo`/`.../tendencia` (sem `tipo`), `SaldoConta`/`fetchSaldoPorConta` (sem filtro), `DashboardSummary`+ativos/passivos | Sonnet: implementação | [api/dashboards.ts:52-62,117-131](../../frontend/src/api/dashboards.ts) |
| 13 | `frontend/src/api/pluggy.ts`: `liabilityId` em filtros/fetch; `account_tipo` na interface `PluggyTransaction`. Novo `api/categorization.ts` helper `setTransactionLiability` | Sonnet: implementação | [api/pluggy.ts:108-134](../../frontend/src/api/pluggy.ts) |
| 14 | Hooks novos: `useLiabilityGastos`, `useLiabilityGastosTendencia`, `useSaldoPorConta`, `useSetTransactionLiability`; `usePluggyTransactions` ganha `liabilityId` na query key | Sonnet: implementação | [hooks/useAssetGastos.ts](../../frontend/src/hooks/useAssetGastos.ts) (mirror) |
| 15 | Extrair `frontend/src/components/CardSparkline.tsx` (de `DashboardsPage`/`AssetsPage`, hoje duplicados) e `frontend/src/components/TrendChart.tsx` (de `AssetTrendChart`, ganha `<Tooltip>` + eixo X reduzido); `frontend/src/hooks/useTableSort.ts` (novo, sem precedente); `frontend/src/components/AccountTipoIcon.tsx` (4 SVGs inline) | Sonnet + skill impeccable | [DashboardsPage.tsx:228-247](../../frontend/src/pages/DashboardsPage.tsx); [AssetsPage.tsx:361-407](../../frontend/src/pages/AssetsPage.tsx) |
| 16 | `AssetsPage.tsx`: refatorar para usar `CardSparkline`/`TrendChart` compartilhados — sem mudança de comportamento | Sonnet: implementação | [AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) |
| 17 | `DashboardsPage.tsx`: cards Ativos/Passivos/Saldo (clicáveis, novo estado de abertura); drill-down de Ativos (toggle, reaproveita hooks Sprint 8) e Passivos (sem toggle); drill-down de Saldo (ignora filtro); remove `DashChart` redundante e `MeioPagamentoAccordion`/`expandedMeios`; `TransacoesPanel` busca direto por categoria+período, ganha `AccountTipoIcon` por linha e ordenação via `useTableSort` | Sonnet + skill impeccable | [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) (arquivo inteiro) |
| 18 | Testes Vitest: `DashboardsPage.test.tsx` (fixtures de ativos/passivos/saldo, remoção do meio-pagamento, ícone por linha, ordenação), `CardSparkline.test.tsx`/`TrendChart.test.tsx`/`useTableSort.test.ts` novos; `AssetsPage.test.tsx` continua verde pós-refactor | Sonnet + skill tdd-workflow | [DashboardsPage.test.tsx](../../frontend/src/pages/DashboardsPage.test.tsx) |
| 19 | Deploy na VM de dev + validação manual real | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 20 | `scripts/browser-check/check-sprint9.mjs` (novo, mirror `check-ativos.mjs`+`check-dashboard.mjs`); deletar/reescrever `check-sanfona.mjs` (premissa removida: sanfona de 3 níveis) | Sonnet: implementação | [check-ativos.mjs](../../scripts/browser-check/check-ativos.mjs); [check-sanfona.mjs](../../scripts/browser-check/check-sanfona.mjs) |
| 21 | Atualizar docs vivos (`OVERVIEW.md` nova seção Sprint 9 + migrations + contagem de testes; `directory-structure.md`; `roadmap.md` fechando Sprint 9) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 22 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** heurística de sugestão de passivo (substring,
  primeiro match, sem sugestão se nada bate); `set_transaction_liability`
  (válido, passivo de outro usuário → 404); `delete_liability`
  desassociando transações vinculadas em vez de falhar (crítico — mirror
  direto de `test_asset_service.py`); `get_por_passivo`/
  `get_tendencia_por_passivo` (período vazio, nunca soma crédito,
  isolamento); `get_saldo_por_conta` (múltiplas contas, fallback
  apelido→nome, isolamento); `get_summary` com `ativos`/`passivos`
  batendo com o mesmo filtro `status=ativo` de `patrimonio`.
- **Integração:** todas as rotas novas (`por-passivo`, `.../tendencia`,
  `saldo-por-conta`, `PUT .../liability`, filtro `liability_id`) sem
  cookie → 401; isolamento entre dois usuários em cada uma.
- **Frontend (Vitest):** cards Ativos/Passivos abrindo o drill-down
  correto; card Saldo mostrando o mesmo dado independente do filtro
  ano/mês; funil expandindo direto de categoria pra transações (sem
  nível intermediário); ícone de meio de pagamento renderizado por linha;
  clique em cabeçalho de coluna reordenando a tabela; `CardSparkline`/
  `TrendChart` isolados (tooltip, eixo reduzido); `AssetsPage.test.tsx`
  sem mudança de assertion pós-refactor.
- Meta ≥80% cobertura nos módulos tocados, mesmo padrão das sprints
  anteriores.

## Impacto no roadmap

Fecha E6 (Dashboards analíticos) por completo — partes 1 (Sprint 6), 2
(Sprint 8) e 3 (esta sprint) concluídas. Sprint 10 (E3, modernização da
tabela de Categorização) segue como próxima candidata, sem dependência
desta sprint.

## Riscos / dependências

- **`delete_liability` sem desassociação é um risco real, não hipotético**
  — a FK `liability_id → liabilities.id` criada nesta sprint tem o mesmo
  padrão sem `ON DELETE` que `asset_id` já tinha (achado real da Sprint
  8). Task 7 precisa ir junto da migration (task 1) na mesma sprint, não
  ficar pra depois — do contrário há uma janela onde `DELETE
  /liabilities/{id}` quebra em produção assim que houver transação
  vinculada.
- **`account_tipo` via `@property` no model** — abordagem escolhida no
  planejamento por ser a de menor diff (Pydantic v2 `from_attributes` lê
  `@property` como atributo comum), mas precisa confirmar em execução que
  não há N+1: toda linha de `/pluggy/transactions` passa a acessar
  `tx.account`, então o eager-load (`joinedload`) na query é obrigatório,
  não opcional.
- **Remoção do nível "meio de pagamento" reverte uma decisão até então
  tratada como fechada** (PRD-005/006) — `check-sanfona.mjs` (Sprint 6)
  fica obsoleto porque testa exatamente o comportamento removido; não
  deixar esse script quebrado no repo, deletar ou reescrever como parte
  da task 20.
- **Extração de `CardSparkline`/`TrendChart` toca duas telas em produção**
  (`DashboardsPage`/`AssetsPage`) — mesmo risco já mitigado na Sprint 8
  para `PeriodFilter`: testes existentes dessas telas devem continuar
  100% verdes após a extração, sem mudança de asserts.
- **`get_summary` ganhando `ativos`/`passivos`** — qualquer consumidor
  existente do schema `SummaryOut` (só o frontend hoje) precisa tolerar
  campos novos sem quebrar; como é adição pura (nenhum campo removido/
  renomeado), risco baixo, mas checar se algum teste de contrato faz
  assert de igualdade estrita no shape da resposta.
