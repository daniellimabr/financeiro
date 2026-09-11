# SPRINT-038: Mesa de Planejamento — Plano

- **PRD(s):** [PRD-038-mesa-de-planejamento.md](../prd/PRD-038-mesa-de-planejamento.md)
- **Data do plano:** 2026-09-11

## Objetivo da sprint

Eliminar o Orçamento (Sprint 30, sem uso real segundo o CEO) e entregar a Mesa de Planejamento —
tela nova, nascida do zero, que mostra receita/despesa projetada dos próximos 12 meses por
subcategoria fixa/variável (sugestão por média móvel de 3 meses, sempre pendente de confirmação
explícita) mais itens planejados sem histórico prévio (opcionalmente vinculáveis a uma transação
real quando ela acontece). Toggle "Modo Projeção" no Dashboard e abatimento por fatura futura de
cartão ficam de fora — avaliados/priorizados depois, decisão explícita do CEO.

Ordem de execução: Fase 0 (remoção do Orçamento) é independente e roda primeiro, liberando o nome
de rota/tabela. Fase 1 (schema+engine de sugestão) precisa terminar antes da Fase 2 (itens
planejados dependem do mesmo módulo `app/planejamento/`). Fase 3 (design) precisa do endpoint da
Fase 1 com dado real pra ter algo pra mostrar. Fase 4 (frontend) depende da Fase 3.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| **Fase 0 — Remoção completa do Orçamento** ||||
| 1 | Migration `0022_drop_orcamentos.py` (`down_revision="0021"`): `DROP TABLE orcamentos`, `DROP TYPE orcamento_tipo`; downgrade recria o schema vazio (sem dado a restaurar — confirmado pelo CEO) | Sonnet: implementação | `backend/alembic/versions/0022_drop_orcamentos.py` (novo), padrão de `0018` |
| 2 | Remover `app/models/orcamento.py`, módulo `app/orcamentos/` inteiro (`service.py`/`router.py`/`__init__.py`), registro em `app/main.py`; remover `OrcamentoStatus`/`get_orcamento_status`/import de `Orcamento`/`orcamentos_vigentes_query` de `app/dashboards/service.py`, `OrcamentoStatusOut` de `app/schemas/dashboards.py`, rota `GET /dashboards/por-orcamento` de `app/dashboards/router.py`; remover testes associados | Sonnet: implementação | `backend/app/models/orcamento.py`, `backend/app/orcamentos/`, `backend/app/dashboards/service.py`, `backend/app/schemas/dashboards.py`, `backend/app/dashboards/router.py`, `backend/tests/test_orcamento_*.py` |
| 3 | Deletar `OrcamentoPage.tsx`+teste, `api/orcamentos.ts`, hooks `useOrcamentos`/`useCreateOrcamento`/`useUpdateOrcamento`/`useDeleteOrcamento`/`useDashboardPorOrcamento`; remover a barra orçado-vs-realizado de `Row`/`SubcategoriaAccordion` em `DashboardsPage.tsx` (Fase 7 da Sprint 30) e a invalidação de `["orcamentos"]` em `invalidateDashboardQueries.ts`; remover aba do nav em `ProtectedPage.tsx` (mantém o lugar pra aba "Planejamento" da Fase 4) | Sonnet: implementação | `frontend/src/pages/OrcamentoPage.tsx`, `frontend/src/api/orcamentos.ts`, `frontend/src/hooks/use*Orcamento*.ts`, `frontend/src/pages/DashboardsPage.tsx`, `frontend/src/hooks/invalidateDashboardQueries.ts`, `frontend/src/pages/ProtectedPage.tsx` |
| **Fase 1 — Schema e engine de sugestão** ||||
| 4 | Model `PlanejamentoValor` (`user_id`, `subcategory_id`, `ano`, `mes`, `valor`, `UniqueConstraint`); migration `0023_create_planejamento_valores.py` (`down_revision="0022"`) | Sonnet: implementação | `backend/app/models/planejamento.py` (novo), `backend/alembic/versions/0023_create_planejamento_valores.py` (novo) |
| 5 | `app/planejamento/service.py`: `_sugestao_media_3_meses(db, user_id, subcategory_id, tipo, ano, mes)` reaproveitando `app.dashboards.service._base_query`/`_apply_periodo`/`_month_range`; `get_grade(db, user_id, *, ano_base, mes_base)` — monta as 16 colunas (3 histórico + atual + 12 futuras) por subcategoria `natureza in (fixa, variavel)`, célula = confirmado (`PlanejamentoValor` se existir) ou sugerido (calculado); mês corrente inclui `realizado_parcial` + `status` (dentro/excedido, sentido por `tipo`, mesma regra de PRD-030) | Sonnet: implementação | `backend/app/planejamento/service.py` (novo) |
| 6 | `PUT /planejamento/valores/{subcategory_id}` (upsert `ano`/`mes`/`valor` — confirma sugestão ou grava override) e `DELETE /planejamento/valores/{subcategory_id}?ano=&mes=` (volta a ser sugestão); `GET /planejamento/grade?ano_base=&mes_base=`; todos isolados por `user_id` via `get_current_user`, registrados em `app/main.py` | Sonnet: implementação | `backend/app/planejamento/router.py` (novo), `backend/app/schemas/planejamento.py` (novo) |
| 7 | Testes: sugestão calculada corretamente (média 3 meses, exclusões de `_base_query` respeitadas); célula sem override é sempre "sugerida" e recalcula se o histórico mudar; confirmar/editar persiste e sobrevive a nova consulta; remover override volta a sugestão; mês corrente com `realizado_parcial`/`status` nos dois sentidos (despesa/receita); isolamento por usuário; subcategoria `eventual`/sem natureza nunca aparece na grade | Sonnet: implementação | `backend/tests/test_planejamento_service.py`, `test_planejamento_endpoints.py` (novos) |
| **Fase 2 — Itens planejados e vínculo com transação real** ||||
| 8 | Model `ItemPlanejado` (`user_id`, `nome`, `tipo`, `valor`, `data_inicio`, `recorrente`, `data_fim`, `transacao_vinculada_id` FK `pluggy_transactions.id` nullable+único); migration `0024_create_itens_planejados.py` (`down_revision="0023"`) | Sonnet: implementação | `backend/app/models/planejamento.py`, `backend/alembic/versions/0024_create_itens_planejados.py` (novo) |
| 9 | CRUD completo em `app/planejamento/service.py`/`router.py` (`GET/POST /planejamento/itens`, `PUT/DELETE /planejamento/itens/{id}`); `POST /planejamento/itens/{id}/vincular` (body `transacao_id`, valida transação do próprio usuário e ainda não vinculada a outro item) e `POST /planejamento/itens/{id}/desvincular`; `get_grade` passa a mesclar itens planejados (únicos e recorrentes vigentes) nas colunas correspondentes, marcados "hipotético" (ou "cumprido" se vinculados) | Sonnet: implementação | `backend/app/planejamento/service.py`, `router.py`, `backend/app/schemas/planejamento.py` |
| 10 | Testes: CRUD de item planejado (único/recorrente, `data_fim` opcional); vínculo/desvínculo (transação de outro usuário rejeitada, transação já vinculada a outro item rejeitada); item cumprido para de contar como hipotético na grade; item recorrente aparece em todos os meses do intervalo, capado pelo horizonte de 12 meses exibido | Sonnet: implementação | `backend/tests/test_planejamento_service.py`, `test_planejamento_endpoints.py` |
| **Fase 3 — Rodada de design (Impeccable/Artifact)** ||||
| 11 | Candidatas pro vocabulário visual novo (pastilha realizado/sugerido/confirmado/hipotético/cumprido, grade densa com scroll horizontal + coluna/cabeçalho fixos, seção de itens planejados, indicador dentro/excedido do mês corrente) com dado real do endpoint da Fase 1/2; aprovação do CEO antes de codar — mesmo padrão da Fase 5 da Sprint 30 | Sonnet + skill `impeccable` | `DESIGN.md`, tokens `--ac-*` existentes |
| **Fase 4 — `PlanejamentoPage.tsx`** ||||
| 12 | `api/planejamento.ts` (grade, valores, itens, vincular/desvincular); hooks `usePlanejamentoGrade`, `useConfirmarPlanejamentoValor`, `useRemoverPlanejamentoValor`, `useItensPlanejados`, `useCreateItemPlanejado`, `useUpdateItemPlanejado`, `useDeleteItemPlanejado`, `useVincularItemPlanejado`/`useDesvincularItemPlanejado` (invalidam `["planejamento"]`) | Sonnet: implementação | `frontend/src/api/planejamento.ts` (novo), `frontend/src/hooks/` (novos) |
| 13 | `PlanejamentoPage.tsx`: grade com `overflow-x:auto`, primeira coluna e cabeçalho fixos (`position: sticky`), pastilhas de estado do design da Fase 3, clique em célula futura abre edição inline (confirmar valor sugerido ou digitar outro); seção "Itens planejados" (form criar, listagem, ação vincular abrindo busca simples de transação por período/tipo, desvincular) | Sonnet: implementação | `frontend/src/pages/PlanejamentoPage.tsx` (novo) |
| 14 | Aba "Planejamento" em `ProtectedPage.tsx` (ocupa o lugar deixado pela remoção de "Orçamento" na Fase 0) | Sonnet: implementação | `frontend/src/pages/ProtectedPage.tsx` |
| 15 | Testes: `PlanejamentoPage.test.tsx` (grade renderiza 16 colunas, confirmar sugestão, editar valor, indicador dentro/excedido do mês corrente, criar/editar/excluir item planejado, vincular/desvincular) | Sonnet: implementação | `frontend/src/pages/PlanejamentoPage.test.tsx` (novo) |
| **Fase 5 — Fechamento** ||||
| 16 | QA visual real `scripts/browser-check/check-sprint38.mjs` (novo): grade completa (scroll horizontal, sticky), confirmar sugestão, editar valor, mês corrente com status, criar item planejado único e recorrente, vincular a uma transação real, ausência de Orçamento em qualquer tela/nav; desktop+mobile, claro+escuro | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 17 | Atualizar `docs/roadmap.md` (novo épico E12, fecha Sprint 38), `docs/directory-structure.md`, `docs/dashboards-guia-cards.md` (remove seção de Orçamento, adiciona Planejamento), `DESIGN.md` (vocabulário visual novo da Fase 3) | Haiku: doc-updater | arquivos acima |
| 18 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Backend: sugestão por média 3 meses respeitando as mesmas exclusões de todo dashboard; célula sem
override recalcula dinamicamente; confirmar/editar/remover override persiste corretamente; mês
corrente com realizado parcial e status nos dois sentidos (despesa/receita); isolamento por
usuário em grade, valores e itens planejados; CRUD de item planejado único/recorrente; vínculo e
desvínculo com transação real (rejeita transação de outro usuário ou já vinculada); item cumprido
sai da contagem de hipotético; subcategoria eventual/sem natureza nunca aparece na grade; nenhuma
rota/tabela de Orçamento sobrevive. Frontend: grade renderiza histórico+atual+futuro corretamente,
edição inline de sugestão, indicador dentro/excedido, CRUD de item planejado, fluxo de
vincular/desvincular, ausência de Orçamento em qualquer tela.

