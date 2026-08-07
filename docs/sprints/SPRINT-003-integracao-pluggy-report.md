# SPRINT-003: Integração Pluggy — Relatório

- **Plano:** [SPRINT-003-integracao-pluggy-plan.md](./SPRINT-003-integracao-pluggy-plan.md)
- **PRD:** [PRD-003-integracao-pluggy](../prd/PRD-003-integracao-pluggy.md)
- **Data do relatório:** 2026-08-07
- **Status:** aguardando validação ponta a ponta e aprovação do CEO

## Resumo

Sprint 3 entregou a integração Pluggy completa no código: modelos +
migration para `pluggy_items`/`pluggy_accounts`/`pluggy_transactions`,
cliente HTTP com API key cacheada em memória, service com as regras de
negócio (upsert idempotente, corte por `cutoff_date`, bloqueio de sync em
status inválido), endpoints `/pluggy/*` isolados por usuário, e UI mínima no
frontend (conectar conta via widget Pluggy Connect + listagem de
transações com sincronização por botão). 40 testes novos (31 backend + 9
frontend), 98-100% de cobertura nos módulos novos. Commit `f953c49` já
pushado para `main`. **Deploy na VM de dev e validação ponta a ponta contra
o sandbox real ainda não foram feitos nesta sessão** — dependem de dados que
só o CEO tem (ver "Pendências" abaixo). Fecha o épico E2 assim que a
validação for concluída.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Modelos + migration `0004` (pluggy_items/accounts/transactions) | **Feito** | `app/models/pluggy.py`, `alembic/versions/0004_create_pluggy_tables.py` |
| 2 | `PluggyClient` (auth por API key, cache em memória, get_item/accounts/transactions paginado) | **Feito** | `app/pluggy_integration/client.py` |
| 3 | `service.py` (create_connect_token, register_item, sync_item, list_*) | **Feito** | `app/pluggy_integration/service.py` |
| 4 | Schemas + `router.py` + registro em `main.py` | **Feito** | `app/schemas/pluggy.py`, `app/pluggy_integration/router.py` |
| 5 | `config.py` + `.env.example` | **Feito** | `PLUGGY_CLIENT_ID/SECRET/BASE_URL/SYNC_CUTOFF_DATE` |
| 6 | Testes unitários (cliente mockado + service) | **Feito** | `test_pluggy_client.py`, `test_pluggy_service.py` |
| 7 | Testes de integração (endpoints) | **Feito** | `test_pluggy_endpoints.py` |
| 8 | Frontend: api, hooks, páginas, abas | **Feito** | `api/pluggy.ts`, `pluggy/loadPluggyConnect.ts`, hooks, `ConnectAccountPage`/`TransactionsPage`, abas em `ProtectedPage.tsx` |
| 9 | Testes Vitest | **Feito** | `pluggy.test.ts`, `ConnectAccountPage.test.tsx` (widget mockado), `TransactionsPage.test.tsx` |
| 10 | Caddyfile + conferir Dockerfile/compose | **Feito** | `/pluggy*` adicionado ao matcher `@api`; Dockerfiles copiam diretórios inteiros (`app`, `scripts`, frontend `.`) — nenhuma mudança extra necessária |
| 11 | Script `pluggy_sandbox_smoke.py` | **Feito** | `backend/scripts/pluggy_sandbox_smoke.py` — não roda em CI |
| 12 | Deploy na VM de dev + validação ponta a ponta | **Não feito** | Falta: credenciais SSH da VM de dev (`FINANCEIRO_DEV_VM_*`) nesta sessão e credenciais reais do sandbox Pluggy no `.env` remoto — ambas dependem do CEO. Ver "Pendências" |
| 13 | Atualizar docs vivos | **Feito** | `OVERVIEW.md`, `directory-structure.md` |
| 14 | Relatório de sprint | **Feito** | Este arquivo |

## Evidência de testes

