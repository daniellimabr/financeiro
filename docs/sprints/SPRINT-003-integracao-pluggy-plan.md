# SPRINT-003: Integração Pluggy — Plano

- **PRD(s):** [PRD-003-integracao-pluggy](../prd/PRD-003-integracao-pluggy.md)
- **Data do plano:** 2026-08-07

## Objetivo da sprint

Ao final, o usuário consegue conectar uma conta bancária via Pluggy Connect,
clicar em "Sincronizar" e ver suas contas e transações reais (sandbox) na
tela — sem categorização ainda, que fica para a Sprint 4.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Modelos SQLAlchemy (`app/models/pluggy.py`) + migration Alembic `0004` (`pluggy_items`, `pluggy_accounts`, `pluggy_transactions`, enums de status/tipo, FKs, índices) | Sonnet: implementação | PRD-003 §Dados e modelo; [0003_create_assets_liabilities.py](../../backend/alembic/versions/) (padrão de enum `create_type=False`) |
| 2 | `PluggyClient` (`app/pluggy_integration/client.py`): auth via API key com cache em memória, `create_connect_token`, `get_item`, `get_accounts`, `get_transactions` paginado, `http_client` injetável | Sonnet: implementação | PRD-003 §Regras de negócio |
| 3 | `service.py` (`app/pluggy_integration/`): `create_connect_token`, `register_item` (upsert por `pluggy_item_id`), `sync_item` (valida status, upsert de contas/transações respeitando `cutoff_date`, atualiza `last_synced_at`), `list_items/accounts/transactions` isolados por `user_id` | Sonnet: implementação | PRD-003 §Regras de negócio, §Critérios de aceite 3-6 |
| 4 | Schemas Pydantic (`app/schemas/pluggy.py`) + `router.py` (`/pluggy/connect-token`, `/pluggy/items`, `/pluggy/items/{id}/sync`, `/pluggy/accounts`, `/pluggy/transactions`) + registro em `main.py` | Sonnet: implementação | PRD-003 §Critérios de aceite; [app/assets/router.py](../../backend/app/assets/router.py) (padrão de mapeamento de exceptions) |
| 5 | `config.py` (`pluggy_client_id/secret/base_url/sync_cutoff_date`) + bloco correspondente em `.env.example` | Sonnet: implementação | PRD-003 §Segurança |
| 6 | Testes unitários: cliente HTTP via `httpx.MockTransport` (cache/refetch de API key, paginação, erro propagado); service com client fake (upsert idempotente, transição pendente→efetivada, corte por `cutoff_date`, item `updating`/`login_error` não grava nada, isolamento por usuário) | Sonnet + skill tdd-workflow | PRD-003 §Critérios de aceite 1, 3, 4, 6 |
| 7 | Testes de integração: endpoints `/pluggy/*` (401 sem cookie, isolamento entre dois usuários, mapeamento de exceptions para 400/404) | Sonnet + skill tdd-workflow | PRD-003 §Critérios de aceite 5, 8 |
| 8 | Frontend: `api/pluggy.ts`, `pluggy/loadPluggyConnect.ts`, hooks TanStack Query (`usePluggyItems`, `usePluggyTransactions`, `useSyncPluggyItem`, `useRegisterPluggyItem`), `pages/ConnectAccountPage.tsx`, `pages/TransactionsPage.tsx`, abas em `ProtectedPage.tsx` | Sonnet: implementação | [frontend/src/hooks/useCurrentUser.ts](../../frontend/src/hooks/useCurrentUser.ts) (padrão de hook TanStack Query), [frontend/src/api/client.ts](../../frontend/src/api/client.ts) |
| 9 | Testes Vitest: `api/pluggy.test.ts`, `ConnectAccountPage.test.tsx` (com `window.PluggyConnect` mockado), `TransactionsPage.test.tsx` | Sonnet + skill tdd-workflow | PRD-003 §Critérios de aceite 7 |
| 10 | `Caddyfile`: adicionar `/pluggy*` ao matcher `@api`; conferir explicitamente que `Dockerfile`/`docker-compose.yml` já cobrem os arquivos novos (sem assumir) | Sonnet: implementação | [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) (lições de deploy da Sprint 2) |
| 11 | Script `backend/scripts/pluggy_sandbox_smoke.py` (validação manual de credenciais reais, não roda em CI) | Sonnet: implementação | [backend/scripts/import_legacy_categories.py](../../backend/scripts/import_legacy_categories.py) (padrão de script standalone) |
| 12 | Deploy na VM de dev: CEO configura `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` reais no `.env` remoto → `git pull` + `docker compose up -d --build` + `docker compose restart caddy` (explícito) → rodar `pluggy_sandbox_smoke.py` → validação manual ponta a ponta no navegador | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 13 | Atualizar docs vivos (`OVERVIEW.md` — novas tabelas, endpoints, rota Caddy; `directory-structure.md` — novos módulos/arquivos) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md |
| 14 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** cache/refetch de API key do cliente Pluggy;
  paginação de transações; upsert idempotente de item/conta/transação (sync
  repetido não duplica); transição de transação `pendente`→`efetivada`;
  transações antes do `cutoff_date` do item não são trazidas; item em
  `updating`/`login_error`/`error` levanta `InvalidStateError` sem gravar
  nada; isolamento de `user_id` em toda a cadeia item→conta→transação.
