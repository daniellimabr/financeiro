# Estrutura de diretórios

Atualizado a cada mudança estrutural. Estado atual (fim da Sprint 7 — categorização/gestão de contas):

```
Financeiro v3/
├── CLAUDE.md                       # doc viva raiz — ponto de entrada (atualizado em Sprint 1)
├── PRODUCT.md                      # fatos de produto (gerado pelo Impeccable /impeccable init)
├── DESIGN.md                       # sistema de design (gerado pelo fluxo new-work do Impeccable, Sprint 5; tipografia/layout estendidos na Sprint 6)
├── .gitignore
├── .pre-commit-config.yaml         # hooks pre-commit: ruff, eslint, detect-secrets (Sprint 1)
├── .secrets.baseline               # baseline para detect-secrets, evita falsos positivos (Sprint 1)
├── .env.example                    # template de variáveis de ambiente (Sprint 1)
├── docker-compose.yml              # orquestração: postgres, api, frontend, caddy (Sprint 1)
├── Caddyfile                       # configuração Caddy reverse-proxy (Sprint 1)
├── .claude/
│   ├── settings.json               # plugins habilitados no projeto (Ponytail)
│   ├── agents/                     # 5 agentes do ECC copiados seletivamente (ver ADR-002)
│   └── skills/
│       ├── tdd-workflow/           # skill do ECC copiada seletivamente
│       └── impeccable/             # skill completa do plugin Impeccable
├── docs/
│   ├── architecture/
│   │   ├── OVERVIEW.md             # arquitetura/infra/lógica — atualizado com VM de dev e Docker Compose (Sprint 1)
│   │   └── adr/
│   │       ├── ADR-001-stack.md    # stack aprovada em 2026-08-03
│   │       └── ADR-002-plugins.md  # plugins ativados/desativados e por quê
│   ├── prd/
│   │   ├── PRD-001-fundacao-tecnica.md  # Sprint 1 — VM de dev, auth Google, testes e CI
│   │   ├── PRD-002-dados-mestres-migracao-legado.md  # Sprint 2 — categorias/ativos/passivos + import
│   │   ├── PRD-003-integracao-pluggy.md  # Sprint 3 — contas/transações via Pluggy (E2)
│   │   ├── PRD-004-categorizacao-automatica.md  # Sprint 4 — categorização + associação despesa↔ativo (E3)
│   │   ├── PRD-005-dashboards-core.md    # Sprint 5 — dashboards core, drill-down (E5)
│   │   ├── PRD-006-dashboards-analiticos.md  # Sprint 6 — tendência, percentual, design system (E6)
│   │   ├── PRD-007-categorizacao-gestao-contas.md  # Sprint 7 — rework categorização, Gestão de Contas (E3, E2)
│   │   └── PRD-008-gestao-de-ativos.md  # Sprint 8 — tela de Gestão de Ativos (E6 parte 2)
│   ├── sprints/
│   │   ├── SPRINT-001-fundacao-tecnica-plan.md       # Plano Sprint 1 (2026-08-04)
│   │   ├── SPRINT-001-fundacao-tecnica-report.md     # Relatório Sprint 1 (2026-08-04)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-plan.md    # Plano Sprint 2 (2026-08-05)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-report.md  # Relatório Sprint 2 (2026-08-06)
│   │   ├── SPRINT-003-integracao-pluggy-plan.md      # Plano Sprint 3 (2026-08-07)
│   │   ├── SPRINT-004-categorizacao-automatica-plan.md    # Plano Sprint 4 (2026-08-14)
│   │   ├── SPRINT-004-categorizacao-automatica-report.md  # Relatório Sprint 4 (2026-08-14)
│   │   ├── SPRINT-005-dashboards-core-plan.md        # Plano Sprint 5 (2026-08-14)
│   │   ├── SPRINT-005-dashboards-core-report.md      # Relatório Sprint 5 (2026-08-14)
│   │   ├── SPRINT-006-dashboards-analiticos-plan.md  # Plano Sprint 6 (2026-08-14)
│   │   ├── SPRINT-006-dashboards-analiticos-report.md  # Relatório Sprint 6 (2026-08-15)
│   │   ├── SPRINT-007-categorizacao-gestao-contas-plan.md  # Plano Sprint 7 (2026-08-15)
│   │   ├── SPRINT-007-categorizacao-gestao-contas-report.md  # Relatório Sprint 7 (2026-08-15)
│   │   └── SPRINT-008-gestao-de-ativos-plan.md  # Plano Sprint 8 (2026-08-15)
│   ├── roadmap.md                  # épicos + sprints
│   ├── directory-structure.md      # este arquivo — atualizado em Sprint 7
│   ├── infra/
│   │   └── ssh-workflow.md         # procedimento SSH obrigatório via venv (atualizado em Sprint 1)
│   └── migration/
│       └── legacy-data.md          # formato de import de categorias + memória do v1
├── templates/
│   ├── PRD-template.md
│   ├── ADR-template.md
│   ├── SPRINT-plan-template.md
│   └── SPRINT-report-template.md
├── backend/                        # FastAPI + SQLAlchemy 2.0 + Alembic (Sprint 1)
│   ├── pyproject.toml              # dependências backend (FastAPI, SQLAlchemy, pytest, etc)
│   ├── app/
│   │   ├── main.py                 # entry point FastAPI, health-check, registra routers
│   │   ├── config.py               # pydantic-settings, vars de env
│   │   ├── db.py                   # session factory SQLAlchemy
│   │   ├── exceptions.py           # DuplicateNameError/NotFoundError/InvalidStateError (Sprint 2)
│   │   ├── models/
│   │   │   ├── user.py             # modelo User (google_sub, email, name, created_at, updated_at)
│   │   │   ├── category.py         # CategoryGroup (+excluir_de_totais na Sprint 5), Subcategory, enum Natureza, SEM_CATEGORIA_ID (Sprint 2)
│   │   │   ├── asset.py            # Asset, enums AssetTipo/AssetStatus (Sprint 2)
│   │   │   ├── liability.py        # Liability, enums LiabilityTipo/LiabilityStatus (Sprint 2)
│   │   │   ├── pluggy.py           # PluggyItem/Account/Transaction + enums (Sprint 3; +9 colunas de categorização/ativo na Sprint 4; +apelido/sync_enabled em Account, +descricao_usuario/sugerida/origem_id em Transaction na Sprint 7)
│   │   │   └── categorization.py   # CategorizationRule — memória de mapeamento padrão→subcategoria (Sprint 4)
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── category.py         # CategoryGroupIn/Out, SubcategoryIn/Out (Sprint 2)
│   │   │   ├── asset.py            # AssetIn/Out, AssetSellIn (Sprint 2)
│   │   │   ├── liability.py        # LiabilityIn/Out (Sprint 2)
│   │   │   ├── pluggy.py           # ConnectToken*, PluggyItem/Account/TransactionOut (Sprint 3); PluggyAccountUpdateIn, SyncItemsIn/Out (Sprint 7)
│   │   │   ├── categorization.py   # TransactionOut/TransactionsPageOut, CategoryIn, AssetAssociationIn, BulkConfirmIn/Out, DescriptionUpdateIn/Out (Sprint 4, renomeado/estendido na Sprint 7)
│   │   │   └── dashboards.py       # SummaryOut, CategoriaTotalOut/MeioPagamentoTotalOut+percentual (Sprint 5), TendenciaMesOut/TendenciaCategoriaOut (Sprint 6)
│   │   ├── auth/
│   │   │   ├── jwt.py              # geração/validação JWT via PyJWT
│   │   │   ├── google.py           # integração Authlib com Google OAuth
│   │   │   ├── service.py          # lógica upsert de usuário
│   │   │   ├── router.py           # rotas /auth/google/login, /auth/google/callback, /auth/me
│   │   │   └── deps.py             # dependency get_current_user (validação JWT)
│   │   ├── categories/             # CRUD category_groups/subcategories (Sprint 2, dado global)
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── assets/                 # CRUD assets + sell, isolado por user_id (Sprint 2)
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── liabilities/            # CRUD liabilities + settle, isolado por user_id (Sprint 2)
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── pluggy_integration/     # integração Pluggy — connect token, sync manual (Sprint 3)
│   │   │   ├── client.py           # PluggyClient — auth por API key cacheada, get_item/accounts/transactions
│   │   │   ├── service.py          # register_item, sync_item, list_items/accounts/transactions; update_account, sync_items (Sprint 7)
│   │   │   └── router.py           # rotas /pluggy/*; PUT /pluggy/accounts/{id}, POST /pluggy/sync (Sprint 7)
│   │   ├── categorization/         # motor de categorização por regras+memória, sem LLM (Sprint 4)
│   │   │   ├── normalize.py        # normalize_description — NFKD/ASCII/minúsculas, prefixo de canal, números isolados
│   │   │   ├── engine.py           # suggest_category (regra > histórico exato > similaridade ≥0.86), suggest_asset
│   │   │   ├── service.py          # list_transactions (status/tipo/ano/mes/paginado, renomeado de list_pending_transactions na Sprint 7), set_category, bulk_confirm, set_transaction_asset, update_description/confirm_description_suggestion/dismiss_description_suggestion (Sprint 7)
│   │   │   └── router.py           # rotas /categorization/transactions/* (renomeadas de /pending/* na Sprint 7)
│   │   └── dashboards/             # agregação para dashboards — sem LLM, sem cache (Sprint 5)
│   │       ├── service.py          # get_summary, get_por_categoria/get_por_meio_pagamento (+percentual), get_tendencia/get_tendencia_por_categoria (Sprint 6)
│   │       └── router.py           # rotas /dashboards/* (+tendencia, por-categoria/tendencia na Sprint 6)
│   ├── scripts/
│   │   ├── import_legacy_categories.py  # import CSV grupo,subcategoria — upsert, loga conflito (Sprint 2)
│   │   ├── import_legacy_categorization_rules.py  # import semente-classificacao.json (328 regras) — upsert por usuário (Sprint 4)
│   │   ├── pluggy_sandbox_smoke.py      # validação manual do sandbox Pluggy — não roda em CI (Sprint 3)
│   │   └── data/
│   │       ├── legacy_categories.csv        # 15 grupos / 51 pares confirmados pelo CEO (Sprint 2)
│   │       └── semente-classificacao.json   # 328 regras de classificação do v1, entregues pelo CEO (Sprint 4)
│   ├── tests/
│   │   ├── test_health.py
│   │   ├── test_jwt.py             # testes de validade, expiração, assinatura
│   │   ├── test_auth_service.py    # testes upsert usuário
│   │   ├── test_auth_endpoints.py  # testes endpoints OAuth e /auth/me
│   │   ├── test_category_service.py     # nome único (grupo/subcategoria), natureza (Sprint 2)
│   │   ├── test_category_endpoints.py   # CRUD, 401/404/400 (Sprint 2)
│   │   ├── test_asset_service.py        # sell idempotente (Sprint 2)
│   │   ├── test_asset_endpoints.py      # CRUD, isolamento user_id, sell (Sprint 2)
│   │   ├── test_liability_service.py    # settle idempotente (Sprint 2)
│   │   ├── test_liability_endpoints.py  # CRUD, isolamento user_id, settle (Sprint 2)
│   │   ├── test_import_legacy_categories.py  # merge de duplicata, log de conflito (Sprint 2)
│   │   ├── test_pluggy_client.py        # cache/refetch de API key, paginação, erro propagado (Sprint 3)
│   │   ├── test_pluggy_service.py       # upsert idempotente, cutoff_date, status não-sincronizável (Sprint 3); apelido preservado em resync, sync_enabled pulando conta, update_account/sync_items (Sprint 7)
│   │   ├── test_pluggy_endpoints.py     # 401/404/400, isolamento user_id (Sprint 3); PUT /accounts/{id}, POST /sync (Sprint 7)
│   │   ├── test_categorization_normalize.py    # acentos, prefixos de canal, token numérico vs. alfanumérico (Sprint 4)
│   │   ├── test_categorization_engine.py       # precedência de camadas, fronteira 0.86, isolamento por usuário (Sprint 4)
│   │   ├── test_categorization_service.py      # invariante "nunca auto-confirma", reedição, 404 cross-user (Sprint 4); paginação, filtro ano/mes (pós-Sprint 6); filtro status/tipo, bulk_confirm parcial, propagação de descrição (Sprint 7)
│   │   ├── test_categorization_endpoints.py    # 401, isolamento, confirmar/editar via API (Sprint 4); paginação, filtro ano/mes (pós-Sprint 6); rotas /transactions/*, bulk-confirm, descrição (Sprint 7)
│   │   ├── test_import_legacy_categorization_rules.py  # conflito, idempotência, categoria não resolvida, abort sem usuário (Sprint 4)
│   │   ├── test_dashboards_service.py   # período vazio, só-transferência, misto, sinal do cartão, borda de mês (Sprint 5); tendência terminando no mês filtrado, percentual somando 100%/denominador zero (Sprint 6)
│   │   ├── test_dashboards_endpoints.py # 401, isolamento entre usuários nos 5 endpoints (Sprint 5+6)
│   │   └── fixtures/
│   │       ├── legacy_categories_sample.csv           # fixture pequena p/ teste de import (Sprint 2)
│   │       └── semente_classificacao_sample.json      # fixture pequena p/ teste de import de regras (Sprint 4)
│   └── alembic/
│       └── versions/
│           ├── 0001_create_users.py       # migration inicial — tabela users
│           ├── 0002_create_categories.py  # category_groups + subcategories (Sprint 2)
│           ├── 0003_create_assets_liabilities.py  # assets + liabilities (Sprint 2)
│           ├── 0004_create_pluggy_tables.py  # pluggy_items/accounts/transactions (Sprint 3)
│           ├── 0005_create_categorization_rules.py  # categorization_rules (Sprint 4)
│           ├── 0006_add_categorization_and_asset_fields_to_pluggy_transactions.py  # 9 colunas novas (Sprint 4)
│           ├── 0007_dashboards_transferencia_flag_e_competencia.py  # excluir_de_totais + backfill data_competencia + índice (Sprint 5)
│           └── 0008_categorizacao_gestao_contas.py  # apelido/sync_enabled em pluggy_accounts, descricao_usuario/sugerida/origem_id em pluggy_transactions, seed subcategoria Aluguel (Sprint 7)
├── frontend/                       # React 19 + Vite + TypeScript (Sprint 1)
│   ├── package.json                # dependências frontend (React, TanStack Query, ESLint, Prettier, Vitest)
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html                  # entry point, lang="pt-BR" (auditado via /impeccable audit)
│   ├── public/
│   │   └── fonts/                  # Archivo (600/700) + Public Sans (400/600), .woff2 auto-hospedado, licença OFL (Sprint 6)
│   ├── src/
│   │   ├── App.tsx                 # componente raiz (renderização condicional login/protected/loading)
│   │   ├── main.tsx
│   │   ├── utils/
│   │   │   └── format.ts           # formatCurrency, extraído de DashboardsPage.tsx (Sprint 7)
│   │   ├── api/
│   │   │   ├── client.ts           # fetch wrapper com credentials:"include"
│   │   │   ├── auth.ts             # chamadas /auth/me
│   │   │   ├── pluggy.ts           # chamadas /pluggy/* (Sprint 3); apelido/sync_enabled em PluggyAccount, updatePluggyAccount, syncPluggyItems (Sprint 7)
│   │   │   ├── categories.ts       # chamadas /category-groups, /subcategories (Sprint 4, pré-requisito antes inexistente)
│   │   │   ├── assets.ts           # chamadas /assets (Sprint 4, pré-requisito antes inexistente)
│   │   │   ├── categorization.ts   # chamadas /categorization/transactions/* — renomeado de /pending/*, +status/tipo, bulkConfirm, updateDescription/confirm/dismissDescriptionSuggestion (Sprint 7, era Sprint 4)
│   │   │   └── dashboards.ts       # chamadas /dashboards/*, SEM_CATEGORIA_ID (Sprint 5); +tendencia/por-categoria/tendencia, +percentual (Sprint 6)
│   │   ├── pluggy/
│   │   │   └── loadPluggyConnect.ts  # injeta o script do widget Pluggy Connect sob demanda (Sprint 3)
│   │   ├── hooks/
│   │   │   ├── useCurrentUser.ts   # TanStack Query hook para sessão do usuário
│   │   │   ├── usePluggyItems.ts   # lista items conectados (Sprint 3)
│   │   │   ├── usePluggyAccounts.ts      # lista contas sincronizadas (Sprint 3)
│   │   │   ├── usePluggyTransactions.ts  # lista transações sincronizadas (Sprint 3) — ainda usada pelo drill-down do Dashboard
│   │   │   ├── useRegisterPluggyItem.ts  # mutation POST /pluggy/items (Sprint 3)
│   │   │   ├── useUpdatePluggyAccount.ts # mutation PUT /pluggy/accounts/{id} — apelido/sync_enabled (Sprint 7)
│   │   │   ├── useSyncPluggyItems.ts     # mutation POST /pluggy/sync, em lote (Sprint 7)
│   │   │   ├── useCategoryGroups.ts      # lista category_groups (Sprint 4)
│   │   │   ├── useSubcategories.ts       # lista subcategories (Sprint 4)
│   │   │   ├── useAssets.ts              # lista assets do usuário (Sprint 4)
│   │   │   ├── useCategorizationTransactions.ts  # lista transações filtrada por status/tipo/ano/mes, paginada (Sprint 7, renomeado de usePendingCategorizations)
│   │   │   ├── useSetCategory.ts         # mutation PUT /categorization/transactions/{id}/category (Sprint 7, renomeado de useConfirmCategorization)
│   │   │   ├── useBulkConfirmCategorization.ts   # mutation POST .../bulk-confirm (Sprint 7)
│   │   │   ├── useSetTransactionAsset.ts # mutation PUT /categorization/transactions/{id}/asset (Sprint 4)
│   │   │   ├── useUpdateDescription.ts   # mutation PUT .../description (Sprint 7)
│   │   │   ├── useConfirmDescriptionSuggestion.ts  # mutation POST .../description/confirm (Sprint 7)
│   │   │   ├── useDismissDescriptionSuggestion.ts  # mutation POST .../description/dismiss (Sprint 7)
│   │   │   ├── useDashboardSummary.ts        # GET /dashboards/summary (Sprint 5)
│   │   │   ├── useDashboardByCategoria.ts    # GET /dashboards/por-categoria (Sprint 5)
│   │   │   ├── useDashboardByMeioPagamento.ts  # GET /dashboards/por-meio-pagamento (Sprint 5)
│   │   │   ├── useDashboardTendencia.ts      # GET /dashboards/tendencia (Sprint 6)
│   │   │   └── useDashboardCategoriaTendencia.ts  # GET /dashboards/por-categoria/tendencia, enabled só com categoria expandida (Sprint 6)
│   │   └── pages/
│   │       ├── LoginPage.tsx       # botão "Entrar com Google" (link para /auth/google/login)
│   │       ├── ProtectedPage.tsx   # nome/e-mail do usuário + abas Início/Dashboards/Categorizar/Gestão de contas (Sprint 5; aba Transações removida, Conectar conta renomeada na Sprint 7)
│   │       ├── DashboardsPage.tsx  # filtro ano/mês, 4 cards com sparkline, funil de drill-down em sanfona + Recharts (Sprint 5, sanfona/tendência/percentual na Sprint 6)
│   │       ├── AccountManagementPage.tsx  # Gestão de Contas — lista contas conectadas, apelido/sync_enabled editáveis, diálogo "Sincronizar MeuPluggy" com pré-seleção (Sprint 7, renomeado de ConnectAccountPage.tsx)
│   │       └── CategorizationReviewPage.tsx  # listagem única de transações (substitui TransactionsPage) — filtro tipo/status, lote, categoria editável em confirmada, descrição inline + propagação (Sprint 4; paginação pós-Sprint 6; rework completo na Sprint 7)
│   │   └── App.test.tsx            # testes Vitest + Testing Library (401, 200)
│   └── test/
│       └── setup.ts                # setup do Vitest (jest-dom matchers)
├── scripts/
│   ├── ssh-vm.ps1                  # wrapper PowerShell: venv + paramiko, alvo dev|prod
│   ├── ssh_vm.py                   # cliente SSH paramiko (dev: livre; prod: aprovação)
│   ├── requirements-ssh.txt        # dependências do venv de SSH (paramiko)
│   └── browser-check/              # QA visual do CTO — Playwright/Chromium headless (Sprint 5)
│       ├── check.mjs               # genérico: navega, screenshot, erros de console
│       ├── check-dashboard.mjs     # fluxo autenticado: início → dashboards → drill-down
│       ├── check-sanfona.mjs       # sanfona multi-nível + sparkline + tipografia, contra dado real (Sprint 6)
│       ├── check-categorizacao.mjs # filtro + paginação + tempo real do fluxo de confirmar (pós-Sprint 6)
│       └── check-sprint7.mjs       # filtro tipo/status, seleção em lote, descrição editável, Gestão de Contas — apelido, diálogo de sync (Sprint 7; achou bug real de overflow desktop)
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions: pytest+ruff (backend), vitest+eslint+tsc (frontend) (Sprint 1)
└── .claude/                        # config local do Claude Code (agentes/hooks do projeto)
```

