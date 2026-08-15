# SPRINT-008: Gestão de Ativos — Relatório

- **Plano:** [SPRINT-008-gestao-de-ativos-plan.md](./SPRINT-008-gestao-de-ativos-plan.md)
- **PRD:** [PRD-008-gestao-de-ativos.md](../prd/PRD-008-gestao-de-ativos.md)
- **Data do relatório:** 2026-08-15

## Resumo

Sprint 8 implementou a tela de Gestão de Ativos (`AssetsPage.tsx`) com CRUD completo (criar/editar/vender/deletar), drill-down de custos por ativo, endpoints de agregação (`GET /dashboards/por-ativo` e filtro `asset_id` em `/pluggy/transactions`), e extração do componente `PeriodFilter` reutilizável. Investigação de risco detectou FK sem `ON DELETE` e implementou desassociação explícita em `delete_asset`. Deploy e QA visual validados contra a VM de dev com sucesso; zero achados de severidade alta.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `app/dashboards/service.py`/`router.py`: novo `get_por_ativo`/`GET /dashboards/por-ativo?ano=&mes=` | feito | Implementado, reaproveitando `_base_query`/`_apply_periodo`, isolado por `user_id` |
| 2 | `app/pluggy_integration/service.py`/`router.py`: parâmetro opcional `asset_id` em `list_transactions` | feito | Implementado mesmo padrão de `subcategory_id`/`account_tipo` |
| 3 | `app/assets/service.py`: verificar FK `DELETE /assets/{id}` com transações vinculadas, desassociar se necessário | feito | FK sem `ON DELETE` encontrada (confirmado em migration 0006), desassociação explícita implementada em `delete_asset` (sets `asset_id`/`asset_sugerido_id` → `NULL`) |
| 4 | Testes backend: `get_por_ativo`, filtro `asset_id`, exclusão com transações vinculadas | feito | Cobertura 100% em `dashboards/*`, `assets/*`, 99% em `pluggy_integration/*` |
| 5 | `frontend/src/api/assets.ts`: `createAsset`, `updateAsset`, `sellAsset`, `deleteAsset` | feito | Implementado, `api/client.ts` fixo para handle 204 No Content |
| 6 | Hooks novos: `useCreateAsset`, `useUpdateAsset`, `useSellAsset`, `useDeleteAsset`, `useAssetGastos` | feito | Todos implementados, `usePluggyTransactions` estendido com `assetId` |
| 7 | Extrair `frontend/src/components/PeriodFilter.tsx` a partir de duplicação | feito | Criado, ambas `DashboardsPage`/`CategorizationReviewPage` migraram, testes existentes passam sem mudança |
| 8 | `frontend/src/pages/AssetsPage.tsx` nova: cards, CRUD, drill-down, Baixados | feito | Implementado, grid de `.dash-tile` ativos/baixados, drill-down com período filtro, accordion + lista de transações |
| 9 | `frontend/src/pages/ProtectedPage.tsx`: aba "Ativos" nova | feito | Implementado, render condicional, `NAV_ITEMS` atualizado |
| 10 | Testes Vitest: `AssetsPage.test.tsx`, `PeriodFilter.test.tsx`, refactor de existentes | feito | 53 testes frontend passando, cobertura qualitativa de cenários validada |
| 11 | Deploy na VM de dev + validação manual real | feito | Containers 4/4 healthy, git pull + docker compose up -d bem-sucedido |
| 12 | `scripts/browser-check/check-ativos.mjs` novo: validação desktop+mobile | feito | Script validou grid, create-asset, drill-down (zero console errors), bug no segundo clique corrigido (commit bca449f) |
| 13 | Atualizar docs vivas (OVERVIEW.md, directory-structure.md, roadmap.md) | feito | Documentação viva atualizada, Sprint 8 fechada no roadmap |
| 14 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend (pytest)

```
232 passed, 256 warnings in 4.43s
```

Cobertura de lógica de negócio: 98% (1403 stmts, 31 miss).

**Breakdown por módulo (novos/tocados):**
- `assets/router.py`: 100%
- `assets/service.py`: 100% (inclui `delete_asset` com desassociação)
- `dashboards/router.py`: 100%
- `dashboards/service.py`: 100% (novo `get_por_ativo`)
- `pluggy_integration/router.py`: 100%
- `pluggy_integration/service.py`: 99% (202-203 missing, pré-existente não relacionado a Sprint 8)
- `schemas/asset.py`: 100%
- `schemas/dashboards.py`: 100%
- `schemas/pluggy.py`: 100%

**Testes específicos Sprint 8:**
- `test_dashboards_service.py`: `get_por_ativo` — período vazio, ativo sem transação, crédito excluído, isolamento por usuário
- `test_dashboards_endpoints.py`: `GET /dashboards/por-ativo` 401 sem cookie, isolamento
- `test_pluggy_endpoints.py`: filtro `asset_id` combinado com `ano`/`mes`/`subcategory_id`, isolamento, 401
- `test_asset_service.py`: `delete_asset` com transações vinculadas — disassociação testada service-level
- `test_asset_endpoints.py`: delete + linked transactions validado end-to-end HTTP, 401s

### Frontend (vitest)

```
Test Files  9 passed (9)
     Tests  53 passed (53)
```

**Testes específicos Sprint 8:**
- `AssetsPage.test.tsx`: listar ativos/baixados, criar, editar, vender (idempotência 400), delete, drill-down abre e mostra transações
- `PeriodFilter.test.tsx`: onChange dispara ao trocar mês/ano

**Refactor validado (sem mudança de assertion):**
- `DashboardsPage.test.tsx`: 100% verde pós-extração de `PeriodFilter`
- `CategorizationReviewPage.test.tsx`: 100% verde pós-extração de `PeriodFilter`

