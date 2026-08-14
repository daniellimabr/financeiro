# Arquitetura — Visão Geral

> Stack abaixo reflete [ADR-001](adr/ADR-001-stack.md), **aprovado pelo CEO em 2026-08-03**. Este doc é atualizado a cada mudança estrutural relevante (regra de doc viva). **Atualizado em 2026-08-14 após Sprint 4** — categorização automática (regras + memória, sem LLM) e associação despesa↔ativo implementadas; fecha o épico E3.

## Visão de alto nível

```
[Google OAuth] ---login---> [Frontend React/Vite] <---HTTP/JSON---> [Caddy] <---docker---> [API FastAPI] ---> [PostgreSQL]
                                                                      (reverse proxy, port 8080)     |
                                                                      rota: /auth/*, /health         +--> [Pluggy API] 
                                                                      rota: /* (restante)            (sync manual, sob demanda)
```

Uma VM Oracle Free Tier (163.176.0.135, Ubuntu 24.04.4 LTS) roda tudo via Docker Compose: `postgres`, `api`, `frontend` (build estático), `caddy` (reverse proxy). Código editado localmente, sincronizado via `git push`; as imagens `api`/`frontend` são buildadas e publicadas no GitHub Container Registry pelo CI (job `build-and-push` em `.github/workflows/ci.yml`, roda em todo push em `main` após os testes passarem) — a VM não builda mais localmente, só `git pull` + `docker compose pull` + `docker compose up -d` (executável via `scripts/ssh_vm.py dev`). Mudado na Sprint 3 depois que builds locais na VM (1GB RAM, sem swap) esgotavam memória/CPU e travavam por horas.

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
- `/auth/*`, `/health`, `/category-groups*`, `/subcategories*`, `/assets*`, `/liabilities*`, `/pluggy*`, `/categorization*` → `api:8000`
- `/*` (resto) → `frontend:80`
- Toda rota nova de API precisa ser adicionada ao matcher `@api` do [Caddyfile](../../Caddyfile) — esquecer isso faz a rota cair no frontend (SPA) e devolver 200 em vez do 401/404 esperado da API. Bug real da Sprint 2, descoberto só na validação end-to-end pós-deploy; adicionar ao checklist de Definition of Done ao criar endpoints novos.

**Healthchecks:** postgres e api têm healthchecks Docker; frontend/caddy derivam do estado dos dependentes.

**Ciclo de deploy (desenvolvimento):**
1. Editar código local (backend/ ou frontend/)
2. `git push` para `main` (autorizado sem aprovação prévia) — dispara o CI, que roda testes e, se passar, builda e publica as imagens `api`/`frontend` no GHCR (`ghcr.io/daniellimabr/financeiro-{api,frontend}:latest`)
3. Aguardar o job `build-and-push` do CI terminar (`gh run list` ou aba Actions do GitHub)
4. Na VM de dev: `git pull` + `docker compose pull` + `docker compose up -d` (**sem** `--build` — a VM só baixa a imagem pronta, não compila nada)
5. Logs: `docker compose logs -f api` ou similar
6. **Se o `Caddyfile` mudou:** `docker compose up -d` sozinho não recarrega o Caddy — é um arquivo montado como volume (`./Caddyfile:/etc/caddy/Caddyfile:ro`), não faz parte da imagem, então o compose não detecta mudança nele. Precisa de `docker compose restart caddy` explícito (aprendido na Sprint 2).

Pré-requisito único, feito uma vez: a VM precisa estar autenticada no GHCR (`docker login ghcr.io`) para conseguir puxar as imagens, já que o pacote é privado — ver [ssh-workflow.md](../infra/ssh-workflow.md).

## Componentes

