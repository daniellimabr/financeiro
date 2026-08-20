# SPRINT-030: Categorias por usuário, Orçamento, Gestão de Categorias/Subcategorias e remoção da Projeção — Relatório

- **Plano:** [SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-plan.md](./SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-plan.md)
- **Data do relatório:** 2026-08-20
- **Aprovado pelo CEO em:** 2026-08-20, após revisão ao vivo na VM de dev

## Resumo

Implementadas as Fases 0–7 do plano: remoção completa da Projeção; migração de Categoria/Subcategoria de catálogo global para nível de usuário (com migration de dados real); mecanismo completo de Orçamento (modelo, CRUD, vigência em tempo constante, agregação orçado-vs-realizado); fix de segurança bloqueando exclusão de categoria/subcategoria em uso; telas `OrcamentoPage` e `CategoriasPage`; componente `SubcategoryGroupTable` compartilhado (extraído de `NaturezaPage`); barra orçado-vs-realizado integrada aos dois funis de Dashboard. A rodada de design (Fase 5) rodou via Artifact publicado para comparação — o CEO escolheu a Candidata B em ambas as decisões (ver seção de decisões).

**Deploy na VM de dev concluído e validado nesta sessão**, a pedido explícito do CEO ("deploy primeiro, para eu poder revisar"). O processo revelou 4 achados reais só visíveis contra o ambiente de verdade — 3 bugs na migration `0018` e 1 gotcha de roteamento já documentado no projeto — todos corrigidos, testados e re-validados antes de tocar o banco real; nenhum dado foi perdido ou corrompido em nenhum momento (ver "Incidente do deploy" abaixo). QA visual ao vivo e atualização de documentação seguem pendentes — ver Pendências.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| **Fase 0 — Remoção da Projeção** ||||
| 1 | Remover `get_projecao`/`_future_month_range`/`PontoProjecao` do backend | feito | — |
| 2 | Remover `ProjecaoPage`, `ProjectionChart`, `utils/projecao.ts`, hook, nav | feito | `resolveClickedPonto.ts` preservado (compartilhado com `TrendLineChart`), confirmado antes de tocar |
| **Fase 1 — Categorias por usuário** ||||
| 3 | `user_id` em `CategoryGroup`/`Subcategory`; unicidade por `(user_id, nome)` | feito | — |
| 4 | Migration `0018`: clona catálogo, repontoa FKs, deleta linhas globais | feito | Backfill implementado com `sa.Table` reflection + Core insert/update (não texto puro) para portabilidade SQLite/Postgres; **rodou contra a VM de dev nesta sessão, com 3 correções no caminho** — ver "Incidente do deploy" |
| 5 | `app/categories/seed.py`: catálogo padrão congelado | feito | Snapshot capturado por leitura direta do catálogo real da VM (16 grupos / 54 subcategorias, incluindo `natureza` e `excluir_de_totais`), não do CSV do v1 (desatualizado desde a Sprint 7+) |
| 6 | Hook de seed em `upsert_user_from_google` | feito | — |
| 7 | Threading de `user_id` em `app/categories/service.py` | feito | — |
| 8 | `app/categories/router.py` por-usuário | feito | Router mudou de `dependencies=[Depends(...)]` a nível de router para injeção por endpoint (necessário para acessar `current_user.id`) |
| 9 | Checklist de call sites (`engine.py`, script de import legado) | feito | `engine.py` não precisou mudar (confirmado, não referencia `Subcategory`); `import_legacy_categorization_rules.py` atualizado para resolver por `user_id`; **`import_legacy_categories.py` (script de import do catálogo *global*) foi excluído**, não apenas revisado — ficou permanentemente incompatível com o schema novo (`user_id` NOT NULL), e seu papel foi substituído por `seed.py` |
| 10 | Testes de isolamento, migration, seed, regressão em dashboards | feito | `test_migration_0018_categorias_por_usuario.py` (testa `_clone_catalog_for_user`/`_repoint_references` isoladamente via `importlib`, mesmo padrão de `test_migration_0013`); `test_category_seed.py` novo |
| **Fase 2 — Schema e backend do Orçamento** ||||
| 11–14 | Modelo `Orcamento`, migration `0019`, schemas, service (CRUD + vigência) | feito | Vigência via aritmética de ordinal (`ano*12+mes`), tempo constante, sem expandir "ad eternum" |
| 15 | `get_orcamento_status` + `GET /dashboards/por-orcamento` | feito | — |
| 16 | Testes de CRUD, vigência, orçado-vs-realizado | feito | `test_orcamento_service.py`, `test_orcamento_vigencia.py`, `test_orcamento_endpoints.py` + extensão de `test_dashboards_service.py`/`test_dashboards_endpoints.py` |
| **Fase 3 — Fix de segurança (bloqueio de exclusão em uso)** ||||
| 17–18 | Guard de uso (transação/regra/orçamento) + 400 no router | feito | — |
| **Fase 4 — `OrcamentoPage.tsx`** ||||
| 19–20 | API client, hooks, tela CRUD | feito | — |
| **Fase 5 — Rodada de design (Impeccable/Artifact)** ||||
| 21 | Candidatas para barra orçado-vs-realizado e tabela agrupada | feito | Ver "Decisões tomadas" — CEO aprovou via Artifact antes de qualquer código da Fase 6/7 |
| **Fase 6 — `CategoriasPage.tsx` + revamp aplicado** ||||
| 22–26 | `SubcategoryGroupTable`, API/hooks de CRUD, `CategoriasPage`, migração de `NaturezaPage`, nav, testes | feito | — |
| **Fase 7 — Integração da barra nos funis** ||||
| 27–28 | `useDashboardPorOrcamento`, prop no `Row`, testes | feito | — |
| **Fase 8 — Fechamento** ||||
| 29a | Deploy do backend/frontend na VM de dev + migração de dados reais | feito | CI verde (3 rodadas — ver "Incidente do deploy"), `docker compose pull` + `up -d`, `alembic upgrade head` automático via entrypoint chegou em `0019`, todos os 4 containers saudáveis |
| 29b | QA visual real (`check-sprint30.mjs`) contra a VM de dev | **não feito** | CEO pediu para revisar manualmente antes — script de QA automatizado fica para depois, se ainda fizer sentido |
| 30 | Atualizar docs vivas (`roadmap.md`, `directory-structure.md`, `dashboards-guia-cards.md`, `DESIGN.md`, `migration/legacy-data.md`) | **não feito** | Por fluxo do CLAUDE.md, doc-updater roda depois da aprovação do relatório — deliberadamente não antecipado |
| 31 | Relatório de sprint | feito | Este documento |

