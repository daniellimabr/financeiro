# Arquitetura — Visão Geral

> Stack abaixo reflete [ADR-001](adr/ADR-001-stack.md), **aprovado pelo CEO em 2026-08-03**. Este doc é atualizado a cada mudança estrutural relevante (regra de doc viva). **Atualizado em 2026-08-15 após Sprint 10** — investigação NuTag (achado sistêmico: cartão de crédito em `credito` nunca é receita), tela de Gestão de Passivos nova, edição inline de descrição/categoria/ativo no drill-down do Dashboard/Ativos/Passivos, drill-down do card Patrimônio, tooltip do sparkline sem "v:", filtros novos e motor de sugestão de ativo em 3 camadas na tela de Categorização, menu sem aba Início. Ver seção própria abaixo.

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
- `/auth/*`, `/health`, `/category-groups*`, `/subcategories*`, `/assets*`, `/liabilities*`, `/pluggy*`, `/categorization*`, `/dashboards*` → `api:8000`
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
7. **Nunca rodar `alembic upgrade head` manualmente logo após `docker compose up -d`:** o entrypoint do container `api` já roda a migration sozinho ao subir (`command: sh -c "alembic upgrade head && ..."`). Um `docker compose exec api alembic upgrade head` manual disparado enquanto esse entrypoint ainda está de pé cria uma corrida de dois processos `alembic upgrade head` concorrentes — o segundo falha com `IntegrityError` (nome de sequência/tabela duplicado) e derruba o container (aprendido na Sprint 10, migration `0011`; a tabela e o `alembic_version` ficaram corretos, só o processo do container morreu — resolvido com `docker compose up -d api` de novo). Se precisar confirmar que a migration rodou, checar `docker compose logs api` ou `alembic_version` direto no Postgres, não reexecutar a migration.

Pré-requisito único, feito uma vez: a VM precisa estar autenticada no GHCR (`docker login ghcr.io`) para conseguir puxar as imagens, já que o pacote é privado — ver [ssh-workflow.md](../infra/ssh-workflow.md).

## Componentes

- **API (FastAPI):** autenticação (Google OAuth via Authlib), CRUD de categorias/subcategorias e ativos/passivos (Sprint 2), integração Pluggy — connect token, registro e sync manual de contas/transações (Sprint 3), categorização automática por regras+memória e associação despesa↔ativo (Sprint 4), endpoints de agregação para dashboards (Sprint 5). Lógica de negócio (categorização, competência de receita, cálculo de patrimônio) vive aqui, testada via pytest com ≥80% cobertura (100% nos módulos novos da Sprint 5). Estrutura: `app/main.py`, `app/config.py`, `app/db.py`, `app/models/`, `app/schemas/`, `app/auth/`, `app/categories/`, `app/assets/`, `app/liabilities/`, `app/pluggy_integration/`, `app/categorization/`, `app/dashboards/`, `app/exceptions.py`, `tests/`.
- **Banco (PostgreSQL):** schema relacional — `users` (Sprint 1); `category_groups`/`subcategories` (globais, sem `user_id` — dado mestre do sistema) e `assets`/`liabilities` (isolados por `user_id`), criados na Sprint 2; `pluggy_items`/`pluggy_accounts`/`pluggy_transactions` (isolados por `user_id`, upsert idempotente por id externo da Pluggy), criados na Sprint 3; `categorization_rules` (memória de classificação por usuário) e 9 colunas novas em `pluggy_transactions` (sugestão de categoria/ativo + `categorizacao_status`), criados na Sprint 4; `category_groups.excluir_de_totais` (flag para excluir "Transferência interna" das agregações) e backfill de `data_competencia` em `pluggy_transactions`, criados na Sprint 5; `apelido`/`sync_enabled` em `pluggy_accounts` e `descricao_usuario`/`descricao_sugerida`/`descricao_sugestao_origem_id` em `pluggy_transactions`, criados na Sprint 7; `liability_id`/`liability_sugerido_id`/`liability_sugestao_confianca` em `pluggy_transactions`, espelhando `asset_id`, criados na Sprint 9; `limite_credito`/`fatura_vencimento` em `pluggy_accounts` (lidos de `creditData` da Pluggy, antes descartado), criados na revisão pós-entrega da Sprint 9. Sem tabelas pré-calculadas — dashboards agregam por consulta direta (decisão fixa do projeto). Migrations via Alembic reversíveis (`0001` users, `0002` categorias, `0003` ativos/passivos, `0004` Pluggy, `0005` categorization_rules, `0006` campos de categorização/ativo em pluggy_transactions, `0007` excluir_de_totais + backfill de competência, `0008` apelido/sync_enabled + descrição editável, `0009` liability_id em pluggy_transactions, `0010` limite_credito/fatura_vencimento em pluggy_accounts).
- **Frontend (React/Vite):** dashboards com filtro ano/mês, cards Receita/Despesa/Saldo/Ativos/Passivos/Patrimônio com sparkline, drill-down em sanfona Receita/Despesa → Categoria (grupo) → Tipo (subcategoria) → lista de transações (nível "meio de pagamento" removido na Sprint 9, vira ícone ao lado do valor; nível Categoria>Tipo adicionado na revisão pós-entrega, com cores distintas por nível), drill-downs de Ativos (toggle despesa/receita)/Passivos (só despesa)/Saldo por conta (snapshot atual, fatura+limite para cartão de crédito), tabelas ordenáveis por coluna (incl. %), tooltip nos gráficos de tendência/sparkline, eixo X por trimestre, gráficos via Recharts (Sprint 5, primeira tela com identidade visual real — ver [DESIGN.md](../../DESIGN.md)), telas de setup (futuro), gestão de categorias/passivos pela UI (futuro — CRUD de ativos já existe desde a Sprint 8), login Google, perfil/logout (futuro), conexão de conta bancária e listagem de transações Pluggy (Sprint 3), fila de revisão de categorização (Sprint 4) — abas em `ProtectedPage`. Data-fetching via TanStack Query. Estrutura: `src/pages/`, `src/api/`, `src/hooks/`, `src/components/`, `src/pluggy/`, `tests/`.
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
- **Paginação e filtro em `list_pending_transactions()`** (pós-Sprint 6, 2026-08-15): aceita `ano`/`mes` (filtro sobre `data`) e `page`/`page_size` (default 20, máx. 100), retorna `(items, total)`. Antes recalculava sugestão pra fila inteira a cada chamada — com centenas de pendências reais, cada refetch após um "Confirmar" levava vários segundos mesmo já com o fix de N+1 da Sprint 5 (regras/histórico/ativos buscados uma vez por chamada, mas ainda uma vez *por pendência inteira*, não por página). Paginar limita o recálculo ao tamanho da página; validado contra 929 pendências reais na VM de dev — refetch completo pós-confirmação caiu de vários segundos para ~250ms.
- **Endpoints:** `GET /categorization/pending?ano=&mes=&page=&page_size=` (resposta `{items, total, page, page_size}`), `POST /categorization/pending/{id}/confirm`, `PUT /categorization/pending/{id}/asset` — isolados por `user_id`, mesmo padrão de `assets`/`pluggy_*`.
- **Import do legado:** `backend/scripts/import_legacy_categorization_rules.py --user-email <email>` lê `backend/scripts/data/semente-classificacao.json` (328 regras entregues pelo CEO), resolve `"Grupo/Subcategoria"` contra a taxonomia já importada (case-insensitive), upsert por `(user_id, padrao_normalizado)` — conflito loga e não sobrescreve, categoria não resolvida loga e pula.
- **Frontend:** `CategorizationReviewPage` (fila de pendentes com sugestão pré-preenchida, confirmar categoria, associar/limpar ativo, filtro ano/mês + paginação Anterior/Próxima — mesmo padrão visual `.dash-filter` da `DashboardsPage`, pós-Sprint 6), aba "Categorizar" em `ProtectedPage`. Pré-requisitos criados na Sprint 4: `api/categories.ts` (+`useCategoryGroups`/`useSubcategories`) e `api/assets.ts` (+`useAssets`), antes inexistentes no frontend.
- **Fora de escopo desta sprint:** herança de regras entre usuários (schema já preparado via `origem`), camadas de token distintivo/IDF e léxico PT-BR, estado "pular" na fila, cálculo automático de competência de receita — ver [PRD-004](../prd/PRD-004-categorizacao-automatica.md).

