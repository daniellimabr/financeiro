# Arquitetura — Visão Geral

> Stack abaixo reflete [ADR-001](adr/ADR-001-stack.md), **aprovado pelo CEO em 2026-08-03**. Este doc é atualizado a cada mudança estrutural relevante (regra de doc viva). **Atualizado em 2026-08-04 após Sprint 1** — a arquitetura proposta agora é realidade.

## Visão de alto nível

```
[Google OAuth] ---login---> [Frontend React/Vite] <---HTTP/JSON---> [Caddy] <---docker---> [API FastAPI] ---> [PostgreSQL]
                                                                      (reverse proxy, port 8080)     |
                                                                      rota: /auth/*, /health         +--> [Pluggy API] 
                                                                      rota: /* (restante)            (sync manual, sob demanda)
```

Uma VM Oracle Free Tier (163.176.0.135, Ubuntu 24.04.4 LTS) roda tudo via Docker Compose: `postgres`, `api`, `frontend` (build estático), `caddy` (reverse proxy). Código editado localmente, sincronizado via `git push`, aplicado na VM via `git pull` + `docker compose up -d --build` (executável via `scripts/ssh_vm.py dev`).

## Infraestrutura de desenvolvimento

### VM de dev (permanente a partir da Sprint 1)

- **Host:** `163.176.0.135` (Oracle Cloud Free Tier, Ubuntu 24.04.4 LTS)
- **SSH:** porta 22, autenticação por chave pública; acesso via `scripts/ssh-vm.ps1 dev "<comando>"` (paramiko dentro de venv Python — ver [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md))
- **Preview web:** porta 8080 (configurável via `DEV_PREVIEW_PORT` em `.env`), acessível em `http://163.176.0.135:8080` após liberação da security list pelo CEO
- **Container runtime:** Docker Engine (instalado via `get.docker.com`), grupo `docker` concedido ao usuário `ubuntu` (sem sudo necessário)
- **fail2ban:** instalado para mitigar força bruta na porta 22 (segurança adicional a autenticação por chave)
- **Autonomia:** scripts SSH executáveis livremente sem aprovação por comando (contrário da VM de prod) — decisão deliberada para acelerar iteração durante desenvolvimento

### Docker Compose (roda na VM de dev)

4 serviços orquestrados:

| Serviço    | Imagem/Build         | Porta interna | Função |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | Banco de dados relacional |
| `api`      | `./backend` (build)  | 8000 | FastAPI, rotas `/auth/*`, `/health` |
| `frontend` | `./frontend` (build) | 80   | Vite build estático, servido por nginx |
| `caddy`    | `caddy:2-alpine`     | 80   | Reverse proxy, rota única entrada porta `$DEV_PREVIEW_PORT` do host |

**Roteamento Caddy:**
- `/auth/*` → `api:8000`
- `/health` → `api:8000`
- `/*` (resto) → `frontend:80`

**Healthchecks:** postgres e api têm healthchecks Docker; frontend/caddy derivam do estado dos dependentes.

**Ciclo de deploy (desenvolvimento):**
1. Editar código local (backend/ ou frontend/)
2. `git push` para `main` (autorizado sem aprovação prévia)
3. Na VM de dev: `git pull` + `docker compose up -d --build`
4. Logs: `docker compose logs -f api` ou similar

## Componentes

- **API (FastAPI):** autenticação (Google OAuth via Authlib), endpoints de sync Pluggy (futuro), CRUD de categorias/ativos/passivos (futuro), endpoints de agregação para dashboards (futuro). Lógica de negócio (categorização por regras+memória, competência de receita, cálculo de patrimônio) vive aqui, testada via pytest com ≥80% cobertura. Estrutura: `app/main.py`, `app/config.py`, `app/db.py`, `app/models/`, `app/auth/`, `tests/`.
- **Banco (PostgreSQL):** schema relacional — `users` (tabela criada em Sprint 1), futuras contas, transações, categorias/subcategorias, natureza de custo, ativos/passivos, memória de categorização, agregações pré-calculadas. Migrations via Alembic reversíveis.
- **Frontend (React/Vite):** dashboards com drill-down (futuro), telas de setup (futuro), gestão de categorias/ativos/passivos (futuro), login Google, perfil/logout (futuro). Data-fetching via TanStack Query. Estrutura: `src/pages/`, `src/api/`, `src/hooks/`, `tests/`.
- **Integração Pluggy:** chamada síncrona disparada por botão "sincronizar" no frontend (futuro); sem job agendado nesta fase.

## Autenticação (Sprint 1)

- **Provedor:** Google OAuth 2.0 (Authlib)
- **Flow:** usuário clica "Entrar com Google" no frontend → redirecionado para `/auth/google/login` → Google → redirecionado de volta para `/auth/google/callback` com `code` → backend autentica em `/auth/google/callback`, cria/atualiza usuário em `users`, gera JWT, seta cookie httpOnly `financeiro_session` (expiração 7 dias) → redirecionado para página protegida
- **Validação:** dependency `get_current_user` em `app/auth/deps.py` valida JWT em cookie a cada request para rotas protegidas; retorna 401 sem cookie/token inválido/expirado/usuário não encontrado
- **Isolamento:** usuários identificados unicamente por `google_sub` (subject ID do Google); cada usuário tem `id`, `email`, `name`, `created_at`, `updated_at` na tabela `users`

## Isolamento de dados por usuário

Toda tabela transacional tem `user_id` obrigatório; toda query de aplicação filtra por usuário autenticado (nunca por sessão implícita). Memória de categorização compartilhada é a única exceção, e apenas para o mapeamento descrição-padrão→categoria, nunca para valores/descrições brutas — ver [docs/migration/legacy-data.md](../migration/legacy-data.md).

## Qualidade (Sprint 1)

- **Testes backend:** pytest com ≥95% cobertura em código de auth (unit: JWT válido/expirado/assinatura inválida, criação/atualização de usuário; integração: `/auth/me` com/sem cookie, `/auth/google/callback` com Google mockado, `/health`)
- **Testes frontend:** Vitest + Testing Library (renderização condicional, tratamento de 401, mock fetch)
- **Lint:** ruff (Python), eslint (TypeScript) — suíte 100% verde
- **Pre-commit:** ruff, eslint, detect-secrets (baseline) — executado local antes de push
- **CI:** GitHub Actions — jobs `backend` (ruff check/format, pytest) e `frontend` (eslint, prettier, tsc, vitest) — roda em push/PR para `main`

## Pendências (Sprint 1)

Bloqueios que impedem validação end-to-end total:

1. **CEO:** abertura da porta 8080 na security list da VM de dev (Oracle Cloud Console) — sem isso, preview web não acessível de fora da VM
2. **CEO:** criação de projeto Google Cloud Console + credenciais OAuth + tela de consentimento com redirect URI `http://163.176.0.135:8080/auth/google/callback` — sem isso, login real não testável (código de auth está pronto com mocks, mas validação no navegador pendente)

Consequência: tarefas 6, 7, 9 do plano de Sprint 1 têm código+testes prontos, mas validação end-to-end em navegador ainda pendente (depende de (1) e (2) acima).

## Referências

- [ADR-001 — Stack](adr/ADR-001-stack.md)
- [ADR-002 — Plugins](adr/ADR-002-plugins.md)
- [docs/directory-structure.md](../directory-structure.md)
- [docs/roadmap.md](../roadmap.md)
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md)
- [docs/sprints/SPRINT-001-fundacao-tecnica-plan.md](../sprints/SPRINT-001-fundacao-tecnica-plan.md)