## Evidência de testes

Backend (661 testes, 99% cobertura):
```
app\schemas\orcamento.py                26      0   100%
app\schemas\pluggy.py                   44      0   100%
app\schemas\user.py                      6      0   100%
------------------------------------------------------------------
TOTAL                                 2752     36    99%
661 passed, 704 warnings in 13.83s
```

Frontend (222 testes):
```
 Test Files  25 passed (25)
      Tests  222 passed (222)
```

Cobertura de lógica de negócio: 99% backend (meta ≥80%). Módulos novos (`app/orcamentos/`, `app/categories/seed.py`, `app/schemas/orcamento.py`) em 100%.

## Lint/formatter

Backend (`ruff check .`): `All checks passed!`

Frontend (`tsc --noEmit`, `eslint`, `prettier --check`): sem erros nos arquivos tocados/novos desta sprint.

## Decisões tomadas durante a execução

- **Escala real da migração**: consulta direta à VM de dev (autorizada, SSH livre) revelou **1 usuário real** hoje (não 2 como a tabela de decisões fixas do CLAUDE.md registra — a arquitetura permite 2, mas só um usuário efetivamente logou até agora), 16 grupos / 54 subcategorias / 1000 transações / 258 regras de categorização. Risco da Fase 1 é menor do que o plano estimava, mas a migração ainda não rodou contra esse dado real.
- **Barra orçado-vs-realizado — Candidata B (CEO escolheu via Artifact)**: sem cor semântica nova — sinaliza com contorno na barra existente + símbolo ▲ (despesa estourou)/▼ (receita não atingiu), preservando a regra de "um único acento" do DESIGN.md em vez de introduzir um 4º token semântico (a Candidata A propunha uma cor âmbar nova).
- **Tabela agrupada compartilhada — Candidata B (CEO escolheu via Artifact)**: grupo demarcado — borda superior mais forte na primeira linha de cada grupo novo, para escanear mais rápido quando a lista cresce (CategoriasPage lista toda subcategoria do usuário, não só as com dado de Natureza).
- **`import_legacy_categories.py` excluído, não só revisado**: o script de import do catálogo *global* ficou permanentemente incompatível com o schema novo (`CategoryGroup.user_id` `NOT NULL`); seu papel foi substituído por `app/categories/seed.py`. Teste/fixture associados removidos junto.
- **`_pagamento_fatura_subcategory_id`, `salario_subcategory_id`, `aporte_subcategory_id`/`resgate_subcategory_id`** (lookups por nome espalhados em `dashboards/`, `categorization/`, `investimentos/`) ganharam parâmetro `user_id` — eram seguros sob catálogo global, mas quebrariam silenciosamente (resultado de outro usuário) sob catálogo por usuário.
- **`set_category`/`bulk_confirm` ganharam checagem de posse de subcategoria** (`db.get(Subcategory, id)` → query filtrada por `user_id`) — antes não existia nenhuma validação de que a subcategoria pertencia ao usuário autenticado.