**Backend:**
```
82 passed, 78 warnings in 10.28s

Name                                 Stmts   Miss  Cover   Missing
------------------------------------------------------------------
app\pluggy_integration\__init__.py       0      0   100%
app\pluggy_integration\client.py        53      1    98%   66
app\pluggy_integration\router.py        40      0   100%
app\pluggy_integration\service.py       98      0   100%
app\schemas\pluggy.py                   52      0   100%
app\models\pluggy.py                    71      0   100%
------------------------------------------------------------------
TOTAL                                  915     18    98%
```

**Frontend:**
```
Test Files  4 passed (4)
     Tests  9 passed (9)
```

Cobertura de lógica de negócio nos módulos novos da Sprint 3: **98-100%**
(meta ≥80%, hard gate). Suíte rodada localmente (venv `backend/.venv` e
`frontend/node_modules`); **CI do GitHub Actions não conferido diretamente
nesta sessão** por falta de acesso ao `gh` CLI neste ambiente — recomendo o
CEO conferir a run do commit `f953c49` em
[actions](https://github.com/daniellimabr/financeiro/actions) antes de
aprovar.

## Lint/formatter

```
ruff.....................................................................Passed
ruff-format..............................................................Passed
eslint (frontend)........................................................Passed
Detect secrets...........................................................Passed
```
(saída do pre-commit no commit `f953c49`; `npm run build`/`tsc -b` e `npm run format` também verdes)

## Decisões tomadas durante a execução

- **Botão "Sincronizar" na tela de transações, não na de conexão** — o PRD
  descrevia a UI mínima de forma ambígua entre as duas telas; optei por
  colocá-lo em `TransactionsPage` (um botão por item conectado) porque o
  critério de aceite 7 liga explicitamente o clique em "Sincronizar" ao
  aparecimento das transações, e `ConnectAccountPage` ficou só leitura
  (lista de contas conectadas).
- **Separação client/service na normalização de dados da Pluggy** —
  `PluggyClient` devolve o JSON cru da API (contrato realista); `service.py`
  concentra o mapeamento de status/tipo (`UPDATED`→`updated`,
  `DEBIT`→`debito`, subtype→`PluggyAccountTipo`) e todas as regras de
  negócio. Evita duplicar lógica de mapeamento em múltiplos lugares e deixa
  o cliente HTTP burro e fácil de testar com `httpx.MockTransport`.
- **Filtro de `cutoff_date` em duas camadas** — passado como parâmetro
  `from` para a API Pluggy (reduz payload real) *e* re-verificado
  localmente em `sync_item` antes do upsert. Garante o critério de aceite 3
  mesmo que a API real não honre o parâmetro exatamente como esperado.
- **Cache de API key em memória do processo** (TTL ~1.8h, sem persistir em
  banco) — implementado como client HTTP singleton no módulo do router,
  seguindo a decisão do PRD; testado via `MockTransport` contando chamadas a
  `/auth`.
- **Upsert por id externo da Pluggy, sem `INSERT ... ON CONFLICT`** — query-
  then-insert/update pelo ORM, consistente com o padrão do resto do
  código-base (decisão já registrada no PRD-003).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `POST /pluggy/connect-token` retorna token válido (mockado em teste) | **Sim** (mockado); sandbox real pendente | `test_connect_token_returns_token`; validação real fica para a etapa de deploy |
| 2. `POST /pluggy/items` cria item vinculado ao usuário; reenvio não duplica | **Sim** | `test_register_item_twice_does_not_duplicate` (unit), `test_register_item_then_resend_does_not_duplicate` (integração) |
| 3. Sync de item `updated` cria/atualiza contas+transações; corte por `cutoff_date`; segunda chamada não duplica | **Sim** | `test_sync_item_creates_accounts_and_transactions`, `test_sync_item_excludes_transactions_before_cutoff_date`, `test_sync_item_twice_does_not_duplicate_accounts_or_transactions` |
| 4. Item `updating`/`login_error` no sync → 400, nada gravado | **Sim** | `test_sync_item_with_non_syncable_status_raises_and_writes_nothing` (parametrizado com 4 status), `test_sync_item_with_updating_status_returns_400_and_writes_nothing` |
| 5. Usuário A não vê items/contas/transações do usuário B | **Sim** | `test_list_accounts_and_transactions_isolated_by_user`, `test_user_does_not_see_other_users_items_accounts_transactions` |
| 6. `subcategory_id` e `data_competencia` sempre `NULL` no sync | **Sim** | Verificado em `test_sync_item_creates_accounts_and_transactions`; nunca escritos pelo `service.py` (campos não populados no upsert) |
| 7. Widget abre, conta aparece na lista, transações aparecem após "Sincronizar" | **Parcial** | Fluxo completo testado com widget/API mockados (`ConnectAccountPage.test.tsx`, `TransactionsPage.test.tsx`); validação real no sandbox/navegador pendente de deploy |
| 8. `/pluggy/*` sem cookie → 401 | **Sim** | `test_items_accounts_transactions_without_cookie_return_401`, `test_connect_token_without_cookie_returns_401` |
| 9. CI com cobertura ≥80%, sem depender de rede/credenciais reais | **Sim (local)** | 98-100% local, todos os testes usam `httpx.MockTransport`/client fake — CI não conferido diretamente (ver "Evidência de testes") |
| 10. Caddyfile roteia `/pluggy/*` para a API | **Sim (código)**; validação na VM pendente | `/pluggy*` no matcher `@api`; confirmação via `curl` real fica para o deploy |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção "Integração Pluggy (Sprint 3)"
  nova (tabelas, endpoints, frontend, validação manual); roteamento Caddy e
  seção "Componentes" atualizados; "Qualidade" passou a citar os três
  sprints.
- `docs/directory-structure.md` — árvore atualizada com
  `app/pluggy_integration/`, `app/models/pluggy.py`,
  `app/schemas/pluggy.py`, migration `0004`, testes novos,
  `backend/scripts/pluggy_sandbox_smoke.py`, e todo o novo diretório
  `frontend/src/pluggy/` + páginas/hooks Pluggy; seção "o que ainda não
  existe" revisada.
- `docs/roadmap.md` e `docs/prd/PRD-002-...md` — já haviam sido atualizados
  na sessão de planejamento (divisão de E2/E3 em Sprints 3/4); não
  retocados nesta sessão de execução.

## Pendências e próximos passos sugeridos

1. **Deploy na VM de dev** — esta sessão não tinha as variáveis
   `FINANCEIRO_DEV_VM_HOST`/`PORT`/`KEY` no ambiente (são definidas por
   sessão do PowerShell, nunca commitadas). Para eu rodar o deploy
   (`git pull` + `docker compose up -d --build` + `docker compose restart
   caddy`, tudo na VM de **dev**, sem necessidade de aprovação por comando),
   preciso que o CEO exporte essas variáveis numa sessão e me peça para
   continuar, ou rode o deploy diretamente.
2. **Credenciais reais do sandbox Pluggy** — precisam ser configuradas
   manualmente pelo CEO no `.env` da VM de dev (`PLUGGY_CLIENT_ID`/
   `PLUGGY_CLIENT_SECRET`) antes da validação ponta a ponta. Nunca devem
   passar por comando montado por mim.
3. **Após 1 e 2**, rodar `python scripts/pluggy_sandbox_smoke.py` na VM (via
   `docker compose exec api ...`) para validar auth/connect-token contra o
   sandbox real, depois validação manual completa no navegador (conectar
   conta sandbox → ver item na lista → sincronizar → ver transações),
   fechando os critérios de aceite 1, 7 e 10.
4. **CI do GitHub Actions** — confirmar a run do commit `f953c49` antes de
   aprovar a sprint.
5. Sprint 4 (E3 — categorização por regras + memória) está desbloqueada
   assim que a validação acima confirmar transações reais fluindo; segue
   também aguardando o arquivo de memória de classificação do v1 do CEO
   (E8, não bloqueia o início de E3).