## Dashboards core (Sprint 5)

- **`data_competencia`:** gravada em `_upsert_transaction` (`app/pluggy_integration/service.py`) igual a `data` a cada sync (novo ou re-sync); backfill via migration `0007` para transações já sincronizadas antes desta sprint. Toda agregação de dashboards filtra por `data_competencia`, nunca por `data`.
- **Exclusão de transferências internas:** `category_groups.excluir_de_totais` (bool, migration `0007` seta `true` só para o grupo "Transferência interna"). Toda query de agregação em `app/dashboards/service.py` faz `outerjoin` até `CategoryGroup` e filtra `excluir_de_totais IS NOT TRUE` — uma transação sem subcategoria (não categorizada) não é afetada, só entra no bucket "Não categorizado".
- **Sinal do saldo de `cartao_credito`:** confirmado empiricamente contra dado real da VM de dev (não a partir da documentação pública da Pluggy) — `saldo` positivo representa dívida (valor devido), não ativo. Cross-checado contra as próprias transações da conta: `debito` (compras) somam positivo, `credito` (pagamentos/estornos) somam negativo. Por isso `patrimonio` soma saldos de `corrente`/`poupanca`/`investimento` e **subtrai** saldos de `cartao_credito`.
- **Sentinel `SEM_CATEGORIA_ID = 0`:** convenção compartilhada entre backend (`app/models/category.py`) e frontend (`api/dashboards.ts`) para representar "sem subcategoria atribuída" em `subcategory_id`/`categoria_id` — tanto na resposta de `/dashboards/por-categoria` quanto nos filtros de `/dashboards/por-meio-pagamento` e `/pluggy/transactions`. IDs reais de subcategoria começam em 1, então `0` nunca colide.
- **Endpoints (`app/dashboards/`):** `GET /dashboards/summary?ano=&mes=` (receita/despesa/saldo — filtrados por período; `patrimonio` é sempre snapshot atual, ignora o filtro), `GET /dashboards/por-categoria?tipo=debito|credito&ano=&mes=` (agrupado por grupo/subcategoria), `GET /dashboards/por-meio-pagamento?tipo=&ano=&mes=&categoria_id=` (agrupado por `pluggy_accounts.tipo`). Todos isolados por `user_id`, agregação via `func.sum`/`group_by` direto — sem cache nem tabela pré-calculada.
- **Filtros novos em `GET /pluggy/transactions`:** `ano`, `mes`, `subcategory_id`, `account_tipo`, `competencia` (bool — quando `true`, `ano`/`mes` filtram por `data_competencia` em vez de `data`; usado pelo último nível do funil para bater com a base de agregação). Sem filtro nenhum, comportamento idêntico ao anterior à Sprint 5.
- **Frontend — primeira identidade visual real do projeto:** direção escolhida com o CEO via fluxo `new-work` do Impeccable (comparação de esboços renderizados como artifacts — cupom fiscal / hypercard / SaaS clássico, depois variações do registro SaaS fintech). Tokens em `frontend/src/index.css` (cores, tipografia, espaçamento) — ver [DESIGN.md](../../DESIGN.md) para o sistema completo. `DashboardsPage.tsx`: filtro ano/mês, 4 cards de resumo (Receita/Despesa clicáveis, Saldo e Patrimônio estáticos — Patrimônio rotulado "atual" para não sugerir que varia com o filtro), funil de drill-down com gráficos Recharts + lista acessível por teclado.
- **`/impeccable audit`** rodado como gate antes de fechar a sprint — inicialmente por revisão de código contra os 5 eixos (a11y, performance, theming, responsivo, integridade de implementação), já que o ambiente Windows não tem Docker/WSL2/`chromium-cli`. 2 achados corrigidos nessa passada (touch targets abaixo de 44px, filtro sem `flex-wrap`). Detector mecânico (`detect.mjs`) sem achados. Feedback visual real do CEO pós-deploy revelou uma lacuna maior — `ProtectedPage` (nav/shell) nunca recebeu os tokens novos, só `DashboardsPage` — resolvida com `scripts/browser-check/` (Playwright/Chromium headless, ferramenta própria do CTO, ver seção abaixo), que encontrou 2 bugs visuais reais (herança de `line-height` percentual sobrepondo texto de heading; overflow de nav mobile) invisíveis a lint/testes. Ver [SPRINT-005-dashboards-core-report.md](../sprints/SPRINT-005-dashboards-core-report.md) para o relato completo.

### Ferramenta de QA visual (`scripts/browser-check/`)

Playwright + Chromium headless, instalada como ferramenta própria do CTO
(fora do `package.json` do frontend — mesmo padrão de `.venv-ssh/` para
SSH), disponível para toda sprint futura com trabalho visual. `check.mjs`
(genérico: navega, tira screenshot, reporta erros de console),
`check-dashboard.mjs` (fluxo autenticado específico do app: início →
dashboards → drill-down, desktop + mobile), `check-sanfona.mjs` (Sprint 6:
expande múltiplos níveis da sanfona — categoria + meio de pagamento — e
captura desktop/mobile), `check-categorizacao.mjs` (pós-Sprint 6: mede o
tempo real de navegação de página na fila de Categorização) e
`check-sprint7.mjs` (filtro tipo/status, seleção em lote, descrição
editável e Gestão de Contas — apelido, diálogo de sincronização; ações que
mutariam dado real são canceladas via Escape/"Cancelar" antes do
screenshot). Sessão
autenticada via token gerado por
`app.auth.jwt.create_access_token` rodado dentro do container da API na VM
de dev (mesmo mecanismo de uma sessão pós-login Google real, nunca uma
credencial nova ou bypass de auth). Screenshots em
`scripts/browser-check/shots/` — gitignored (podem conter dado financeiro
real).

## Dashboards analíticos (Sprint 6)

- **Tendência:** `app/dashboards/service.py` ganha `get_tendencia()` (série
  mensal receita/despesa/saldo) e `get_tendencia_por_categoria()` (mesma
  série, agrupada por subcategoria) — cada uma numa única query agregada
  por `(ano, mês)` extraído de `data_competencia`, evitando N chamadas por
  mês/categoria. Período é sempre os últimos N meses (3/6/12,
  parametrizável) **terminando no mês filtrado no dashboard**, não no mês
  corrente do calendário; meses sem transação aparecem com zero, nunca
  ausentes da série.
