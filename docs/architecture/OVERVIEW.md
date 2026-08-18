# Arquitetura — Visão Geral

> Stack abaixo reflete [ADR-001](adr/ADR-001-stack.md), **aprovado pelo CEO em 2026-08-03**. Este doc é atualizado a cada mudança estrutural relevante (regra de doc viva). **Atualizado em 2026-08-18 após Sprint 20** — Integração completa de Investments da Pluggy: `PluggyClient` ganha `get_investments`/`get_investment_transactions` (paginação por página, diferente de `/v2/transactions`), schema novo para holdings (`pluggy_investments`, `pluggy_investment_transactions`), sync/CRUD/rotas novas, Patrimônio soma holdings sem dobra com contas `tipo=investimento`. Bloco 1 investigou taxonomia real (CDB/Tesouro no Nubank, EQUITY/STOCK na XP) e confirmou paginação por página (não cursor), precisão decimal alta, `date`/`tradeDate` como meia-noite UTC. Dois bugs reais encontrados e corrigidos: limite Postgres de 63 caracteres em nome de índice unique (SQLite não tem), e Caddyfile nunca roteava `/investimentos*` pra API (bug da Sprint 19, descoberto agora). Ver seção própria abaixo.

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
  teclado, mede tempo de abertura, verifica o indicador de status) e
  está pronto pra rodar contra a fila real assim que houver token — ver
  relatório da Sprint 11 para o plano de follow-up.
- **Revisão pós-implementação (mesmo dia, feedback do CEO antes da
  aprovação do relatório):** badge de texto de status virou `StatusIcon`
  (ícone SVG — relógio pendente / check confirmada, distinguidos por
  forma e não só cor), coluna bem mais estreita; ordem das colunas da
  tabela de Categorização mudou para Status/Data/Descrição/Categoria/
  Ativo/Valor (Valor por último, alinhado à direita); `cat-review-table`
  ganhou densidade maior (padding de célula reduzido) e larguras
  dedicadas por coluna — mais espaço para Descrição/Categoria (texto
  livre e "grupo / subcategoria" respectivamente), menos para
  Status/Data/Ativo, que são curtos por natureza; `.dash-page`
  (compartilhada por todas as 5 telas) passou de `max-width: 1440px`
  para `1800px`, aumentando a ocupação de tela de forma padronizada em
  Dashboards/Categorização/Ativos/Passivos/Gestão de Contas sem precisar
  tocar cada página individualmente.
- **Segunda rodada de feedback (mesmo dia):** `.dash-page` perdeu o teto
  de largura de vez (`max-width` removido — 1800px ainda deixava espaço
  vazio em telas largas). Dentro da tabela de Categorização, as caixas de
  Descrição/Categoria continuavam cortando texto mesmo com mais espaço
  na página, e sobrava espaço excessivo entre Ativo/Valor — causa raiz:
  `.dash-table` usa `table-layout: auto`, que dimensiona cada coluna só
  pelo conteúdo da página atual, não pelo `max-width` do elemento
  interno. `cat-review-table` passou a usar `table-layout: fixed` +
  `<colgroup>` explícito (Descrição 32%, Categoria 26%, Ativo/Valor fixos
  e justos ao conteúdo real), com `max-width: 200px` genérico de
  `.dash-table` cancelado (`max-width: none` + `width: 100%`) só nessas
  colunas — agora a caixa de texto sempre ocupa a coluna inteira, e a
  coluna sempre reivindica sua fatia do espaço disponível.
- **Lição de deploy (mesma sessão):** redeploy na VM de dev rodado
  segundos depois do `git push`, antes do CI publicar a imagem nova no
  GHCR (`:latest` só muda depois do job `build-and-push`, que roda
  depois de `backend`/`frontend` passarem — leva minutos) — `docker
  compose pull` trouxe silenciosamente a imagem *anterior*, sem erro
  algum, então o CEO seguiu vendo a versão antiga mesmo após o "deploy".
  Corrigido consultando o status do run do GitHub Actions pro commit
  exato via API antes de fazer pull; documentado como regra permanente em
  [ssh-workflow.md](../infra/ssh-workflow.md).

## Natureza — classificação e dashboard de visibilidade (Sprint 12)

- **Reaproveita `Subcategory.natureza`** (enum `fixa`/`variavel`/`eventual`,
  `app/models/category.py`), dormente desde a Sprint 2 — sem migration
  nesta sprint. `get_por_natureza`/`get_tendencia_por_natureza`
  (`app/dashboards/service.py`) espelham `get_por_categoria`/
  `get_tendencia_por_categoria`, mas agrupam por
  `func.coalesce(Subcategory.natureza, Natureza.eventual)` e — diferença
  proposital do padrão `por-categoria` — **sempre retornam as 3 naturezas**
  (`_NATUREZA_ORDEM`), zero-preenchidas quando sem dado, já que o domínio é
  fixo (3 valores), diferente de categoria (aberto); os cards da tela não
  precisam de lógica de fallback pra saber se um bucket existe. Endpoints
  `GET /dashboards/por-natureza?tipo=&ano=&mes=` e
  `.../por-natureza/tendencia?tipo=&ano=&mes=&meses=`, isolados por
  `user_id`, mesmo padrão de auth/filtro dos irmãos `por-categoria`.
- **Transação sem subcategoria (`subcategory_id=None`) também cai em
  "eventual"** pelo mesmo `COALESCE` — sem sentinel `SEM_CATEGORIA_ID`
  dedicado aqui, porque o agrupamento é por natureza, não por subcategoria.
- **`app/schemas/dashboards.py`:** `NaturezaTotalOut`/`TendenciaNaturezaOut`,
  mesmo padrão de `CategoriaTotalOut`/`TendenciaCategoriaOut`.
- **Frontend — nova tela "Natureza"** (`pages/NaturezaPage.tsx`), aba nova
  em `ProtectedPage.tsx` entre "Passivos" e "Gestão de contas": combina (a)
  dashboard de visibilidade — 3 cards (`dash-tile`/`dash-summary`, mesmo
  padrão de `DashboardsPage`) com total/percentual/`CardSparkline`,
  filtráveis por período e despesa/receita, com drill-down (`dash-funnel`)
  natureza → subcategoria → transação — e (b) tabela de classificação de
  subcategorias agrupada por `CategoryGroup` (`<td rowSpan>` por grupo,
  `table-layout: fixed` + `<colgroup>`, mesma técnica de
  `cat-review-table`), com `<select>` de 3 opções por linha salvando via
  `PUT /subcategories/{id}` (endpoint já existente desde a Sprint 2, sem
  mudança de contrato).
- **Funil natureza → subcategoria sem endpoint dedicado:** reaproveita
  `GET /dashboards/por-categoria` (já traz total por subcategoria) e
  agrupa localmente por natureza via `useSubcategories()` — mesma técnica
  que `GrupoAccordion` (`DashboardsPage`) usa pra agrupar por
  `CategoryGroup`. `TransacoesPanel` (antes privada em
  `DashboardsPage.tsx`) foi exportada e reaproveitada como o nível
  "transação" do funil, em vez de duplicada.
- **`api/categories.ts` ganha `updateSubcategory`** (só havia `fetch` antes
  — primeiro `PUT` desse recurso no frontend); hook
  `useUpdateSubcategoryNatureza` invalida `["subcategories"]` e todo query
  key `dashboard*` (predicate extraído de `invalidateDashboardQueries.ts`
  em `invalidateAllDashboardQueries`, reaproveitado tanto por edição de
  transação quanto por edição de subcategoria agora).
- **`utils/naturezaLabels.ts`** — única fonte dos 3 rótulos de exibição
  (`fixa` → "Fixo recorrente" etc., `eventual`/`null` → "Custo eventual"),
  mesmo cuidado de `subcategoryLabel` (Sprint 11) contra rótulo divergente
  em dois lugares (card, seletor, funil).
- **3 tons de cor novos** (`--nat-fixa`/`--nat-variavel`/`--nat-eventual`,
  `index.css`), decididos via skill `impeccable` — deliberadamente fora da
  paleta categórica de 8 matizes (`--cat-1..8`) e da semântica
  receita/despesa, mesma faixa de contraste de `--despesa` (≥4.5:1 em
  `--surface`) mas dessaturados, pra não competir com o funil de categoria
  quando as duas aparecem na mesma tela.
- **Validado ao vivo contra a VM de dev** (`scripts/browser-check/check-sprint12.mjs`,
  novo): 3 cards, drill-down, tabela de classificação, edição de natureza
  persistindo (via `PUT`) e refletindo nos cards sem reload, mobile — sem
  erros de console. A única mutação real do script (natureza da 1ª
  subcategoria da lista real, não há registro sintético pra escopar já que
  a tabela só lista dado real do CEO) é capturada via `GET /subcategories`
  antes de qualquer clique (preserva `null` vs. `"eventual"` explícito,
  indistinguíveis no `<select>`) e restaurada por `PUT` direto em
  `finally`, mesmo mecanismo de limpeza de `check-ativos.mjs`.

## Redesign de tabelas/botões e funil completo de Natureza (Sprint 13)

Sem mudança de backend/schema/endpoint — sprint inteiramente de frontend,
decidida em sessão de planejamento própria (2026-08-16) a partir de 3
pontos que o CEO trouxe usando a tela "Natureza" na prática.

- **Rótulo "Custo eventual" → "Eventual"** — `NATUREZA_LABELS.eventual`
  (`utils/naturezaLabels.ts`), única fonte; `NaturezaPage.tsx` trocou o
  `<select>` de classificação de 3 `<option>` hardcoded por um `.map()`
  sobre `NATUREZA_ORDER`, eliminando a segunda fonte de verdade do rótulo.
  Cosmético — `--nat-eventual`/enum `eventual` não mudam.
