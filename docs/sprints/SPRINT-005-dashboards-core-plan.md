# SPRINT-005: Dashboards core — Plano

- **PRD(s):** [PRD-005-dashboards-core](../prd/PRD-005-dashboards-core.md)
- **Data do plano:** 2026-08-14

## Objetivo da sprint

Ao final, o usuário abre a aba Dashboards, filtra por ano/mês e vê receita,
despesa, saldo e patrimônio atual consolidados — com capacidade de descer do
total até a transação individual que o compõe (Receita/Despesa → Categoria →
Meio de pagamento → Linha de extrato). `data_competencia` passa a ser
calculada em toda transação sincronizada, e transferências internas (ex.:
pagamento de fatura de cartão) deixam de inflar os totais de despesa. O
frontend ganha sua primeira identidade visual real (`DESIGN.md`, via fluxo
Impeccable), auditada antes de fechar a sprint.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Confirmar empiricamente o sinal de `pluggy_accounts.saldo` para conta `cartao_credito` (consultar Postgres da VM de dev) antes de codar a fórmula de patrimônio | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 2 | Migration `0007_dashboards_transferencia_flag_e_competencia.py`: coluna `category_groups.excluir_de_totais` (bool, default `false`) + `UPDATE` setando `true` para `Transferência interna` + backfill `data_competencia = data` em `pluggy_transactions` + índice `(user_id, data_competencia)` | Sonnet: implementação | PRD-005 §Dados e modelo; [0006_add_categorization_and_asset_fields_to_pluggy_transactions.py](../../backend/alembic/versions/) (padrão de índice composto) |
| 3 | `app/pluggy_integration/service.py::_upsert_transaction`: gravar `tx.data_competencia = tx_date` junto com `tx.data` | Sonnet: implementação | PRD-005 §Regras de negócio, §Critério de aceite 1 |
| 4 | Estender `service.list_transactions()` e `router.py::list_transactions` (`app/pluggy_integration/`) com filtros opcionais `ano`, `mes`, `subcategory_id`, `account_tipo`, `competencia` | Sonnet: implementação | PRD-005 §Critério de aceite 7 |
| 5 | `app/dashboards/service.py`: `get_summary()`, `get_by_categoria()`, `get_by_meio_pagamento()` — agregação via SQLAlchemy `group_by`/`func.sum`, join `subcategories→category_groups` filtrando `excluir_de_totais=false`, cálculo de patrimônio (ativos ativos − passivos ativos + saldos Pluggy, sinal de cartão confirmado na tarefa 1) | Sonnet: implementação | PRD-005 §Regras de negócio, §Critérios de aceite 3-6 |
| 6 | `app/schemas/dashboards.py` (`SummaryOut`, `CategoriaTotalOut`, `MeioPagamentoTotalOut`) + `app/dashboards/router.py` (`GET /dashboards/summary`, `/por-categoria`, `/por-meio-pagamento`) + registro em `main.py` | Sonnet: implementação | [app/categorization/router.py](../../backend/app/categorization/router.py) (padrão de router isolado por usuário) |
| 7 | `Caddyfile`: adicionar `/dashboards*` ao matcher `@api` | Sonnet: implementação | [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) (lição de rota caindo no SPA, Sprint 2) |
| 8 | Testes unitários: `test_dashboards_service.py` (período vazio, período só-transferência, misto débito/crédito, sinal do cartão, ativos/passivos inativos excluídos, borda de mês) + extensão de `test_pluggy_service.py` (`data_competencia` gravada no sync) | Sonnet + skill tdd-workflow | PRD-005 §Critérios de aceite 1-6 |
| 9 | Testes de integração: `test_dashboards_endpoints.py` (401, isolamento entre usuários) + extensão de `test_pluggy_endpoints.py` (novos filtros combinados/isolados, regressão sem filtro) | Sonnet + skill tdd-workflow | PRD-005 §Critérios de aceite 7-9 |
| 10 | Instalar Recharts; `frontend/src/api/dashboards.ts` + `useDashboardSummary.ts`/`useDashboardByCategoria.ts`/`useDashboardByMeioPagamento.ts`; estender `api/pluggy.ts::fetchPluggyTransactions` com os novos filtros | Sonnet: implementação | [api/categories.ts](../../frontend/src/api/categories.ts), [api/pluggy.ts](../../frontend/src/api/pluggy.ts) (padrão de hooks TanStack Query) |
| 11 | Fluxo `new-work` do Impeccable + construção de `pages/DashboardsPage.tsx` (filtro ano/mês, cards de resumo, funil de drill-down reaproveitando renderização de tabela de `TransactionsPage.tsx`), aba `"dashboards"` em `ProtectedPage.tsx` | Sonnet + skill impeccable | [pages/TransactionsPage.tsx](../../frontend/src/pages/TransactionsPage.tsx); PRODUCT.md (funil de drill-down) |
| 12 | Testes Vitest: `api/dashboards.test.ts`, `DashboardsPage.test.tsx` (cards com dado mockado, troca de filtro refetch, navegação do funil, estado vazio) | Sonnet + skill tdd-workflow | PRD-005 §Critério de aceite 11 |
| 13 | `/impeccable audit` — gate final antes de considerar a sprint pronta para deploy | Sonnet + skill impeccable | ADR-002-plugins.md |
| 14 | Deploy na VM de dev: `git pull` + `docker compose pull` + `docker compose up -d` + `docker compose restart caddy` → validar migration `0007` (`upgrade head`) → validação manual ponta a ponta no navegador contra dados reais já sincronizados | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 15 | Atualizar docs vivos (`OVERVIEW.md` — módulo `app/dashboards/`, coluna nova, endpoints, rota Caddy, `DESIGN.md` referenciado; `directory-structure.md` — módulo novo; `roadmap.md` — marcar E5 concluído) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 16 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** backfill de `data_competencia` (criação e
  re-sync); agregação de summary com período vazio, período só com
  `Transferência interna` (totais zerados), período misto
  débito/crédito; sinal do saldo de `cartao_credito` na fórmula de
  patrimônio (com valor real confirmado, não assumido); ativos/passivos
  com status inativo (`baixado`/`quitado`) excluídos do patrimônio; borda
  de mês (última data de um mês vs. primeira do seguinte) na filtragem por
  `data_competencia`.