- **API (FastAPI):** autenticação (Google OAuth via Authlib), CRUD de categorias/subcategorias e ativos/passivos (Sprint 2), integração Pluggy — connect token, registro e sync manual de contas/transações (Sprint 3), categorização automática por regras+memória e associação despesa↔ativo (Sprint 4), endpoints de agregação para dashboards (futuro). Lógica de negócio (categorização, competência de receita, cálculo de patrimônio) vive aqui, testada via pytest com ≥80% cobertura (98% nos módulos da Sprint 4). Estrutura: `app/main.py`, `app/config.py`, `app/db.py`, `app/models/`, `app/schemas/`, `app/auth/`, `app/categories/`, `app/assets/`, `app/liabilities/`, `app/pluggy_integration/`, `app/categorization/`, `app/exceptions.py`, `tests/`.
- **Banco (PostgreSQL):** schema relacional — `users` (Sprint 1); `category_groups`/`subcategories` (globais, sem `user_id` — dado mestre do sistema) e `assets`/`liabilities` (isolados por `user_id`), criados na Sprint 2; `pluggy_items`/`pluggy_accounts`/`pluggy_transactions` (isolados por `user_id`, upsert idempotente por id externo da Pluggy), criados na Sprint 3; `categorization_rules` (memória de classificação por usuário) e 9 colunas novas em `pluggy_transactions` (sugestão de categoria/ativo + `categorizacao_status`), criados na Sprint 4; agregações pré-calculadas (futuro). Migrations via Alembic reversíveis (`0001` users, `0002` categorias, `0003` ativos/passivos, `0004` Pluggy, `0005` categorization_rules, `0006` campos de categorização/ativo em pluggy_transactions).
- **Frontend (React/Vite):** dashboards com drill-down (futuro), telas de setup (futuro), gestão de categorias/ativos/passivos (futuro), login Google, perfil/logout (futuro), conexão de conta bancária e listagem de transações Pluggy (Sprint 3), fila de revisão de categorização (Sprint 4) — abas em `ProtectedPage`. Data-fetching via TanStack Query. Estrutura: `src/pages/`, `src/api/`, `src/hooks/`, `src/pluggy/`, `tests/`.
- **Integração Pluggy:** módulo `app/pluggy_integration/` (`client.py`, `service.py`, `router.py`). `PluggyClient` autentica via API key (client id/secret), cacheada em memória do processo (~1.8h de TTL, sem persistir em banco). Sync é síncrono, disparado por botão "sincronizar" no frontend por item conectado — sem job agendado/webhook nesta fase (decisão fixa do projeto). `cutoff_date` por item (default `settings.pluggy_sync_cutoff_date`, `2026-01-01`) filtra histórico trazido. Transações sincronizadas chegam sem categoria confirmada (`subcategory_id` nulo) e sem `data_competencia` — a Sprint 4 adiciona sugestão automática, mas a confirmação continua manual.

## Autenticação (Sprint 1)

- **Provedor:** Google OAuth 2.0 (Authlib)
- **Flow:** usuário clica "Entrar com Google" no frontend → redirecionado para `/auth/google/login` → Google → redirecionado de volta para `/auth/google/callback` com `code` → backend autentica em `/auth/google/callback`, cria/atualiza usuário em `users`, gera JWT, seta cookie httpOnly `financeiro_session` (expiração 7 dias) → redirecionado para página protegida
- **Validação:** dependency `get_current_user` em `app/auth/deps.py` valida JWT em cookie a cada request para rotas protegidas; retorna 401 sem cookie/token inválido/expirado/usuário não encontrado
- **Isolamento:** usuários identificados unicamente por `google_sub` (subject ID do Google); cada usuário tem `id`, `email`, `name`, `created_at`, `updated_at` na tabela `users`

## Isolamento de dados por usuário

Toda tabela transacional tem `user_id` obrigatório; toda query de aplicação filtra por usuário autenticado (nunca por sessão implícita). Memória de categorização compartilhada é a única exceção, e apenas para o mapeamento descrição-padrão→categoria, nunca para valores/descrições brutas — ver [docs/migration/legacy-data.md](../migration/legacy-data.md).

## Dados mestres (Sprint 2)