## Impacto no roadmap

Fecha um novo épico, **E12 Planejamento financeiro** — sucessor direto de E9 (que já havia fechado
com a Projeção, depois removida) e do mecanismo de Orçamento nascido cross-epic na Sprint 30.
Toggle "Modo Projeção" no Dashboard e abatimento por fatura futura ficam registrados no roadmap
como candidatos futuros, sem sprint numerada.

## Riscos / dependências

- **Maior risco da sprint**: vínculo entre item planejado e transação real não tem precedente no
  código — mais próximo é a associação `asset_id`/`liability_id` em `pluggy_transactions`, mas
  aquela é 1-transação-para-1-ativo (N:1), enquanto aqui é 1-item-planejado-para-1-transação (1:1,
  únicos ao longo do tempo). Validar a busca de transação candidata (período/tipo) com dado real
  da VM de dev antes de fechar a Fase 2.
- Migration `0022` (drop de `orcamentos`) não preserva dado — aceitável só porque o CEO confirmou
  ausência de uso real; se essa premissa mudar durante a execução (dado real inesperado na VM),
  parar e confirmar com o CEO antes de aplicar.
- Sequenciamento: Fase 1 depende só da Fase 0 (nome de rota/tabela livre); Fase 2 depende da Fase
  1 (mesmo módulo `app/planejamento/`); Fase 3 depende de dado real da Fase 1/2; Fase 4 depende da
  Fase 3. Fase 0 é a única independente e deve rodar primeiro.
- Grade de 16 colunas × N subcategorias é a maior tabela do app até hoje — decisão de sticky
  column/header é obrigatória, não cosmética; testar em mobile (390px) é parte do QA visual, não
  opcional (achado real de overflow horizontal já aconteceu 2x no projeto — Sprints 6 e 7).
- Horizonte fixo em 12 meses (decisão explícita do CEO "por enquanto") — se não for suficiente na
  prática, volta como ajuste desta mesma tela, não como sprint nova de descoberta.