- **Integração:** `/dashboards/*` retornam 401 sem cookie; usuário A não
  vê total/categoria/transação do usuário B em nenhum dos três endpoints;
  `/pluggy/transactions` com os novos filtros combinados e isolados
  funciona, e chamado sem filtro nenhum mantém o comportamento anterior à
  sprint (sem regressão em `TransactionsPage`); soma de
  `/dashboards/por-categoria` bate com `/dashboards/summary` para os
  mesmos filtros.
- **Frontend (Vitest):** `DashboardsPage` renderiza os quatro cards a
  partir de dado mockado; trocar ano/mês dispara refetch com os novos
  parâmetros; navegar o funil (categoria → meio de pagamento →
  transações) e voltar; estado vazio (sem transações no período).
- Todos executados localmente e na VM de dev via `scripts/ssh-vm.ps1 dev
  "..."`. Meta ≥80% de cobertura nos módulos novos — hard gate, mesmo
  padrão das sprints anteriores.

## Impacto no roadmap

Fecha o épico E5 (dashboards core). Resolve a pendência de
`data_competencia`, aberta desde a Sprint 3 e adiada na Sprint 4. Deixa E6
(dashboards analíticos: natureza, ativo, evolução de patrimônio) e E7
(perfil/multiusuário) como próximos candidatos de planejamento — ambos já
descritos no roadmap, sem PRD ainda.

## Riscos / dependências

- Sinal do saldo de conta `cartao_credito` na fórmula de patrimônio precisa
  ser confirmado contra dado real da VM de dev antes de fechar a
  implementação — a documentação pública da Pluggy já divergiu do
  comportamento observado em sandbox antes (Sprint 3); não assumir, testar.
- `patrimonio` em `/dashboards/summary` ignora o filtro de ano/mês (é
  snapshot atual, não há série histórica de saldo/valor de ativo neste
  schema) — risco de confundir o usuário se o frontend não deixar isso
  explícito ("Patrimônio atual", desacoplado do seletor de período);
  tratado na tarefa 11 como decisão de copy, não como bug.
- Lição já registrada nas Sprints 2/4: `Caddyfile` é volume, não faz parte
  da imagem — `docker compose up -d` sozinho não recarrega; precisa de
  `docker compose restart caddy` explícito (tarefa 14).
- Primeira sprint com trabalho visual real: o fluxo `new-work` do
  Impeccable roda durante a construção da página (direção de cor/forma
  antes do código), e `DESIGN.md` só é gerado ao final, a partir do que
  foi de fato construído — não escrever/congelar decisões visuais antes de
  ter a página funcionando com dado real.
- Nenhuma dependência de infraestrutura nova além da instalação de
  Recharts no frontend — reaproveita VM de dev, Docker Compose, CI e
  pipeline de testes já existentes.