- **Categorias/subcategorias:** `category_groups` (`nome` único, case-insensitive) e `subcategories` (FK `group_id`, `nome` único dentro do grupo, `natureza` opcional: `fixa`/`variavel`/`eventual`). Dado global do sistema — sem `user_id`, editável por qualquer usuário autenticado (aceitável para os 2 usuários da família; revisitar se crescer). Endpoints: `GET/POST /category-groups`, `GET/PUT/DELETE /category-groups/{id}`, `GET/POST /subcategories` (filtro opcional `?group_id=`), `GET/PUT/DELETE /subcategories/{id}`. Módulo: `app/categories/` (`service.py`, `router.py`).
- **Ativos/passivos:** `assets` (`tipo`: `imovel`/`veiculo`/`outro`; `status`: `ativo`/`baixado`) e `liabilities` (`tipo`: `financiamento`/`outro`; `status`: `ativo`/`quitado`), ambos com `user_id` obrigatório e isolados por usuário via `get_current_user`. Baixa de ativo (`POST /assets/{id}/sell`, exige `valor_venda`+`data_venda`) e quitação de passivo (`POST /liabilities/{id}/settle`) são idempotentes — uma segunda tentativa retorna 400. CRUD completo em `GET/POST /assets`, `GET/PUT/DELETE /assets/{id}` (e equivalente `/liabilities`). Módulos: `app/assets/`, `app/liabilities/`.
- **Erros de domínio:** `app/exceptions.py` define `DuplicateNameError`/`NotFoundError`/`InvalidStateError`, convertidos pelos routers em 400/404/400 respectivamente.
- **Import do legado:** `backend/scripts/import_legacy_categories.py` lê `backend/scripts/data/legacy_categories.csv` (fixture versionada — não é dado sensível) e faz upsert por par (grupo, subcategoria); duplicata não sobrescreve, só loga conflito. Rodado contra o CSV real na VM de dev na Sprint 2: 15 grupos e 51 subcategorias importados, 0 conflitos (a contagem "16 grupos/50 pares" em versões antigas de [legacy-data.md](../migration/legacy-data.md) estava incorreta na prosa, não na lista — corrigido).
- **Frontend de gestão dessas entidades:** fora de escopo da Sprint 2 (decisão registrada em PRD-002), fica para quando E5/E6/E3 exigirem uma tela real.

## Integração Pluggy (Sprint 3)

- **Tabelas:** `pluggy_items` (`user_id`, `pluggy_item_id` único, `connector_id`/`connector_name`, `status` enum — `updating`/`updated`/`login_error`/`waiting_user_input`/`outdated`/`error`, `cutoff_date`, `last_synced_at`); `pluggy_accounts` (`item_id`, `user_id` denormalizado, `pluggy_account_id` único, `tipo` enum — `corrente`/`poupanca`/`cartao_credito`/`investimento`, `saldo`); `pluggy_transactions` (`account_id`, `user_id` denormalizado, `pluggy_transaction_id` único — chave de idempotência, `valor`, `tipo` débito/crédito, `data`, `data_competencia` e `subcategory_id` nulos nesta sprint, `categoria_pluggy` só informativo, `status` pendente/efetivada).
- **Endpoints:** `POST /pluggy/connect-token` (gera token do widget), `GET/POST /pluggy/items` (lista/registra item — upsert idempotente por `pluggy_item_id`), `POST /pluggy/items/{id}/sync` (busca contas+transações reais, upsert idempotente por id externo; item em `updating`/`login_error`/`error`/`waiting_user_input` retorna 400 e não grava nada), `GET /pluggy/accounts`, `GET /pluggy/transactions`. Todos isolados por `user_id` via `get_current_user`, mesmo padrão de `assets`/`liabilities`.
- **Frontend:** `ConnectAccountPage` (botão "Conectar conta bancária" abre o widget Pluggy Connect via `src/pluggy/loadPluggyConnect.ts`, que injeta o script do CDN sob demanda; `onSuccess` do widget chama `POST /pluggy/items`) e `TransactionsPage` (lista transações sincronizadas, com botão "Sincronizar" por item conectado). Ambas acessíveis por abas em `ProtectedPage.tsx`.
- **Validação manual do sandbox:** `backend/scripts/pluggy_sandbox_smoke.py` (não roda em CI) — testa auth/connect-token e, opcionalmente, sync de um item real já conectado. Credenciais `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` (sandbox, fornecidas pelo CEO) configuradas manualmente no `.env` da VM de dev, nunca commitadas.
- **Transações via `GET /v2/transactions`** (cursor `next`/`after`), não o endpoint por página (deprecado pela Pluggy, responde `410 Gone`). Parâmetros aceitos: `accountId`, `dateFrom` — **não** `pageSize`/`from` (existem na doc pública da Pluggy mas a API real rejeita com 400; confirmado empiricamente em 2026-08-08, ver `SPRINT-003...-report.md`).
- **Validado de ponta a ponta em produção real (VM de dev, 2026-08-08):** 2 contas sandbox conectadas e sincronizadas com sucesso (556 + 386 transações).
- **Fora de escopo desta sprint:** categorização (regras+memória, E3/Sprint 4), sync agendado/webhooks, UI dedicada de reconexão — ver [PRD-003](../prd/PRD-003-integracao-pluggy.md).

