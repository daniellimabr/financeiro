# SPRINT-015: Configurações, Competência de Salário e Saldo Acumulado — Plano

- **PRD(s):** [PRD-015-configuracoes-competencia-salario-saldo-acumulado](../prd/PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
- **Data do plano:** 2026-08-16

## Objetivo da sprint

Ao final, o CEO consegue sair da conta, editar perfil/gestão de contas numa
tela "Configurações" única, configurar o dia de corte de competência de
salário e informar o salário real de dez/2025 (que passa a aparecer como
receita normal no drill-down de jan/2026), informar o saldo real de cada
conta em 31/12/2025 e auditar a evolução mensal de saldo de cada uma contra
o extrato bancário real, e ver dois cards novos no Dashboard ("Saldo
Acumulado" e "Saldo Anterior", este último navegando a tela pro mês anterior
ao ser clicado). Fecha o épico E7.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Migration `0012`: `users.salario_competencia_cutoff_dia` (default 25), `pluggy_accounts.saldo_inicial`, backfill Python de `data_competencia` para transações já categorizadas como Salário (cutoff 25) | Sonnet: implementação | [alembic/versions/0011_create_asset_categorization_rules.py](../../backend/alembic/versions/0011_create_asset_categorization_rules.py) (última migration); [alembic/versions/0007_dashboards_transferencia_flag_e_competencia.py](../../backend/alembic/versions/0007_dashboards_transferencia_flag_e_competencia.py) (precedente de backfill em migration) |
| 2 | `POST /auth/logout`; `PUT /auth/me/settings` (cutoff de competência); `UserOut`/`UserSettingsIn` em `app/schemas/user.py` | Sonnet: implementação | [auth/router.py](../../backend/app/auth/router.py); [auth/service.py](../../backend/app/auth/service.py) |
| 3 | `app/categorization/competencia.py` novo: `shift_to_next_month`/`competencia_salario`; hook em `set_category`/`bulk_confirm` (`app/categorization/service.py`) — recalcula `data_competencia` ao confirmar/reconfirmar Salário, reseta ao sair de Salário | Sonnet: implementação | [categorization/service.py](../../backend/app/categorization/service.py) (`set_category`, `bulk_confirm`); [alembic/versions/0008_categorizacao_gestao_contas.py](../../backend/alembic/versions/0008_categorizacao_gestao_contas.py) (lookup de subcategoria por nome, precedente) |
| 4 | `upsert_salario_ajuste_dez_2025` em `app/pluggy_integration/service.py` (transação sentinela, upsert por `pluggy_transaction_id` determinístico); `PUT /pluggy/ajuste-salario-dezembro` | Sonnet: implementação | [pluggy_integration/service.py](../../backend/app/pluggy_integration/service.py) (`_upsert_transaction`, padrão de upsert idempotente) |
| 5 | `PluggyAccount.saldo_inicial`; `PUT /pluggy/accounts/{id}/saldo-inicial` (schema dedicado, não reaproveita `PluggyAccountUpdateIn`) | Sonnet: implementação | [models/pluggy.py](../../backend/app/models/pluggy.py); [pluggy_integration/router.py](../../backend/app/pluggy_integration/router.py) (`PUT /accounts/{id}` existente) |
| 6 | `get_evolucao_saldo_por_conta` em `app/dashboards/service.py` (soma cumulativa por `data` real, sem `_base_query`); `GET /dashboards/evolucao-saldo-por-conta` | Sonnet: implementação | [dashboards/service.py:1-260](../../backend/app/dashboards/service.py) (`_patrimonio_breakdown`, convenção de sinal por tipo de conta) |
| 7 | Extrair helper de soma receita/despesa por mês (range arbitrário) de `get_tendencia`; `get_saldo_acumulado` em `app/dashboards/service.py` (âncora + acumulação por competência); `GET /dashboards/saldo-acumulado` | Sonnet: implementação | [dashboards/service.py:356-395](../../backend/app/dashboards/service.py) (`get_tendencia`) |
| 8 | Testes backend: `competencia.py` (unitário), `set_category`/`bulk_confirm` (shift/reset/isolamento), `upsert_salario_ajuste_dez_2025` (upsert idempotente, delete, reflexo em summary/tendencia/por-categoria sem código especial), `get_evolucao_saldo_por_conta`, `get_saldo_acumulado`, endpoints novos (401/404/isolamento/validação) | Sonnet + skill tdd-workflow | testes existentes de `test_categorization_service.py`, `test_dashboards_service.py`, `test_pluggy_service.py` |
| 9 | `frontend/src/pages/ConfiguracoesPage.tsx` novo (3 seções: Perfil+logout, Gestão de Contas reaproveitada, Competência de Salário); `ProtectedPage.tsx` troca aba "Gestão de contas" por "Configurações" | Sonnet + skill impeccable | [pages/AccountManagementPage.tsx](../../frontend/src/pages/AccountManagementPage.tsx); [pages/ProtectedPage.tsx](../../frontend/src/pages/ProtectedPage.tsx) |
| 10 | `AccountManagementPage.tsx`: campo editável "Saldo inicial (31/12/2025)" por conta (mesmo padrão de edição inline do apelido) + tabela de auditoria mensal (`.dash-table`) | Sonnet + skill impeccable | [pages/AccountManagementPage.tsx](../../frontend/src/pages/AccountManagementPage.tsx) (edição inline de apelido) |
| 11 | `api/auth.ts` (+`logout`, `updateUserSettings`), `api/pluggy.ts` (+saldo inicial, +ajuste salário dezembro), `api/dashboards.ts` (+evolução de saldo por conta, +saldo acumulado); hooks novos (`useLogout`, `useUpdateUserSettings`, `useUpdateSaldoInicial`, `useUpdateSalarioAjusteDezembro`, `useEvolucaoSaldoPorConta`, `useDashboardSaldoAcumulado`) | Sonnet: implementação | [api/dashboards.ts](../../frontend/src/api/dashboards.ts); [hooks/useAssetGastosTendencia.ts](../../frontend/src/hooks/useAssetGastosTendencia.ts) (padrão de hook de tendência) |
| 12 | `DashboardsPage.tsx`: cards "Saldo Acumulado" (drill-down com `TrendChart`) e "Saldo Anterior" (primeiro card, navega `ano`/`mes` ao clicar, alerta em jan/2026) | Sonnet + skill impeccable | [pages/DashboardsPage.tsx:78-243](../../frontend/src/pages/DashboardsPage.tsx) (`DrillKind`, grid `.dash-summary`, `sumTrends`) |
| 13 | Testes frontend: `ConfiguracoesPage.test.tsx` novo, `DashboardsPage.test.tsx` estendido (cards novos, clique de "Saldo Anterior" navegando vs. alerta), `AccountManagementPage.test.tsx` estendido (saldo inicial + auditoria), `ProtectedPage.test.tsx` atualizado (rótulo novo) | Sonnet + skill tdd-workflow | testes existentes equivalentes de cada página |
| 14 | `scripts/browser-check/check-sprint15.mjs` novo: logout, 3 seções de Configurações, edição de dia de corte/salário dez-25/saldo inicial, cards novos do Dashboard (incl. caso especial jan/2026), desktop+mobile — validado contra a VM de dev | Sonnet: implementação | [scripts/browser-check/check-sprint14.mjs](../../scripts/browser-check/check-sprint14.mjs) (script mais recente equivalente) |
| 15 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` fechando Sprint 15 e épico E7) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 16 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `competencia_salario`/`shift_to_next_month`
  (fronteira do corte, rollover dez→jan, clamp de dia/ano bissexto);
  `set_category`/`bulk_confirm` (shift, sem shift abaixo do corte, reset ao
  sair de Salário, isolamento do cutoff por usuário); `get_evolucao_saldo_por_conta`
  (conta comum vs. cartão de crédito, direções opostas, conta sem
  `saldo_inicial` excluída); `get_saldo_acumulado` (âncora com/sem
  transação sentinela, acumulação mês a mês, isolamento).
- **Integração (pytest, TestClient):** `POST /auth/logout` (cookie limpo),
  `PUT /auth/me/settings` (validação 1–28, isolamento), `upsert_salario_ajuste_dez_2025`
  via endpoint (upsert idempotente, delete com `valor=None`, reflexo em
  `GET /dashboards/summary`/`/tendencia`/`/por-categoria` de jan/2026 **sem**
  nenhuma mudança de código nessas três funções — teste de regressão
  explícito), `PUT /pluggy/accounts/{id}/saldo-inicial`, `GET
  /dashboards/evolucao-saldo-por-conta`, `GET /dashboards/saldo-acumulado`
  — todos com 401/404/isolamento entre usuários.
- **Componente/integração (Vitest + Testing Library):** `ConfiguracoesPage`
  (3 seções, logout, formulários); `DashboardsPage` (cards novos renderizam
  a partir de fixtures, "Saldo Anterior" navega o filtro em meses normais e
  alerta em jan/2026 sem navegar); `AccountManagementPage` (edição de saldo
  inicial, tabela de auditoria a partir de fixture).
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa (backend +
  frontend) 100% verde antes de fechar.

## Impacto no roadmap

Fecha o **épico E7 — Conta e perfil**. Não reabre nenhum épico já fechado
(E1–E6, E8, E9) — `get_summary`/`get_tendencia`/`get_projecao` (tocados por
E5/E6/E9) só passam a incluir a transação sentinela de salário como
qualquer outra transação, sem mudança de assinatura ou de regra própria.

## Riscos / dependências

- **Transação sentinela de salário é editável depois pela tela de
  Categorização normal** (é uma transação de verdade, não um registro
  protegido) — efeito colateral aceito e documentado no PRD, não um bug a
  esconder.
- **Duas métricas de "saldo acumulado" coexistem com definições diferentes**
  (D: por conta, data real, para auditoria bancária; E: agregado, por
  competência, cards de Dashboard) — risco real de confusão de nomenclatura
  na implementação e na UI; nomear com clareza (“Saldo Acumulado” só no
  Dashboard, “auditoria de saldo por conta” só em Configurações) e não
  reaproveitar a mesma função/endpoint para as duas coisas.
- **`get_saldo_acumulado` depende de `get_tendencia` já incluir a transação
  sentinela de salário corretamente** — ordem de implementação importa:
  tarefas 3 e 4 (competência + transação sentinela) precisam estar
  funcionando antes de validar a tarefa 7 (saldo acumulado) fim a fim.
- **Migration `0012` faz backfill em Python dentro do `upgrade()`** — mesmo
  padrão da `0007`, mas vale rodar contra uma cópia do dado real da VM de
  dev antes do deploy final, já que mexe em `data_competencia` de
  transações já confirmadas pelo CEO.
- **Caso especial "Saldo Anterior" em jan/2026 é fixo, não parametrizado**
  — se o corte de dados do projeto mudar no futuro (não previsto), esse
  caso especial vira código morto ou incorreto; aceitável dado que é uma
  decisão de projeto já fixada (CLAUDE.md, "Corte de dados").
