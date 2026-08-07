# Estrutura de diretórios

Atualizado a cada mudança estrutural. Estado atual (fim da Sprint 3 — integração Pluggy):

```
Financeiro v3/
├── CLAUDE.md                       # doc viva raiz — ponto de entrada (atualizado em Sprint 1)
├── PRODUCT.md                      # fatos de produto (gerado pelo Impeccable /impeccable init)
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
│   │   └── PRD-003-integracao-pluggy.md  # Sprint 3 — contas/transações via Pluggy (E2)
│   ├── sprints/
│   │   ├── SPRINT-001-fundacao-tecnica-plan.md       # Plano Sprint 1 (2026-08-04)
│   │   ├── SPRINT-001-fundacao-tecnica-report.md     # Relatório Sprint 1 (2026-08-04)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-plan.md    # Plano Sprint 2 (2026-08-05)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-report.md  # Relatório Sprint 2 (2026-08-06)
│   │   └── SPRINT-003-integracao-pluggy-plan.md      # Plano Sprint 3 (2026-08-07)
│   ├── roadmap.md                  # épicos + sprints
│   ├── directory-structure.md      # este arquivo — atualizado em Sprint 3
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
│   │   │   ├── category.py         # CategoryGroup, Subcategory, enum Natureza (Sprint 2)
│   │   │   ├── asset.py            # Asset, enums AssetTipo/AssetStatus (Sprint 2)
│   │   │   ├── liability.py        # Liability, enums LiabilityTipo/LiabilityStatus (Sprint 2)
│   │   │   └── pluggy.py           # PluggyItem/Account/Transaction + enums de status/tipo (Sprint 3)
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── category.py         # CategoryGroupIn/Out, SubcategoryIn/Out (Sprint 2)
│   │   │   ├── asset.py            # AssetIn/Out, AssetSellIn (Sprint 2)
│   │   │   ├── liability.py        # LiabilityIn/Out (Sprint 2)
│   │   │   └── pluggy.py           # ConnectToken*, PluggyItem/Account/TransactionOut (Sprint 3)
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
│   │   └── pluggy_integration/     # integração Pluggy — connect token, sync manual (Sprint 3)
│   │       ├── client.py           # PluggyClient — auth por API key cacheada, get_item/accounts/transactions
│   │       ├── service.py          # register_item, sync_item, list_items/accounts/transactions
│   │       └── router.py           # rotas /pluggy/*
│   ├── scripts/
│   │   ├── import_legacy_categories.py  # import CSV grupo,subcategoria — upsert, loga conflito (Sprint 2)
│   │   ├── pluggy_sandbox_smoke.py      # validação manual do sandbox Pluggy — não roda em CI (Sprint 3)
│   │   └── data/
│   │       └── legacy_categories.csv    # 15 grupos / 51 pares confirmados pelo CEO (Sprint 2)
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
│   │   ├── test_pluggy_service.py       # upsert idempotente, cutoff_date, status não-sincronizável (Sprint 3)
│   │   ├── test_pluggy_endpoints.py     # 401/404/400, isolamento user_id (Sprint 3)
│   │   └── fixtures/
│   │       └── legacy_categories_sample.csv   # fixture pequena p/ teste de import (Sprint 2)
│   └── alembic/
│       └── versions/
│           ├── 0001_create_users.py       # migration inicial — tabela users
│           ├── 0002_create_categories.py  # category_groups + subcategories (Sprint 2)
│           ├── 0003_create_assets_liabilities.py  # assets + liabilities (Sprint 2)
│           └── 0004_create_pluggy_tables.py  # pluggy_items/accounts/transactions (Sprint 3)
├── frontend/                       # React 19 + Vite + TypeScript (Sprint 1)
│   ├── package.json                # dependências frontend (React, TanStack Query, ESLint, Prettier, Vitest)
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html                  # entry point, lang="pt-BR" (auditado via /impeccable audit)
│   ├── src/
│   │   ├── App.tsx                 # componente raiz (renderização condicional login/protected/loading)
│   │   ├── main.tsx
│   │   ├── api/
│   │   │   ├── client.ts           # fetch wrapper com credentials:"include"
│   │   │   ├── auth.ts             # chamadas /auth/me
│   │   │   └── pluggy.ts           # chamadas /pluggy/* (Sprint 3)
│   │   ├── pluggy/
│   │   │   └── loadPluggyConnect.ts  # injeta o script do widget Pluggy Connect sob demanda (Sprint 3)
│   │   ├── hooks/
│   │   │   ├── useCurrentUser.ts   # TanStack Query hook para sessão do usuário
│   │   │   ├── usePluggyItems.ts   # lista items conectados (Sprint 3)
│   │   │   ├── usePluggyAccounts.ts      # lista contas sincronizadas (Sprint 3)
│   │   │   ├── usePluggyTransactions.ts  # lista transações sincronizadas (Sprint 3)
│   │   │   ├── useRegisterPluggyItem.ts  # mutation POST /pluggy/items (Sprint 3)
│   │   │   └── useSyncPluggyItem.ts      # mutation POST /pluggy/items/{id}/sync (Sprint 3)
│   │   └── pages/
│   │       ├── LoginPage.tsx       # botão "Entrar com Google" (link para /auth/google/login)
│   │       ├── ProtectedPage.tsx   # nome/e-mail do usuário + abas Início/Conectar conta/Transações (Sprint 3)
│   │       ├── ConnectAccountPage.tsx    # widget Pluggy Connect + lista de items conectados (Sprint 3)
│   │       └── TransactionsPage.tsx      # lista de transações + botão sincronizar por item (Sprint 3)
│   │   └── App.test.tsx            # testes Vitest + Testing Library (401, 200)
│   └── test/
│       └── setup.ts                # setup do Vitest (jest-dom matchers)
├── scripts/
│   ├── ssh-vm.ps1                  # wrapper PowerShell: venv + paramiko, alvo dev|prod
│   ├── ssh_vm.py                   # cliente SSH paramiko (dev: livre; prod: aprovação)
│   └── requirements-ssh.txt        # dependências do venv de SSH (paramiko)
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions: pytest+ruff (backend), vitest+eslint+tsc (frontend) (Sprint 1)
└── .claude/                        # config local do Claude Code (agentes/hooks do projeto)
```

## O que ainda não existe

- `DESIGN.md` — será gerado pelo fluxo `new-work` do Impeccable quando o primeiro trabalho visual estiver em progresso (ver [ADR-002](architecture/adr/ADR-002-plugins.md)).
- Frontend de gestão de categorias/ativos/passivos — fora de escopo da Sprint 2 (ver PRD-002), fica para quando E5/E6/E3 exigirem uma tela real.
- Tabela de regras/memória de categorização (E3), fila de revisão manual, associação despesa↔ativo — planejadas para Sprint 4, agora que há transações reais (Sprint 3) para calibrar o motor. Import da memória de classificação do v1 aguarda arquivo do CEO.
- Cálculo automático de data de competência de receita — campo `data_competencia` existe no schema de transações desde a Sprint 3, mas não é preenchido pelo sync; lógica fica para E3/E5.
- Sync agendado/webhooks Pluggy e UI dedicada de reconexão — fora do roadmap a menos que o CEO priorize (decisão fixa do projeto é sync manual).
- VM de produção — adiada para sprint futura sob aprovação do CEO.

## Convenção

- Toda pasta nova de código de produto (`backend/`, `frontend/`) deve ser refletida aqui na sprint que a criar.
- PRDs numerados sequencialmente (`PRD-001-...`), ADRs idem (`ADR-NNN-...`), sprints idem (`SPRINT-NNN-...`).
