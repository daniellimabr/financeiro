# SPRINT-020: Integração completa de Investments da Pluggy — Plano

- **PRD(s):** [PRD-020-integracao-completa-investments-pluggy](../prd/PRD-020-integracao-completa-investments-pluggy.md)
- **Data do plano:** 2026-08-17

## Objetivo da sprint

Ao final: (1) posições/holdings de investimento (CDBs, ações, "Caixinha") passam a ser
capturadas via `GET /investments`/`GET /investments/transactions` da Pluggy, inclusive para
itens que não retornam nenhuma conta pelo endpoint genérico (caso real: Nubank
Investimentos); (2) cada holding pode ser vinculada a um `Investimento` (agrupamento
lógico da Sprint 19) diretamente, sem depender de uma `PluggyAccount`; (3) o card
Patrimônio soma holdings no `saldo_investimentos`, fechando a lacuna real onde "Nubank
Investimentos" era invisível; (4) a tela `InvestimentosPage` ganha uma view "Posições" com
histórico de transações por holding. O schema definitivo (Bloco 2) só é escrito depois do
achado real do Bloco 1 (investigação read-only obrigatória).

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | `PluggyClient`: `get_investments(pluggy_item_id)` (`GET /investments?itemId=`) e `get_investment_transactions(pluggy_investment_id, from_date=None)` (`GET /investments/{id}/transactions`) | Sonnet: implementação | [pluggy_integration/client.py](../../backend/app/pluggy_integration/client.py) (padrão de auth/paginação já usado em `get_accounts`/`get_transactions`) |
| 2 | Bloco 1, investigação read-only: confirmar com o CEO o ambiente (mesma checagem do Bloco 3 da Sprint 19); chamar `get_investments`/`get_investment_transactions` contra Nubank Investimentos e XP na VM de dev, comando a comando | Sonnet: investigação, com o CEO | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), [SPRINT-019-report, "Achados do Bloco 3"](SPRINT-019-gestao-de-investimentos-report.md) |
| 3 | Bloco 1, passo 2: documentar achado real (taxonomia `type`/`subtype`, campos presentes/ausentes, paginação, formato de datas) e confirmar/ajustar o rascunho de schema do PRD-020 antes de escrever a migration | Sonnet: investigação | resultado da tarefa 2; [PRD-020, "Dados e modelo"](../prd/PRD-020-integracao-completa-investments-pluggy.md) |
| 4 | Migration `0016`: tabelas `pluggy_investments`/`pluggy_investment_transactions` (schema conforme achado do Bloco 1, rascunho no PRD-020) | Sonnet: implementação | [alembic/versions/0015_gestao_de_investimentos.py](../../backend/alembic/versions/0015_gestao_de_investimentos.py) (padrão de migration mais recente) |
| 5 | Models `PluggyInvestment`/`PluggyInvestmentTransaction` novos; registro em `models/__init__.py` | Sonnet: implementação | [models/pluggy.py:77-188](../../backend/app/models/pluggy.py) (padrão `PluggyAccount`/`PluggyTransaction`) |
| 6 | `pluggy_integration/service.py`: `_upsert_investment`/`_upsert_investment_transaction`, chamadas dentro de `sync_item` para todo item (mesmo os que também retornam contas); `update_investment` (link/unlink) e `update_investment_saldo_inicial` (clones de `update_account`/`update_saldo_inicial`) | Sonnet: implementação | [pluggy_integration/service.py:110-144,251-346](../../backend/app/pluggy_integration/service.py) |
| 7 | `pluggy_integration/router.py` + `schemas/pluggy.py`: `GET /pluggy/investments` (filtro `investimento_id`), `PUT /pluggy/investments/{id}`, `PUT /pluggy/investments/{id}/saldo-inicial`, `GET /pluggy/investments/{id}/transactions` | Sonnet: implementação | [pluggy_integration/router.py:84-121](../../backend/app/pluggy_integration/router.py), [schemas/pluggy.py:42-69](../../backend/app/schemas/pluggy.py) |
| 8 | `app/investimentos/service.py::get_evolucao`: somar `PluggyInvestment.saldo_inicial`/`valor_atual` das holdings vinculadas em `saldo_base`/`saldo_atual`, sem mudar a fórmula de `rendimento_estimado` | Sonnet: implementação | [investimentos/service.py:120-154](../../backend/app/investimentos/service.py) |
| 9 | `app/dashboards/service.py::_patrimonio_breakdown`: `saldo_investimentos` passa a somar holdings (fonte preferencial por item) + contas `tipo=investimento` só para itens sem holdings, evitando dobrar contagem | Sonnet: implementação | [dashboards/service.py:340-368](../../backend/app/dashboards/service.py) |
| 10 | Testes backend: sync de holdings/transações de investimento (upsert, resync preserva vínculo/`saldo_inicial`), CRUD/vínculo de holding, isolamento por usuário, 401 sem cookie, `get_evolucao` com holdings, **regressão explícita de Patrimônio** para contas/itens sem holdings | Sonnet + skill tdd-workflow | `test_pluggy_service.py`, `test_pluggy_endpoints.py`, `test_investimento_service.py`, `test_dashboards_service.py` (padrão) |
| 11 | `api/pluggy.ts` + hooks novos (`usePluggyInvestments`, `useUpdatePluggyInvestment`, `useUpdatePluggyInvestmentSaldoInicial`, `usePluggyInvestmentTransactions`) | Sonnet: implementação | [api/pluggy.ts](../../frontend/src/api/pluggy.ts), hooks equivalentes de `PluggyAccount` em `frontend/src/hooks/` |
| 12 | `AccountManagementPage.tsx`: nova lista "Posições de investimento" (vínculo a Investimento + saldo inicial editável, mirror da lista de carteiras já existente) | Sonnet: implementação | [pages/AccountManagementPage.tsx:186-264](../../frontend/src/pages/AccountManagementPage.tsx) |
| 13 | `InvestimentosPage.tsx`: drilldown ganha view "Posições" (tabela de holdings vinculadas, linha expansível com histórico de transações); card do investimento lista posições vinculadas junto das carteiras | Sonnet + skill impeccable | [pages/InvestimentosPage.tsx](../../frontend/src/pages/InvestimentosPage.tsx) |
| 14 | Testes frontend: `InvestimentosPage.test.tsx` (view "Posições"), extensão de `AccountManagementPage.test.tsx` | Sonnet + skill tdd-workflow | testes equivalentes de carteira/asset como referência |
| 15 | Deploy VM de dev, validação ao vivo (script `browser-check` novo) — sync populando `pluggy_investments`, vínculo refletindo no card, Patrimônio somando sem regressão | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), `scripts/browser-check/` (padrão) |
| 16 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `dashboards-guia-cards.md` — card Patrimônio muda de fonte, `roadmap.md`) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, dashboards-guia-cards.md, roadmap.md |
| 17 | Relatório de sprint — achados reais do Bloco 1, eventuais ajustes de schema em relação ao rascunho do PRD-020 | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** sync de holdings/transações de investimento (upsert
  idempotente, resync preserva `investimento_id`/`saldo_inicial` editados manualmente,
  mesmo princípio de `data_editada_manualmente` já usado em `PluggyTransaction`); CRUD de
  vínculo holding→Investimento (link/unlink, `NotFoundError` cross-user); `get_evolucao`
  somando holdings; `_patrimonio_breakdown` com holdings (incluindo teste de regressão:
  Patrimônio de contas/itens sem holdings idêntico ao comportamento pré-sprint); isolamento
  por usuário e 401 em toda rota nova.