## O que ainda não existe

- Frontend de gestão de categorias/ativos/passivos (CRUD completo) — fora de escopo da Sprint 4 também; `api/categories.ts`/`api/assets.ts` criados nesta sprint só cobrem leitura (`GET`), suficiente para alimentar os selects da fila de revisão.
- Frontend de gestão de `categorization_rules` (editar/remover regra manualmente) — fora de escopo, só o import e o motor automático (ver PRD-004).
- UI de gestão de `category_groups.excluir_de_totais` — só setado via migration na Sprint 5; se surgir necessidade de mais grupos excluídos, é ajuste de dado, não de mecanismo (ver PRD-005).
- Override manual de `data_competencia` por transação — schema já suporta (coluna gravada, não computada), endpoint/UI adiados (ver PRD-005).
- Tela de Gestão de Ativos (cards, criar/editar ativo, drilldown de custos por ativo) — E6 parte 2, Sprint 8; backend CRUD já existe em `app/assets/`/`app/liabilities/` desde a Sprint 2. Evolução de patrimônio/investimentos ao longo do tempo segue sem série histórica no schema (precisaria de snapshot periódico, job novo).
- Estado "pular/ignorar" na fila de Categorização; reconciliação de descrição quando a Pluggy reenvia uma transação já editada pelo usuário (`descricao_usuario` nunca é sobrescrito por sync, não há merge/conflito a resolver) — ambos fora de escopo desde o PRD-004/PRD-007.
- Modernização visual/paginação da tabela de Categorização (hoje HTML puro, sem tokens do design system) — Sprint 10.
- Herança de regras entre usuários (memória compartilhada opt-in) — schema de `categorization_rules` já preparado (`origem` extensível), mecanismo de opt-in/onboarding fica para sprint futura.
- Camadas de token distintivo/IDF e léxico estático PT-BR no motor de categorização — adiadas até haver volume real suficiente para calibrar (ver PRD-004).
- Perfil de usuário, logout, multiusuário — E7.
- Sync agendado/webhooks Pluggy e UI dedicada de reconexão — fora do roadmap a menos que o CEO priorize (decisão fixa do projeto é sync manual).
- Tabelas pré-calculadas ou cache de agregação para dashboards — decisão fixa do projeto (leitura direta/agregação simples).
- VM de produção — adiada para sprint futura sob aprovação do CEO.

## Convenção

- Toda pasta nova de código de produto (`backend/`, `frontend/`) deve ser refletida aqui na sprint que a criar.
- PRDs numerados sequencialmente (`PRD-001-...`), ADRs idem (`ADR-NNN-...`), sprints idem (`SPRINT-NNN-...`).
