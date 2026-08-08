# SPRINT-003: Integração Pluggy — Relatório

- **Plano:** [SPRINT-003-integracao-pluggy-plan.md](./SPRINT-003-integracao-pluggy-plan.md)
- **PRD:** [PRD-003-integracao-pluggy](../prd/PRD-003-integracao-pluggy.md)
- **Data do relatório:** 2026-08-07, atualizado em 2026-08-08 após deploy e validação real
- **Status:** validado ponta a ponta na VM de dev com contas reais do sandbox — aguardando aprovação do CEO

## Resumo

Sprint 3 entregou a integração Pluggy completa: modelos + migration para
`pluggy_items`/`pluggy_accounts`/`pluggy_transactions`, cliente HTTP com API
key cacheada em memória, service com as regras de negócio (upsert
idempotente, corte por `cutoff_date`, bloqueio de sync em status inválido),
endpoints `/pluggy/*` isolados por usuário, e UI mínima no frontend
(conectar conta via widget Pluggy Connect + listagem de transações com
sincronização por botão). 40 testes novos (31 backend + 9 frontend), 98-100%
de cobertura nos módulos novos. Commit `f953c49` pushado em 2026-08-07;
quatro commits de correção adicionais em 2026-08-08 (ver "Bugs encontrados
no deploy real" abaixo).

**Deploy na VM de dev concluído e validado ponta a ponta em 2026-08-08**: o
CEO conectou 2 contas reais no sandbox (Itaú e XP) pelo widget, sincronizou
as duas, e a gravação no banco foi conferida diretamente (556 transações no
item 1, 386 no item 2, zero violações do critério `subcategory_id`/
`data_competencia` sempre `NULL`). Fecha o épico E2.

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
| 12 | Deploy na VM de dev + validação ponta a ponta | **Feito** | Deployado, 2 contas reais conectadas e sincronizadas (556 + 386 transações gravadas). 4 bugs encontrados e corrigidos no processo — ver seção dedicada abaixo |
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
(meta ≥80%, hard gate). Suíte completa (82 testes, não só os módulos Pluggy)
re-rodada localmente em 2026-08-08 após as correções pós-deploy, 100%
verde, 98% de cobertura total. **CI do GitHub Actions não conferido via
`gh` CLI** diretamente (indisponível neste ambiente) — para os commits
`87af0f0` em diante, o job `build-and-push` só publica imagem no GHCR se
`backend`+`frontend` passarem primeiro (gate via `needs:`), e o deploy só
funcionou porque as imagens existiam — evidência indireta de que o CI
passou nesses commits. O commit original `f953c49` (antes dessa mudança de
CI) não teve a run conferida diretamente nesta sessão; recomendo o CEO
checar em [actions](https://github.com/daniellimabr/financeiro/actions)
antes da aprovação final, por completude.

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
| 1. `POST /pluggy/connect-token` retorna token válido (mockado em teste) | **Sim** | `test_connect_token_returns_token` (mock) + validado contra o sandbox real via `pluggy_sandbox_smoke.py` e via widget real no navegador em 2026-08-08 |
| 2. `POST /pluggy/items` cria item vinculado ao usuário; reenvio não duplica | **Sim** | `test_register_item_twice_does_not_duplicate` (unit), `test_register_item_then_resend_does_not_duplicate` (integração) |
| 3. Sync de item `updated` cria/atualiza contas+transações; corte por `cutoff_date`; segunda chamada não duplica | **Sim** | `test_sync_item_creates_accounts_and_transactions`, `test_sync_item_excludes_transactions_before_cutoff_date`, `test_sync_item_twice_does_not_duplicate_accounts_or_transactions` |
| 4. Item `updating`/`login_error` no sync → 400, nada gravado | **Sim** | `test_sync_item_with_non_syncable_status_raises_and_writes_nothing` (parametrizado com 4 status), `test_sync_item_with_updating_status_returns_400_and_writes_nothing` |
| 5. Usuário A não vê items/contas/transações do usuário B | **Sim** | `test_list_accounts_and_transactions_isolated_by_user`, `test_user_does_not_see_other_users_items_accounts_transactions` |
| 6. `subcategory_id` e `data_competencia` sempre `NULL` no sync | **Sim** | Verificado em `test_sync_item_creates_accounts_and_transactions`; nunca escritos pelo `service.py` (campos não populados no upsert) |
| 7. Widget abre, conta aparece na lista, transações aparecem após "Sincronizar" | **Sim** | Testado com mocks (`ConnectAccountPage.test.tsx`, `TransactionsPage.test.tsx`) e validado de ponta a ponta no navegador real em 2026-08-08: CEO conectou Itaú e XP, sincronizou, 556+386 transações gravadas (confirmado via query direta no banco) |
| 8. `/pluggy/*` sem cookie → 401 | **Sim** | `test_items_accounts_transactions_without_cookie_return_401`, `test_connect_token_without_cookie_returns_401` |
| 9. CI com cobertura ≥80%, sem depender de rede/credenciais reais | **Sim (local)** | 98-100% local, todos os testes usam `httpx.MockTransport`/client fake — CI não conferido diretamente via `gh` (ver "Evidência de testes") |
| 10. Caddyfile roteia `/pluggy/*` para a API | **Sim** | `/pluggy*` no matcher `@api`; confirmado por tráfego real (widget → connect-token → sync, tudo via `http://financeirov2.duckdns.org:8080`) em 2026-08-08 |

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

## Bugs encontrados no deploy real (2026-08-08) e correções

Nenhum destes apareceu nos testes automatizados (que usam mocks) — só ao
rodar de verdade contra a VM e a API real da Pluggy. Todos corrigidos no
mesmo dia, cada um com commit, teste atualizado e CI verde antes do
próximo passo:

1. **VM de dev travava por horas em `docker compose up -d --build`** — 1GB
   RAM sem swap, compilando `pip`/`npm` enquanto os containers antigos
   ainda rodavam. Corrigido movendo o build pro CI (GHCR, `build-and-push`
   job) — VM só faz `pull`. Commit `87af0f0`.
2. **Página em branco** — Caddy roteava `/assets*` (rota da API pra
   entidade "Ativos") por cima dos arquivos estáticos do build do Vite, que
   por padrão também usa `/assets/`. Corrigido movendo a saída do build pro
   `/static/` (`vite.config.ts`, `assetsDir`). Commit `c9e3c1a`.
3. **Widget Pluggy Connect não abria (404)** — URL do CDN tinha versão
   fixa (`v2.9.0`) que não existe mais. Trocado pelo alias `latest` que a
   própria Pluggy documenta. Commit `5eac75f`.
4. **Sync retornava 500** — `client.py` chamava `GET /transactions`
   (paginação por página), endpoint deprecado pela Pluggy que já responde
   `410 Gone`. Migrado pra `GET /v2/transactions` (cursor). Commit
   `97288d1`.
5. **Sync ainda quebrava (400 Bad Request)** — mesmo após migrar pro v2, os
   parâmetros `pageSize`/`from` usados não existem nessa versão (confirmado
   empiricamente contra o sandbox real: a doc pública da Pluggy diverge da
   API de fato). Corrigido removendo `pageSize` e renomeando `from` para
   `dateFrom`. Commit `6924ca3`.
6. **Bug estrutural no `ssh-vm.ps1`** (achado durante a investigação do
   #5, ao tentar rodar uma query SQL remota) — o PowerShell re-tokenizava o
   comando remoto ao repassá-lo pro `python.exe` sem aspas, derrubando
   aspas internas de qualquer comando com SQL ou strings com espaço.
   Corrigido passando o comando via variável de ambiente em vez de
   argumento de CLI. Faz parte do commit `97288d1`.

**Lição registrada para sessões futuras:** o CEO pediu explicitamente para
parar de ser quem descobre esse tipo de bug clicando na UI — deploys
futuros devem incluir verificação automatizada (checar se os assets
referenciados no HTML respondem 200 do serviço certo, validar URLs de CDN
de terceiros, rodar `pluggy_sandbox_smoke.py` com um `item_id` real contra
a API de verdade) antes de pedir validação manual ao CEO.

## Pendências e próximos passos sugeridos

1. **Deploy + validação ponta a ponta: concluídos** (ver acima). Épico E2
   fechado.
2. **CI do GitHub Actions** — commit `f953c49` (o commit original da
   Sprint 3, antes das correções de deploy) não teve a run conferida
   diretamente nesta sessão por falta de `gh` CLI; recomendo checar em
   [actions](https://github.com/daniellimabr/financeiro/actions) antes da
   aprovação final, por completude.
3. Sprint 4 (E3 — categorização por regras + memória) está desbloqueada
   agora que transações reais estão fluindo; segue aguardando o arquivo de
   memória de classificação do v1 do CEO (E8, não bloqueia o início de E3).
4. **Débito técnico não bloqueante:** os critérios de aceite 2-5 e 8-9
   (dedupe, isolamento por usuário, bloqueio por status inválido) seguem
   validados só por teste mockado, nunca exercitados contra o sandbox real
   nesta sprint — risco baixo (lógica pura, sem dependência de
   comportamento específico da API externa), mas vale ter em mente se
   surgir bug equivalente aos 1-7 acima.