- **Funil de Natureza ganha o nível Categoria**, virando `Natureza →
  Categoria → Subcategoria → Transação` (era só `Natureza → Subcategoria →
  Transação` desde a Sprint 12 — corte de escopo explícito, não bug).
  `utils/categoriaGrouping.ts` novo: `groupCategoriaTotalsByGrupo` extrai a
  aritmética pura de agrupamento por `group_id` (soma, percentual do total
  recebido, ordenação desc) que `GrupoAccordion` (`DashboardsPage.tsx`) já
  tinha — cor/dado/tendência continuam proprietários de cada tela (Natureza
  usa cor de natureza constante em todo o funil, não a paleta categórica).
  Sanfona multi-nível (mais de uma Categoria expandida ao mesmo tempo),
  substituindo o single-select de subcategoria da Sprint 12.
- **`TransactionsTable.tsx` novo** (`components/`) — unifica as 3
  implementações divergentes de "tabela de transação" que existiam antes:
  `TransacoesPanel` (privada em `DashboardsPage.tsx`, reaproveitada por
  Dashboard e Natureza), o `<table>` hand-rolled de `AssetDrilldown`
  (`AssetsPage.tsx`, só Data/Descrição/Valor em texto puro) e o de
  `LiabilityDrilldown` (`LiabilitiesPage.tsx`). Contrato de
  `TransacoesPanel` preservado, com flags `showCategoria`/`showAtivo`
  (default `true`). `AssetDrilldown` ganha as colunas Categoria (editável)
  e Ativo/sort que não tinha — mudança de comportamento explícita, não só
  visual (decisão do CEO ao aprovar a unificação). `SortableHeader`
  também extraído (`components/SortableHeader.tsx`), agora genérico sobre
  a união de chaves de sort de cada tabela, reaproveitado por
  `CategorizationReviewPage` (sort novo em Data/Descrição/Valor — a
  tabela "flagship" da Sprint 11 nunca tinha tido) e pela tabela de
  classificação de `NaturezaPage` (sort de Categoria/Subcategoria,
  implementado à mão — não via `useTableSort` — porque reordena um dado
  hierárquico com `rowSpan`, não uma lista plana).
- **Redesign de tabela decidido via rodada `impeccable`** (Artifact,
  2 candidatas de densidade/hover + 2 de hierarquia de botão, mesmo
  processo das Sprints 5/6/9/12): o CEO pediu um híbrido depois de ver as
  candidatas renderizadas — densidade compacta (`6px` padding vertical, a
  fila de Categorização real tem centenas de itens) + hover de
  preenchimento simples de fundo (`--accent-bg`), rejeitando um indicador
  de borda lateral (`border-left` por célula) que criava uma linha vertical
  falsa entre colunas e fazia o texto "pular" no hover. `table-layout:
  fixed` + `<colgroup>` explícito agora em toda `<table>` do app (incluindo
  `TransactionsTable`/`PatrimonioBreakdownPanel`, que não tinham antes) —
  reabre a regra do `DESIGN.md` de que a tabela era "o nível mais plano do
  funil por design" (ver seção Table, com nota de histórico).
  **Achado real via browser-check pós-implementação:** `<select>`/combobox
  de Categoria/Ativo vazavam visualmente por cima da coluna Valor seguinte
  — `table-layout: fixed` não recorta conteúdo mais largo que a coluna por
  conta própria; corrigido cancelando o `max-width: 200px` genérico
  (`width: 100%`/`max-width: none`) dentro de `.txn-table`, mesmo padrão já
  usado em `.cat-review-table` desde a Sprint 7.
- **Hierarquia de botão nos cards de Ativos/Passivos** — decisão do CEO
  após ver as 2 candidatas: só "Ver gasto no período" fica Default (já é a
  continuação natural do sparkline que o card mostra); Editar/Vender/
  Quitar/Excluir viram Ghost. `.btn-ghost` novo em `index.css` — através da
  Sprint 12 esse vocabulário só existia embutido em `.app-nav
  button`/`.dash-row`, sem classe reutilizável.
- **`--danger` novo** (`#a3374a` claro / `#d9748c` escuro) — primeira cor
  de aviso/destrutiva do app, decidida em rodada própria dentro do mesmo
  ciclo `impeccable` (o CEO pediu pra ver uma opção antes de decidir).
  Deliberadamente um vermelho frio/vinho, distinto em matiz do terracota
  de despesa (laranja quente) — token independente, não reabre a One
  Meaning Rule. Aplicado só em `Excluir` (`.btn-danger`, empilhada com
  `.btn-ghost`/`.btn-quiet`) — nunca em Vender/Quitar, que não apagam dado.
- **`.simple-list` novo** — Gestão de Contas e o diálogo de sincronização
  (listas `<li>` cruas até então) ganham o mesmo espaçamento/hover das
  outras listas do app, sem virar accordion (sem chevron, sem estado de
  expansão — presentation only).
- **`DESIGN.md` reescrito:** seção Table documenta a tabela unificada com
  nota de histórico (a regra antiga "nível mais plano do funil" fica
  registrada, não apagada); Buttons ganha o Ghost generalizado + Danger;
  nova subseção Simple lists; Tertiary — Natureza registra o rename.
- **Validado ao vivo contra a VM de dev**
  (`scripts/browser-check/check-sprint13.mjs`, novo, desktop+mobile, sem
  erros de console): rótulo "Eventual", funil de 4 níveis com percentual
  em Categoria+Subcategoria e múltiplas categorias expandidas
  simultaneamente, hover+sort nas tabelas de Categorização/Natureza-
  classificação/drill-down de Dashboard, colgroup no breakdown de
  Patrimônio, hierarquia de botão (cores computadas via `getComputedStyle`,
  não só screenshot) nos cards de Ativos/Passivos, `.simple-list` em
  Gestão de Contas. `check-sprint12.mjs` removido — testava a estrutura de
  funil de 1 nível que esta sprint substituiu e usava o rótulo antigo
  (mesmo padrão da remoção de `check-sanfona.mjs` na Sprint 9).

## Projeção de custos futuros com despesas hipotéticas (Sprint 14) — E9 fechado

Planejada em sessão própria (2026-08-16), fecha o épico E9. Sem migration —
reaproveita `Subcategory.natureza` (Sprint 2/12) e `PluggyTransaction.data_competencia`.

- **`app/dashboards/service.py`:** `_future_month_range(ano, mes, meses_futuros)`
  — inverso de `_month_range` (Sprint 6), gera os N meses **seguintes** a
  `(ano, mes)` em vez dos N anteriores. `get_projecao(db, user_id, *, ano,
  mes, meses_futuros=6, janela_media=3)` com dataclass `PontoProjecao`
  (`ano`/`mes`/`receita`/`despesa`/`saldo`): calcula a média mensal dos
  últimos `janela_media` meses (mesma janela de `_month_range`/`_date_bounds`
  já usada por `get_tendencia`) restrita a `Subcategory.natureza.in_([fixa,
  variavel])` — exclusão direta, sem `COALESCE` (diferente de
  `get_por_natureza`, que precisa de um bucket "eventual" pros 3 cards
  zero-filled; aqui `eventual`/subcategoria sem `natureza`/transação sem
  subcategoria simplesmente não entram na base) — e repete o mesmo valor
  constante (`Decimal` quantizado a centavos) em cada um dos
  `meses_futuros` meses seguintes. Base da média usa `_base_query` (mesmas
  exclusões de sempre: `excluir_de_totais`, `cartao_credito`+`credito`).
- **Endpoint novo:** `GET /dashboards/projecao?ano=&mes=&meses_futuros=&janela_media=`
  (`PontoProjecaoOut` em `app/schemas/dashboards.py`, mesmo padrão de
  `TendenciaMesOut`), isolado por `user_id`, `meses_futuros`/`janela_media`
  com `Query(..., ge=1, le=24)` (mesmo teto de `/tendencia`).
