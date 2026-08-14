# SPRINT-004: Categorização automática — Plano

- **PRD(s):** [PRD-004-categorizacao-automatica](../prd/PRD-004-categorizacao-automatica.md)
- **Data do plano:** 2026-08-14

## Objetivo da sprint

Ao final, transações sincronizadas via Pluggy aparecem numa fila de revisão
com sugestão automática de categoria (e, quando aplicável, de ativo
associado) — nunca aplicada sozinha. O usuário confirma ou edita cada
sugestão pela UI, e a memória de classificação do Financeiro v1 (328 regras,
arquivo já entregue pelo CEO) está importada e alimentando o motor.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Mover `semente-classificacao.json` da raiz para `backend/scripts/data/semente-classificacao.json` (`git mv`) | Sonnet: implementação | — |
| 2 | Modelo `CategorizationRule` (`app/models/categorization.py`) + migration `0005_create_categorization_rules.py`; exportar em `app/models/__init__.py` | Sonnet: implementação | PRD-004 §Dados e modelo; [0002_create_categories.py](../../backend/alembic/versions/) (padrão de tabela nova com enum/unique) |
| 3 | Alterar `PluggyTransaction` (`app/models/pluggy.py`): novo enum `PluggyTransactionCategorizacaoStatus`, 9 colunas novas (sugestão de categoria + associação de ativo), índice composto `(user_id, categorizacao_status)` + migration `0006_add_categorization_and_asset_fields_to_pluggy_transactions.py` | Sonnet: implementação | PRD-004 §Dados e modelo; [0004_create_pluggy_tables.py](../../backend/alembic/versions/) (padrão `checkfirst=True`/`create_type=False`) |
| 4 | `app/categorization/normalize.py`: `normalize_description()` (NFKD→ASCII→minúsculas, prefixos de canal/pagamento, remoção de pontuação/tokens numéricos, colapso de espaços) | Sonnet: implementação | PRD-004 §Regras de negócio; [legacy-data.md](../migration/legacy-data.md) §3 (lições de normalização do v1) |
| 5 | `app/categorization/engine.py`: `suggest_category()` (camada 1a regra, 1b histórico exato, 2 similaridade `difflib >= 0.86`) e `suggest_asset()` (heurística contains normalizado) | Sonnet: implementação | PRD-004 §Regras de negócio, §Critérios de aceite 3-4 |
| 6 | `app/categorization/service.py`: `list_pending_transactions()` (recalcula e persiste sugestões, filtra `categorizacao_status=pendente`, isolado por `user_id`), `confirm_categorization()`, `set_transaction_asset()` | Sonnet: implementação | PRD-004 §Critérios de aceite 2, 5, 6, 7 |
| 7 | Schemas Pydantic (`app/schemas/categorization.py`: `PendingTransactionOut`, `CategorizationConfirmIn`, `AssetAssociationIn`) + `router.py` (`GET /categorization/pending`, `POST /categorization/pending/{id}/confirm`, `PUT /categorization/pending/{id}/asset`) + registro em `main.py` | Sonnet: implementação | [app/schemas/pluggy.py](../../backend/app/schemas/pluggy.py), [app/pluggy_integration/router.py](../../backend/app/pluggy_integration/router.py) (padrão de mapeamento de exceptions) |
| 8 | Script `backend/scripts/import_legacy_categorization_rules.py`: `import_legacy_rules(db, user_id, json_path)` (resolve `"Grupo/Subcategoria"`, normaliza, upsert por `(user_id, padrao_normalizado)`, loga conflito/não-resolvido), `main()` com `--user-email` obrigatório | Sonnet: implementação | [import_legacy_categories.py](../../backend/scripts/import_legacy_categories.py) (padrão de script standalone) |
| 9 | Testes unitários: `test_categorization_normalize.py`, `test_categorization_engine.py` (precedência de camadas, fronteira 0.86, isolamento por usuário), `test_categorization_service.py` (invariante "nunca auto-confirma", confirmar/editar, 404 cross-user) | Sonnet + skill tdd-workflow | PRD-004 §Critérios de aceite 2-7 |
| 10 | Testes de integração: `test_categorization_endpoints.py` (401, isolamento entre dois usuários, confirmar/editar via API), `test_import_legacy_categorization_rules.py` + fixture (conflito, idempotência, categoria não resolvida, abort sem usuário) | Sonnet + skill tdd-workflow | PRD-004 §Critérios de aceite 1, 7, 8, 9 |
| 11 | Frontend: `api/categories.ts`+`useCategoryGroups.ts`/`useSubcategories.ts` e `api/assets.ts`+`useAssets.ts` (pré-requisitos ainda inexistentes), `api/categorization.ts`, `usePendingCategorizations.ts`, `useConfirmCategorization.ts`, `useSetTransactionAsset.ts`, `pages/CategorizationReviewPage.tsx`, aba `"categorizar"` em `ProtectedPage.tsx` | Sonnet: implementação | [pages/TransactionsPage.tsx](../../frontend/src/pages/TransactionsPage.tsx) (padrão de tabela simples), [api/pluggy.ts](../../frontend/src/api/pluggy.ts) |
| 12 | Testes Vitest: `api/categorization.test.ts`, `CategorizationReviewPage.test.tsx` (fetch mockado, confirmar linha remove da lista) | Sonnet + skill tdd-workflow | PRD-004 §Critérios de aceite 10 |
| 13 | `Caddyfile`: adicionar `/categorization*` ao matcher `@api` | Sonnet: implementação | [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) (lição de rota caindo no SPA, Sprint 2) |
| 14 | Deploy na VM de dev: `git pull` + `docker compose pull` + `docker compose up -d` + `docker compose restart caddy` → rodar `import_legacy_categorization_rules.py --user-email <email do CEO, confirmar antes>` contra o arquivo real → validação manual ponta a ponta no navegador | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md); PRD-004 §Regras de negócio (atribuição das regras ao CEO) |
| 15 | Atualizar docs vivos (`OVERVIEW.md` — tabela nova, colunas novas, endpoints, rota Caddy; `directory-structure.md` — módulo novo; `legacy-data.md` — pendência de memória de classificação passa a "recebida e importada") | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, legacy-data.md |
| 16 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** normalização (acentos, cada prefixo de canal,
  token numérico vs. alfanumérico misto, string vazia); precedência de
  camadas do motor (regra > histórico exato > similaridade, mesmo quando
  similaridade teria score alto); fronteira exata de `ratio() >= 0.86`
  (com `SequenceMatcher` real); nenhuma sugestão quando nada casa;
  isolamento por usuário nas sugestões de categoria e de ativo; invariante
  "sugestão nunca escreve em `subcategory_id`/`asset_id`" mesmo após
  listar pendentes repetidamente; upsert do import (conflito não
  sobrescreve, categoria não resolvida é logada e pulada, usuário
  inexistente aborta).