## Categorização automática (Sprint 4)

- **Tabela `categorization_rules`:** memória de mapeamento `padrão-de-descrição normalizado → subcategoria`, por usuário (`user_id` obrigatório — mesmo as regras importadas do legado são memória privada, nunca seed global). Unique `(user_id, padrao_normalizado)`. Campo `origem` (`legado` hoje; `usuario_confirmou`/`herdado:<user_id>` reservados para sprint futura de memória compartilhada opt-in).
- **9 colunas novas em `pluggy_transactions`:** `categorizacao_status` (enum `pendente`/`confirmada`, distinto do `status` bancário já existente), `subcategoria_sugerida_id`/`sugestao_confianca`/`sugestao_fonte_tipo`/`sugestao_fonte_id`/`sugestao_score` (sugestão de categoria) e `asset_id`/`asset_sugerido_id`/`asset_sugestao_confianca` (associação despesa↔ativo, confirmada e sugerida). Índice composto `(user_id, categorizacao_status)`. O motor **nunca** escreve em `subcategory_id`/`asset_id` — só nos campos de sugestão; a confirmação é sempre uma ação explícita do usuário via API.
- **Motor (`app/categorization/`):** `normalize.py` (NFKD→ASCII→minúsculas, remove prefixo de canal/meio de pagamento e números isolados); `engine.py` — `suggest_category()` com 2 camadas por ordem de precedência (1: match exato contra `categorization_rules` ou histórico confirmado do próprio usuário, fonte `regra`/`historico_exato`; 2: similaridade `difflib.SequenceMatcher.ratio() >= 0.86` contra o histórico confirmado, fonte `historico_similar`) e `suggest_asset()` (heurística "contains" simples entre descrição normalizada e nome do ativo, confiança `media`); `service.py` — `list_pending_transactions()` recalcula e persiste sugestões a cada chamada (sem cache/digest), `confirm_categorization()`/`set_transaction_asset()` são as únicas escritas em campos confirmados.
- **Endpoints:** `GET /categorization/pending`, `POST /categorization/pending/{id}/confirm`, `PUT /categorization/pending/{id}/asset` — isolados por `user_id`, mesmo padrão de `assets`/`pluggy_*`.
- **Import do legado:** `backend/scripts/import_legacy_categorization_rules.py --user-email <email>` lê `backend/scripts/data/semente-classificacao.json` (328 regras entregues pelo CEO), resolve `"Grupo/Subcategoria"` contra a taxonomia já importada (case-insensitive), upsert por `(user_id, padrao_normalizado)` — conflito loga e não sobrescreve, categoria não resolvida loga e pula.
- **Frontend:** `CategorizationReviewPage` (fila de pendentes com sugestão pré-preenchida, confirmar categoria, associar/limpar ativo), aba "Categorizar" em `ProtectedPage`. Pré-requisitos criados nesta sprint: `api/categories.ts` (+`useCategoryGroups`/`useSubcategories`) e `api/assets.ts` (+`useAssets`), antes inexistentes no frontend.
- **Fora de escopo desta sprint:** herança de regras entre usuários (schema já preparado via `origem`), camadas de token distintivo/IDF e léxico PT-BR, estado "pular" na fila, cálculo automático de competência de receita — ver [PRD-004](../prd/PRD-004-categorizacao-automatica.md).

## Qualidade (Sprint 1 + Sprint 2 + Sprint 3 + Sprint 4)

