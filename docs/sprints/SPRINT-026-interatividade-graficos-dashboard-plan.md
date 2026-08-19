# SPRINT-026: Interatividade de gráficos (ampliar + hover + clique = filtro) — Plano

- **PRD(s):** [PRD-026-interatividade-graficos-dashboard.md](../prd/PRD-026-interatividade-graficos-dashboard.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

Todo gráfico de linha do sistema (mini gráfico de drilldown, sparkline de card, gráfico de
tendência de Ativos/Passivos/Investimentos/Natureza) passa a se comportar do mesmo jeito: maior,
com legenda no hover e um clique que filtra a tela pelo mês do ponto de dado. Além disso (achado do
CEO na validação da Sprint 25), a seção "Valor atual por Ativo" do card Ativos vira drilldown/
accordion, consistente com as outras duas seções do mesmo card.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Avaliar consolidação: um componente de gráfico de linha parametrizado (tamanho/interatividade) vs. 3 componentes separados ganhando as mesmas props — decidir antes de tocar os 3 arquivos | Sonnet: implementação | `frontend/src/components/CardSparkline.tsx`, `TrendChart.tsx`, `DashboardsPage.tsx` (`RowTrend`, linha 627) |
| 2 | Reconstruir `RowTrend` em Recharts, 3x mais largo, com `Tooltip` (mesmo padrão de `CardSparkline`) | Sonnet: implementação | `DashboardsPage.tsx` (627-650, usos em `GrupoAccordion`/`SubcategoriaAccordion`) |
| 3 | Adicionar clique-em-ponto → filtro de mês em `RowTrend`/`CardSparkline`/`TrendChart` (destaque visual do ponto sob hover antes do clique) | Sonnet: implementação | os 3 componentes + prop `onClickPonto`/equivalente |
| 4 | Conectar o clique ao estado `ano`/`mes` de cada tela: `DashboardsPage.tsx`, `AssetsPage.tsx`, `LiabilitiesPage.tsx`, `InvestimentosPage.tsx`, `NaturezaPage.tsx`, `ProjecaoPage.tsx` | Sonnet: implementação | `frontend/src/components/PeriodFilter.tsx`, cada página listada |
| 5 | Testes de componente: clique em ponto dispara callback de filtro correto; tooltip mostra mês/ano+valor; `RowTrend` renderiza 3x mais largo | Sonnet: implementação | testes existentes de `DashboardsPage`/`AssetsPage`/etc. |
| 6 | `AssetsValorAtualList` ("Valor atual por Ativo", card Ativos): troca `<table>` por `dash-accordion`/`Row` (mesmo padrão de "Valor atual por Investimento"), decidindo o que cada linha expande (achado do CEO na validação da Sprint 25, 2026-08-19) | Sonnet: implementação | `DashboardsPage.tsx` (`AssetsValorAtualList`, `InvestimentosValorAtualList` como referência) |
| 7 | QA visual real na VM de dev — `scripts/browser-check/check-sprint26.mjs` (novo): hover mostra tooltip, clique navega o filtro, em pelo menos 3 telas diferentes (Dashboard, Ativos, Investimentos), desktop+mobile; confirma "Valor atual por Ativo" como drilldown | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 8 | Atualizar `docs/directory-structure.md` (componente de gráfico consolidado ou não, conforme decisão da tarefa 1) e `docs/dashboards-guia-cards.md` (Valor atual por Ativo vira drilldown) | Haiku: doc-updater | `docs/directory-structure.md`, `docs/dashboards-guia-cards.md` |
| 9 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Componente (frontend, sem mudança de backend): clique num ponto de dado dispara a mudança de
`ano`/`mes` esperada em cada tela; tooltip formata mês/ano+valor; nenhuma chamada de rede nova é
disparada só por hover (só o filtro em si, já existente, dispara refetch). Regressão: gráficos
existentes continuam renderizando os mesmos valores após a migração do `RowTrend`.

## Impacto no roadmap

Cross-epic, sem épico prévio. 2ª de 3 sprints desta sessão de planejamento (PRD-025/026/027) —
independente de PRD-025 (pode rodar antes ou depois), mas se PRD-025 mudar `RowTrend`/`GrupoAccordion`
antes desta sprint (não deveria, PRD-025 só adiciona título/reordena seções), revisar conflito de
merge na sessão de execução.

## Riscos / dependências

- Recharts não expõe nativamente "clique num ponto específico da linha" da mesma forma simples que
  expõe `Tooltip` — pode exigir `activeDot={{ onClick }}` ou capturar `onClick` no `LineChart` e
  mapear pro índice ativo do tooltip; validar a abordagem antes de replicar nos 3 componentes.
- Ampliar `RowTrend` em 3x pode quebrar o layout compacto das linhas do funil de Despesa/Receita em
  telas menores — QA mobile obrigatório antes de fechar.
- Se a consolidação da tarefa 1 virar um componente único, `CardSparkline`/`TrendChart` como nomes
  próprios podem sumir — atualizar todos os call sites na mesma sprint (sem shim de
  compatibilidade).
- Tarefa 6: o que cada linha de "Valor atual por Ativo" expande ao clicar não está decidido — "Valor
  atual por Investimento" expande pra holdings (dado que já existe por investimento) e "Despesas por
  Ativo" expande pro extrato (accordion da Sprint 25), mas um Ativo não tem holdings nem precisa
  reabrir o mesmo extrato de outra seção; decidir na execução (ex.: sem conteúdo ao expandir, mesmo
  padrão adotado por "Passivos — saldo devedor" na Sprint 25) antes de codar.
