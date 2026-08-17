# SPRINT-017: Filtro de Conta em Categorizar + Validação de Dados/Cálculos contra Extrato Real — Plano

- **PRD(s):** [PRD-017-filtro-conta-validacao-extrato](../prd/PRD-017-filtro-conta-validacao-extrato.md)
- **Data do plano:** 2026-08-17

## Objetivo da sprint

Ao final, o CEO consegue filtrar a tela Categorizar por uma conta específica
(ex.: "Itaú - Conta Corrente"), e o sistema foi validado mês a mês (janeiro a
junho/2026) contra o extrato real do Itaú — datas, categorização e saldo
final de cada mês batendo, com todo gap real encontrado corrigido e coberto
por teste de regressão.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | `GET /categorization/transactions` ganha query param `account_id: int \| None` | Sonnet: implementação | [categorization/router.py:26-51](../../backend/app/categorization/router.py) |
| 2 | `list_transactions()` ganha parâmetro `account_id`, filtro condicional `PluggyTransaction.account_id == account_id` | Sonnet: implementação | [categorization/service.py:50-122](../../backend/app/categorization/service.py) (padrão de `group_id`/`has_asset`) |
| 3 | `TransactionsFilter`/`fetchTransactions` (frontend) ganham `accountId` | Sonnet: implementação | [api/categorization.ts](../../frontend/src/api/categorization.ts) |
| 4 | `useCategorizationTransactions` inclui `accountId` na query key | Sonnet: implementação | [hooks/useCategorizationTransactions.ts](../../frontend/src/hooks/useCategorizationTransactions.ts) |
| 5 | `CategorizationReviewPage.tsx`: novo `<select>` de conta no `.dash-filter`, populado via `usePluggyAccounts()`, rótulo `account.apelido ?? account.nome` | Sonnet + skill impeccable | [pages/CategorizationReviewPage.tsx](../../frontend/src/pages/CategorizationReviewPage.tsx); [pages/AccountManagementPage.tsx:210](../../frontend/src/pages/AccountManagementPage.tsx) (mesmo fallback de rótulo) |
| 6 | Testes backend: filtro isolado, combinado com filtros existentes, isolamento cross-user | Sonnet + skill tdd-workflow | [test_categorization_service.py](../../backend/tests/test_categorization_service.py), [test_categorization_endpoints.py](../../backend/tests/test_categorization_endpoints.py) |
| 7 | Testes frontend: select popula contas, muda filtro, reflete `account_id` no request | Sonnet + skill tdd-workflow | `CategorizationReviewPage.test.tsx` |
| 8 | Estender `scripts/browser-check/check-categorizacao.mjs` com o select de conta | Sonnet: implementação | [scripts/browser-check/check-categorizacao.mjs](../../scripts/browser-check/check-categorizacao.mjs) |
| 9 | Deploy VM de dev (filtro de conta) | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 10 | Reconciliação mês a mês (jan→jun/2026): ler o PDF do extrato do Itaú por mês, puxar `GET /categorization/transactions?account_id=&ano=&mes=` (filtro novo) + tabela de auditoria de Configurações (`GET /dashboards/evolucao-saldo-por-conta`), comparar datas/categorização/saldo final, investigar causa raiz de cada gap com o CEO antes de corrigir, implementar fix + teste de regressão, revalidar o mês, só então avançar | Sonnet: implementação + investigação, com o CEO | dado real da VM de dev; PDF do extrato (1º semestre); [get_evolucao_saldo_por_conta](../../backend/app/dashboards/service.py) |
| 11 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` — Sprint 17) refletindo o filtro novo e um resumo dos gaps corrigidos na reconciliação | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 12 | Relatório de sprint — deve documentar mês a mês (jan-jun) o que foi comparado, gaps encontrados e como foram corrigidos; registrar explicitamente que jul/ago ficam para revisão "no olho" futura | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** filtro `account_id` em `list_transactions`
  isolado e combinado com `status`/`tipo`/`ano`/`mes`/`has_asset`/`group_id`;
  isolamento cross-user via `TestClient`. Testes de regressão para cada gap
  real corrigido durante a reconciliação (tarefa 10) — específicos ao bug
  encontrado, não previsíveis de antemão.
- **Componente (Vitest):** select de conta em `CategorizationReviewPage`
  populando via `usePluggyAccounts`, filtro refletido no request.
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde
  antes de fechar.

## Impacto no roadmap

Sprint sem épico prévio (item trazido diretamente pelo CEO). Pausa
funcionalidade nova até a reconciliação fechar — nenhuma sprint de feature
deve ser planejada antes do relatório desta sprint ser aprovado. Julho e
agosto/2026 ficam como candidata a sessão futura de revisão "no olho".

## Riscos / dependências

- **Escopo do Bloco 2 (reconciliação) não é fechado de antemão** — depende
  inteiramente do que a comparação contra o PDF do extrato revelar. Se o
  volume de gaps em jan-jun tornar a sessão grande demais, cortar no mês
  corrente e tratar o resto como sprint de continuação é aceitável (mesmo
  precedente de corte de escopo em sessão usado nas Sprints 8/13/16) — não
  aprovar o relatório com meses pendentes sem deixar isso explícito em
  "Pendências".
- **Toda correção que tocar regra de negócio já decidida precisa de
  confirmação explícita do CEO antes de implementar** — não presumir
  causa raiz nem aplicar fix silencioso, mesmo padrão de rigor das Sprints
  10/15/16.
- **Extrato é PDF real do CEO** — tratar como dado sensível, não versionar
  no repo, mesmo cuidado já aplicado a outros dados financeiros reais do
  projeto.
- **Dependência de dado real da VM de dev** — toda validação de saldo/data
  precisa ser feita contra a VM de dev (não há Docker/Postgres local no
  notebook), mesmo fluxo de sessões anteriores.