- **Frontend — tela nova "Projeção"** (`pages/ProjecaoPage.tsx`), aba nova
  em `ProtectedPage.tsx` (`NAV_ITEMS`, entre "Natureza" e "Gestão de
  contas"). `api/dashboards.ts` ganha `PontoProjecao`/`fetchDashboardProjecao`;
  `hooks/useDashboardProjecao.ts` novo. Reaproveita `PeriodFilter` (mês-base)
  e o mesmo seletor de horizonte 3/6/12 já usado em `DashboardsPage`
  (histórico) — aqui como horizonte **futuro**, com o mesmo valor
  determinando quantos meses de histórico real (`useDashboardTendencia`) e
  de projeção (`useDashboardProjecao`) são buscados, para o gráfico
  combinar as duas séries com o mesmo comprimento visual dos dois lados do
  mês-base.
- **`components/ProjectionChart.tsx` novo:** primeiro gráfico do projeto a
  combinar 2 fontes na mesma série visual (histórico real de
  `/dashboards/tendencia`, linha sólida, + projeção de
  `/dashboards/projecao`, linha tracejada via `strokeDasharray`) — para as 3
  séries (receita/despesa/saldo) simultaneamente. O mês-base (último ponto
  do histórico) entra em ambos os campos Real/Projetada no dado do gráfico,
  então a linha sólida e a tracejada compartilham esse ponto e aparecem
  visualmente conectadas, sem gap — técnica nova, sem precedente em
  `TrendChart.tsx` (que só desenha uma fonte/série).
- **`utils/projecao.ts` novo:** tipo `Hipotetica`
  (`nome`/`valor`/`tipo` despesa|receita/`frequencia` unica|mensal/
  `ano`+`mes` opcionais, só usados quando `unica`) e `applyHipoteticas(pontos,
  hipoteticas)` — lógica pura, sem dependência de React/DOM. Estado
  **puramente local** da tela (`useState` em `ProjecaoPage`, nunca trafega
  para o backend, decisão explícita do CEO na sessão de planejamento: "e se"
  efêmero, não um cenário salvo) — cada hipotética `unica` soma/subtrai seu
  valor só no ponto cujo `(ano, mes)` bate com o alvo escolhido no form;
  `mensal` aplica em todos os pontos do horizonte. Recalculado via
  `useMemo` a cada mudança de `hipoteticas`, sem nenhuma chamada de rede
  nova — os 3 cards (`média mensal do horizonte`) e o `ProjectionChart` leem
  do mesmo array já ajustado.
- **Validado ao vivo contra a VM de dev**
  (`scripts/browser-check/check-sprint14.mjs`, novo, desktop+mobile, sem
  erros de console): os 3 cards carregam, adicionar hipotética
  única/mensal altera os cards sem disparar nenhuma chamada de rede a
  `/dashboards/projecao`/`/dashboards/tendencia` (contagem de `request` do
  Playwright antes/depois), remover as hipotéticas restaura os valores
  originais, trocar o horizonte dispara uma chamada nova.

## Configurações, Competência de Salário e Saldo Acumulado (Sprint 15) — E7 fechado

Planejada em sessão própria (2026-08-16), fecha o épico E7. Escopo cresceu
além do título original do roadmap durante o planejamento (mesmo padrão das
Sprints 8/9/13): a regra de competência de salário sozinha não bastava
porque o corte de sincronização Pluggy (`2026-01-01`) nunca trouxe o
salário real de dez/2025 nem o saldo real das contas até aquela data — ver
[PRD-015](../prd/PRD-015-configuracoes-competencia-salario-saldo-acumulado.md).

- **`users.salario_competencia_cutoff_dia`** (int, default 25, migration
  `0012`). `app/categorization/competencia.py` novo: `shift_to_next_month`
  (rollover de ano, clamp de dia via `calendar.monthrange`) e
  `competencia_salario(data, cutoff_dia)`. `app/categorization/service.py`
  ganha `salario_subcategory_id(db)` (lookup por nome "Salário"/grupo
  "Receitas") e passa a recalcular `data_competencia` em **toda** chamada de
  `set_category`/`bulk_confirm` — desloca 1 mês quando o alvo é "Salário" e
  `data.day >= cutoff`, senão **reseta** `data_competencia = data` (garante
  que recategorizar pra fora de Salário desfaça o deslocamento). Migration
  `0012` faz backfill em Python das transações já categorizadas como
  Salário antes desta sprint, com a regra duplicada localmente (mesmo
  precedente da `0007`, migrations não dependem de código de `app/`).
- **Salário de dez/2025 como transação real, não um número solto:**
  `upsert_salario_ajuste_dez_2025` (`app/pluggy_integration/service.py`) —
  upsert por `pluggy_transaction_id` sentinela determinístico
  (`manual-salario-dez2025-user{user_id}`, nunca colide com id externo da
  Pluggy), grava `subcategory_id`=Salário,
  `categorizacao_status=confirmada`, `data_competencia` calculada pela
  mesma `competencia_salario`. `valor=None` deleta a linha. Flui por
  `get_summary`/`get_tendencia`/`get_por_categoria` **sem nenhuma mudança
  de código** nessas três funções — é uma transação normal, testado como
  regressão explícita. Endpoints `GET`/`PUT /pluggy/ajuste-salario-dezembro`.
  Efeito colateral aceito (documentado, não escondido): por ser uma
  transação de verdade, pode ser editada depois pela tela de Categorização
  normal.
- **Saldo inicial por conta + auditoria (D, distinta do Saldo Acumulado
  agregado — E):** `pluggy_accounts.saldo_inicial` (migration `0012`),
  editável via `PUT /pluggy/accounts/{id}/saldo-inicial` (schema próprio,
  não reaproveita `PluggyAccountUpdateIn` — full-replace misturado
  arriscaria zerar `saldo_inicial` numa edição de apelido).
  `get_evolucao_saldo_por_conta(db, user_id, *, ano, mes, meses=6)` — soma
  cumulativa de `PluggyTransaction.valor` (sinal já correto pela convenção
  bancária) por **`data` real** (não `data_competencia`), desde
  `2026-01-01`; não reaproveita `_base_query`/`_apply_periodo` (aquelas
  excluem cartão-crédito+crédito e filtram por competência, errado para
  reconciliação bancária literal). Endpoint `GET
  /dashboards/evolucao-saldo-por-conta`. Frontend: campo "Saldo inicial
  (31/12/2025)" editável inline em `AccountManagementPage.tsx` (mesmo
  padrão do apelido) + tabela de auditoria mensal (`.dash-table`).
- **Saldo Acumulado (E, agregado por competência) — dois cards novos no
  Dashboard:** `_receita_despesa_por_periodo` extraída de `get_tendencia`
  (helper reaproveitável pra somar receita/despesa num range arbitrário de
  meses, não só os últimos N terminando no filtro).
  `get_saldo_acumulado(db, user_id, *, ano, mes, meses=6) -> list[PontoTendencia]`
  — âncora ("saldo acumulado de dez/2025") = `soma(saldo_inicial das
  contas) − valor da transação sentinela de salário` (a sentinela já entra
  de volta sozinha na receita de jan/2026, por competência); caminha mês a
  mês desde jan/2026 acumulando `receita − despesa`. Endpoint `GET
  /dashboards/saldo-acumulado`. Frontend: `useDashboardSaldoAcumulado`
  pede `periodoHistorico + 1` meses — o ponto extra à frente da janela
  alimenta o card **"Saldo Anterior"** (primeiro card da grid, mês
  anterior ao filtro, navega `ano`/`mes` da tela ao ser clicado; em
  jan/2026 — único mês sem "anterior" navegável — `window.alert` em vez de
  navegar) sem precisar de uma segunda chamada; o restante da série
  (mesmo tamanho de `periodoHistorico`) alimenta o card **"Saldo
  Acumulado"** (sparkline + drill-down com `TrendChart`).
- **Frontend — tela "Configurações"** (`pages/ConfiguracoesPage.tsx`,
  novo) substitui a aba "Gestão de contas" em `ProtectedPage.tsx`: 3
  seções — Perfil (nome/e-mail + botão "Sair", `useLogout`), Competência de
  Salário (dia de corte + form "Salário de dezembro/2025"), Gestão de
  Contas (reaproveita `AccountManagementPage.tsx` como está, import
  direto). Campos do form de ajuste de salário usam um padrão "não tocado
  até editar" (`useState<T | null>(null)`, valor exibido = draft ?? valor
  da query) em vez de sincronizar estado local a partir de uma query via
  `useEffect` — evita cascading render (só `useEffect` do projeto até
  então era em `CategoryCombobox.tsx`, para listeners de DOM, não para
  sincronizar dado de servidor).
- **`POST /auth/logout`:** `response.delete_cookie` com os mesmos
  parâmetros do `set_cookie` de `google_callback`, 204 sem corpo.
  `PUT /auth/me/settings` (`UserSettingsIn.cutoff_dia`, 1–28) separado do
  `GET /auth/me` (só-leitura, vindo do OAuth).
- **Achado real de infraestrutura (não da aplicação):**
  `scripts/ssh-vm.ps1` tinha `$ErrorActionPreference = "Stop"` global —
  PowerShell 5.1 trata qualquer escrita em stderr de um comando nativo
  como erro terminante nesse modo, mesmo com exit code 0. Como `git pull`
  sempre escreve seu progresso em stderr (convenção do git) e o wrapper
  encaminha stderr do comando remoto para o stderr local
  (`scripts/ssh_vm.py::_pump`), **todo deploy que passasse por um `git
  pull` com output real derrubava o script antes do comando remoto
  terminar** — só não tinha aparecido antes porque sessões anteriores
  rodavam os comandos um a um interativamente. Corrigido trocando para
  `"Continue"` (a propagação de erro real já era via `exit $LASTEXITCODE`,
  não por exceção do PowerShell) — ver [ssh-workflow.md](../infra/ssh-workflow.md).
- **QA visual real** (`scripts/browser-check/check-sprint15.mjs`, novo)
  contra a VM de dev: logout, as 3 seções de Configurações, edição de dia
  de corte / ajuste de salário de dez/2025 / saldo inicial de conta (todas
  revertidas ao valor original capturado no início do script — nenhum
  dado real do CEO alterado permanentemente, confirmado por leitura direta
  da API após o script terminar), tabela de auditoria populando, cards
  "Saldo Acumulado"/"Saldo Anterior" no Dashboard incluindo os dois ramos
  do clique em "Saldo Anterior" (alerta em jan/2026 vs. navegação em outro
  mês), desktop+mobile, sem erros de console reais (só o 401 esperado de
  chamadas em voo no exato instante do logout). Único achado foi no
  próprio script (ambiguidade de `getByRole` case-insensitive entre
  `<h3>Gestão de Contas</h3>` desta sprint e `<h2>Gestão de contas</h2>` já
  existente dentro de `AccountManagementPage`), não na aplicação.

## Regime de Competência/Caixa e Patrimônio por Saldo Acumulado (Sprint 16) — sem épico prévio

Planejada em sessão própria (2026-08-17), a partir de uma planilha de
referência que o CEO trouxe (fórmulas inspecionadas célula a célula) para
validar sua leitura de somas/saldos e formalizar a lógica de competência —
revelou que competência de cartão de crédito nunca tinha sido implementada
(`data_competencia = data`, sem shift, exceto para Salário) e que não
existia uma "visão caixa" separada de competência. Ver
[PRD-016](../prd/PRD-016-regime-competencia-caixa-patrimonio.md).