- **Integração:** `/categorization/*` retornam 401 sem cookie; usuário A
  não vê nem altera regras/sugestões/transações do usuário B; confirmar
  categoria remove a transação da listagem de pendentes; reconfirmar com
  outra subcategoria reedita sem erro; `PUT .../asset` seta e limpa
  `asset_id`; FK inválida (subcategoria/asset inexistente ou de outro
  usuário) retorna 404.
- **Frontend (Vitest):** tela de revisão renderiza sugestão pré-preenchida;
  confirmar uma linha chama a API e a remove da lista após refetch.
- Todos executados localmente e na VM de dev via `scripts/ssh-vm.ps1 dev
  "..."`. Meta ≥80% de cobertura nos módulos novos — hard gate, mesmo
  padrão das Sprints 2 e 3. Testes automatizados não dependem do arquivo
  real `semente-classificacao.json` (usam fixture própria); o import real
  só roda manualmente na VM de dev, após confirmação do e-mail do CEO.

## Impacto no roadmap

Fecha o épico E3 (categorização) e destrava E8 (a memória de classificação
do legado, pendência desde a Sprint 2, é importada nesta sprint). Produz o
primeiro dado categorizado real, necessário para desenhar E5/E6
(dashboards) nas sprints seguintes, conforme já registrado em
`docs/roadmap.md`.

## Riscos / dependências

- Depende de decidir corretamente qual `users.email` real recebe as 328
  regras importadas — confirmar com o CEO antes de rodar o script contra
  dado real (não é um risco de teste automatizado, só da etapa manual na
  VM de dev).
- O motor reduzido (2 camadas) pode gerar poucas sugestões de alta
  confiança fora do conjunto das 328 regras importadas até o usuário
  confirmar mais transações manualmente (a camada de histórico próprio só
  cresce com uso) — esperado, não é regressão; camadas adicionais (token
  distintivo/IDF, léxico PT-BR) ficam para uma sprint futura de
  calibração se a taxa de sugestão ficar baixa demais na validação manual.
- Heurística de sugestão de ativo é nova (sem precedente do v1) — validar
  na prática se o "contains" simples gera falsos positivos/negativos
  úteis; se não, é ajuste pontual, não retrabalho arquitetural.
- Lição já registrada nas Sprints 2/3: `Caddyfile` é volume, não faz parte
  da imagem — `docker compose up -d` sozinho não recarrega; precisa de
  `docker compose restart caddy` explícito (tarefa 14).
- Nenhuma dependência de infraestrutura nova além do arquivo já entregue
  pelo CEO — reaproveita VM de dev, Docker Compose, CI e pipeline de
  testes já existentes.
