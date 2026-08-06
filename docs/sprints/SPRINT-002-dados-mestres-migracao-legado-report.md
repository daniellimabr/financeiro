# SPRINT-002: Dados mestres + migração de categorias do legado — Relatório

- **Plano:** [SPRINT-002-dados-mestres-migracao-legado-plan.md](./SPRINT-002-dados-mestres-migracao-legado-plan.md)
- **PRD:** [PRD-002-dados-mestres-migracao-legado](../prd/PRD-002-dados-mestres-migracao-legado.md)
- **Data do relatório:** 2026-08-06
- **Status:** aprovado pelo CEO em 2026-08-06

## Resumo

Sprint 2 entregou schema + CRUD completo de categorias/subcategorias (globais)
e ativos/passivos (isolados por usuário), com baixa de ativo e quitação de
passivo idempotentes, e o script de import das 51 categorias/subcategorias
confirmadas do Financeiro v1, rodado com sucesso contra o Postgres real da VM
de dev. 51 testes novos (unit + integração), 97% de cobertura nos módulos da
sprint. Épico E4 fechado; parte de categorias do E8 fechada (import da memória
de classificação segue pendente, aguardando arquivo do CEO).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Modelos + migration `0002` (category_groups, subcategories, natureza) | **Feito** | `app/models/category.py`, `alembic/versions/0002_create_categories.py` |
| 2 | Schemas + service + router CRUD category_groups/subcategories | **Feito** | `app/schemas/category.py`, `app/categories/{service,router}.py` — nome único case-insensitive validado na camada de serviço |
| 3 | Modelos + migration `0003` (assets, liabilities) | **Feito** | `app/models/{asset,liability}.py`, `alembic/versions/0003_create_assets_liabilities.py` |
| 4 | Schemas + service + router CRUD assets/liabilities + sell/settle | **Feito** | `app/schemas/{asset,liability}.py`, `app/assets/{service,router}.py`, `app/liabilities/{service,router}.py` |
| 5 | Script de import `import_legacy_categories.py` | **Feito** | Upsert por (grupo, subcategoria), merge sem sobrescrever, log de conflito — `backend/scripts/import_legacy_categories.py` |
| 6 | Testes unitários | **Feito** | Nome único (grupo/subcategoria), natureza inválida (422 via Pydantic), sell/settle idempotentes, merge do import — ver evidência abaixo |
| 7 | Testes de integração | **Feito** | CRUD completo (200/401/404/400), isolamento `user_id` entre dois usuários, import contra fixture CSV |
| 8 | Rodar import real na VM de dev | **Feito** | 15 grupos, 51 subcategorias, 0 conflitos — confirmado direto no Postgres (ver seção "Validação na VM de dev") |
| 9 | Atualizar docs vivos | **Feito** | OVERVIEW.md, directory-structure.md, legacy-data.md (ver seção "Documentação atualizada") |
| 10 | Relatório de sprint | **Feito** | Este arquivo |

## Evidência de testes

```
======================= 51 passed, 64 warnings in 1.99s =======================

Name                          Stmts   Miss  Cover   Missing
-----------------------------------------------------------
app\assets\router.py             41      0   100%
app\assets\service.py            41      0   100%
app\auth\deps.py                 18      1    94%   24
app\auth\router.py               28      2    93%   19-20
app\categories\router.py         68     10    85%   50-51, 65-68, 91-92, 99-100
app\categories\service.py        73      0   100%
app\db.py                        13      4    69%   17-21
app\exceptions.py                 3      0   100%
app\liabilities\router.py        41      0   100%
app\liabilities\service.py       40      0   100%
app\models\asset.py              26      0   100%
app\models\category.py           26      0   100%
app\models\liability.py          24      0   100%
app\schemas\asset.py             25      0   100%
app\schemas\category.py          23      0   100%
app\schemas\liability.py         21      0   100%
-----------------------------------------------------------
TOTAL                           593     17    97%
```