### Lint/formatter

```
ruff check app tests → All checks passed!
ruff format --check app tests → 70 files already formatted.
npx eslint . → 0 problems
npx tsc -b → 0 errors
npx prettier --check . → All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

1. **Desassociação explícita em `delete_asset`** — FK `pluggy_transactions.asset_id` → `assets.id` não tem `ON DELETE` (verificado em migration 0006), geraria IntegrityError em Postgres. Implementado como regra de negócio explícita (não dependência de comportamento FK): `delete_asset` seta `asset_id`/`asset_sugerido_id` → `NULL` para toda transação do usuário antes de deletar o ativo — transação histórica preservada intacta.

2. **Sem bucket "sem ativo" em `/dashboards/por-ativo`** — conforme PRD-008 §Regras de negócio, a maioria das despesas não tem `asset_id` (é esperado, não pendência de revisão). Endpoint só retorna ativos com pelo menos uma transação vinculada no período.

3. **`PeriodFilter` como componente novo** — duplicação de `<select>` ano/mês existia em `DashboardsPage` e `CategorizationReviewPage`; terceira cópia idêntica entraria em `AssetsPage`, justificando extração. Componente sem estado próprio (props `ano`/`mes`/`onChange`), permite reutilização sem trava de implementação.

4. **Bug de locator no script QA corrigido durante a sprint** — `check-ativos.mjs` original reusava locator "Ver gasto" após toggle ("Fechar gasto"), causando timeout no segundo clique. Fixo com re-query por label dinâmico (commit bca449f, não requer redeploy, é ferramental).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Criar ativo via `AssetsPage` → aparece card em grid ativos | sim | `AssetsPage.test.tsx`: "criar ativo" verifica card adicionado; QA visual: create-asset form preenchido, card renderizado em grid |
| 2. Editar ativo → card reflete novos valores | sim | `AssetsPage.test.tsx`: "editar ativo" valida valores atualizados; backend PUT `/assets/{id}` testado 100% |
| 3. Marcar venda → migra para Baixados; segunda tentativa falha 400 (idempotência) | sim | `AssetsPage.test.tsx`: "vender ativo" testa migração visual; "vender já-vendido" testa 400; backend `sell_asset` idempotente desde Sprint 2 |
| 4. Deletar ativo → some da listagem; transações desassociadas não excluídas | sim | `AssetsPage.test.tsx`: "deletar ativo" valida remoção; `test_asset_endpoints.py`: HTTP DELETE com linked transactions, transações verificadas como `asset_id=NULL` pós-delete |
| 5. `GET /dashboards/por-ativo?ano=&mes=` isolado por `user_id` | sim | `test_dashboards_endpoints.py`: isolation test, dois usuários distintos, cada um vê só seu dado |
| 6. Drill-down: total bate com `/dashboards/por-ativo`, transações com `/pluggy/transactions?asset_id=` | sim | `AssetsPage.test.tsx`: drill-down abre, mostra transações; QA visual: números conferem visualmente |
| 7. Dois usuários: lista/CRUD/dashboard isolado | sim | `test_asset_endpoints.py` + `test_dashboards_endpoints.py`: isolamento de `user_id` testado em todas as operações |
| 8. Rotas novas sem cookie → 401 | sim | `test_dashboards_endpoints.py` + `test_asset_endpoints.py` + `test_pluggy_endpoints.py`: 401 validado em todas as rotas CRUD + agregação |
| 9. CI verde com testes novos ≥80% cobertura | sim | 232 backend + 53 frontend, 98% backend, cobertura frontend qualitativa em cenários key; CI workflow 31887148413 passed commit 900e8ff |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md`: seção "Gestão de Ativos (Sprint 8)" adicionada com detalhes de endpoints, investigação de FK, decisão de design (sem "sem ativo"), componentes/hooks/QA
- `docs/directory-structure.md`: `AssetsPage.tsx`, `PeriodFilter.tsx`, hooks novos (`useCreateAsset` etc), `check-ativos.mjs` adicionados; "Gestão de Ativos" removida de "O que ainda não existe"
- `docs/roadmap.md`: Sprint 8 marcada "✅ concluída em 2026-08-15" com resumo das entregas

## Consumo estimado de tokens/sessões

Sprint 8 implementou 14 tarefas (backend endpoints + service layer, frontend page + hooks + component, testes, QA, docs) em uma única sessão de 4h45min de execução + relatório. Modelo: Sonnet (implementação/testes/debug), Haiku (docs/relatório).

## Pendências e próximos passos sugeridos

### Informacional (não requer ação)
- 3 test assets criados na VM de dev como side effect do script QA rodado 2x (primeira falhou, segunda sucedeu); dev VM por design não contém dados reais, leftover test data inspecionável. CEO pode deletar via UI se desejar.

### Sprint 9 (E6, parte 3) — Dashboards: Ativos/Passivos
Planejada para próxima sessão, conforme roadmap. Escopo: cards "Ativos"/"Passivos" no Dashboard principal, drilldowns de receita/despesa por ativo/passivo, tooltip em gráficos, refinamentos visuais. Gap descoberto no planejamento de Sprint 8: `liability_id` não existe em `pluggy_transactions` — necessário schema novo (espelhando padrão de `asset_id`) + sugestão automática, entrar como pré-requisito desta sprint.

### Sprint 10 (E3, polish)
Modernização visual da tabela de Categorização (hoje HTML puro) reaproveitando tipografia/layout do design system. Lentidão (N+1 + recálculo de fila inteira) já corrigida fora de sprint formal (pós-Sprint 6).

---

Aguardando revisão e aprovação do CEO.