- **Competência de cartão incondicional + `data_caixa` novo:**
  `app/categorization/competencia.py` ganha `competencia_padrao(data,
  account_tipo)` (cartão sempre `shift_to_next_month`, sem dia de corte —
  diferente de Salário; demais tipos sem defasagem) e `caixa(data_competencia,
  account_tipo)` (cartão desloca mais 1 mês sobre a competência — evento + 2
  meses no total; demais tipos iguais à competência, mesmo quando já
  deslocada por Salário). Aplicadas nos 3 pontos de escrita: `_upsert_transaction`
  (sync), `_recompute_data_competencia` (`set_category`/`bulk_confirm` —
  cartão tem prioridade sobre a regra de Salário, checada primeiro), e
  `upsert_salario_ajuste_dez_2025`. `pluggy_transactions.data_caixa` (Date,
  nullable) via migration `0013`, com backfill em Python (mesmo precedente
  das migrations `0007`/`0012`): recalcula `data_competencia` de toda
  transação de cartão existente e popula `data_caixa` para toda transação.
- **Bug real de fuso horário corrigido:** `_parse_date`
  (`app/pluggy_integration/service.py`) convertia o timestamp UTC bruto da
  Pluggy direto para `date()`, sem passar por `America/Sao_Paulo` — transações
  com horário local (BRT) entre 21h e 23h59 gravavam `data` um dia à frente
  do evento real (equivalente a 00h–03h UTC do dia seguinte). Corrigido com
  `.astimezone(ZoneInfo("America/Sao_Paulo"))` antes de `.date()`. Dado
  histórico se autocorrige via re-sync (upsert idempotente); **confirmado
  contra dado real da VM de dev** após `POST /pluggy/sync` pós-deploy — a
  transação "BRASA E DRINKS" (`date` bruto `...T01:34:27Z`) foi de
  `data=2026-01-23` para `2026-01-22`, e uma segunda transação do mesmo
  comerciante teve o mesmo tipo de correção (`2026-01-16` → `2026-01-15`),
  achado não previsto no PRD original — evidência de que o bug afetava mais
  transações do que só o caso de verificação citado no PRD.
- **`app/dashboards/service.py` — parâmetro `regime` (`Literal["competencia",
  "caixa"]`, default `"competencia"`) threaded via `_competencia_column(regime)`
  (`data_caixa` vs. `data_competencia`) em `get_summary`, `get_por_categoria`,
  `_receita_despesa_por_periodo`, `get_tendencia`, `get_tendencia_por_categoria`,
  `get_por_ativo`, `get_tendencia_por_ativo`, `get_por_passivo`,
  `get_tendencia_por_passivo`, `get_saldo_acumulado`, `get_patrimonio_breakdown`
  — sem mudança de contrato pra quem não passa o parâmetro. Fora de escopo por
  decisão do CEO: telas "Natureza"/"Projeção" continuam só por competência.**
- **`_base_query` ganha `excluir_investimento: bool = False`** — usado só por
  `get_saldo_acumulado` (âncora `soma(saldo_inicial)` e acumulação de
  receita/despesa excluem contas `tipo=investimento`; variação de valor de
  mercado não é uma transação).
- **Patrimônio redesenhado — de snapshot bancário pra ledger acumulado:**
  `PatrimonioBreakdown` troca `saldo_contas`/`saldo_cartoes` (ambos snapshot
  ao vivo) por `saldo_liquido_acumulado` (via `get_saldo_acumulado(regime=...,
  ano/mes=hoje, meses=1)`, que já exclui investimento) + `saldo_investimentos`
  (snapshot ao vivo, só contas `tipo=investimento`). **Fallback de conta sem
  `saldo_inicial`:** contas líquidas (não-investimento) sem `saldo_inicial`
  não entram na acumulação de `get_saldo_acumulado` — `_saldo_liquido_fallback`
  soma o saldo ao vivo dessas contas específicas por fora, mantendo a
  convenção de sinal de `_base_query` (cartão de crédito subtrai, demais
  somam), sem quebrar o cálculo das contas ancoradas. `total = saldo_liquido_acumulado
  + saldo_investimentos + ativos − passivos`.
- **`app/dashboards/router.py`:** query param `regime` em `/summary`,
  `/tendencia`, `/por-categoria`, `/por-categoria/tendencia`, `/por-ativo`,
  `/por-ativo/tendencia`, `/por-passivo`, `/por-passivo/tendencia`,
  `/saldo-acumulado`, `/patrimonio/breakdown`.
- **Frontend:** `components/RegimeToggle.tsx` novo (mesmo padrão `aria-pressed`
  do toggle despesa/receita de `AssetsPage`), state `regime` levantado em
  `DashboardsPage`/`AssetsPage`/`LiabilitiesPage`, propagado pros hooks
  (`useDashboardSummary`, `useDashboardTendencia`, `useDashboardByCategoria`,
  `useDashboardCategoriaTendencia`, `useDashboardSaldoAcumulado`,
  `useAssetGastos`/`Tendencia`, `useLiabilityGastos`/`Tendencia`,
  `usePatrimonioBreakdown` — `regime` incluído na `queryKey` de cada um) e
  incluído nas queries via `buildQuery`. `PatrimonioBreakdownPanel` atualizado
  pros campos novos — linha "Saldo líquido acumulado" agora abre o drill-down
  existente de "Saldo Acumulado" (`TrendChart`) em vez do antigo "Saldo em
  conta"/"Saldo de cartão de crédito".
- **418 testes backend (98% cobertura, +39 sobre a Sprint 15) + 162 testes
  frontend (+7)**, suíte completa verde. Migration `0013` testada via um
  precedente novo no projeto: `_backfill` extraída como função plana
  (não depende do contexto `op` do alembic) e testada com `importlib` carregando
  o arquivo de migration diretamente contra o schema do `db_session` de teste.
- **Deploy na VM de dev + validação real:** CI verde publicou as imagens,
  `git pull` + `docker compose pull` + `docker compose up -d`, `alembic
  upgrade head` rodou automaticamente no entrypoint do container `api`
  (`0012 → 0013`), `POST /pluggy/sync` re-sincronizou as 2 contas reais
  (corrige o bug de fuso em dado histórico). `scripts/browser-check/check-sprint16.mjs`
  (novo, só leitura — nenhuma mutação de dado persistido, diferente da Sprint
  15): toggle Competência/Caixa presente e funcional no Dashboard/Ativos/
  Passivos, drill-down de Patrimônio com os rótulos novos, "Ver detalhe" de
  "Saldo líquido acumulado" abrindo o drill-down de Saldo Acumulado,
  desktop+mobile, sem erros de console reais (só o 401 já documentado na
  Sprint 15 de uma chamada em voo no instante do logout, confirmado via
  script de diagnóstico que o mesmo fluxo sem logout não produz o erro).
  Único achado foi no próprio script (assertion invertida sobre o toggle
  despesa/receita pré-existente de `AssetsPage`), não na aplicação.
  Confirmado contra dado real da conta do CEO: `Despesa` competência
  R$ 8.309,59 vs. caixa R$ 8.066,41 no mesmo período — o toggle realmente
  muda o número exibido, não só a UI; transações de cartão sincronizadas
  mostrando `data_competencia` sempre 1 mês após `data` (ex.: `data=2028-05-29`
  → `data_competencia=2028-06-29`).
- **Achado real pendente de ação do CEO (não bloqueia a sprint, documentado
  para a validação final):** a conta "NuBank - Cartão de Crédito" não tem
  `saldo_inicial` preenchido — cai no fallback de `_saldo_liquido_fallback`
  (soma o saldo ao vivo por fora da acumulação, comportamento correto e não
  quebra as demais contas), mas o card "Patrimônio" só reflete o Saldo
  Acumulado real dessa conta assim que o CEO preencher o campo em
  Configurações (mesmo aviso já registrado no plano da sprint).

PRD: [PRD-016-regime-competencia-caixa-patrimonio.md](../prd/PRD-016-regime-competencia-caixa-patrimonio.md).
Plano: [SPRINT-016-regime-competencia-caixa-plan.md](../sprints/SPRINT-016-regime-competencia-caixa-plan.md).
Relatório: [SPRINT-016-regime-competencia-caixa-report.md](../sprints/SPRINT-016-regime-competencia-caixa-report.md).

## Filtro de conta em Categorizar + Reconciliação contra extrato real (Sprint 17) — sem épico prévio

CEO trouxe o extrato do Itaú do 1º semestre de 2026 (PDF) para validar
sistematicamente, mês a mês, se o sistema faz as contas certas — nunca tinha
havido reconciliação linha a linha contra dado bancário real. Dois blocos:

**Bloco 1 — filtro de conta:** `account_id: int | None` novo em `GET
/categorization/transactions` (query param + `service.list_transactions`,
filtro condicional `PluggyTransaction.account_id == account_id`, mesmo padrão
de `group_id`) e novo `<select>` "Conta" em `CategorizationReviewPage.tsx`
(populado via `usePluggyAccounts`, rótulo `account.apelido ?? account.nome`,
mesmo fallback de `AccountManagementPage`). Isolamento por usuário preservado
sem checagem extra — o filtro é só mais um `AND` sobre a query já restrita a
`user_id`, então `account_id` de outro usuário simplesmente não bate com
nenhuma linha.

**Bloco 2 — reconciliação jan–jun/2026:** comparação mês a mês do saldo final
da conta "Itaú - Conta Corrente" (`get_evolucao_saldo_por_conta`, Sprint 15)
contra o "SALDO DO DIA" do extrato real, mais conferência linha a linha
completa de janeiro (78 transações). **Resultado: nenhum bug de data/cálculo
encontrado.** Março a junho batem exatos ao centavo. Janeiro (R$395,42) e
fevereiro (R$159,68) tinham diferença — mas ambas são exatamente o lag de
liquidação de fim de semana já documentado e decidido como fora de escopo na
Sprint 16 (transações de sábado/domingo que o Itaú só lança no próximo dia
útil): confirmado transação a transação (5 lançamentos de 31/01→02/02, 1
lançamento de 28/02→02/03, valores e descrições batendo exatamente contra o
extrato). Zero transações pendentes de categorização na conta, nos 6 meses.

