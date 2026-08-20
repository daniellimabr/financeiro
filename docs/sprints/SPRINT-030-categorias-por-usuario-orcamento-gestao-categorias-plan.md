# SPRINT-030: Categorias por usuário, Orçamento, Gestão de Categorias/Subcategorias e remoção da Projeção — Plano

- **PRD(s):** [PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md](../prd/PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md)
- **Data do plano:** 2026-08-20

## Objetivo da sprint

Maior sprint do projeto até agora (comparável à Sprint 13). Quatro entregas conectadas: (1)
Categoria/Subcategoria deixam de ser um catálogo global e passam a ser por usuário, semeadas a
partir do catálogo atual — pré-requisito técnico descoberto nesta sessão de planejamento, não
pedido original do CEO, mas necessário porque Orçamento e a nova tela de Categorias dependem de
cada usuário poder editar sua própria cópia sem afetar o outro; (2) mecanismo de Orçamento por
Subcategoria (eventual ou recorrente com "ad eternum", múltiplos orçamentos permitidos, vale
para Despesa e Receita); (3) tela de gestão de Categorias/Subcategorias, com um componente de
tabela agrupada revampado visualmente e reaproveitado também pela tabela de classificação de
Natureza; (4) remoção completa da funcionalidade de Projeção.

Ordem de execução obrigatória: Fase 1 (categorias por usuário) precisa terminar antes de
qualquer coisa que toque `subcategory_id` — é a fase de maior risco, pois migra dado real da VM
de dev. A Fase 0 (remoção da Projeção) é independente e pode rodar a qualquer momento.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| **Fase 0 — Remoção da Projeção** ||||
| 1 | Remover `get_projecao`, `_future_month_range`, dataclass `PontoProjecao` de `service.py`; manter `_month_range`/`_date_bounds` (compartilhadas por outras ~10 funções); remover `PontoProjecaoOut` e a rota `GET /dashboards/projecao`; remover testes associados | Sonnet: implementação | `backend/app/dashboards/service.py`, `backend/app/schemas/dashboards.py`, `backend/app/dashboards/router.py`, `backend/tests/test_dashboards_service.py`, `test_dashboards_endpoints.py` |
| 2 | Deletar `ProjecaoPage.tsx`+teste, `ProjectionChart.tsx` (não `resolveClickedPonto.ts`, compartilhado), `utils/projecao.ts`+teste, `useDashboardProjecao.ts`; remover `fetchDashboardProjecao` de `api/dashboards.ts`; remover tab/nav/import de `ProtectedPage.tsx`; deletar `check-sprint14.mjs` | Sonnet: implementação | `frontend/src/pages/ProjecaoPage.tsx`, `components/ProjectionChart.tsx`, `utils/projecao.ts`, `hooks/useDashboardProjecao.ts`, `api/dashboards.ts`, `pages/ProtectedPage.tsx`, `scripts/browser-check/check-sprint14.mjs` |
| **Fase 1 — Migração de Categorias/Subcategorias para nível de usuário** ||||
| 3 | `user_id` novo (nullable temporário) em `CategoryGroup`/`Subcategory`; troca `UniqueConstraint` de `nome` global para `(user_id, nome)` em `CategoryGroup` | Sonnet: implementação | `backend/app/models/category.py` |
| 4 | Migration `0018_categorias_por_usuario.py`: clona catálogo global por usuário existente, repontando `PluggyTransaction.subcategory_id`/`CategorizationRule.subcategory_id` via mapa por usuário; deleta linhas globais; torna `user_id` `NOT NULL`; downgrade documentado como best-effort/irreversível | Sonnet: implementação | `backend/alembic/versions/0018_categorias_por_usuario.py` (novo), padrão de `0013`/`0016` |
| 5 | `app/categories/seed.py` novo: `seed_categories_for_user(db, user_id)`, gerado a partir do dump real do catálogo capturado no passo 4; congelar snapshot fixo pra uso em usuários futuros | Sonnet: implementação | `backend/app/categories/seed.py` (novo) |
| 6 | Hook de seed em `upsert_user_from_google` (branch de usuário novo: `db.flush()` + `seed_categories_for_user`) | Sonnet: implementação | `backend/app/auth/service.py` |
| 7 | Threading de `user_id` em toda função de `app/categories/service.py` (`list_groups`, `get_group`, `create_group`, `update_group`, `delete_group`, `list_subcategories`, `get_subcategory`, `create_subcategory`, `update_subcategory`, `delete_subcategory`); `NotFoundError` (não 403) quando a linha é de outro usuário | Sonnet: implementação | `backend/app/categories/service.py` |
| 8 | `app/categories/router.py`: todo endpoint ganha `current_user: User = Depends(get_current_user)` e repassa `current_user.id` | Sonnet: implementação | `backend/app/categories/router.py` |
| 9 | Checklist de call sites: confirmar que `app/categorization/engine.py` não precisa de mudança (não referencia `Subcategory` diretamente); revisar se `scripts/import_legacy_categorization_rules.py` ainda faz sentido rodar de novo | Sonnet: implementação | `backend/app/categorization/engine.py`, `backend/scripts/import_legacy_categorization_rules.py` |
| 10 | Testes: isolamento de categoria entre usuários (`test_category_service.py`/`test_category_endpoints.py`, mesmo padrão de Asset/Liability); teste de migration via `importlib` (backfill preserva 100% das referências, nenhuma órfã/trocada de dono); teste de `seed_categories_for_user`; teste de regressão em `test_dashboards_service.py` confirmando que nenhum dashboard mistura subcategorias entre usuários | Sonnet: implementação | `backend/tests/test_category_service.py`, `test_category_endpoints.py`, `test_dashboards_service.py` |
| **Fase 2 — Schema e backend do Orçamento** ||||
| 11 | Modelo `Orcamento` (`user_id`, `subcategory_id`, `tipo` enum eventual/recorrente, `valor`, `ano`/`mes` ou `data_inicio`/`data_fim`, sem `UniqueConstraint`); `OrcamentoTipo` enum | Sonnet: implementação | `backend/app/models/orcamento.py` (novo) |
| 12 | Migration `0019_create_orcamentos.py` (`down_revision="0018"`), padrão de enum de `0003`; índices `user_id`, `subcategory_id`, `(tipo, ano, mes)` | Sonnet: implementação | `backend/alembic/versions/0019_create_orcamentos.py` (novo) |
| 13 | `OrcamentoIn`/`OrcamentoOut` (Pydantic) com `model_validator` eventual-xor-recorrente (`data_fim >= data_inicio`) | Sonnet: implementação | `backend/app/schemas/orcamento.py` (novo) |
| 14 | `_orcamento_vigente(ano, mes)` — filtro em tempo constante via `func.extract`, sem expandir "ad eternum"; `app/orcamentos/service.py` (CRUD completo, filtro `user_id`, valida subcategoria via `app.categories.service.get_subcategory`); `app/orcamentos/router.py` | Sonnet: implementação | `backend/app/orcamentos/service.py`, `router.py` (novos), registrar em `backend/app/main.py` |
| 15 | `OrcamentoStatus`/`get_orcamento_status(db, user_id, *, tipo, ano, mes, regime)` em `app/dashboards/service.py`, reaproveitando `_base_query`/`_apply_periodo`; `OrcamentoStatusOut`; endpoint `GET /dashboards/por-orcamento?tipo=&ano=&mes=&regime=` | Sonnet: implementação | `backend/app/dashboards/service.py`, `backend/app/schemas/dashboards.py`, `backend/app/dashboards/router.py` |
| 16 | Testes: CRUD de orçamento (eventual/recorrente, validação cruzada rejeitada); vigência isolada (eventual só no mês exato; recorrente com/sem `data_fim`; mês arbitrariamente distante em tempo constante, ex. 2099); `get_orcamento_status` (soma de múltiplos vigentes, zero-fill sem transação, `tipo` despesa e receita, respeita `excluir_de_totais`/regime) | Sonnet: implementação | `backend/tests/test_orcamento_service.py`, `test_orcamento_vigencia.py`, `test_orcamento_endpoints.py` (novos), extensão de `test_dashboards_service.py`/`test_dashboards_endpoints.py` |
| **Fase 3 — Fix de segurança: bloqueio de exclusão de Categoria/Subcategoria em uso** ||||
| 17 | `_subcategory_usage_counts(db, user_id, subcategory_id)` (conta `PluggyTransaction`, `CategorizationRule`, `Orcamento`); `delete_subcategory` levanta `InvalidStateError` se em uso; `delete_group` guarda cada subcategoria antes do cascade do ORM | Sonnet: implementação | `backend/app/categories/service.py` |
| 18 | `InvalidStateError`→400 em `DELETE /category-groups/{id}` e `DELETE /subcategories/{id}`; testes de bloqueio (cada tipo de vínculo) e sucesso quando livre | Sonnet: implementação | `backend/app/categories/router.py`, `backend/tests/test_category_service.py`, `test_category_endpoints.py` |
| **Fase 4 — `OrcamentoPage.tsx`** ||||
| 19 | `api/orcamentos.ts` (fetch/create/update/delete); hooks `useOrcamentos`/`useCreateOrcamento`/`useUpdateOrcamento`/`useDeleteOrcamento` (invalidam `["orcamentos"]` + queries de dashboard) | Sonnet: implementação | `frontend/src/api/orcamentos.ts` (novo), `frontend/src/hooks/` (novos) |
| 20 | `OrcamentoPage.tsx`: form inline (padrão `AssetsPage.tsx`), toggle eventual/recorrente via `.dash-toggle`, `CategoryCombobox` pra subcategoria, campos condicionais por tipo, listagem agrupada, delete com confirm | Sonnet: implementação | `frontend/src/pages/OrcamentoPage.tsx` (novo), `frontend/src/pages/AssetsPage.tsx` (padrão), `frontend/src/components/CategoryCombobox.tsx` |
| **Fase 5 — Rodada de design (Impeccable/Artifact)** ||||
| 21 | Candidatas para a barra orçado-vs-realizado (2 sentidos de cor: estouro em Despesa vs. déficit em Receita) e para o componente de tabela agrupada compartilhado (Categorias + Natureza revampada), com dado real do endpoint da Fase 2; aprovação do CEO antes de codar | Sonnet + skill `impeccable` | `DESIGN.md`, `frontend/src/pages/DashboardsPage.tsx` (`Row`), `frontend/src/pages/NaturezaPage.tsx` (`.nat-table`) |
| **Fase 6 — `CategoriasPage.tsx` + revamp aplicado** ||||
| 22 | `SubcategoryGroupTable.tsx` novo (componente compartilhado, design da Fase 5), parametrizado pela coluna de ação | Sonnet: implementação | `frontend/src/components/SubcategoryGroupTable.tsx` (novo) |
| 23 | `createCategoryGroup`/`updateCategoryGroup`/`deleteCategoryGroup`/`createSubcategory`/`deleteSubcategory` em `api/categories.ts`; hooks equivalentes; generalizar `invalidateAfterSubcategoryEdit` pra também invalidar `["categoryGroups"]` | Sonnet: implementação | `frontend/src/api/categories.ts`, `frontend/src/hooks/invalidateDashboardQueries.ts` |
| 24 | `CategoriasPage.tsx`: CRUD de grupo/subcategoria sobre `SubcategoryGroupTable`; cuidado com `updateSubcategory` (PUT replace completo — reenviar `natureza` atual sem alterar); erro 400 de exclusão bloqueada exibido via `role="alert"` | Sonnet: implementação | `frontend/src/pages/CategoriasPage.tsx` (novo) |
| 25 | `NaturezaPage.tsx` migra sua tabela de classificação para `SubcategoryGroupTable`, sem mudar o `<select>` de natureza; nav ganha "Orçamento" e "Categorias" em `ProtectedPage.tsx` | Sonnet: implementação | `frontend/src/pages/NaturezaPage.tsx`, `frontend/src/pages/ProtectedPage.tsx` |
| 26 | Testes: `OrcamentoPage.test.tsx`, `CategoriasPage.test.tsx` (novos); `NaturezaPage.test.tsx` revalidado sem regressão pós-migração de componente | Sonnet: implementação | `frontend/src/pages/OrcamentoPage.test.tsx`, `CategoriasPage.test.tsx`, `NaturezaPage.test.tsx` |
| **Fase 7 — Integração da barra orçado-vs-realizado nos funis** ||||
| 27 | `useDashboardPorOrcamento(tipo, filter)` (padrão `useDashboardByCategoria`); mapa `subcategory_id → OrcamentoStatus` passado como prop opcional pro `Row` existente (não criar componente paralelo), nos dois funis (Despesa e Receita) de `SubcategoriaAccordion` | Sonnet: implementação | `frontend/src/pages/DashboardsPage.tsx` (`Row`, `SubcategoriaAccordion`), `frontend/src/hooks/` (novo), `frontend/src/api/dashboards.ts` |
| 28 | Testes: barra aparece nos dois funis só com orçamento vigente, variante de cor correta em cada sentido | Sonnet: implementação | `frontend/src/pages/DashboardsPage.test.tsx` |
| **Fase 8 — Fechamento** ||||
| 29 | QA visual real `scripts/browser-check/check-sprint30.mjs` (novo): 2 usuários reais em paralelo (isolamento de categoria); CRUD de orçamento eventual/recorrente (com/sem `data_fim`) em despesa e receita; barra nos dois funis; CRUD de Categorias com exclusão bloqueada; Natureza revalidada; ausência de Projeção; desktop+mobile, claro+escuro | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 30 | Atualizar `docs/roadmap.md` (fecha Sprint 30), `docs/directory-structure.md`, `docs/dashboards-guia-cards.md`, `DESIGN.md` (componente de tabela + cor de estouro/déficit), `docs/migration/legacy-data.md` (catálogo deixa de ser global) | Haiku: doc-updater | arquivos acima |
| 31 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Backend: isolamento de categoria por usuário (cross-user nunca vê/edita/exclui); migration
preserva 100% das referências existentes; vigência de orçamento em tempo constante mesmo com
`data_fim` nula e mês arbitrariamente distante; soma de múltiplos orçamentos vigentes; orçado vs.
realizado correto para `tipo` débito e crédito, respeitando `excluir_de_totais`/regime; bloqueio
de exclusão de categoria/subcategoria em uso (transação, regra, orçamento), com sucesso quando
livre. Frontend: CRUD de Orçamento (toggle eventual/recorrente troca os campos certos); CRUD de
Categorias (criar/renomear/excluir, erro de exclusão bloqueada exibido); barra orçado-vs-
realizado nos dois funis, só com orçamento vigente; `NaturezaPage` sem regressão pós-migração de
componente.

