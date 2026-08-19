# SPRINT-023: Investimentos — drilldown de posições e extrato unificado — Plano

- **PRD(s):** [PRD-023-investimentos-drilldown-extrato-unificado.md](../prd/PRD-023-investimentos-drilldown-extrato-unificado.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

O card de Investimento para de exibir posições como texto solto e abre direto no drilldown de
Posições (sem overlap de coluna); o extrato passa a mostrar todo movimento real do investimento —
tanto vindo de conta bancária quanto de holdings — inclusive para investimentos como "Quitar o AP"
que hoje aparecem sempre vazios.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Bloco 0: investigação read-only na VM de dev — campos/volume/intervalo real de `PluggyInvestmentTransaction` do investimento "Quitar o AP" | Sonnet: implementação (SSH via `scripts/ssh_vm.py`) | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 2 | Schema `InvestimentoTransacaoOut` + serviço `get_transacoes` (une `PluggyTransaction.investimento_id` e `PluggyInvestmentTransaction` via join em `PluggyInvestment.investimento_id`, filtro `ano`/`mes` opcional, isolado por `user_id`) | Sonnet: implementação | `backend/app/investimentos/service.py`, `backend/app/schemas/investimento.py`, `backend/app/pluggy_integration/service.py::list_investment_transactions` (linha ~654, referência de padrão) |
| 3 | Rota `GET /investimentos/{id}/transacoes?ano=&mes=` | Sonnet: implementação | `backend/app/investimentos/router.py` |
| 4 | Testes backend: união das duas fontes, filtro ano/mes, isolamento por usuário, 401/404 | Sonnet: implementação | `backend/tests/test_investimento_service.py`, `test_investimento_endpoints.py` |
| 5 | `fetchInvestimentoTransacoes(id, {ano, mes})` no frontend | Sonnet: implementação | `frontend/src/api/investimentos.ts` |
| 6 | Aba "Extrato" de `InvestimentoDrilldown` troca a fonte de dado para o endpoint unificado, tabela nova com `<colgroup>` | Sonnet: implementação | `frontend/src/pages/InvestimentosPage.tsx` (`InvestimentoDrilldown`, linhas 332-371) |
| 7 | Card de Investimento: remove texto de "Carteiras"/"Posições"; ação do card abre drilldown com view default `"posicoes"` | Sonnet: implementação | `frontend/src/pages/InvestimentosPage.tsx` (`InvestimentoCard` 273-330, `toggleDrilldown` 119-122, `DrillView` linha 29) |
| 8 | `<colgroup>` + classes de largura em `InvestimentoPosicoes`/`PosicaoHistorico` (mesmo padrão de `.serie-historica-table .col-*`) | Sonnet: implementação | `frontend/src/pages/InvestimentosPage.tsx` (373-429, 534-565), `frontend/src/index.css` (~1244-1261) |
| 9 | Testes frontend: render da tabela de extrato unificado (dado das duas origens), colgroup presente, drillView default | Sonnet: implementação | `frontend/src/pages/InvestimentosPage.tsx` e testes existentes do arquivo |
| 10 | QA visual real na VM de dev — `scripts/browser-check/check-sprint23.mjs` (novo), validar "Quitar o AP" mostrando movimento real desde o início do ano | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 11 | Atualizar `docs/directory-structure.md` e `docs/dashboards-guia-cards.md` (se aplicável) | Haiku: doc-updater | `docs/directory-structure.md` |
| 12 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Unitários: `get_transacoes` unindo as duas fontes corretamente (conta + holdings), filtro
`ano`/`mes` (presente/ausente), isolamento por usuário, ordenação por data desc. Integração:
`GET /investimentos/{id}/transacoes` — 401 sem sessão, 404 cross-user, filtros aplicados
corretamente. Frontend: tabela de extrato renderizando linhas das duas origens com rótulo
distinto, `<colgroup>` presente em `InvestimentoPosicoes`/`PosicaoHistorico`, card abrindo em
"Posições" por default.

## Impacto no roadmap

Cross-epic, sem épico prévio (mesmo padrão das Sprints 16-22). Sem sprint subsequente
diretamente dependente — Sprint 24 (Dashboard) é independente, não bloqueada por esta.

## Riscos / dependências

- O Bloco 0 pode revelar volume de `PluggyInvestmentTransaction` alto o suficiente para justificar
  paginação — se acontecer, decisão registrada no relatório (não presumida no plano).
- Mudar o `drillView` default do card pode exigir revisão do fluxo de teste/QA visual já existente
  (`check-sprint20.mjs`/`check-sprint21.mjs`/`check-sprint22.mjs` assumiam "Extrato" como entrada)
  — checar scripts antigos antes de assumir que continuam válidos sem ajuste.