**Achado real, mas de produto, não de dado incorreto:** o CEO identificou,
lendo o relatório desta reconciliação, que transferências para investimento
(ex.: PIX de R$5.000 em 03/01/2026, Itaú→NuBank→Investimento) não têm uma
categoria própria de "Aporte"/"Resgate" — a de 03/01 estava categorizada como
"Impostos e taxas" (miscategorização real, não corrigida nesta sprint por
decisão do CEO — ver relatório), inflando a despesa total de janeiro. Não há
conta de investimento conectada via Pluggy ainda, nem tela de gestão de
investimentos. Virou pauta de uma sprint nova (sem PRD/plano ainda) — ver
"Registro de reavaliações futuras" no roadmap.

PRD: [PRD-017-filtro-conta-validacao-extrato.md](../prd/PRD-017-filtro-conta-validacao-extrato.md).
Plano: [SPRINT-017-filtro-conta-validacao-extrato-plan.md](../sprints/SPRINT-017-filtro-conta-validacao-extrato-plan.md).
Relatório: [SPRINT-017-filtro-conta-validacao-extrato-report.md](../sprints/SPRINT-017-filtro-conta-validacao-extrato-report.md).

## Edição manual de data + investigação de Saldo Acumulado + guia dos cards (Sprint 18) — sem épico prévio

Três pedidos do CEO conectados pela confiança na conferência do saldo mensal
contra o extrato bancário real (mesmo fio condutor da Sprint 17).

**Bloco 1 — edição manual de data:** `pluggy_transactions.data_editada_manualmente`
(`Boolean`, not null, default `False`, migration `0014`) — trava explícita,
não reaproveita `categorizacao_status`, porque uma edição de data deliberada
é muito mais rara que uma confirmação de categoria. Coluna Data na tela
Categorizar vira `<DateCell />` (mesmo padrão de `DescriptionCell`, `input
type="date"`, indicador `✎` quando editada). `service.update_data()` seta
`data`+flag, recomputa `data_competencia`/`data_caixa` reaproveitando
`_recompute_data_competencia` sem mudar a assinatura (mesmas regras de
cartão/Salário do `set_category`), rejeita data futura. `_upsert_transaction`
(sync Pluggy) pula os 3 campos quando a flag está `True` — testado nos dois
sentidos: transação editada sobrevive a resync (conta corrente e cartão),
transação não editada continua sendo sobrescrita normalmente (regressão).

**Bloco 2 — investigação do "Saldo Acumulado":** o CEO reportou que o card
não batia com Itaú+NuBank em 31/01/2026. Investigação com dado real da VM de
dev (mesma metodologia da Sprint 17): `get_saldo_acumulado` (competência,
jan/2026) inicialmente mostrava R$2.687,81 contra R$10.914,05 reais
(Itaú R$10.913,75 + NuBank Conta Corrente R$0,30, via
`get_evolucao_saldo_por_conta`) — gap de R$7.830,82, reconciliado por
completo e explicado por 2 efeitos que se somam exatamente:

1. Um salário de R$9.882,83 caiu na conta Itaú em 30/01/2026 — já está no
   saldo bancário real, mas por competência (dia ≥ cutoff) só "pertence" a
   fevereiro/2026, então não entra no Saldo Acumulado de janeiro (regra já
   existente desde a Sprint 15, funcionando como desenhada).
2. Uma transação de R$2.052,01 (pagamento da fatura de dezembro/2025 do
   cartão NuBank — período anterior ao corte de dados, cujas compras nunca
   foram sincronizadas via Pluggy) estava categorizada como "Transferência
   interna", grupo excluído de receita/despesa em todo o app — reduzia o
   saldo bancário real mas não o Saldo Acumulado, sem uma despesa
   correspondente já contabilizada (já que a compra original não existe no
   sistema).