- **Integração:** todos os endpoints `/pluggy/*` retornam 401 sem cookie;
  usuário A não vê items/contas/transações do usuário B; `POST
  /pluggy/items` reenviado com o mesmo `pluggy_item_id` não duplica; sync de
  item inexistente/de outro usuário retorna 404; sync de item em estado
  inválido retorna 400.
- **Frontend (Vitest):** fluxo de conectar conta chama `registerItem` no
  `onSuccess` do widget mockado; tela de transações lista e permite
  sincronizar via botão.
- Todos executados localmente e na VM de dev via `scripts/ssh-vm.ps1 dev
  "..."`. Meta ≥80% de cobertura nos módulos novos — hard gate, mesmo padrão
  da Sprint 2. Testes automatizados não dependem de rede/credenciais reais;
  a validação contra o sandbox real da Pluggy é manual (script +
  navegador), documentada no relatório de sprint.

## Impacto no roadmap

Fecha o épico E2. Desbloqueia a Sprint 4 (E3 — categorização por regras +
memória, associação despesa↔ativo), que passa a ter transações reais para
calibrar o motor. Não fecha E8 (import da memória de classificação do v1
continua bloqueado aguardando arquivo do CEO — entra junto com o design de
E3 na Sprint 4).

## Riscos / dependências

- Depende das credenciais sandbox do Pluggy, já em posse do CEO — precisam
  ser configuradas no `.env` da VM de dev antes da etapa de validação
  ponta a ponta (tarefa 12); não bloqueia o desenvolvimento/testes
  automatizados, que rodam com cliente mockado.
- Item Pluggy pode ficar em `updating` por segundos/minutos após a conexão
  no widget — a sincronização precisa comunicar isso claramente ao usuário,
  não apenas devolver "0 transações" (critério de aceite 4).
- Reconexão (`login_error`/`outdated`) reaproveita o fluxo de conexão
  existente sem UI dedicada — se a validação manual mostrar confusão de UX,
  vira ajuste pontual, não retrabalho arquitetural.
- Nenhuma dependência de infraestrutura nova além de variáveis de ambiente —
  reaproveita VM de dev, Docker Compose, CI e pipeline de testes já
  existentes.
- Lição já registrada da Sprint 2: `Caddyfile` é montado como volume, não faz
  parte da imagem — `docker compose up -d --build` sozinho não basta, é
  preciso `docker compose restart caddy` explícito (tarefa 12).
