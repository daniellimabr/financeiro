# SPRINT-024: Dashboard — layout, cards, navegação e cores — Plano

- **PRD(s):** [PRD-024-dashboard-layout-cards-navegacao.md](../prd/PRD-024-dashboard-layout-cards-navegacao.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

O Dashboard ganha hierarquia visual (Ativos/Passivos/Patrimônio numa linha própria), navegação de
mês por seta nos cards de saldo, drilldowns que realmente ajudam a entender o número (memória de
cálculo em vez de listas desconexas ou tabelas em "Ver detalhe"), cores distintas por item nos
funis que hoje colidem ou são uniformes, e um atalho de sincronização na tela de Categorização.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Remove disclaimers dos cards Saldo Acumulado/Patrimônio; reagrupa grid em 2 linhas (Ativos/Passivos/Patrimônio + resto) | Sonnet: implementação | `frontend/src/pages/DashboardsPage.tsx` (239-327) |
| 2 | Ícone de seta decorativo em "Saldo Anterior"; `mesSeguinte()` + botão de seta nested com `stopPropagation` em "Saldo Acumulado", alerta de fronteira | Sonnet: implementação | `DashboardsPage.tsx` (`mesAnterior` linha 115, cards 241-300), `frontend/src/components/AccountTipoIcon.tsx` (padrão de ícone SVG inline) |
| 3 | Expande paleta categórica de 8 para 16 cores (`--cat-9`..`--cat-16` em 3 blocos de `index.css`; `PALETTE_SIZE` em `categoryColors.ts`) — usar skill `dataviz` para escolher os 8 matizes novos | Sonnet: implementação | `frontend/src/utils/categoryColors.ts`, `frontend/src/index.css` |
| 4 | Generaliza `buildGroupColorIndex` para `buildColorIndexFromIds(ids)`; aplica cor por ativo em `AtivosAccordion` (Dashboard) e nos 2 pontos de `AssetsPage.tsx` | Sonnet: implementação | `frontend/src/utils/categoryColors.ts`, `DashboardsPage.tsx` (658-714), `frontend/src/pages/AssetsPage.tsx` (linhas 81, 388) |
| 5 | Card "Saldo": troca `SaldoPorContaList` por painel de memória de cálculo (Receita−Despesa=Saldo) usando `summary` já carregado | Sonnet: implementação | `DashboardsPage.tsx` (drill.kind==="saldo", ~281-288/392) |
| 6 | Card "Saldo Acumulado": adiciona memória de cálculo (âncora + acumulação mês a mês) + resumo receita/despesa do mês, acima do `TrendChart` existente — conferir schema `SaldoAcumulado`/`EvolucaoSaldoConta` antes de montar a UI | Sonnet: implementação | `DashboardsPage.tsx` (drill.kind==="saldoAcumulado", 404-420), `frontend/src/api/dashboards.ts` |
| 7 | `InvestimentosValorAtualList` vira accordion (Investimento → Holding via `fetchPluggyInvestments(investimentoId)`) | Sonnet: implementação | `DashboardsPage.tsx` (804-839), `frontend/src/api/pluggy.ts` |
| 8 | Card "Passivos": adiciona `LiabilitiesValorAtualList` ao lado do `PassivosAccordion` existente | Sonnet: implementação | `DashboardsPage.tsx` (383-390, componente 884-925) |
| 9 | `PatrimonioBreakdownPanel`: de tabela com "Ver detalhe" para accordion de 4 partes expansível in-place, reaproveitando `AssetsValorAtualList`/`LiabilitiesValorAtualList`/`InvestimentosValorAtualList` (já com drilldown de holdings da tarefa 7)/`TrendChart` | Sonnet: implementação | `DashboardsPage.tsx` (927-1010) |
| 10 | Botão "Sincronizar contas" em Categorização — `useSyncPluggyItems()` direto, sem diálogo, estado de loading/disabled | Sonnet: implementação | `frontend/src/pages/CategorizationReviewPage.tsx` (168-266), `frontend/src/hooks/useSyncPluggyItems.ts` |
| 11 | Testes frontend: navegação por seta (mês seguinte + alerta), accordion Patrimônio, accordion Investimento→Holding, paleta de 16 sem colisão, botão de sync, memórias de cálculo de Saldo/Saldo Acumulado | Sonnet: implementação | testes existentes de `DashboardsPage`/`CategorizationReviewPage`/`categoryColors` |
| 12 | QA visual real na VM de dev — `scripts/browser-check/check-sprint24.mjs` (novo), claro/escuro, desktop+mobile | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 13 | Atualizar `docs/dashboards-guia-cards.md` (novos drilldowns) e `docs/directory-structure.md` | Haiku: doc-updater | `docs/dashboards-guia-cards.md`, `docs/directory-structure.md` |
| 14 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Unitários/componente (frontend, praticamente sem mudança de backend): `buildColorIndexFromIds`
sem colisão até 16 ids; `mesSeguinte` com alerta de fronteira; accordions (Patrimônio,
Investimento→Holding) expandindo/recolhendo e buscando dado sob demanda; painéis de memória de
cálculo renderizando os valores corretos a partir de `summary`/`saldo-acumulado`; botão de sync
disparando a mutation e refletindo estado de loading. Sem migration nesta sprint.

## Impacto no roadmap

Cross-epic, sem épico prévio (mesmo padrão das Sprints 16-23). Independente da Sprint 23
(Investimentos) — pode rodar antes ou depois dela, sem dependência de código entre as duas.

## Riscos / dependências

- Trocar `<button className="dash-tile clickable">` por `<div role="button">` no card "Saldo
  Acumulado" precisa preservar acessibilidade por teclado (Enter/Espaço) — checar com
  `check-sprint24.mjs` ou revisão manual, não só visual.
- Se `GET /dashboards/saldo-acumulado` não expuser todos os campos necessários pra memória de
  cálculo (âncora explícita, por exemplo), pode ser necessário um ajuste aditivo de schema —
  decisão a confirmar durante a execução, registrada no relatório.
- Reaproveitar `InvestimentosValorAtualList` tanto no card Ativos quanto dentro do accordion do
  card Patrimônio exige que o componente seja genérico o bastante para os dois contextos (mesmo
  padrão de composição, sem duplicar implementação).