Nenhum bug de fórmula ou de agregação foi encontrado em janeiro — as duas
regras (cutoff de competência de salário, exclusão de "Transferência
interna") funcionam exatamente como desenhadas nas Sprints 15/16. O CEO
recategorizou a transação de R$2.052,01 para "Outras Compras" (ação pontual,
sem migration, via a própria tela Categorizar) para tratar a fronteira
dez/2025↔jan/2026. **Ação de UI (Bloco 2b):** card "Saldo Acumulado" ganha
uma tag "projeção por competência — pode diferir do saldo bancário"; o
drill-down ganha um parágrafo explicando a diferença (salário/cartão por
competência vs. saldo bancário do dia), com link implícito pro card "Saldo"
(snapshot real).

O CEO continuou validando fevereiro e março ao vivo, e **fevereiro revelou um
bug real** (não conceitual) no regime caixa: o deslocamento fixo de cartão
de crédito (`competencia_padrao`/`caixa`, compra+1/+2 meses) e o pagamento
real da fatura podiam contar a mesma compra 2 vezes — mascarado em fevereiro
porque as compras de janeiro têm caixa modelado em março, mas exposto ao
testar recategorizar a fatura pra validar o efeito (competência quebrou:
`-120,92` em vez de `146,13`). **Fix confirmado com o CEO antes de
implementar** (tocava PRD-016): sob regime caixa, `_base_query`
(`app/dashboards/service.py`) passa a excluir toda transação de conta de
cartão de crédito e a incluir a subcategoria "Pagamento de Fatura" (dentro
de "Transferência interna") como despesa normal na data real — competência
não muda. Revalidado nos 3 meses após o fix (jan `1.030,92`, fev `1.543,37`,
mar `7.653,54`, todos batendo com Itaú+NuBank real menos salário deferido).
Março também expôs, de novo, o padrão já registrado desde a Sprint 17
(transferência de investimento sem categoria própria — dessa vez R$10.000),
tratado como pauta de sprint futura, não corrigido aqui.

**Bloco 3 — guia dos cards:** [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md)
novo, não técnico, cobrindo todos os cards do Dashboard (Saldo, Saldo
Acumulado, Saldo Anterior, Receita, Despesa, Ativos, Passivos, Patrimônio, e
o drill-down "Saldo por conta") e o efeito do toggle Competência/Caixa —
escrito só depois de os Blocos 1/2 fecharem, pra documentar o comportamento
final, não uma hipótese.

PRD: [PRD-018-edicao-data-saldo-acumulado-guia-cards.md](../prd/PRD-018-edicao-data-saldo-acumulado-guia-cards.md).
Plano: [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md](../sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md).
Relatório: [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md](../sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md).

## Gestão de Investimentos, Blocos 1+2 (Sprint 19)

- **`Investimento` (migration `0015`):** agrupamento lógico definido pelo
  usuário (`nome` só), tabelas `investimentos`/`investimento_categorization_rules`
  (mirror exato de `assets`/`asset_categorization_rules`). Colunas novas:
  `pluggy_accounts.investimento_id` (FK nullable — uma carteira pertence a no
  máximo um Investimento, sem tabela de junção, mesmo padrão de `asset_id` em
  `pluggy_transactions`) e `pluggy_transactions.investimento_id`/
  `investimento_sugerido_id`/`investimento_sugestao_confianca`. Seed do grupo
  "Investimentos" (`excluir_de_totais=false` — decisão do CEO: Aporte/Resgate
  contam nos totais normais de Despesa/Receita) com subcategorias "Aporte"
  (despesa) e "Resgate" (receita).
- **`app/investimentos/` novo:** CRUD isolado por `user_id` (mesmo padrão de
  `app/assets/`) + `GET /investimentos/{id}/evolucao` — `saldo_base` (soma de
  `saldo_inicial` das carteiras vinculadas), `saldo_atual` (soma de `saldo`
  ao vivo), `total_aportes`/`total_resgates` (só transações **confirmadas**),
  `rendimento_estimado = saldo_atual − saldo_base − aportes + resgates`,
  rotulado como estimativa em toda superfície (nunca dado oficial da Pluggy —
  absorve variação de mercado e qualquer renda não capturada). `delete_investimento`
  desassocia carteiras E transações vinculadas (dois caminhos, sem excluir
  nenhuma), mesmo princípio de `delete_asset`.
- **Sugestão automática (`app/categorization/engine.py`):**
  `suggest_investimento`/`build_investimento_rules_index`/
  `build_investimento_historico_index` — clone 1:1 da cascata de 3 camadas já
  usada para Ativo (regra exata > histórico confirmado exato > similaridade
  `difflib >= 0.86`), plugada em `_apply_suggestions`
  (`app/categorization/service.py`) junto das sugestões de categoria/ativo/
  passivo já existentes. `PUT /categorization/transactions/{id}/investimento`
  novo, mesmo padrão de `.../asset`.
- **`GET /dashboards/por-investimento`(`/tendencia`):** clones de `por-ativo`
  (`app/dashboards/service.py`) — **nenhuma mudança** em `_base_query`/
  `_patrimonio_breakdown`/`get_saldo_acumulado`, já que aporte/resgate
  acontecem na conta corrente de origem/destino (não numa conta
  `tipo=investimento`), fluindo pelos totais existentes sem lógica de
  exclusão nova — testado como regressão explícita (totais idênticos
  antes/depois da introdução do grupo "Investimentos" pra transação não
  relacionada).
- **Frontend:** `InvestimentosPage.tsx` nova (clone estrutural de
  `AssetsPage.tsx` — cards com saldo atual/rendimento estimado/carteiras
  vinculadas, drilldown fora do card com toggle Aporte/Resgate, sparkline);
  `InvestimentoSelectCell` em `TransactionEditCells.tsx` e coluna
  "Investimento" em `TransactionsTable`/`CategorizationReviewPage` (mesmo
  padrão de `AssetSelectCell`); `<select>` de vínculo carteira→investimento
  em `AccountManagementPage.tsx`, restrito a linhas `tipo=investimento`
  (trava só de UI, não de backend — decisão explícita do PRD). Aba
  "Investimentos" nova em `ProtectedPage.tsx`, entre "Ativos" e "Passivos".
  **Nota de correção:** `PUT /pluggy/accounts/{id}` é full-replace
  (`PluggyAccountUpdateIn.investimento_id` default `None`) — `updatePluggyAccount`
  no frontend passou a exigir `investimentoId` explícito em toda chamada
  (inclusive edição de apelido/toggle de sync), preservando o vínculo atual
  da conta; sem isso, qualquer edição de apelido desvincularia a carteira
  silenciosamente.
- **Bloco 3 (investigação com dado real) — achado real, escopo maior que o
  previsto, não implementado nesta sprint:** com Nubank Investimentos e XP
  sincronizadas na VM de dev, a inspeção read-only mostrou que (a) o item
  Nubank Investimentos sincroniza sem erro mas retorna zero contas do
  endpoint genérico `GET /accounts`; (b) o item XP retorna 3 contas, nenhuma
  classificada `tipo=investimento` pelo `_map_account_tipo` existente, mas
  uma delas (tipo `corrente`) carrega dezenas de transações reais de
  dividendos/JCP com `categoria_pluggy = "Proceeds interests and dividends"`/
  `"Taxes on investments"`. Rendimento *incidental* já flui pelo endpoint
  genérico já integrado — mas a visão completa de posições/holdings (CDBs,
  ações) exige as rotas dedicadas de Investments da Pluggy (`/investments`,
  `/investments/transactions`), nunca chamadas neste projeto. CEO decidiu não
  implementar a subcategoria "Rendimento" nem soltar o filtro de tipo de
  conta agora — a integração completa de Investments vira a **próxima
  sprint**, já confirmada (ver [docs/roadmap.md](../roadmap.md), "Registro de
  reavaliações futuras").

PRD: [PRD-019-gestao-de-investimentos.md](../prd/PRD-019-gestao-de-investimentos.md).
Plano: [SPRINT-019-gestao-de-investimentos-plan.md](../sprints/SPRINT-019-gestao-de-investimentos-plan.md).
Relatório: [SPRINT-019-gestao-de-investimentos-report.md](../sprints/SPRINT-019-gestao-de-investimentos-report.md).

## Integração completa de Investments da Pluggy (Sprint 20)

- **Bloco 1 — investigação read-only (achados reais):** com Nubank Investimentos e XP já sincronizadas desde a Sprint 19, confirmação contra dado real na VM de dev via chamada direta ao `PluggyClient` dentro do container (sem depender de nenhuma rota nova). Achados: `GET /investments` e `GET /investments/{id}/transactions` são **paginados por página** (`{total, totalPages, page, results}`), diferente do cursor (`next`/`after`) usado em `/v2/transactions` — mudança que motivou helper `_get_paginated` novo no `PluggyClient` (loop até `page >= totalPages`). Taxonomia real: Nubank retorna holdings `type=FIXED_INCOME`/`subtype=CDB` ou `TREASURY`; XP retorna `type=EQUITY`/`subtype=STOCK` — `tipo`/`subtipo` armazenados como String livre (não Enum, taxonomia mais volátil que `PluggyAccountTipo`). Campo `codigo` nem sempre igual ao `isin` — schema usa `codigo` mapeado como `code or isin` (fallback). Payload de transação real: `date`/`tradeDate` vêm como meia-noite UTC, convertidas sem shift de fuso (`_parse_investment_date` novo, diferente de `_parse_date` usado em transações bancárias que faz conversão UTC→BRT). Quantidade de CDB tem alta precisão decimal (`1967409.5229`) — motivou `Numeric(20, 8)` em vez de `Numeric(14,2)` do rascunho original. Confirmado: Nubank Investimentos (zero contas) tem 18 holdings; XP (3 contas) tem 4 holdings — sem sobreposição de saldo.
- **Bloco 2 — schema (migration `0016`):** tabelas `pluggy_investments` (holdings: `item_id`, `user_id`, `pluggy_investment_id` unique, `tipo`/`subtipo` String, `nome`, `codigo` nullable, `quantidade` `Numeric(20,8)` nullable, `valor_investido` `Numeric(18,6)` nullable, `valor_atual` `Numeric(14,2)`, `saldo_inicial` nullable — visão-base, mesmo papel de `PluggyAccount.saldo_inicial` —, `moeda`, `investimento_id` FK nullable) e `pluggy_investment_transactions` (ledger interno: `investment_id` FK, `user_id`, `pluggy_investment_transaction_id` unique, `tipo` String, `descricao` nullable, `valor` `Numeric(18,6)`, `quantidade` nullable, `data` Date). **Limite Postgres (63 caracteres de identificador):** índice unique (`ix_pluggy_investment_transactions_pluggy_investment_transaction_id`) e constraint unique (`unique=True` na coluna) do nome SQL gerado excediam o limite — SQLite (testes) não tem esse limite, passou limpo. Corrigido removendo `unique=True` da coluna e criando índice com nome encurtado explícito (`ix_pluggy_investment_tx_ext_id`), mesmo comportamento, sem mudança de schema.
- **Bloco 3 — sync/CRUD/rotas:** `PluggyClient.get_investments(pluggy_item_id)`/`get_investment_transactions(pluggy_investment_id, from_date=None)` novos. `sync_item` estendido pra sincronizar holdings de **todo** item (mesmo os que também retornam contas) via `_upsert_investment`/`_upsert_investment_transaction` (upsert idempotente, resync preserva `investimento_id`/`saldo_inicial` editados manualmente). Novos endpoints: `GET /pluggy/investments` (filtro `investimento_id`), `PUT /pluggy/investments/{id}`, `PUT /pluggy/investments/{id}/saldo-inicial`, `GET /pluggy/investments/{id}/transactions` — todas 401 sem cookie, 404 cross-user, mesmo padrão de isolamento por `user_id`.
- **Bloco 4 — integração com Investimento/Patrimônio:** `get_evolucao` (Sprint 19) estendido: `saldo_base`/`saldo_atual` somam `PluggyInvestment.saldo_inicial`/`valor_atual` das holdings vinculadas além das carteiras já existentes. `_patrimonio_breakdown`: `saldo_investimentos` soma holdings como fonte preferencial por item; contas `tipo=investimento` só entram pra itens **sem** nenhuma holding (subquery, evita dobrar contagem), confirmado sem sobreposição em dado real pós-deploy (R$ 91.196,07).
- **Frontend:** `api/pluggy.ts` ganha `PluggyInvestment`/`PluggyInvestmentTransaction` + fetch novos; hooks `usePluggyInvestments`/`useUpdatePluggyInvestment`/`useUpdatePluggyInvestmentSaldoInicial`/`usePluggyInvestmentTransactions`. `AccountManagementPage.tsx` ganha seção "Posições de investimento" (lista holdings do usuário, mirror da lista de carteiras: vínculo a Investimento + saldo inicial). `InvestimentosPage.tsx`: card ganha tag "Posições: <código/nome>"; drilldown ganha toggle "Extrato"/"Posições", view "Posições" lista holdings em tabela (tipo/subtipo, nome ou código, quantidade, valor atual) com linha expansível mostrando histórico de transações via `GET /pluggy/investments/{id}/transactions`.
- **Testes backend:** 532 testes (era 497), 98% cobertura — novos: `test_pluggy_client.py` (paginação, `from_date`), `test_pluggy_service.py` (sync criando holdings mesmo sem conta, resync preservando vínculo, isolamento), `test_investimento_service.py` (evolução somando holdings, isolamento), `test_dashboards_service.py` (patrimônio somando holdings sem dobra, regressão explícita), `test_pluggy_endpoints.py` (CRUD rotas novas, isolamento, sync end-to-end). Frontend: 181 testes (era 176) — `AccountManagementPage.test.tsx`/`InvestimentosPage.test.tsx` com posições, vínculo, saldo inicial, histórico.
- **Achados/bugs reais encontrados e corrigidos DURANTE o deploy:** (1) **Limite de 63 caracteres de identificador Postgres** — o índice unique (`ix_pluggy_investment_transactions_pluggy_investment_transaction_id`, 66 caracteres) excedeu o limite; SQLite (testes) não tem esse limite, passou limpo antes do deploy real. Postgres fez rollback transacional automático (nenhuma tabela parcial). Corrigido renomeando o índice (`ix_pluggy_investment_tx_ext_id`, 25 caracteres), sem mudança de comportamento. (2) **Caddyfile nunca roteava `/investimentos*` pra API** — achado durante validação ao vivo (browser-check recebeu 405 do nginx, não da API). Bug existe desde a **Sprint 19** (quando InvestimentosPage foi criada), nunca pego porque Sprint 19 validou via TestClient direto (não passa por Caddy) e via curl (só `/pluggy/*`). Corrigido adicionando `/investimentos*` ao matcher `@api` do Caddyfile (linha única). Aplicado direto na VM de dev via `docker compose restart caddy`.
- **Deploy e validação ao vivo:** 2 rodadas (por causa do fix de índice) + fix de infra (Caddyfile). Sync real via `POST /pluggy/items/{id}/sync` para os itens Nubank Investimentos e XP populou 22 holdings e 19 transações de histórico, confirmado via query Postgres. `GET /dashboards/patrimonio/breakdown` confirmado batendo exatamente com soma manual das holdings (R$ 91.196,07). Validação via `scripts/browser-check/check-sprint20.mjs` (novo): desktop + mobile, sem erros de console reais. Script cria 1 Investimento de teste, vincula TAEE11 real (ação da XP), confirma tag "Posições", drilldown "Posições" com tabela e histórico, reverte tudo (desvincula, exclui). Estado final limpo via query Postgres — nenhum dado real do CEO alterado permanentemente.
- **Achado cosmético não corrigido:** coluna "Quantidade" da view "Posições" mostra precisão bruta (`98.00000000` em vez de `98`) — não exigido pelos critérios de aceite do PRD-020.

PRD: [PRD-020-integracao-completa-investments-pluggy.md](../prd/PRD-020-integracao-completa-investments-pluggy.md).
Plano: [SPRINT-020-integracao-completa-investments-pluggy-plan.md](../sprints/SPRINT-020-integracao-completa-investments-pluggy-plan.md).
Relatório: [SPRINT-020-integracao-completa-investments-pluggy-report.md](../sprints/SPRINT-020-integracao-completa-investments-pluggy-report.md).

## Qualidade (Sprint 1 → Sprint 20)

- **Testes backend:** 532 testes (+35, Sprint 20), 98% cobertura total, 98% em
  `app/pluggy_integration/` (paginação read-only). Sprint 20: `PluggyClient.get_investments`/`get_investment_transactions` com paginação (loop até `page >= totalPages`, `from_date` presente/ausente), `_upsert_investment`/`_upsert_investment_transaction` criando holdings mesmo pra item sem conta (caso real Nubank Investimentos), resync sem duplicar e preservando `investimento_id`/`saldo_inicial` editados, isolamento por usuário em CRUD, regressão explícita de Patrimônio (somando holdings sem dobra, itens sem holdings continuam somando por conta); 4 rotas novas (`GET /pluggy/investments`, `/investments/{id}`, `/investments/{id}/saldo-inicial`, `/investments/{id}/transactions`) — 401/isolamento/filtros; `get_evolucao` (Sprint 19) somando holdings; `_patrimonio_breakdown` (Sprint 16) preferindo holdings sobre conta por item; endpoints de investimento (`GET /dashboards/por-investimento`/`tendencia`) regressão (nunca muda totais pré-existentes). Sprint 19 (497, +54): CRUD/isolamento/`get_evolucao` de
  `Investimento` (saldo base multi-carteira, aritmética de
  `rendimento_estimado`, só transações confirmadas), `delete_investimento`
  desassociando carteiras E transações (dois caminhos), sugestão de
  investimento mirror completo dos testes de ativo (regra/histórico
  exato/similaridade/isolamento), `set_transaction_investimento`,
  `update_account` com `investimento_id` (link/unlink/404 cross-user),
  filtro `investimento_id` em `/pluggy/transactions`, `get_por_investimento`/
  tendência, e regressão explícita confirmando que a introdução do grupo
  "Investimentos" não muda nenhum total pré-existente de Despesa/Receita.
  Sprint 18 (99%
  em `app/categorization/service.py`, 98% em
  `app/pluggy_integration/service.py`, 99% em `app/dashboards/service.py`):
  `update_data` recomputando competência por tipo de conta (corrente sem
  deslocamento, cartão via `competencia_padrao`/`caixa`, Salário confirmada
  via `competencia_salario`), rejeição de data futura, 404 cross-user; resync
  preservando `data`/`data_competencia`/`data_caixa` de transação editada
  manualmente (conta corrente e cartão) e continuando a sobrescrever
  transação não editada (regressão); regime caixa excluindo cartão de
  crédito inteiramente e contando "Pagamento de Fatura" como despesa normal
  na data real, sem dobrar com o modelo de compra+1/2 meses — achado real
  durante a investigação do Bloco 2 (ver seção própria), corrigido com
  mudança de código em `_base_query`. Sprint 17 (99% em
  `app/categorization/service.py`): `account_id` isolado e combinado com
  `status` em `list_transactions`, isolamento cross-user (conta de outro
  usuário não vaza nenhuma linha) — sem migration, sem endpoint novo, filtro
  puramente aditivo. Sprint 16 (100% em
  `app/categorization/competencia.py`, 99% em `app/dashboards/service.py`):
  `competencia_padrao`/`caixa` (cartão incondicional, demais tipos sem
  defasagem, inclusive quando a competência já foi deslocada por Salário);
  `_parse_date` (timestamp UTC próximo da virada de dia em BRT, com e sem
  cruzar meia-noite); os 3 pontos de escrita respeitando cartão vs. salário
  vs. default (cartão tem prioridade); cada função de `dashboards/service.py`
  com `regime="caixa"` via um helper `_cartao_com_competencia_deslocada`
  (evento/competência/caixa em meses diferentes, isola qual data cada
  regime usa); `get_saldo_acumulado` excluindo investimento (âncora e
  acumulação, com/sem conta de investimento); Patrimônio — `saldo_investimentos`
  separado de `saldo_liquido_acumulado`, fallback de conta sem `saldo_inicial`
  (sinal correto pra corrente vs. cartão), investimento nunca entra no
  fallback; migration `0013` — backfill contra fixture com cartão histórico,
  clamp de dia, isolamento por transação. Sprint 15 (100% em
  `app/categorization/competencia.py`, 99% em `app/categorization/service.py`
  e `app/dashboards/service.py`, 98% em `app/pluggy_integration/service.py`):
  `shift_to_next_month`/`competencia_salario` (fronteira do dia de corte,
  rollover dez→jan, clamp de dia em fevereiro/ano bissexto); `set_category`/
  `bulk_confirm` — shift pra Salário, sem shift abaixo do corte, reset ao
  recategorizar pra fora de Salário, cutoff por usuário nunca afeta outro;
  `upsert_salario_ajuste_dez_2025` — cria com competência certa, upsert
  idempotente (2ª chamada atualiza em vez de duplicar), `valor=None` deleta,
  isolamento, e regressão explícita de `get_summary`/`get_tendencia`/
  `get_por_categoria` de jan/2026 refletindo a sentinela sem nenhuma mudança
  de código nessas três funções; `get_evolucao_saldo_por_conta` — acumula
  por `data` real (conta comum e cartão de crédito, direções opostas), conta
  sem `saldo_inicial` excluída, isolamento; `get_saldo_acumulado` — âncora
  com/sem sentinela, acumulação mês a mês, isolamento; endpoints novos
  (`POST /auth/logout`, `PUT /auth/me/settings`, `PUT
  /pluggy/accounts/{id}/saldo-inicial`, `GET`/`PUT
  /pluggy/ajuste-salario-dezembro`, `GET /dashboards/evolucao-saldo-por-conta`,
  `GET /dashboards/saldo-acumulado`) — 401/404/isolamento/validação.
  Sprint 14 (100% em
  `app/dashboards/`): `_future_month_range` (meses seguintes, rollover de
  ano), `get_projecao` — média correta sobre a janela passada, exclusão de
  `eventual`/`natureza` nula/`cartao_credito`+`credito`/`excluir_de_totais`
  (mesma base de `_base_query`), valor constante repetido em todos os
  meses futuros, `meses_futuros`/`janela_media` parametrizáveis, isolamento
  por `user_id`; endpoint novo 401 sem cookie, filtros `ano`/`mes`/
  `meses_futuros`/`janela_media`, isolamento entre usuários. Sprint 12 (100% em
  `app/dashboards/`): `get_por_natureza`/`get_tendencia_por_natureza` —
  agrupamento fixa/variável/eventual, fallback `null`→eventual, transação
  sem subcategoria→eventual, exclusão de `excluir_de_totais`, isolamento
  por usuário, sempre 3 buckets mesmo sem dado, percentual somando 100%;
  endpoints novos 401 sem cookie, isolamento entre usuários. Sprint 10 (100% em `app/dashboards/` e `app/categorization/`): `suggest_asset` mirror completo dos testes de categoria (regra > histórico exato > similaridade `>=0.86`, isolamento); `has_asset`/`group_id` isolados e combinados entre si e com filtros existentes; `get_patrimonio_breakdown` batendo exatamente com `summary.patrimonio`; `cartao_credito`+`credito` excluído da receita (o achado do NuTag) enquanto `corrente`+`credito` continua contando normalmente; `GET /dashboards/patrimonio/breakdown` isolado por usuário, 401 sem cookie. Auth (Sprint 1), dados mestres (Sprint 2, 97%), Pluggy (Sprint 3, 98%), categorização (Sprint 4, paginação/filtro ano-mes pós-Sprint 6) — ver histórico nos relatórios de sprint. Dashboards (Sprint 5+6, 100% em `app/dashboards/`): período vazio, período só com "Transferência interna" (totais zerados), misto débito/crédito, sinal do saldo de `cartao_credito` na fórmula de patrimônio, ativos/passivos inativos excluídos, borda de mês (`data_competencia` no limite entre meses), soma de `/por-categoria` batendo com `/summary`, isolamento entre usuários; tendência terminando no mês filtrado (não no calendário), mês sem transação aparecendo zerado, tendência por categoria com bucket "Não categorizado", percentual somando 100% (menos arredondamento) e retornando `0` com denominador zero. Categorização/Pluggy (Sprint 7, 99%): filtro status/tipo em todas as combinações, bulk-confirm parcial (linha inválida não bloqueia as demais), `set_category` em transação já confirmada, propagação de descrição (match normalizado + mesma categoria, isolamento por usuário, "primeira grava, segunda não sobrescreve"), `sync_item`/`sync_items` pulando conta com `sync_enabled=False`, `apelido` preservado em resync. Gestão de Ativos (Sprint 8, 100% em `app/assets/` e `app/dashboards/`): `get_por_ativo` filtrando por `tipo` (período vazio, ativo sem transação vinculada, isolamento), `get_tendencia_por_ativo` zero-preenchendo meses sem transação e isolado por `tipo`/usuário, filtro `asset_id`/`tipo` em `/pluggy/transactions` combinados com outros filtros, `delete_asset` desassociando transações vinculadas em vez de falhar. Ativos/Passivos no Dashboard (Sprint 9, 100% em `app/dashboards/`): `suggest_liability` (substring, isolamento, sem match), `set_transaction_liability` (sets/clears, 404 cross-user), `delete_liability` desassociando (crítico, mirror de `delete_asset`), `get_por_passivo`/`get_tendencia_por_passivo` (nunca soma crédito, zero-preenchida, isolamento), `get_saldo_por_conta` (apelido→nome, isolamento), `summary.ativos`/`summary.passivos` batendo com a mesma base de `patrimonio`, filtro `liability_id` combinado com outros filtros, `account_tipo` na resposta de `/pluggy/transactions`. Revisão pós-entrega: `_upsert_account` persistindo/deixando `None` os campos de `creditData`, `get_saldo_por_conta` de cartão somando a janela da fatura (limite, exclui fora da janela, nunca soma crédito, cai pro saldo bruto sem `fatura_vencimento`), `_subtract_month` (rollover de ano, clamp de dia).
- **Testes frontend:** 181 testes (+5, Sprint 20), Vitest + Testing Library. Sprint 20: `AccountManagementPage.test.tsx` (lista de posições renderiza tipo/valor formatado, vínculo via `PUT /pluggy/investments/{id}`, saldo inicial via `PUT .../saldo-inicial`), `InvestimentosPage.test.tsx` (card lista posições vinculadas, view "Posições" mostra posição, expande histórico via `GET /pluggy/investments/{id}/transactions`), suíte 100% verde sem regressão. Sprint 19 (176, +10): `InvestimentosPage.test.tsx` novo (clone de `AssetsPage.test.tsx` — cards com saldo/rendimento/carteiras vinculadas, CRUD, drilldown fora do card com toggle Aporte/Resgate, sparkline); `AccountManagementPage.test.tsx` ganha vínculo carteira→investimento via `PUT /pluggy/accounts/{id}` (full-replace, `investimento_id` sempre presente no payload); `CategorizationReviewPage.test.tsx` ganha sort por coluna Investimento; `api/dashboards.test.ts` ganha `fetchDashboardPorInvestimento`/tendência; `ProtectedPage.test.tsx` atualizado pra nav com "Investimentos" — suíte 100% verde, sem regressão. Sprint 18: `TransactionEditCells.test.tsx` ganha `DateCell` (edição via clique/digitação/blur, payload correto, indicador visual presente/ausente conforme `data_editada_manualmente`); `CategorizationReviewPage.tsx` troca a coluna Data estática por `<DateCell />`; `DashboardsPage.tsx` ganha nota explicativa no card/drill-down de "Saldo Acumulado" — suíte 100% verde, sem regressão. Sprint 17: `CategorizationReviewPage.test.tsx` ganha `<select>` "Conta" populado via `usePluggyAccounts` (fixture `/pluggy/accounts` nova em `baseHandlers`) e refetch com `account_id` no request ao trocar a seleção — suíte 100% verde, sem regressão. Sprint 15: `ConfiguracoesPage.test.tsx` novo (3 seções, logout chamando `POST /auth/logout`, form de dia de corte chamando `PUT /auth/me/settings`, form de salário de dezembro chamando `PUT /pluggy/ajuste-salario-dezembro`); `DashboardsPage.test.tsx` estendido (cards "Saldo Acumulado"/"Saldo Anterior" a partir da série mockada, rótulo com mês/ano do ponto anterior, clique em "Saldo Anterior" alertando em jan/2026 vs. navegando o filtro em outro mês, drill-down com `TrendChart`); `AccountManagementPage.test.tsx` estendido (edição de saldo inicial via `PUT /pluggy/accounts/{id}/saldo-inicial`, tabela de auditoria mensal a partir de fixture); `ProtectedPage.test.tsx` (nav com "Configurações" no lugar de "Gestão de contas", troca de aba) — suíte 100% verde, sem regressão. Sprint 14: `utils/projecao.test.ts` novo (`applyHipoteticas` — hipotética única só afeta o mês-alvo, mensal afeta todos os meses do horizonte, múltiplas hipotéticas somam corretamente no mesmo mês, mês-alvo fora do horizonte não quebra nem afeta nada); `ProjecaoPage.test.tsx` novo (cards com a média calculada a partir das fixtures de histórico+projeção, hipotética mensal/única recalculando os cards sem nenhuma chamada de rede nova, remover restaura os valores originais, trocar o horizonte dispara uma query nova); `api/dashboards.test.ts` atualizado (`fetchDashboardProjecao` com/sem `janela_media`); `ProtectedPage.test.tsx` (nav com "Projeção", troca de aba) — suíte 100% verde, sem regressão. Sprint 13: `categoriaGrouping.test.ts` novo (soma por `group_id`, percentual somando 100%, ordenação desc, entrada vazia); `NaturezaPage.test.tsx` reescrito para o funil de 4 níveis (clique em Categoria antes de Subcategoria, percentuais somando 100% em cada nível novo, múltiplas categorias expandidas ao mesmo tempo, sort de Categoria/Subcategoria na tabela de classificação preservando o agrupamento por `rowSpan`); `AssetsPage.test.tsx`/`LiabilitiesPage.test.tsx` ganham teste de sort na tabela unificada (Data/Valor); `CategorizationReviewPage.test.tsx` ganha teste de sort novo — suíte 100% verde, sem regressão. Sprint 12: `NaturezaPage.test.tsx` novo (3 cards com totais/percentuais mockados, drill-down natureza→subcategoria incluindo subcategoria não classificada caindo em "eventual", clique em subcategoria mostrando transações, tabela de classificação agrupada por categoria com `null`→"eventual" no `<select>`, edição salvando via `PUT /subcategories/{id}` com payload completo e refazendo as chamadas de `por-natureza`, toggle despesa/receita), `ProtectedPage.test.tsx` (nav com "Natureza", troca de aba), `api/categories.test.ts` novo (primeira cobertura direta do módulo — `fetchCategoryGroups`/`fetchSubcategories`/`updateSubcategory`, incluindo `natureza: null`), `api/dashboards.test.ts` atualizado (`fetchDashboardPorNatureza`/`fetchDashboardPorNaturezaTendencia`). Sprint 11: `CategoryCombobox.test.tsx` novo (abrir via clique/foco, filtro por digitação case/acento-insensível, filtro por nome de grupo, seleção por clique e por teclado, `Escape` cancela sem aplicar, padrão ARIA completo, `disabled`), `TransactionEditCells.test.tsx` novo (primeira cobertura direta de `CategorySelectCell`/`AssetSelectCell`/`DescriptionCell`), `CategorizationReviewPage.test.tsx` atualizado (interação via combobox no lugar de `selectOptions`, badge de status, seleção bufferizada em linha pendente) e `DashboardsPage.test.tsx` (interação de categoria no drill-down via combobox) — suíte 100% verde, sem regressão. Sprint 10: `LiabilitiesPage.test.tsx` (mirror de `AssetsPage.test.tsx` — listar ativos/quitados, criar/editar/quitar+idempotência 400/excluir, drill-down com edição inline), `CardSparkline.test.tsx` atualizado pra `pontos`, `ProtectedPage.test.tsx` (nav sem Início, ordem final, troca de aba), filtros novos e ícone débito/crédito em `CategorizationReviewPage.test.tsx`, edição inline no drill-down do Dashboard invalidando `dashboardSummary` em `DashboardsPage.test.tsx`. Dashboards (Sprint 5+6): cards a partir de dado mockado, refetch ao trocar filtro ano/mês, sparkline a partir de tendência mockada, refetch ao trocar seletor de período histórico, sanfona expandindo múltiplos níveis sem esconder os anteriores (e mantendo duas categorias expandidas ao mesmo tempo), percentual exibido em cada nível, estado vazio. Categorização (Sprint 7): filtro tipo/status disparando refetch, seleção em lote + "Aprovar marcadas" chamando bulk-confirm, edição de descrição + propagação chamando o endpoint certo, aceitar sugestão de descrição. Gestão de Contas (Sprint 7): apelido/sync_enabled salvos via PUT, diálogo de sincronização unificada pré-selecionado a partir de `sync_enabled` e confirmando com os `item_ids` corretos, fluxo de conexão via widget Pluggy Connect. Gestão de Ativos (Sprint 8): listar ativos/baixados, criar/editar/vender (idempotência refletindo o 400 do backend)/excluir, drill-down abrindo fora do card mostrando total+transações, toggle despesa/receita refazendo as chamadas com o `tipo` selecionado, sparkline no card quando há dado de tendência; `PeriodFilter` isolado disparando `onChange` ao trocar mês/ano. Ativos/Passivos no Dashboard (Sprint 9): cards Ativos (com toggle)/Passivos (sem toggle) abrindo o drill-down correto, card Saldo ignorando o filtro ano/mês, ícone de meio de pagamento por linha, ordenação por coluna (clique no cabeçalho, alterna asc/desc), `CardSparkline`/`TrendChart`/`useTableSort` isolados; `AssetsPage.test.tsx` sem mudança de assertion pós-refactor. Revisão pós-entrega: funil Categoria>Tipo>Transação (sanfona nos dois níveis, percentual em cada nível contra o total do nível acima), ícone dentro da célula Valor, coluna % ordenável, limite de crédito entre parênteses no card do cartão, `categoryColors.test.ts` isolado (atribuição estável por id, wrap após 8 grupos, fallback neutro, tint por grupo).
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
