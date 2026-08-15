# SPRINT-007: Categorização (rework), eliminação de Transações e Gestão de Contas — Plano

- **PRD(s):** [PRD-007-categorizacao-gestao-contas](../prd/PRD-007-categorizacao-gestao-contas.md)
- **Data do plano:** 2026-08-15

## Objetivo da sprint

Ao final, a fila de Categorização filtra por tipo (receita/despesa) e
status (pendente/confirmada/todas), permite aprovação em lote, corrige
categoria de linhas já confirmadas, e tem descrição de linha editável com
propagação (pendente de aprovação) para transações idênticas. A tela
Transações deixa de existir — suas funções ficam na fila de Categorização
via filtro `status=todas`. "Conectar Conta" vira "Gestão de Contas": lista
contas conectadas, permite renomear (apelido) e remover uma conta da lista
de sync, e centraliza a sincronização num botão único com pré-seleção. Além
disso, formato de moeda padronizado em todas as telas e nova subcategoria
"Aluguel".

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Migration `0008`: `pluggy_accounts.apelido`/`sync_enabled`, `pluggy_transactions.descricao_usuario`/`descricao_sugerida`/`descricao_sugestao_origem_id`, seed idempotente da subcategoria "Aluguel" | Sonnet: implementação | PRD-007 §Dados e modelo; [models/pluggy.py](../../backend/app/models/pluggy.py) |
| 2 | `app/categorization/service.py`: generalizar `list_pending_transactions` → `list_transactions(status, tipo, ano, mes, page, page_size)`, preservando o recálculo de sugestão só na página (sem reintroduzir o N+1 corrigido pós-Sprint 6) | Sonnet: implementação | PRD-007 §Critérios 1-2; [categorization/service.py](../../backend/app/categorization/service.py) |
| 3 | `app/categorization/service.py`: `bulk_confirm` (transação atômica, sucesso/falha por id); `confirm_categorization` → `set_category` sem trava de status | Sonnet: implementação | PRD-007 §Critérios 3-4 |
| 4 | `app/categorization/service.py` + `engine.py`/`normalize.py`: `update_description`, `confirm_description`, `dismiss_description_suggestion` — match exato normalizado + mesma categoria (confirmada ou sugerida) | Sonnet: implementação | PRD-007 §Critérios 5-6, §Regras de negócio |
| 5 | `app/categorization/router.py` + `app/schemas/categorization.py`: renomear rotas `/pending/*` → `/transactions/*`, novos endpoints de bulk-confirm e descrição | Sonnet: implementação | PRD-007 §Escopo |
| 6 | `app/pluggy_integration/models.py`/`service.py`: preservar `apelido` em `_upsert_account`; `sync_item` pula conta com `sync_enabled=False`; novo `update_account`; novo `sync_items(item_ids)` | Sonnet: implementação | PRD-007 §Critérios 7-8; [pluggy_integration/service.py](../../backend/app/pluggy_integration/service.py) |
| 7 | `app/pluggy_integration/router.py`: `PUT /pluggy/accounts/{id}`, `POST /pluggy/sync` | Sonnet: implementação | [pluggy_integration/router.py](../../backend/app/pluggy_integration/router.py) |
| 8 | Testes unitários backend: filtro status/tipo, bulk-confirm parcial, set_category em confirmada, matching de propagação de descrição (positivo/negativo/isolamento por usuário), sync pulando conta desativada, apelido preservado após sync | Sonnet + skill tdd-workflow | PRD-007 §Critérios 1-9 |
| 9 | Testes de integração backend: novas rotas — 401, isolamento entre usuários, combinações de filtro | Sonnet + skill tdd-workflow | PRD-007 §Critério 9 |
| 10 | `frontend/src/utils/format.ts` (novo): extrai `formatCurrency` de `DashboardsPage.tsx`; aplicar em `CategorizationReviewPage`/tela de contas | Sonnet: implementação | [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) |
| 11 | `frontend/src/api/categorization.ts` + hooks: renomear/estender para os endpoints novos (`useCategorizationTransactions`, `useSetCategory`, `useBulkConfirmCategorization`, `useUpdateDescription`, `useConfirmDescriptionSuggestion`, `useDismissDescriptionSuggestion`) | Sonnet: implementação | [api/categorization.ts](../../frontend/src/api/categorization.ts) |
| 12 | `frontend/src/pages/CategorizationReviewPage.tsx`: filtros tipo/status, seleção em lote + aprovar marcadas, editar categoria em linha confirmada, descrição inline editável com nota de propagação e aceitar/descartar sugestão | Sonnet + skill impeccable | PRD-007 §Escopo; reusar `.dash-filter` |
| 13 | Remover `frontend/src/pages/TransactionsPage.tsx` e seu import/rota | Sonnet: implementação | [ProtectedPage.tsx](../../frontend/src/pages/ProtectedPage.tsx) |
| 14 | `frontend/src/api/pluggy.ts` + hooks: `useUpdatePluggyAccount`, `useSyncPluggyItems` (bulk) | Sonnet: implementação | [api/pluggy.ts](../../frontend/src/api/pluggy.ts) |
| 15 | `ConnectAccountPage.tsx` → rework como tela de Gestão de Contas (considerar renomear arquivo): lista de contas por item com apelido/editar/sync_enabled, diálogo "Sincronizar MeuPluggy" com pré-seleção | Sonnet + skill impeccable | PRD-007 §Escopo |
| 16 | `ProtectedPage.tsx`: remover aba "Transações", renomear label "Conectar conta" → "Gestão de contas", ajustar copy da aba início | Sonnet: implementação | [ProtectedPage.tsx](../../frontend/src/pages/ProtectedPage.tsx) |
| 17 | Testes Vitest: filtros disparando refetch, seleção em lote + aprovar, editar categoria confirmada, edição de descrição + propagação + aceitar/descartar, edição de conta, diálogo de sync unificado | Sonnet + skill tdd-workflow | Estender `CategorizationReviewPage.test.tsx`/criar teste da tela de contas |
| 18 | Checar `Caddyfile` — `/pluggy/sync` cai no matcher `@api` (`/pluggy*`) já existente; `/categorization/transactions*` também precisa estar coberto (hoje é `/categorization*`) — conferir, não assumir | Sonnet: implementação | [Caddyfile](../../Caddyfile); OVERVIEW.md §Roteamento Caddy (lição da Sprint 2) |
| 19 | Deploy na VM de dev + validação manual real (fluxos do §Verificação do PRD) | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 20 | `scripts/browser-check/`: script novo cobrindo lote + rename de descrição + gestão de contas (desktop + mobile) | Sonnet: implementação | Padrão de `check-categorizacao.mjs` |
| 21 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` — fechar Sprint 7, registrar Sprint 8/9 e renumerar a antiga "Sprint 8: tabela moderna") | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 22 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `list_transactions` em cada combinação de
  status/tipo; `bulk_confirm` com uma linha inválida no meio do lote (as
  demais ainda confirmam); `set_category` mudando categoria de transação
  já `confirmada`; `update_description` propagando só para descrição
  normalizada idêntica + mesma categoria, não propagando para descrição
  diferente ou categoria diferente, nunca cruzando `user_id`;
  `confirm_description`/`dismiss_description_suggestion`; `sync_item`
  pulando conta com `sync_enabled=False`; `_upsert_account` preservando
  `apelido` num segundo sync.
- **Integração:** todas as rotas novas/renomeadas sem cookie → 401;
  isolamento entre usuários em bulk-confirm, edição de descrição e edição
  de conta; combinações de filtro `status`/`tipo`/`ano`/`mes`.
- **Frontend (Vitest):** filtro tipo/status dispara refetch; marcar
  linhas + "Aprovar marcadas" remove todas da fila de pendentes; "Editar
  categoria" numa linha confirmada atualiza a categoria exibida; editar
  descrição mostra nota "N itens com sugestão pendente"; aceitar/
  descartar sugestão de descrição; tela de contas salva apelido e
  `sync_enabled`; diálogo de sincronização unificada abre com as contas
  corretas pré-marcadas.
- Meta ≥80% cobertura nos módulos tocados, mirando 100% nas funções novas
  — mesmo padrão das sprints anteriores.

## Impacto no roadmap

Fecha a primeira fatia do pedido de "ajustes de tela" trazido pelo CEO
nesta sessão. Deixa Sprint 8 (Gestão de Ativos, E6 parte 2) e Sprint 9
(Dashboard analítico — cards Ativos/Passivos, drilldowns, ordenação,
tooltip, moeda no Dashboard já resolvida por aqui) como próximas
candidatas. A antiga "Sprint 8: Categorização tabela moderna" do roadmap
anterior a esta sessão é renumerada para depois da Sprint 9 — parte do seu
escopo (filtros, ações em lote) já é entregue por esta sprint; o que resta
é só modernização visual/paginação da tabela em si.

## Riscos / dependências

- **Renomear rotas sem shim de compatibilidade** — só o próprio frontend
  consome `/categorization/pending/*` hoje (confirmado na exploração desta
  sessão); atualizar backend e frontend na mesma sprint evita quebra, mas
  a ordem de deploy importa (mesmo container sobe os dois juntos via
  Docker Compose, então não há janela de inconsistência em produção).
- **Propagação de descrição é a peça mais nova** — não existe precedente
  no código para "sugestão pendente de aprovação" fora do próprio motor de
  categorização; reaproveitar `normalize.py` evita duplicar lógica, mas a
  UI de "aceitar/descartar sugestão" por linha é nova o suficiente pra
  merecer atenção extra de teste (positivo, negativo, e o caso de duas
  transações-origem competindo pela mesma candidata — resolver por "a
  primeira grava, a segunda não sobrescreve enquanto houver sugestão
  pendente").
- **Caddyfile** — histórico do projeto já teve bug real (Sprint 2) de rota
  nova cair no matcher errado e devolver 200 do SPA em vez do erro
  esperado da API; task #18 existe especificamente por causa dessa lição.
- **Eliminar a tela Transações é irreversível em termos de UX** — validar
  com o CEO antes do deploy final que o filtro `status=todas` da fila de
  Categorização cobre tudo que a tela antiga oferecia (a exploração desta
  sessão não encontrou nenhuma função exclusiva de `TransactionsPage.tsx`
  além de listar + sincronizar, ambas cobertas).