Cobertura de lógica de negócio nos módulos novos da Sprint 2: **97%** (meta
≥80%, hard gate desta sprint). `app/db.py` (69%) e trechos de `app/auth/*` são
código pré-existente da Sprint 1, não tocado nesta sprint. Suíte rodada
localmente (venv dedicado, `backend/.venv`); o CI do GitHub Actions roda a
mesma suíte a cada push — não verificado diretamente nesta sessão por falta de
acesso ao `gh` CLI, recomendo o CEO conferir a run mais recente em
[actions](https://github.com/daniellimabr/financeiro/actions) antes de aprovar.

## Lint/formatter

```
All checks passed!
49 files already formatted
```

## Decisões tomadas durante a execução

- **Nome único case-insensitive de `category_groups`/`subcategories`** validado
  na camada de serviço (`func.lower(...)` na query), não via índice funcional
  no banco — mais simples e suficiente para o volume esperado; unicidade
  exata (case-sensitive) também garantida por constraint no banco como rede de
  segurança.
- **`assets`/`liabilities`**: schema/CRUD reaproveitam o padrão de módulo já
  usado em `app/auth/` (um `service.py` + `router.py` por domínio), em vez de
  criar uma camada genérica de repositório — consistente com o resto do
  código e sem abstração prematura.
- **Erros de domínio centralizados** em `app/exceptions.py`
  (`DuplicateNameError`/`NotFoundError`/`InvalidStateError`), convertidos em
  400/404/400 pelos routers — evita repetir `try/except HTTPException` ad hoc
  em cada endpoint.

## Bugs encontrados e corrigidos durante a validação de deploy

Nenhum destes apareceu nos testes locais (SQLite não usa enum nativo, e o
Caddy/Dockerfile não são exercitados por pytest) — só surgiram ao validar de
verdade na VM de dev. Registrados aqui porque não estavam previstos no plano:

1. **Enum duplicado no Postgres (`type "natureza" already exists"`)** — as
   migrations `0002`/`0003` criavam o enum explicitamente (`.create()`) e
   também o referenciavam numa coluna dentro de `op.create_table`, que por
   padrão tenta criar o mesmo tipo de novo. Primeira tentativa de correção
   (`create_type=False` em `sa.Enum` genérico) não funcionou porque esse
   kwarg só existe em `sqlalchemy.dialects.postgresql.ENUM`, não no `Enum`
   genérico — silenciosamente ignorado. Corrigido usando `postgresql.ENUM`
   explícito nas migrations. Validado rodando a migration (upgrade e
   downgrade) contra um banco descartável no Postgres real da VM antes do
   deploy final, para não repetir o ciclo de tentativa-e-erro num ambiente
   compartilhado.
2. **`Dockerfile` não copiava `backend/scripts/`** — o script de import não
   existia dentro da imagem da API. Corrigido com `COPY scripts ./scripts`.
3. **Caddy não roteava as rotas novas para a API** — `Caddyfile` só conhecia
   `/auth/*` e `/health`; `/category-groups`, `/subcategories`, `/assets`,
   `/liabilities` caíam no frontend estático (devolvendo 200 do SPA em vez de
   401 da API). Corrigido adicionando os paths ao matcher `@api`. Também
   descoberto que `docker compose up -d` sozinho **não** reinicia o Caddy
   quando só o `Caddyfile` muda (é volume montado, não parte da imagem) —
   precisa de `docker compose restart caddy` explícito. Ambos os aprendizados
   registrados em OVERVIEW.md para não repetir na Sprint 3.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Import popula as combinações grupo/subcategoria do CSV confirmado, sem duplicar, conflitos logados | **Sim** (com nota) | Rodado na VM de dev: 15 grupos, 51 subcategorias, 0 conflitos, confirmado via `select count(*)` no Postgres. **Nota:** a lista real do CEO tem 51 pares/15 grupos, não "50 pares/16 grupos" como a prosa de `legacy-data.md` dizia — divergência só na contagem em texto, a lista em si (a fonte confirmada) sempre esteve certa; linha corrigida nesta sprint |
| 2. `POST /category-groups`/`subcategories` com nome duplicado → erro de validação | **Sim** | `test_create_duplicate_category_group_returns_400`, `test_update_category_group_to_duplicate_name_returns_400` |
| 3. Venda de ativo (`sell`) muda status para `baixado`; segunda venda falha | **Sim** | `test_sell_asset_then_second_sell_fails` (unit + integração) |
| 4. Quitação de passivo (`settle`) muda status para `quitado` | **Sim** | `test_settle_liability_then_second_settle_fails` |
| 5. Usuário A não vê ativos/passivos do usuário B | **Sim** | `test_user_does_not_see_other_users_assets`, `test_user_does_not_see_other_users_liabilities`, `test_get_other_users_asset_returns_404` |
| 6. Rotas sem cookie válido → 401 | **Sim** | Testado em todos os routers; confirmado também via `curl` direto na VM pós-deploy (ver seção de bugs, item 3) |
| 7. CI com cobertura ≥80% nos módulos novos | **Sim (local)** | 97% local — CI não conferido diretamente nesta sessão, recomendo checagem do CEO |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção "Dados mestres (Sprint 2)" nova
  (tabelas, endpoints, isolamento, import); roteamento Caddy atualizado com os
  paths novos e a lição do `docker compose restart caddy`.
- `docs/directory-structure.md` — árvore do `backend/` atualizada com
  `app/categories/`, `app/assets/`, `app/liabilities/`, `app/exceptions.py`,
  `app/schemas/{category,asset,liability}.py`, `backend/scripts/`,
  migrations `0002`/`0003`, testes novos; seção "o que ainda não existe"
  revisada.
- `docs/migration/legacy-data.md` — contagem corrigida (15 grupos/51 pares).
- `docs/roadmap.md` — não tocado nesta sprint (fechamento de E4 fica
  registrado aqui no relatório; roadmap já listava Sprint 2 corretamente).

## Validação na VM de dev

Sequência completa executada via `scripts/ssh-vm.ps1 dev`:

1. `git pull` + `docker compose up -d --build` (rebuild de `api`/`frontend`).
2. Migrations `0002`/`0003` aplicadas automaticamente no boot do container
   `api` (`alembic upgrade head` no `docker-compose.yml`).
3. Antes de tocar o banco real: migration validada (upgrade **e** downgrade)
   contra um banco Postgres descartável (`test_migration_check`, criado e
   destruído dentro do próprio container `postgres` já rodando) — só depois
   disso o deploy real foi feito.
4. Import real: `docker compose exec api python scripts/import_legacy_categories.py`
   → 15 grupos, 51 subcategorias, 0 conflitos.
5. Confirmado direto no Postgres: `select count(*)` em `category_groups` (15),
   `subcategories` (51), `assets`/`liabilities` (0, como esperado).
6. Confirmado via `curl` na porta pública (8080): `/health` → 200,
   `/category-groups`, `/assets`, `/liabilities` → 401 sem cookie (prova de
   que a rota chega na API, não no frontend).

## Consumo estimado de tokens/sessões

Sessão única, mais longa que a Sprint 1 por causa dos três bugs de deploy
encontrados e corrigidos em produção-de-dev (enum duplicado, Dockerfile
incompleto, roteamento Caddy) — nenhum deles aparece em teste local, só na
validação real na VM. Recomendo manter esse padrão de "validar contra um
banco descartável antes de tocar o banco real" quando migrations mexerem em
tipos nativos do Postgres (enums), já que SQLite não pega esse tipo de bug.

## Pendências e próximos passos sugeridos

- Import da memória de classificação (E8) segue bloqueado até o CEO entregar
  o arquivo real — não bloqueia a Sprint 3.
- CI do GitHub Actions: recomendo o CEO conferir a run do push mais recente
  (`main`) antes de aprovar esta sprint, já que não confirmei diretamente
  nesta sessão.
- Frontend de gestão de categorias/ativos/passivos: fora de escopo (decisão
  registrada no PRD-002), fica para quando E5/E6/E3 exigirem uma tela real.
- Sprint 3 (E2 Pluggy + E3 categorização) está desbloqueada:
  `category_groups`/`subcategories` já existem e estão populadas.