## Impacto no roadmap

Cross-epic, sem épico prévio — sprint isolada, sem divisão em partes (decisão explícita do CEO
de manter tudo junto nesta sessão de planejamento, apesar da alternativa de dividir recomendada
pelo CTO).

## Riscos / dependências

- **Maior risco da sprint**: a migration de categorias (Fase 1) roda contra dado real da VM de
  dev, o único ambiente real hoje, com transações e regras de categorização reais dos 2
  usuários. Validar contagem de linhas antes/depois é obrigatório antes de considerar a migration
  concluída; rodar num dump/cópia local antes de aplicar na VM se possível.
- Downgrade da migration `0018` não é uma operação limpa — documentar explicitamente como
  best-effort/irreversível (decisão a validar durante a implementação, já sinalizada no plano de
  sessão para não ser descoberta tarde).
- Sequenciamento rígido: Fase 2 (Orçamento) depende da Fase 1; Fase 3 (fix delete) depende da
  Fase 1 e da Fase 2 (conta uso de `Orcamento`); Fase 5 (design) precisa do endpoint da Fase 2 já
  existir pra usar dado real nas candidatas; Fase 6 depende da Fase 3 (guard) e da Fase 5
  (design); Fase 7 depende só da Fase 5. Fase 0 é a única totalmente independente.
- Nuance de design ainda em aberto na Fase 5: em Despesa, estourar o orçado é o sinal ruim; em
  Receita, é o oposto (não alcançar é o sinal ruim) — a rodada Impeccable precisa contemplar os
  dois sentidos, não uma única regra de cor.
- `CategoryGroup`/`Subcategory` deixam de ser globais — qualquer código futuro que assuma "existe
  1 catálogo compartilhado" (fora do já mapeado nesta sprint) precisa ser revisto se aparecer.
