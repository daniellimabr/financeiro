# SPRINT-027: "Ocultar gasto" (binóculo) e gráfico comparativo de categorias — Plano

- **PRD(s):** [PRD-027-ocultar-gasto-comparativo-categorias.md](../prd/PRD-027-ocultar-gasto-comparativo-categorias.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

Dentro do funil de Despesa/Receita do Dashboard, o usuário consegue simular "e se esse gasto não
tivesse existido" ocultando itens (sem afetar dado real nem outros cards) e ver como a composição
de gasto por categoria mudou mês a mês.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Ícone SVG de binóculo (mesmo padrão de ícone inline decorativo já usado — `AccountTipoIcon`/`TransactionTipoIcon`) | Sonnet: implementação | `frontend/src/components/AccountTipoIcon.tsx` (padrão de referência) |
| 2 | Estado local de "itens ocultos" no funil aberto (Set de ids de transação), toggle por linha, recalcula total do grupo/subcategoria e mini gráfico local sem chamada de rede | Sonnet: implementação | `frontend/src/pages/DashboardsPage.tsx` (`GrupoAccordion`/`SubcategoriaAccordion`), `frontend/src/utils/projecao.ts` (padrão de referência de estado local efêmero) |
| 3 | Reset do estado de itens ocultos ao fechar o funil ou trocar `ano`/`mes` | Sonnet: implementação | `DashboardsPage.tsx` (`fecharFunil`, mudança de filtro) |
| 4 | Gráfico comparativo de categorias dentro do funil Despesa/Receita — avaliar se `GET /dashboards/por-categoria/tendencia` (já existente) atende ou precisa ajuste aditivo | Sonnet: implementação | `frontend/src/api/dashboards.ts`, `backend/app/dashboards/service.py` (`get_tendencia_por_categoria`) |
| 5 | Componente de gráfico novo (área empilhada ou linhas múltiplas por categoria, decidir em execução) — reaproveitar base Recharts já consolidada na Sprint 26 | Sonnet: implementação | componente de gráfico consolidado (resultado da Sprint 26) |
| 6 | Testes: toggle de ocultar recalcula total local sem request nova; reset ao fechar/trocar filtro; cards de resumo do topo não mudam ao ocultar item; gráfico comparativo renderiza a partir do dado de tendência por categoria | Sonnet: implementação | testes existentes de `DashboardsPage` |
| 7 | QA visual real na VM de dev — `scripts/browser-check/check-sprint27.mjs` (novo): ocultar/desocultar item, contagem de requests via Playwright (mesmo padrão de `check-sprint14.mjs`), gráfico comparativo renderizando, desktop+mobile | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 8 | Atualizar `docs/dashboards-guia-cards.md` (nova funcionalidade de simulação, escopo explícito de não afetar cards de resumo) | Haiku: doc-updater | `docs/dashboards-guia-cards.md` |
| 9 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Unitários (frontend): função pura de recálculo de total excluindo ids ocultos (mesmo padrão de
`applyHipoteticas`); reset de estado ao fechar funil/trocar filtro. Componente: toggle de binóculo
alterna estado visual e total exibido; nenhuma chamada de rede nova disparada ao ocultar/desocultar
(contagem de requests via Playwright, mesmo padrão da Sprint 14). Backend: só se a tarefa 4
concluir que `por-categoria/tendencia` precisa de ajuste — caso contrário, sem mudança de backend.

## Impacto no roadmap

Cross-epic, sem épico prévio. 3ª de 3 sprints desta sessão de planejamento (PRD-025/026/027).
Depende da Sprint 26 apenas na medida em que reaproveita o componente de gráfico consolidado lá —
se a Sprint 26 ainda não tiver rodado, o gráfico comparativo desta sprint usa `TrendChart` atual
como base, sem bloquear a execução.

## Riscos / dependências

- Escopo do "ocultar gasto" ficou deliberadamente restrito ao funil aberto (decisão do CEO nesta
  sessão) — se o CEO pedir escopo "tela inteira" ao ver o resultado ao vivo (mesmo padrão de
  revisão pós-entrega de outras sprints, ex. Sprint 8/9), isso é uma mudança de arquitetura maior
  (parâmetro de exclusão nos endpoints agregados), não um ajuste rápido — sinalizar antes de
  aceitar mudar no meio da execução.
- Tipo de gráfico (área empilhada vs. linhas múltiplas) e uso ou não do endpoint
  `por-categoria/tendencia` como está ficam para decisão técnica da execução — podem exigir
  agregação nova se o formato de retorno atual não separar por categoria do jeito necessário pro
  gráfico.