- **Testes backend:** pytest com ≥95% cobertura em código de auth (Sprint 1: unit JWT válido/expirado/assinatura inválida, criação/atualização de usuário; integração `/auth/me`, `/auth/google/callback` mockado, `/health`), 97% nos módulos de dados mestres (Sprint 2: unit de regras de negócio — nome único, `natureza` inválida, idempotência de sell/settle, merge do import; integração de CRUD, 401/404, isolamento `user_id` entre dois usuários, import contra fixture CSV), 98% nos módulos Pluggy (Sprint 3: cliente HTTP via `httpx.MockTransport` — cache/refetch de API key, paginação, erro propagado; service com client fake — upsert idempotente, transição pendente→efetivada, corte por `cutoff_date`, item não-sincronizável não grava nada; integração dos endpoints `/pluggy/*` — 401, isolamento entre usuários, 400/404) e 96-100% nos módulos de categorização (Sprint 4: normalização — acentos, prefixos de canal, token numérico vs. alfanumérico; motor — precedência de camadas mesmo com scores conflitantes, fronteira exata do `ratio() >= 0.86` com `SequenceMatcher` real, isolamento por usuário; service — invariante "nunca auto-confirma" mesmo após listar pendentes repetidamente, reconfirmação, 404 cross-user; import — conflito, idempotência, categoria não resolvida, abort sem usuário)
- **Testes frontend:** Vitest + Testing Library (renderização condicional, tratamento de 401, mock fetch, widget Pluggy Connect mockado via `window.PluggyConnect`, sugestão pré-preenchida e remoção da fila após confirmar)
- **Lint:** ruff (Python), eslint (TypeScript) — suíte 100% verde
- **Pre-commit:** ruff, eslint, detect-secrets (baseline) — executado local antes de push
- **CI:** GitHub Actions — jobs `backend` (ruff check/format, pytest) e `frontend` (eslint, prettier, tsc, vitest) — roda em push/PR para `main`

## Acesso externo à VM de dev — DNS e checklist de portas

A VM de dev é acessada por `http://financeirov2.duckdns.org:8080` (domínio gratuito DuckDNS apontando para `163.176.0.135`), **não pelo IP puro**: o Google rejeita IP como redirect URI OAuth ("é preciso usar um domínio... com TLD válido"). `OAUTH_REDIRECT_BASE_URL` no `.env` da VM usa esse domínio.

Abrir uma porta nova nesta VM (ou na futura VM de prod, se a mesma imagem Oracle Ubuntu for usada) exige checar **três camadas**, não só uma — Sprint 1 caiu nas três:

1. **Security List da VCN** — a VCN `vcn-financeiro` tem duas Security Lists (uma para subnet privada, outra "Default"); a instância pública usa a "Default". Regra de ingress precisa estar na lista certa.
2. **`iptables` da própria VM** — a imagem Ubuntu da Oracle já vem com um `REJECT` padrão (`icmp-host-prohibited`) para tudo que não é porta 22 (`chain INPUT`, ver `sudo iptables -L INPUT -n`). Precisa de um `ACCEPT tcp --dport <porta> -m state --state NEW` **antes** da regra de reject (`iptables -I INPUT <posição> ...`). A imagem já vem com `iptables-persistent`/`netfilter-persistent` instalado — depois de adicionar a regra, rodar `sudo netfilter-persistent save` para sobreviver a reboot (feito para a porta 8080 nesta sprint).
3. **Redirect URI do Google (se aplicável)** — exige domínio com TLD, não aceita IP puro.

## Pendências

Nenhum bloqueio de Sprint 1 restante — porta 8080 e credenciais Google resolvidas e login validado end-to-end pelo CEO. Ver [SPRINT-001-fundacao-tecnica-report.md](../sprints/SPRINT-001-fundacao-tecnica-report.md) para detalhe completo.

## Referências

- [ADR-001 — Stack](adr/ADR-001-stack.md)
- [ADR-002 — Plugins](adr/ADR-002-plugins.md)
- [docs/directory-structure.md](../directory-structure.md)
- [docs/roadmap.md](../roadmap.md)
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md)
- [docs/sprints/SPRINT-001-fundacao-tecnica-plan.md](../sprints/SPRINT-001-fundacao-tecnica-plan.md)