- **Percentual:** `get_por_categoria`/`get_por_meio_pagamento` ganham campo
  `percentual` (`Decimal`, 0–100, 2 casas) — fração da linha sobre a soma
  de todas as linhas da mesma resposta; denominador zero retorna `0`, nunca
  erro. Linha de extrato (transação individual) não tem endpoint próprio de
  percentual — calculado no frontend contra o total do meio de pagamento já
  conhecido do passo anterior do drill.
- **Endpoints novos:** `GET /dashboards/tendencia?ano=&mes=&meses=`,
  `GET /dashboards/por-categoria/tendencia?tipo=&ano=&mes=&meses=`. Mesmo
  padrão de isolamento por `user_id` dos demais endpoints de `/dashboards/*`.
  Nenhuma tabela nova, nenhuma migration — agregação por consulta direta,
  mesma decisão fixa do projeto.
- **Frontend — sanfona:** `DashboardsPage.tsx` reestruturado — estado de
  expansão independente por categoria (`expandedCategorias: number[]`) e
  por meio de pagamento dentro de cada categoria
  (`expandedMeios: Record<number, string[]>`), em vez do estado único
  `drill` de tela-substitui-tela da Sprint 5. Cada nível aninhado é seu
  próprio componente (`CategoriaAccordion` → `MeioPagamentoAccordion` →
  `TransacoesPanel`) que só busca dado quando montado — o `enabled` do
  `useQuery` fica implícito na árvore de componentes, não um flag manual.
  Botão "Fechar" no cabeçalho do funil substitui o antigo "← Voltar".
- **Tipografia própria:** par Archivo (display/headline, 600/700) + Public
  Sans (body/label, 400/600), escolhido pelo CEO via comparação visual real
  (3 pares renderizados como Artifact com conteúdo real do dashboard — cada
  fonte baixada do Google Fonts, subset `latin`, e re-hospedada localmente
  em `frontend/public/fonts/*.woff2`, licença OFL, sem CDN em produção).
  `--font-display`/`--font-body` novos em `index.css`; `--sans` passa a
  apontar para `--font-body`. `.dash-page` alargado de `880px` para
  `1440px`.
- **Achado real de QA visual:** `.dash-table` (linha de extrato) não tinha
  wrapper com `overflow-x`, cortando a coluna `%` em telas de 390px em vez
  de rolar; e a linha da sanfona (6 elementos: chevron/nome/tendência/
  barra/valor/%) ficava apertada demais no mesmo viewport, cortando o
  percentual. Ambos só detectáveis com o app renderizado de verdade — nem
  lint, nem `tsc`, nem os 28 testes Vitest pegam layout/overflow visual.
  Corrigidos e revalidados via `check-sanfona.mjs` contra a VM de dev.

## Categorização (rework) e Gestão de Contas (Sprint 7)