- **Componente (Vitest):** `InvestimentosPage` (view "Posições", drilldown de histórico por
  holding), extensão de `AccountManagementPage` (lista de posições, vínculo, saldo
  inicial).
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde antes de fechar.
- Testes do Bloco 1 (investigação) não são previsíveis de antemão — dependem do achado
  real, mesmo precedente das Sprints 17/18/19.

## Impacto no roadmap

Sprint sem épico prévio (item registrado em "Registro de reavaliações futuras" a partir do
achado da Sprint 19, formalizado nesta sessão). Ao fechar, o item correspondente deve ser
removido dessa lista e substituído pela entrada padrão de sprint concluída, com referência a
PRD-020/SPRINT-020.

## Riscos / dependências

- **Todo o schema do Bloco 2 (migration `0016`) depende do achado real do Bloco 1** — se a
  taxonomia de `type`/`subtype` ou a estrutura de `/investments/transactions` divergir do
  rascunho do PRD-020, o schema é ajustado antes de escrever a migration.
- **Sprint grande** — 2 endpoints Pluggy novos, 2 tabelas novas, mudança em Patrimônio
  (superfície sensível, já tocada nas Sprints 15/16/18/19), UI nova de posições e
  histórico. Comparável ou maior que a Sprint 19. Se o Bloco 1 revelar complexidade extra
  (ex.: paginação pesada, múltiplos tipos de posição com campos muito distintos), dividir
  em duas sprints é uma saída válida — mesmo precedente das Sprints 7/8/9 e 12/13/14/15.
- **Ambiente da investigação (Bloco 1)** precisa ser confirmado com o CEO antes de rodar
  (dev vs. prod), mesma checagem explícita já feita no Bloco 3 da Sprint 19.
- **Nenhuma dependência de dado real para os Blocos 2-5 além do schema em si** — uma vez
  fechado o schema pelo achado do Bloco 1, o resto (sync, CRUD, telas) é testável com dados
  fictícios/fixtures, como já é padrão neste projeto.