## Incidente do deploy (migration `0018` contra a VM de dev)

A pedido do CEO ("deploy primeiro, para eu poder revisar"), o deploy rodou nesta mesma sessão de execução, ainda sem aprovação formal do relatório. A migration `0018` — a peça de maior risco da sprint, por tocar dado financeiro real de produção (a VM de dev é o único ambiente real hoje) — falhou 2 vezes contra o banco real antes de ser corrigida, e uma 3ª vez contra uma cópia descartável adotada depois da 2ª falha. Registro completo, na ordem em que aconteceu:

1. **Backup preventivo antes de qualquer tentativa**: `pg_dump` completo do banco real, copiado para fora do container (`~/pre-sprint30-backup.dump` na VM), antes do primeiro `docker compose up -d`.
2. **1ª falha (contra o banco real)**: índice único antigo em `category_groups.nome` (global, da migration `0002`) ainda existia quando o loop de clonagem tentava inserir a cópia de cada usuário com o mesmo nome do grupo global — as linhas globais só são removidas *depois* de clonadas para todos os usuários, então a inserção da cópia colide com o original ainda presente. **Postgres reverteu a transação inteira automaticamente** (DDL transacional) — `alembic_version` continuou em `0017`, contagem de `category_groups` continuou em 16, nenhum dado tocado. Fix: mover o `DROP INDEX` do índice antigo para antes do loop de clonagem.
3. **2ª falha (contra o banco real)**: com o fix acima publicado e a imagem nova puxada, a migration avançou mais, mas falhou ao inserir `subcategories.natureza` — a tabela mínima declarada na migration usava `sa.String(20)` para essa coluna, mas a coluna real é um `ENUM` do Postgres; o driver gera um cast `::VARCHAR` que o Postgres rejeita contra a coluna `ENUM`, mesmo para valores `NULL`. De novo, **rollback automático limpo**, mesma contagem intacta. Fix: usar `postgresql.ENUM(..., create_type=False)`, mesmo padrão já usado nas migrations `0002`/`0003`.
4. **Mudança de estratégia**: depois da 2ª falha ao vivo, testes passaram a rodar contra uma **cópia descartável** do banco real (`test_migration_check`, criada dentro do próprio container `postgres` já rodando e restaurada do backup do passo 1) em vez de tentar direto contra o banco de produção — mesmo precedente já usado na Sprint 2 (`docs/sprints/SPRINT-002-...-report.md`), que deveria ter sido seguido desde o início desta sprint.
5. **3ª falha (contra a cópia descartável, não o banco real)**: `pluggy_transactions.subcategoria_sugerida_id` — uma 3ª coluna FK real para `subcategories.id` que a investigação original do PRD-030 não encontrou ("`PluggyTransaction.subcategory_id`/`CategorizationRule.subcategory_id` são as únicas duas colunas FK reais" — afirmação incompleta) — nunca foi repontoada, causando `ForeignKeyViolation` no `DELETE` das linhas globais ao final da migration. Como o teste rodou contra a cópia descartável, o banco real nunca foi tocado por essa falha. Fix: adicionar a coluna à tabela mínima da migration e repontoá-la junto de `subcategory_id`; teste de unidade (`test_migration_0018_categorias_por_usuario.py`) estendido para cobrir o caso.
6. **Validação completa contra a cópia descartável** (16 `category_groups`, 54 `subcategories` com `natureza` preservada — 11 fixa/3 variável/1 eventual/39 sem classificação —, 1000 `pluggy_transactions` e 258 `categorization_rules` sem nenhuma referência órfã, tabela `orcamentos` criada vazia) — só depois disso a migration corrigida rodou contra o banco real, com o mesmo resultado exato.
7. **4º achado, depois da migration já validada**: `GET/POST/PUT/DELETE /orcamentos` retornava o HTML do frontend em vez de JSON — o prefixo de rota novo (`app/orcamentos/router.py`) nunca foi adicionado ao matcher `@api` do `Caddyfile`, o mesmo gotcha já documentado no projeto (`docs/architecture/OVERVIEW.md`) e nas memórias de sessões anteriores. Fix: uma linha no `Caddyfile` + `docker compose restart caddy`; confirmado que `/orcamentos` passou a responder `401` (autenticação exigida, como esperado) em vez do HTML da SPA.
8. **Limpeza**: banco descartável (`test_migration_check`) e a cópia do backup dentro do container `postgres` foram removidos. O backup no filesystem da VM (`~/pre-sprint30-backup.dump`) foi mantido como rede de segurança.