- **`descricao_usuario`/`descricao_sugerida`/`descricao_sugestao_origem_id`
  em `pluggy_transactions`:** descrição exibida passa a ser
  `descricao_usuario ?? descricao` (raw, nunca sobrescrito por sync).
  Editar a descrição de uma transação grava `descricao_usuario` de
  imediato nela e propaga uma **sugestão pendente** (`descricao_sugerida`
  + `descricao_sugestao_origem_id`) para toda outra transação do mesmo
  usuário com descrição normalizada idêntica (`normalize_description`,
  match exato — não a similaridade `>=0.86` usada para sugestão de
  categoria) **e** mesma categoria (confirmada ou sugerida) da transação de
  origem. Candidata com sugestão pendente não é sobrescrita por uma
  segunda origem concorrente ("a primeira grava, a segunda não
  sobrescreve"). Aceitar/descartar por linha via
  `POST .../description/confirm`/`.../dismiss` — nunca aplicado
  automaticamente.
- **`apelido`/`sync_enabled` em `pluggy_accounts`:** `apelido` é o nome
  exibido quando setado (nunca sobrescrito por `_upsert_account` num
  resync — mesma regra de `descricao_usuario`); `sync_enabled=false` faz
  `sync_item`/`sync_items` pular a conta inteira (nem saldo nem
  transações são atualizados), mecanismo de "remover da lista de sync" e
  fonte da pré-seleção do diálogo de sincronização unificada.
- **`app/categorization/service.py`:** `list_pending_transactions` vira
  `list_transactions(status, tipo, ano, mes, page, page_size)` —
  `status` (`pendente`/`confirmada`/`todas`, default `todas`) e `tipo`
  (`debito`/`credito`) filtram a query; sugestão só é recalculada para as
  linhas pendentes da página retornada (confirmadas não precisam). Rotas
  `/categorization/pending/*` renomeadas para `/categorization/transactions/*`
  sem shim de compatibilidade. `confirm_categorization` vira `set_category`
  (sem trava de status — já podia reeditar categoria confirmada antes
  desta sprint, só não tinha nome que refletisse isso). `bulk_confirm`
  processa uma lista de `{transaction_id, subcategory_id}` e reporta
  sucesso/falha por item — uma linha inválida (categoria inexistente,
  transação de outro usuário) não bloqueia as demais.
- **`app/pluggy_integration/service.py`:** `update_account` (apelido +
  sync_enabled); `sync_items(item_ids)` sincroniza vários itens (ou todos
  do usuário se `item_ids` omitido) reaproveitando `sync_item`, reporta
  sucesso/falha por item. `sync_item` pula contas com `sync_enabled=False`
  antes de tocar em saldo/transações.
- **Frontend — `CategorizationReviewPage.tsx` vira a listagem única** de
  transações (filtro `status=todas` cobre o que `TransactionsPage.tsx`
  oferecia — página removida): filtro tipo/status, seleção em lote +
  "Aprovar marcadas", categoria editável em linha confirmada (select
  dispara `set_category` direto, sem botão extra), descrição inline
  (clique no texto abre edição; nota "N itens com sugestão pendente" +
  aceitar/descartar por linha).
- **Frontend — `AccountManagementPage.tsx`** (renomeia
  `ConnectAccountPage.tsx`, aba "Gestão de contas"): lista contas
  conectadas (não só items) com apelido editável e toggle de
  `sync_enabled`; botão único "Sincronizar MeuPluggy" abre diálogo com
  contas pré-marcadas a partir do `sync_enabled` persistido, aguardando
  confirmação antes de rodar `POST /pluggy/sync`.
- **`frontend/src/utils/format.ts`:** `formatCurrency` extraído de
  `DashboardsPage.tsx` para util compartilhado, aplicado também na fila
  de Categorização e Gestão de Contas.
- **Achado real de QA visual:** sem teto de largura, os `<select>` de
  categoria/ativo (nomes de subcategoria longos) e o botão de descrição
  empurravam a linha da tabela de Categorização para além de 1440px — o
  botão "Confirmar" ficava invisível fora da área rolável de
  `.dash-table-wrap`, sem nenhum indício visual de que havia mais
  conteúdo à direita. Só detectável com o app renderizado de verdade
  (`scripts/browser-check/check-sprint7.mjs`, novo); corrigido com
  `max-width`/`text-overflow: ellipsis` nos selects/botão/input da tabela.
- **Migration `0008`** (reversível): campos acima + seed idempotente da
  subcategoria "Aluguel" sob o grupo "Receitas" (distinta da despesa
  "Aluguel" já existente sob "Moradia").

## Gestão de Ativos (Sprint 8)

- **`app/dashboards/service.py` e `router.py`:** `get_por_ativo(db, user_id, *, tipo, ano=None, mes=None)` com dataclass `AtivoTotal` — sums transações do `tipo` pedido (despesa ou receita, escolhido via toggle na UI — ver revisão de escopo abaixo) agregadas por `Asset` via `JOIN PluggyTransaction.asset_id == Asset.id` (inner join — sem bucket "sem ativo", ver decisão abaixo), filtradas por período. Novo `get_tendencia_por_ativo(db, user_id, *, tipo, ano, mes, meses=6)` com dataclass `TendenciaAtivo` — série mensal por ativo, zero-preenchida nos meses sem transação, mesmo padrão de `get_tendencia_por_categoria`. Endpoints: `GET /dashboards/por-ativo?tipo=&ano=&mes=` (`tipo` obrigatório) e `GET /dashboards/por-ativo/tendencia?tipo=&ano=&mes=&meses=`, ambos isolados por `user_id`. **Decisão de design:** sem bucket "sem ativo" — a maioria das transações não tem `asset_id`, é esperado, não uma pendência de revisão (conforme PRD-008 §Regras de negócio).
- **Investigação de risco (tarefa 3 do plano):** FK `pluggy_transactions.asset_id` e `asset_sugerido_id` → `assets.id` não tem cláusula `ON DELETE` (verificado em migration `0006_add_categorization_and_asset_fields_to_pluggy_transactions.py` e model); em Postgres, `DELETE` geraria IntegrityError se deixado. Implementado como regra de negócio explícita: `delete_asset` passa a desassociar (seta `asset_id`/`asset_sugerido_id` para `NULL` em toda transação do usuário apontando pro ativo) antes de deletar — transação nunca é excluída, só desvinculada, preservando histórico íntegro.
- **`app/pluggy_integration/service.py` e `router.py`:** parâmetros opcionais `asset_id` e `tipo` novos em `list_transactions`/`GET /pluggy/transactions`, mesmo padrão de `subcategory_id`/`account_tipo` — alimentam o nível "linha de extrato" do drill-down de gasto por ativo, escopado ao mesmo `tipo` do toggle para bater com o total agregado.
- **Componente `PeriodFilter` extraído:** `frontend/src/components/PeriodFilter.tsx` — mês/ano selects, eliminando duplicação. Reaproveitado por `DashboardsPage`, `CategorizationReviewPage` e nova `AssetsPage` — ambas as telas existentes migraram, testes passam sem mudança de assertion (refatoring puro).
- **`frontend/src/pages/AssetsPage.tsx` nova:** grid de `.dash-tile` cards para ativos ativos, filtro período (escopa só drill-down, não listagem de cards), toggle Despesa/Receita (`.dash-toggle`, `aria-pressed`) que escolhe o `tipo` usado tanto na sparkline de cada card quanto no drill-down, formulário criar/editar (diálogo inline, nome/tipo/valor_atual/data_aquisição, padrão `AccountManagementPage`), ação vender (diálogo `valor_venda`/`data_venda`), delete com `window.confirm`. Seção "Baixados" separada (`.dash-tile.baixado`, opacidade 0.55, sem drill-down/sparkline, mostra `valor_venda`/`data_venda`). Aba "Ativos" nova em `ProtectedPage.tsx` (`Tab`, `NAV_ITEMS`, render condicional).
- **Revisão de escopo (pedido do CEO após entrega inicial):** o drill-down de gasto, inicialmente expandido dentro do próprio card, foi movido para um painel `.dash-funnel` abaixo da grid — mesmo padrão visual do funil de Dashboards — e ganhou toggle Despesa/Receita (PRD-008 originalmente previa só despesa; passa a cobrir os dois tipos) mais um gráfico de linha (`AssetTrendChart`, Recharts, 6 meses) dentro do painel e uma sparkline (`CardSparkline`, mesmo padrão de `DashboardsPage`) em cada card, ambos reagindo ao toggle a partir de uma única chamada bulk a `/dashboards/por-ativo/tendencia` (evita N+1 de uma chamada por card).
- **API/hooks novos:** `api/assets.ts` (`createAsset`/`updateAsset`/`sellAsset`/`deleteAsset`), `api/dashboards.ts` (`fetchDashboardPorAtivo`/`fetchDashboardPorAtivoTendencia`, ambos com `tipo`), `api/pluggy.ts` (parâmetros `assetId`/`tipo`), `api/client.ts` (fixo para handle 204 No Content — necessário para `deleteAsset`, antes não testado). Hooks: `useCreateAsset`, `useUpdateAsset`, `useSellAsset`, `useDeleteAsset`, `useAssetGastos` (GET /dashboards/por-ativo, agora com `tipo`), `useAssetGastosTendencia` (GET /dashboards/por-ativo/tendencia), `usePluggyTransactions` estendido com `assetId`/`tipo`.
- **QA visual (`scripts/browser-check/check-ativos.mjs`):** grid de cards, criar ativo, abrir drill-down fora do card, alternar toggle Despesa/Receita, screenshots desktop+mobile; ações que mutariam canceladas (sem side-effects em dado real além do ativo criado para inspeção). Um bug de locator obsoleto foi encontrado e corrigido durante a primeira rodada de QA (commit bca449f), e a segunda revisão (toggle) exigiu um ajuste de seletor por ambiguidade `role=button name="Fechar"` vs `"Fechar gasto"` (commit 72512d1).
- **Testes backend:** `test_dashboards_service.py`/`test_dashboards_endpoints.py` (vazio, sem transação vinculada, filtro por `tipo`, isolamento, `tendencia_por_ativo` zero-preenchida), `test_pluggy_endpoints.py` (filtro `asset_id`/`tipo` combinados, isolamento), `test_asset_service.py`/`test_asset_endpoints.py` (delete com transações vinculadas, disassociação, 401s). Cobertura: `assets/*` 100%, `dashboards/*` 100%, `pluggy_integration/*` 99%, `schemas/*` 100%.
- **Testes frontend:** `AssetsPage.test.tsx` (listar ativos/baixados, criar, editar, vender + idempotência 400, delete, drill-down fora do card, toggle despesa/receita refazendo as chamadas com o `tipo` certo, sparkline no card quando há dado de tendência), `PeriodFilter.test.tsx`. Refactor de `DashboardsPage.test.tsx`/`CategorizationReviewPage.test.tsx` pós-extração — testes existentes passam sem mudança de assertion.
- **Nenhuma tabela/migration nova** — reaproveita `assets` (Sprint 2) e campos `asset_id`/`asset_sugerido_id` em `pluggy_transactions` (Sprint 4).

**Achados de QA:** 3 test assets criados na VM de dev (side effect de rodadas do script de QA); dev VM sem dados reais por design, leftover test data inspecionável, não requer ação (CEO pode deletar via UI se desejar).

## Ativos/Passivos no Dashboard (Sprint 9) — E6 fechado

- **`liability_id`/`liability_sugerido_id`/`liability_sugestao_confianca`
  em `pluggy_transactions` (migration `0009`):** espelha `asset_id`/
  `asset_sugerido_id`/`asset_sugestao_confianca` (Sprint 4) campo a campo —
  mesma heurística de sugestão automática (`suggest_liability`, substring
  da descrição normalizada contra o nome do passivo, confiança "media"),
  mesmo endpoint de confirmação manual (`PUT
  /categorization/transactions/{id}/liability`), mesmo filtro
  (`liability_id`) em `GET /pluggy/transactions`.
- **`delete_liability` desassocia em vez de falhar:** mesmo achado da
  Sprint 8 (`delete_asset`) — FK `liability_id`/`liability_sugerido_id` →
  `liabilities.id` sem `ON DELETE`. Implementado junto da migration na
  mesma sprint (não como correção posterior): `DELETE /liabilities/{id}`
  seta `liability_id`/`liability_sugerido_id` para `NULL` em toda
  transação do usuário antes de excluir o passivo, transação nunca é
  excluída.
- **`app/dashboards/service.py`:** `_calcula_patrimonio` refatorado com
  helper `_ativos_e_passivos` (mesma soma que `get_summary` agora expõe
  separadamente, sem duplicar query). `get_summary`/`Summary` ganham
  `ativos`/`passivos` (mesmo filtro `status=ativo` que `_calcula_patrimonio`
  já usava). Novo `get_por_passivo(db, user_id, *, ano=None, mes=None)` e
  `get_tendencia_por_passivo(..., meses=6)` — mirror exato de
  `get_por_ativo`/`get_tendencia_por_ativo` (Sprint 8), mas **sem parâmetro
  `tipo`**: passivo nunca gera receita, sempre filtra `tipo=debito`
  internamente, não exposto ao chamador (diferente de `/por-ativo`, que
  aceita o toggle desde a Sprint 8). Novo `get_saldo_por_conta(db,
  user_id)` — sem `ano`/`mes`, sempre `PluggyAccount.saldo` atual (mesmo
  padrão conceitual do campo `patrimonio`, rotulado "atual" na UI; sem
  histórico de saldo no schema, mesma limitação das Sprints 5/6).
  Endpoints: `GET /dashboards/por-passivo`, `.../tendencia`, `GET
  /dashboards/saldo-por-conta`.
- **`account_tipo` em `PluggyTransactionOut`:** `@property` no model
  `PluggyTransaction` (lê `self.account.tipo`) — Pydantic v2
  `from_attributes` trata `@property` como atributo comum, menor diff que
  duplicar o campo. Toda linha de `/pluggy/transactions` passa a acessar
  `tx.account`, então `list_transactions` ganhou `joinedload(
  PluggyTransaction.account)` — sem isso seria N+1 real (uma query de
  conta por transação da página).
- **Frontend — funil sem nível "meio de pagamento":** meio de pagamento
  deixa de ser um nível do funil e passa a aparecer como
  `AccountTipoIcon` (SVG inline, `aria-hidden`, decorativo) dentro da
  célula Valor de cada linha de transação. Reverte uma decisão até então
  tratada como fechada em PRD-005/006 — decisão explícita do CEO na sessão
  de planejamento desta sprint. `useDashboardByMeioPagamento.ts` removido
  (órfão pós-refactor); `GET /dashboards/por-meio-pagamento` segue
  existindo no backend (não removido, só sem consumidor no frontend hoje).
- **Frontend — cards Ativos/Passivos/Saldo:** ao lado de
  Receita/Despesa/Saldo/Patrimônio já existentes. "Ativos" abre
  `AtivosAccordion` reaproveitando `useAssetGastos`/`useAssetGastosTendencia`
  (Sprint 8) sem alteração de backend, com toggle despesa/receita local ao
  drill-down. "Passivos" abre `PassivosAccordion` (novos hooks
  `useLiabilityGastos`/`useLiabilityGastosTendencia`), sem toggle — só
  despesa. "Saldo" (antes inerte desde a Sprint 5) abre
  `SaldoPorContaList` (`useSaldoPorConta`) — **ignora o filtro ano/mês**,
  mesmo padrão conceitual do card Patrimônio.
- **Frontend — componentes/hook compartilhados extraídos:**
  `CardSparkline.tsx`/`TrendChart.tsx` (de `DashboardsPage`/`AssetsPage`,
  que duplicavam o primeiro e agora precisam do segundo em 3+ lugares —
  mesmo gatilho de duplicação que motivou a extração de `PeriodFilter` na
  Sprint 8), `AccountTipoIcon.tsx` (4 SVGs inline), `useTableSort.ts`
  (hook genérico de ordenação por coluna, sem precedente). `AssetsPage.tsx`
  refatorada pra usar os componentes compartilhados — testes existentes
  passam sem mudança de assertion (refactor puro, mesmo padrão da
  extração de `PeriodFilter`).

### Revisão pós-entrega (mesma sessão, feedback do CEO)

CEO deu feedback ao ver o resultado real, antes de aprovar a sprint —
mesmo padrão da revisão de escopo da Sprint 8.

- **Funil de Despesa/Receita ganha um nível — Categoria > Tipo >
  Transação:** `GrupoAccordion` (novo, nível Categoria — agrupa por
  `CategoryGroup`) e `SubcategoriaAccordion` (novo, nível Tipo — agrupa
  por `Subcategory` dentro do grupo expandido) substituem o
  `CategoriaAccordion` de nível único da entrega inicial. Calculado
  inteiramente no frontend a partir do `GET /dashboards/por-categoria` já
  existente (cada linha já vem com `group_id`/`group_nome` junto do
  `subcategory_id`) — soma por grupo é só agregar client-side pelas linhas
  que compartilham `group_id`, sem endpoint novo. Percentual em cada nível
  é contra o total do nível acima (Categoria contra o total geral do tipo,
  Tipo contra o total da Categoria, transação contra o total do Tipo).
- **Paleta categórica nova (`frontend/src/utils/categoryColors.ts`):** 8
  matizes (`--cat-1`..`--cat-8` em `index.css`, light+dark), validados via
  skill `dataviz` (`scripts/validate_palette.js`) contra a superfície real
  do app — ΔE CVD adjacente ≥8.4, normal-vision ≥19.3 em ambos os modos.
  Categoria recebe cor por índice do `id` em ordem crescente entre **todos**
  os grupos do catálogo (`GET /category-groups`, não escopado ao período)
  — identidade estável, nunca por ranking do período (a mesma categoria
  não muda de cor mês a mês). Acima de 8 grupos (catálogo real do CEO tem
  mais, herdado do import do legado), o índice faz módulo 8 — grupos
  extras **compartilham** cor com um grupo anterior, aceito conscientemente
  em vez de um "Outros" cinza (risco documentado no PRD-009/roadmap). Tipo
  deriva um tint `color-mix(in oklch, <cor-do-grupo> <85|65|45|25>%,
  var(--surface))` — mistura com o token de superfície do próprio tema,
  então adapta claro/escuro automaticamente sem duplicar valores.
- **Ícone de meio de pagamento move pra dentro da célula Valor** (antes
  coluna própria à esquerda da tabela) — `.valor-cell` (flex, ícone +
  valor). Coluna % também vira `SortableHeader`.
- **Tooltip e eixo X:** `CardSparkline` (sparkline dos cards) ganha
  `<Tooltip>` — não tinha nenhum antes, só o `TrendChart` (drill-downs)
  tinha. `TrendChart` troca `interval="preserveStartEnd"` por um
  `tickFormatter` que só rotula os meses de início de trimestre (jan/abr/
  jul/out, `mes % 3 === 1`) — o ponto de dado continua mensal, só o rótulo
  do eixo fica mais enxuto; a legenda no tooltip mantém o mês exato.
- **Saldo de cartão de crédito — investigação de payload real:** inspeção
  do JSON bruto de `GET /accounts` (Pluggy, via `PluggyClient` chamado
  direto no container da API) para o cartão real do CEO confirmou
  `balance` = `creditData.disaggregatedCreditLimits[].usedAmount` (dívida
  total), **não** o limite — reafirma o achado da Sprint 5, que já estava
  correto (a leitura do CEO de que a tela mostrava "limite" não batia com
  o payload). O card "Saldo" passa a mostrar, para cartão de crédito, a
  soma dos débitos da conta numa janela auto-contida
  `(fatura_vencimento - 1 mês, fatura_vencimento]` — aproximação da
  fatura atual não paga, já que a Pluggy retornou `balanceCloseDate: null`
  no payload real e o client atual não chama nenhum endpoint de bill/
  invoice — com o limite de crédito (`creditData.creditLimit`) entre
  parênteses. Sem `fatura_vencimento` conhecido (conector não trouxe
  `creditData`), cai de volta pro saldo bruto (comportamento anterior).
  **Migration `0010`:** `limite_credito`/`fatura_vencimento` novos em
  `pluggy_accounts`, persistidos em `_upsert_account` a partir de
  `creditData.creditLimit`/`creditData.balanceDueDate` — campos que já
  chegavam no payload do sync e eram descartados. `_calcula_patrimonio`
  (cálculo de patrimônio) **não muda** — continua usando o `saldo` bruto
  da conta, comportamento validado desde a Sprint 5; só a exibição no
  card "Saldo" passa a usar a fatura calculada.
- **QA visual (`scripts/browser-check/check-sprint9.mjs`):** script da
  entrega inicial testava o funil de nível único; atualizado pra expandir
  Categoria e depois Tipo antes de chegar na tabela, e passou a validar o
  ícone dentro de `.valor-cell`, a coluna % ordenável e o limite de
  crédito (`.amt-detail`) no card do cartão. Confirmado contra dado real
  da VM de dev sem erros de console, incluindo o resync do item Pluggy
  real do CEO pra popular `limite_credito`/`fatura_vencimento` antes da
  validação. `check-sanfona.mjs` (Sprint 6) segue removido — testava
  exatamente o nível "meio de pagamento" que esta sprint eliminou (não o
  agrupamento Categoria/Tipo, que é um nível diferente).
- **Nenhuma tabela nova.** `liabilities` (Sprint 2) e `pluggy_transactions`
  (Sprint 3+) reaproveitados; migrations `0009` (liability) e `0010`
  (creditData) acima.

## Revisão de UX e Gestão de Passivos (Sprint 10)

Sprint cross-epic disparada por 8 ajustes que o CEO levantou usando o app
na prática pós-Sprint 9 (não coberta por PRD anterior) — ver
[PRD-010](../prd/PRD-010-revisao-ux-e-passivos.md).

- **Investigação NuTag — achado sistêmico, não isolado:** consulta via SSH
  às transações reais do usuário confirmou que `tipo` está correto
  (`PluggyTransaction.tipo` já reflete fielmente o dado bruto da Pluggy);
  o problema real é que a agregação de receita/despesa (`_sum_tipo`/
  `_base_query` em `app/dashboards/service.py`) somava toda transação
  `tipo=credito` como receita, sem considerar o tipo de conta. Em conta de
  **cartão de crédito**, `credito` é **sempre** pagamento de fatura ou
  estorno/reversão de compra — confirmado empiricamente (100% das 43
  transações `cartao_credito`+`credito` da conta real do CEO têm `valor`
  negativo, contra 100% dos `debito` com `valor` positivo, mesma
  convenção de sinal já validada na Sprint 5 para saldo/fatura), nunca
  receita real. NuTag era só o caso mais visível (pedágio recorrente);
  o mesmo padrão afetava "Pagamento recebido" (-R$31.119 histórico),
  estornos de NuPay, IOF de assinatura, créditos de devolução de compra
  etc. **Fix:** `_base_query` passa a excluir `cartao_credito`+`credito`
  da agregação de receita/despesa — filtro de query, **sem mutar dado
  bruto** (flipar `tipo` nas linhas quebraria o cálculo de fatura/saldo
  já validado, que depende do sinal de `credito` nesse tipo de conta).
  Decisão de escopo (confirmada com o CEO durante a execução, dado que a
  causa raiz não era isolada como o PRD original assumia): aplicar a
  correção sistêmica completa agora, não só nas linhas de NuTag.
- **`asset_categorization_rules` (migration `0011`):** mirror exato de
  `categorization_rules` trocando `subcategory_id` por `asset_id`.
  `suggest_asset`/`suggest_asset_from_index` (`app/categorization/
  engine.py`) reescritos pro mesmo padrão de 3 camadas de
  `suggest_category` (regra exata > histórico confirmado exato >
  similaridade `difflib >= 0.86`) — antes era só "contains" simples.
  Tabela começa vazia (diferente de `categorization_rules`, que já tem
  328 regras herdadas do v1); a sugestão de ativo depende mais da camada
  de histórico até o usuário confirmar itens suficientes.
- **`has_asset`/`group_id` em `GET /categorization/transactions`:**
  filtros independentes e combináveis com os já existentes
  (`status`/`tipo`/`ano`/`mes`, todos `AND`). `group_id` filtra pela
  subcategoria pertencer ao grupo (join direto `Subcategory.group_id`,
  sem precisar de `CategoryGroup`).
- **`GET /dashboards/patrimonio/breakdown`:** expõe as 4 partes que
  `_calcula_patrimonio` já somava internamente (ativos, passivos, saldo
  de contas não-cartão, saldo de cartões) — `_calcula_patrimonio`
  refatorado com helper `_patrimonio_breakdown` (mesmo padrão de reuso de
  `_ativos_e_passivos` na Sprint 9), nunca diverge do `patrimonio` de
  `GET /dashboards/summary`.
- **`PluggyTransactionOut` ganha `descricao_usuario`/`descricao_sugerida`/
  `subcategoria_sugerida_id`/`asset_id`/`asset_sugerido_id`** — campos que
  já existiam no model desde a Sprint 4/7, mas nunca eram expostos por
  `GET /pluggy/transactions`; necessário pra edição inline funcionar nos
  drill-downs do Dashboard/Ativos/Passivos (que usam esse endpoint, não
  `/categorization/transactions`, por causa dos filtros específicos de
  cada drill-down — `subcategory_id`/`asset_id`/`liability_id`/
  `competencia`).
- **Frontend — componentes de edição compartilhados
  (`TransactionEditCells.tsx`):** `DescriptionCell`/`CategorySelectCell`/
  `AssetSelectCell` extraídos de `CategorizationReviewPage.tsx`,
  reaproveitados em `TransacoesPanel` (Dashboard) e nos drill-downs de
  Ativos/Passivos (`AssetDrilldown`/`LiabilityDrilldown`). `CategorySelectCell`
  fica de fora da extração em `CategorizationReviewPage` — a fila de
  pendentes tem um workflow de confirmação em lote (seleção não salva
  sozinha, fica pendente de "Confirmar"/aprovação em lote) que diverge do
  auto-save do componente compartilhado; forçar essa asimetria dentro do
  componente compartilhado teria sido uma abstração vazando, não uma
  simplificação real.
- **Mutations de edição de transação invalidam o Dashboard também:**
  `useSetCategory`/`useSetTransactionAsset`/`useUpdateDescription`/
  `useSetTransactionLiability` passam a chamar
  `invalidateAfterTransactionEdit` (novo `hooks/invalidateDashboardQueries.ts`)
  — invalida `categorizationTransactions`/`pluggyTransactions` mais
  qualquer query cuja chave comece com `"dashboard"` ou seja
  `"saldoPorConta"` (via `predicate`, não lista fixa) — uma edição feita a
  partir do drill-down do Dashboard atualiza a própria tela sem F5.
- **`CardSparkline.tsx`:** prop `values: number[]` → `pontos:
  {ano,mes,total}[]` (mesmo formato de `PontoTendencia`/`TrendChart`).
  Tooltip mostrava `"v:"` (nome da série interno) sem mês/ano; agora
  mostra `"MM/AAAA"` (via `XAxis dataKey` + `name="Valor"` no `<Line>`,
  sem `labelFormatter` suprimindo o rótulo), `itemStyle`/`labelStyle`
  com `fontSize: 12` explícito (consistente com `TrendChart`).
- **`DashboardsPage.tsx` — card Patrimônio clicável:** novo
  `PatrimonioBreakdownPanel` (tabela de 4 linhas + total, cada linha
  linkando pro drill-down já existente de Ativos/Passivos/Saldo via
  `abrirFunil`, sem duplicar UI).
- **`LiabilitiesPage.tsx` nova** (mirror 1:1 de `AssetsPage.tsx`) — o
  backend de CRUD (`app/liabilities/`) já existia completo e testado
  desde a Sprint 2, só nunca tinha ganhado UI. Sem toggle despesa/receita
  (passivo é sempre débito) e sem `data_aquisicao`; ação "Quitar"
  (confirmação via `window.confirm`, sem form) no lugar de "Vender".
- **`CategorizationReviewPage.tsx`:** filtros novos "associado a ativo"
  (todos/sim/não) e "categoria" (grupo, dropdown); `TransactionTipoIcon`
  novo (mesmo padrão visual de `AccountTipoIcon` — SVG inline 14x14,
  `aria-hidden`) ao lado do valor de cada linha, indicando débito/crédito
  — reduz a chance da confusão do NuTag se repetir.
- **`ProtectedPage.tsx` — nav:** aba "Início" (stub sem dado próprio)
  removida, "Dashboards" vira a aba inicial; aba "Passivos" nova; "Gestão
  de Contas" move pro final. Ordem final: Dashboards, Categorizar,
  Ativos, Passivos, Gestão de Contas.
- **QA visual (`scripts/browser-check/check-sprint10.mjs`):** confirmado
  contra dado real da conta do CEO na VM de dev — nav sem Início/com
  Passivos/ordem final, tooltip do sparkline mostrando "05/2026" (não
  "v:"), breakdown de Patrimônio com as 4 partes batendo com o total,
  controles de edição inline presentes no drill-down do Dashboard
  (verificados só por presença — os selects salvam ao trocar, sem
  diálogo de confirmação, então o script nunca dispara `onChange`
  neles), filtros novos de Categorização, CRUD+drill-down de Passivos
  (único mutador do script, desfeito no final). Confirmação empírica do
  fix do NuTag: Receita de agosto/2026 caiu de um valor inflado por
  pagamento de fatura/estornos de cartão pra R$56,40 (só receita real).
- **Migration `0011`** (reversível): `asset_categorization_rules` nova.
  Nenhuma mudança de schema em `PluggyTransaction`/`Asset`/`Liability` —
  todos os campos usados já existiam desde Sprint 4/9. Correção do NuTag
  não precisou de migration nem `UPDATE` em dado — é fix de lógica de
  agregação, não de dado armazenado.

## Categorização: tabela moderna (Sprint 11)

- **`CategoryCombobox.tsx` novo** (`frontend/src/components/`): combobox
  buscável, controlado (`value`/`onChange`, sem mutation própria),
  substituindo o `<select>` nativo de 51 subcategorias em duas telas.
  Popup renderizado via `createPortal(document.body)` com
  `position: fixed`, posicionado a partir de `getBoundingClientRect()` do
  trigger — necessário porque `.dash-table-wrap` (onde o combobox sempre
  vive) é `overflow-x: auto`, e um popup `position: absolute` normal seria
  cortado no scroll horizontal da tabela. Fecha em scroll (qualquer
  ancestral, `capture: true`) em vez de reposicionar, mantendo o
  componente simples. Padrão ARIA combobox+listbox completo
  (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, popup
  `role="listbox"`/`role="option"`, cabeçalhos de grupo `role="presentation"`
  não navegáveis). Filtro por digitação normaliza acento/maiúscula
  (`.normalize("NFD")` + strip de combining marks) e casa contra nome da
  subcategoria **e** do grupo. Estado do item ativo é derivado
  (`activeOverride` + `useMemo`, não um `useEffect` chamando `setState`)
  para não cair na regra de lint `react-hooks/set-state-in-effect`.
- **Gotcha de implementação — blur fantasma fechava o popup antes do
  clique aplicar:** clicar num `<li role="option">` (não focável) dispara
  blur no `<input>` do combobox no jsdom (e em navegadores reais), porque
  o foco não tem mais onde ficar; o handler de `onBlur` fechava o popup
  (desmontando a opção via portal) antes do evento `click` alcançá-la —
  `onChange` nunca era chamado. Fix padrão de qualquer combobox/listbox
  real (Downshift, Radix, Reach UI): `onMouseDown={(e) => e.preventDefault()}`
  em cada opção, suprimindo a mudança de foco que dispara o blur.
- **`TransactionEditCells.CategorySelectCell`** passa a usar
  `CategoryCombobox` por dentro, API externa e mutation imediata via
  `useSetCategory` inalteradas — os 3 consumidores existentes (drill-downs
  de Dashboard/Ativos/Passivos) ganham o combobox automaticamente, sem
  tocar nesses call sites.
- **`CategorizationReviewPage.tsx`:** `<select>` inline trocado pelo
  mesmo `CategoryCombobox`, preservando o estado local bufferizado
  (`selectedSubcategory`) até confirmação individual/aprovação em lote.
  Status por linha (Pendente/Confirmada) vira um badge visual
  (`.status-badge--pending`/`--confirmed`, tokens `--border`/`--text` e
  `--accent`/`--accent-bg` — nunca a cor de despesa, One Meaning Rule).
  Tabela ganha classe aditiva `cat-review-table` (hover de linha,
  alinhamento da coluna de checkbox) sobre `.dash-table`, só nesta tela —
  as tabelas de drill-down continuam no nível "terminal" documentado no
  `DESIGN.md`.
- **`subcategoryLabel(subcategoryId, subcategories, groups)`** extraída
  pra `frontend/src/utils/transactionEdit.ts` — antes duplicada
  byte-a-byte em `TransactionEditCells.tsx` e
  `CategorizationReviewPage.tsx`.
- **Sem mudança de backend/API** — confirmado no PRD-011, mudança
  inteiramente de frontend.
- **Validação ao vivo (VM de dev) e `/impeccable audit` ficaram
  pendentes nesta sessão** — sem `FINANCEIRO_SESSION_TOKEN` disponível e
  sem Docker/Postgres/OAuth localmente (notebook/desktop sem Docker —
  ver [ssh-workflow.md](../infra/ssh-workflow.md)), não é possível rodar
  o app completo fora da VM de dev. `scripts/browser-check/check-categorizacao.mjs`
  foi atualizado (abre o combobox, filtra por digitação, seleciona por
  teclado, mede tempo de abertura, verifica o badge) e está pronto pra
  rodar contra a fila real assim que houver token — ver relatório da
  Sprint 11 para o plano de follow-up.

## Qualidade (Sprint 1 → Sprint 11)

- **Testes backend:** 297 testes, 98% cobertura total. Sprint 10 (100% em `app/dashboards/` e `app/categorization/`): `suggest_asset` mirror completo dos testes de categoria (regra > histórico exato > similaridade `>=0.86`, isolamento); `has_asset`/`group_id` isolados e combinados entre si e com filtros existentes; `get_patrimonio_breakdown` batendo exatamente com `summary.patrimonio`; `cartao_credito`+`credito` excluído da receita (o achado do NuTag) enquanto `corrente`+`credito` continua contando normalmente; `GET /dashboards/patrimonio/breakdown` isolado por usuário, 401 sem cookie. Auth (Sprint 1), dados mestres (Sprint 2, 97%), Pluggy (Sprint 3, 98%), categorização (Sprint 4, paginação/filtro ano-mes pós-Sprint 6) — ver histórico nos relatórios de sprint. Dashboards (Sprint 5+6, 100% em `app/dashboards/`): período vazio, período só com "Transferência interna" (totais zerados), misto débito/crédito, sinal do saldo de `cartao_credito` na fórmula de patrimônio, ativos/passivos inativos excluídos, borda de mês (`data_competencia` no limite entre meses), soma de `/por-categoria` batendo com `/summary`, isolamento entre usuários; tendência terminando no mês filtrado (não no calendário), mês sem transação aparecendo zerado, tendência por categoria com bucket "Não categorizado", percentual somando 100% (menos arredondamento) e retornando `0` com denominador zero. Categorização/Pluggy (Sprint 7, 99%): filtro status/tipo em todas as combinações, bulk-confirm parcial (linha inválida não bloqueia as demais), `set_category` em transação já confirmada, propagação de descrição (match normalizado + mesma categoria, isolamento por usuário, "primeira grava, segunda não sobrescreve"), `sync_item`/`sync_items` pulando conta com `sync_enabled=False`, `apelido` preservado em resync. Gestão de Ativos (Sprint 8, 100% em `app/assets/` e `app/dashboards/`): `get_por_ativo` filtrando por `tipo` (período vazio, ativo sem transação vinculada, isolamento), `get_tendencia_por_ativo` zero-preenchendo meses sem transação e isolado por `tipo`/usuário, filtro `asset_id`/`tipo` em `/pluggy/transactions` combinados com outros filtros, `delete_asset` desassociando transações vinculadas em vez de falhar. Ativos/Passivos no Dashboard (Sprint 9, 100% em `app/dashboards/`): `suggest_liability` (substring, isolamento, sem match), `set_transaction_liability` (sets/clears, 404 cross-user), `delete_liability` desassociando (crítico, mirror de `delete_asset`), `get_por_passivo`/`get_tendencia_por_passivo` (nunca soma crédito, zero-preenchida, isolamento), `get_saldo_por_conta` (apelido→nome, isolamento), `summary.ativos`/`summary.passivos` batendo com a mesma base de `patrimonio`, filtro `liability_id` combinado com outros filtros, `account_tipo` na resposta de `/pluggy/transactions`. Revisão pós-entrega: `_upsert_account` persistindo/deixando `None` os campos de `creditData`, `get_saldo_por_conta` de cartão somando a janela da fatura (limite, exclui fora da janela, nunca soma crédito, cai pro saldo bruto sem `fatura_vencimento`), `_subtract_month` (rollover de ano, clamp de dia).
- **Testes frontend:** 109 testes (Vitest + Testing Library) — renderização condicional, tratamento de 401, mock fetch, widget Pluggy Connect mockado. Sprint 11: `CategoryCombobox.test.tsx` novo (abrir via clique/foco, filtro por digitação case/acento-insensível, filtro por nome de grupo, seleção por clique e por teclado, `Escape` cancela sem aplicar, padrão ARIA completo, `disabled`), `TransactionEditCells.test.tsx` novo (primeira cobertura direta de `CategorySelectCell`/`AssetSelectCell`/`DescriptionCell`), `CategorizationReviewPage.test.tsx` atualizado (interação via combobox no lugar de `selectOptions`, badge de status, seleção bufferizada em linha pendente) e `DashboardsPage.test.tsx` (interação de categoria no drill-down via combobox) — suíte 100% verde, sem regressão. Sprint 10: `LiabilitiesPage.test.tsx` (mirror de `AssetsPage.test.tsx` — listar ativos/quitados, criar/editar/quitar+idempotência 400/excluir, drill-down com edição inline), `CardSparkline.test.tsx` atualizado pra `pontos`, `ProtectedPage.test.tsx` (nav sem Início, ordem final, troca de aba), filtros novos e ícone débito/crédito em `CategorizationReviewPage.test.tsx`, edição inline no drill-down do Dashboard invalidando `dashboardSummary` em `DashboardsPage.test.tsx`. Dashboards (Sprint 5+6): cards a partir de dado mockado, refetch ao trocar filtro ano/mês, sparkline a partir de tendência mockada, refetch ao trocar seletor de período histórico, sanfona expandindo múltiplos níveis sem esconder os anteriores (e mantendo duas categorias expandidas ao mesmo tempo), percentual exibido em cada nível, estado vazio. Categorização (Sprint 7): filtro tipo/status disparando refetch, seleção em lote + "Aprovar marcadas" chamando bulk-confirm, edição de descrição + propagação chamando o endpoint certo, aceitar sugestão de descrição. Gestão de Contas (Sprint 7): apelido/sync_enabled salvos via PUT, diálogo de sincronização unificada pré-selecionado a partir de `sync_enabled` e confirmando com os `item_ids` corretos, fluxo de conexão via widget Pluggy Connect. Gestão de Ativos (Sprint 8): listar ativos/baixados, criar/editar/vender (idempotência refletindo o 400 do backend)/excluir, drill-down abrindo fora do card mostrando total+transações, toggle despesa/receita refazendo as chamadas com o `tipo` selecionado, sparkline no card quando há dado de tendência; `PeriodFilter` isolado disparando `onChange` ao trocar mês/ano. Ativos/Passivos no Dashboard (Sprint 9): cards Ativos (com toggle)/Passivos (sem toggle) abrindo o drill-down correto, card Saldo ignorando o filtro ano/mês, ícone de meio de pagamento por linha, ordenação por coluna (clique no cabeçalho, alterna asc/desc), `CardSparkline`/`TrendChart`/`useTableSort` isolados; `AssetsPage.test.tsx` sem mudança de assertion pós-refactor. Revisão pós-entrega: funil Categoria>Tipo>Transação (sanfona nos dois níveis, percentual em cada nível contra o total do nível acima), ícone dentro da célula Valor, coluna % ordenável, limite de crédito entre parênteses no card do cartão, `categoryColors.test.ts` isolado (atribuição estável por id, wrap após 8 grupos, fallback neutro, tint por grupo).
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
- [DESIGN.md](../../DESIGN.md) — sistema de design (Sprint 5)
