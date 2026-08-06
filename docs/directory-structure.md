# Estrutura de diretórios

Atualizado a cada mudança estrutural. Estado atual (fim da Sprint 2 — dados mestres + migração de categorias do legado):

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
│   │   └── PRD-002-dados-mestres-migracao-legado.md  # Sprint 2 — categorias/ativos/passivos + import
│   ├── sprints/
│   │   ├── SPRINT-001-fundacao-tecnica-plan.md       # Plano Sprint 1 (2026-08-04)
│   │   ├── SPRINT-001-fundacao-tecnica-report.md     # Relatório Sprint 1 (2026-08-04)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-plan.md    # Plano Sprint 2 (2026-08-05)
│   │   └── SPRINT-002-dados-mestres-migracao-legado-report.md  # Relatório Sprint 2 (2026-08-05)
│   ├── roadmap.md                  # épicos + 3 primeiras sprints propostas
│   ├── directory-structure.md      # este arquivo — atualizado em Sprint 2
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
│   │   │   └── liability.py        # Liability, enums LiabilityTipo/LiabilityStatus (Sprint 2)
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── category.py         # CategoryGroupIn/Out, SubcategoryIn/Out (Sprint 2)
│   │   │   ├── asset.py            # AssetIn/Out, AssetSellIn (Sprint 2)
│   │   │   └── liability.py        # LiabilityIn/Out (Sprint 2)
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
│   │   └── liabilities/            # CRUD liabilities + settle, isolado por user_id (Sprint 2)
│   │       ├── service.py
│   │       └── router.py
│   ├── scripts/
│   │   ├── import_legacy_categories.py  # import CSV grupo,subcategoria — upsert, loga conflito (Sprint 2)
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
│   │   └── fixtures/
│   │       └── legacy_categories_sample.csv   # fixture pequena p/ teste de import (Sprint 2)
│   └── alembic/
│       └── versions/
│           ├── 0001_create_users.py       # migration inicial — tabela users
│           ├── 0002_create_categories.py  # category_groups + subcategories (Sprint 2)
│           └── 0003_create_assets_liabilities.py  # assets + liabilities (Sprint 2)
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
│   │   │   └── auth.ts             # chamadas /auth/me
│   │   ├── hooks/
│   │   │   └── useCurrentUser.ts   # TanStack Query hook para sessão do usuário
│   │   └── pages/
│   │       ├── LoginPage.tsx       # botão "Entrar com Google" (link para /auth/google/login)
│   │       └── ProtectedPage.tsx   # mostra nome/e-mail do usuário autenticado
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
- Tabela de regras/memória de categorização (E3) — schema ainda não desenhado; import da memória de classificação do v1 aguarda arquivo do CEO.
- Contas e transações (E2 Pluggy) — Sprint 3.
- Endpoints de sincronização Pluggy — Sprint 3/E2.
- VM de produção — adiada para sprint futura sob aprovação do CEO.

## Convenção

- Toda pasta nova de código de produto (`backend/`, `frontend/`) deve ser refletida aqui na sprint que a criar.
- PRDs numerados sequencialmente (`PRD-001-...`), ADRs idem (`ADR-NNN-...`), sprints idem (`SPRINT-NNN-...`).