**Nenhum dado real foi perdido, corrompido ou trocado de dono em nenhum momento** — cada falha foi isolada por uma transação de DDL do Postgres (ou por rodar contra a cópia, não o original) e confirmada por contagem de linhas antes/depois. O estado final do banco real bate exatamente com o validado na cópia descartável. Todas as 4 correções foram commitadas como commits separados (não squash), com a causa raiz documentada em cada mensagem — ver `581db5c`, `abda5d1`, `589a853`, `2a97c18`.

**Lição para sessões futuras**: testar migrations de dado real contra uma cópia descartável do banco (não contra produção/dev direto) deveria ser o primeiro passo, não uma resposta a uma falha ao vivo — precedente já existia na Sprint 2 e não foi seguido aqui até a 2ª falha.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Isolamento total de categoria/subcategoria entre usuários | sim | `test_category_service.py`/`test_category_endpoints.py` (isolamento + 404 cross-user) |
| 2. Usuário novo nasce com cópia do catálogo padrão | sim | `test_category_seed.py`, `test_google_callback_creates_session_cookie` (auth) |
| 3. Migração não deixa `subcategory_id` nulo/trocado de dono | sim | `test_migration_0018_categorias_por_usuario.py` + validado ao vivo contra o dado real da VM (1000 `pluggy_transactions`/258 `categorization_rules`, zero referências órfãs em `subcategory_id` e `subcategoria_sugerida_id`) — ver "Incidente do deploy" |
| 4. Orçamento eventual só vigente no mês/ano exato | sim | `test_orcamento_vigencia.py::test_eventual_vigente_only_in_exact_month` |
| 5. Recorrente sem `data_fim` vigente "ad eternum", tempo constante | sim | `test_recorrente_without_data_fim_vigente_ad_eternum` (testado até 2099) |
| 6. Soma de múltiplos orçamentos vigentes | sim | `test_multiple_orcamentos_allowed_for_same_subcategory`, `test_get_orcamento_status_sums_multiple_vigentes_for_same_subcategoria` |
| 7. Orçamento funciona igual para Despesa e Receita | sim | `test_get_orcamento_status_respects_tipo_receita`; barra ▼ testada em `DashboardsPage.test.tsx` |
| 8. Exclusão bloqueada com mensagem, sem erro de integridade | sim | `test_delete_subcategory_blocked_when_used_by_*` (3 tipos de vínculo) + endpoints 400 |
| 9. Tela Categorias CRUD ponta a ponta sem afetar outro usuário | sim | `CategoriasPage.test.tsx` (8 testes) |
| 10. Nenhum resquício de Projeção | sim | grep confirma zero ocorrências fora de docs históricos |
| 11. CI 100% verde, cobertura ≥80% | sim | 661 backend + 222 frontend, 99% cobertura, local e no CI real (GitHub Actions verde nos 4 commits desta sessão) |

## Documentação atualizada

Nenhuma ainda — por decisão deliberada de seguir o fluxo do CLAUDE.md (doc-updater roda após aprovação do relatório + deploy + validação, não antes). Docs a atualizar na próxima etapa: `docs/roadmap.md` (fecha Sprint 30), `docs/directory-structure.md`, `docs/dashboards-guia-cards.md`, `DESIGN.md` (componente de tabela + regra "sem cor nova" do alerta de orçamento), `docs/migration/legacy-data.md` (catálogo deixa de ser global).

## Consumo estimado de tokens/sessões

Sprint grande (comparável à Sprint 13) — uma única sessão de execução, ~74 arquivos tocados (31 novos, 12 excluídos, 31 modificados).

## Pendências e próximos passos sugeridos

1. **Revisão ao vivo do CEO na VM de dev** — motivo do deploy ter rodado antes da aprovação formal. App está no ar, todos os 4 containers saudáveis, commit `2a97c18`.
2. QA visual automatizado (`scripts/browser-check/check-sprint30.mjs`, ainda não escrito) — opcional, se o CEO preferir cobertura automatizada além da revisão manual: 2 usuários em paralelo, CRUD de Orçamento e Categorias, barra nos dois funis, exclusão bloqueada, ausência de Projeção, desktop+mobile, claro+escuro.
3. Atualização de documentação viva (lista na seção "Documentação atualizada") via doc-updater — inclui registrar o achado real do gotcha de Caddyfile e a lição da Sprint 2 não seguida (testar migration contra cópia descartável desde o início).
4. Aprovação final do CEO para fechar a sprint.
