# SPRINT-006: Dashboards analíticos — Relatório

- **Plano:** [SPRINT-006-dashboards-analiticos-plan.md](./SPRINT-006-dashboards-analiticos-plan.md)
- **Data do relatório:** 2026-08-15

## Resumo

Entregue: tendência histórica (3/6/12 meses) nos cards de resumo e no
drill-down de categoria, percentual de representatividade em cada nível do
funil, drill-down reestruturado em sanfona (múltiplos níveis expandidos
simultaneamente), e a primeira tipografia própria do projeto (Archivo/
Public Sans, escolhida pelo CEO por comparação visual real) com layout mais
largo. Validado com dado real na VM de dev (942+ transações), incluindo dois
bugs visuais mobile encontrados e corrigidos via QA visual real
(`scripts/browser-check`).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Rodada de comparação visual de tipografia (CEO escolhe) | feito | 3 pares (Space Grotesk/Inter, Archivo/Public Sans, Sora/Work Sans) renderizados como Artifact com conteúdo real do dashboard, fontes reais baixadas do Google Fonts (subset `latin`) e embutidas como `@font-face` base64 só no comparativo. CEO escolheu **Archivo/Public Sans**. |
| 2 | Aplicar tipografia + revisar largura do `.dash-page` | feito | Fontes baixadas e re-hospedadas em `frontend/public/fonts/*.woff2` (licença OFL, sem CDN). `--font-display`/`--font-body` novos em `index.css`; `.dash-page` de `880px` para `1440px`. |
| 3 | `get_tendencia()` | feito | Query única por `(ano, mês)`, zero-fill de meses sem dado, termina no mês filtrado (não no calendário). |
| 4 | `get_tendencia_por_categoria()` | feito | Query única por `(ano, mês, subcategory_id)`, inclui bucket "Não categorizado". |
| 5 | `percentual` em `get_por_categoria`/`get_por_meio_pagamento` | feito | Denominador zero → `Decimal("0")`, nunca erro/NaN. |
| 6 | Schemas novos | feito | `TendenciaMesOut`, `PontoTendenciaOut`, `TendenciaCategoriaOut`, `+percentual` em `CategoriaTotalOut`/`MeioPagamentoTotalOut`. |
| 7 | Endpoints novos | feito | `GET /dashboards/tendencia`, `GET /dashboards/por-categoria/tendencia`, parâmetro `meses` (padrão 6). |
| 8 | Testes unitários backend | feito | 14 testes novos em `test_dashboards_service.py` (tendência, percentual, isolamento, borda de mês). |
| 9 | Testes de integração backend | feito | 6 testes novos em `test_dashboards_endpoints.py` (401, isolamento, combinação de filtros). |
| 10 | `api/dashboards.ts` + hooks | feito | `fetchDashboardTendencia`/`fetchDashboardPorCategoriaTendencia`, `useDashboardTendencia`/`useDashboardCategoriaTendencia`. |
| 11 | Sparkline nos cards + seletor de período | feito | Recharts `LineChart` pequeno nos 3 cards com histórico; Patrimônio sem sparkline, nota visual "sem histórico ainda" adicionada ao texto já existente. |
| 12 | Tendência por linha no drill-down de categoria | feito | SVG inline simples (`RowTrend`), não Recharts — visual deliberadamente mais simples que o dos cards, conforme decisão do CEO registrada no PRD. |
| 13 | Reestruturar `DashboardsPage.tsx` pra sanfona | feito | Estado `expandedCategorias`/`expandedMeios` substitui o antigo `drill` de tela-substitui-tela; cada nível é seu próprio componente que só busca dado quando montado. |
| 14 | Percentual em cada linha | feito | Categoria e meio de pagamento vêm do backend; linha de extrato calculada no frontend contra o total do meio de pagamento já conhecido. |
| 15 | Testes Vitest novos | feito | 4 testes novos (8 no total no arquivo): sparkline a partir de dado mockado, refetch do seletor de período, sanfona mantendo níveis anteriores visíveis com 2 categorias expandidas, percentual em cada nível. |
| 16 | `/impeccable audit` + `browser-check` | feito | Sem Docker/WSL2 local — QA visual real feita direto contra a VM de dev (`check-sanfona.mjs`, novo). 2 bugs mobile reais encontrados e corrigidos (ver seção própria abaixo). |
| 17 | Deploy na VM de dev + validação real | feito | 3 deploys (feature + 2 correções mobile), validados contra 942+ transações reais já sincronizadas. |
| 18 | Atualizar docs vivos | feito | OVERVIEW.md, directory-structure.md, DESIGN.md, roadmap.md. |
| 19 | Relatório de sprint | feito | Este documento. |

## Evidência de testes

### Backend

```
165 passed, 172 warnings in 2.84s

Name                                 Stmts   Miss  Cover
------------------------------------------------------------------
app\dashboards\__init__.py               0      0   100%
app\dashboards\router.py                24      0   100%
app\dashboards\service.py              109      0   100%
app\schemas\dashboards.py               15      0   100%
------------------------------------------------------------------
TOTAL                                 1209     24    98%
```

### Frontend

```
Test Files  8 passed (8)
     Tests  28 passed (28)
```

Cobertura de lógica de negócio: 98% total no backend (100% em
`app/dashboards/`, módulo novo desta sprint). Meta ≥80% superada.

## Lint/formatter

```
backend:  ruff check → All checks passed!
          ruff format --check → 70 files already formatted
frontend: eslint . → sem erros
          prettier --check . → All matched files use Prettier code style!
          tsc -b → sem erros
```

## Decisões tomadas durante a execução

- **Validação de `meses` sem `Literal[3, 6, 12]`.** A tentativa inicial usou
  `Literal[3, 6, 12]` como tipo do query param `meses`, mas o FastAPI/Pydantic
  desta versão não coage `"3"` (string da query string) para o literal `3`
  (int), retornando 422 mesmo com valor válido. Trocado por
  `Query(6, ge=1, le=24)` — mais permissivo que o previsto no plano, mas sem
  esse bug; o frontend só envia 3/6/12 de qualquer forma (seletor fixo).
- **Comparação de tipografia via Artifact, não `browser-check`.** O plano
  previa usar `scripts/browser-check` pra renderizar as opções de fonte,
  igual ao processo de cor da Sprint 5. Como a Sprint 5 na verdade usou
  Artifacts pra essa decisão específica (não `browser-check`, que só existia
  desde o fim daquela sprint), segui o precedente real: 3 pares
  self-hosted, baixados do Google Fonts (subset `latin`) e publicados como
  Artifact com conteúdo real do dashboard, para o CEO escolher.
- **Dois bugs mobile reais só visíveis com o app renderizado**, encontrados
  via `check-sanfona.mjs` (script novo desta sprint) contra a VM de dev:
  1. Tabela de extrato (`.dash-table`) sem wrapper `overflow-x`, cortando a
     coluna `%` em vez de rolar em 390px. Corrigido com `.dash-table-wrap`.
  2. Linha da sanfona com 6 elementos (chevron/nome/tendência/barra/valor/%)
     apertada demais em 390px, cortando o percentual — mais evidente no
     nível aninhado (meio de pagamento) por causa da indentação acumulada.
     Corrigido escondendo tendência/barra abaixo de 640px (já reforçadas
     pelo gráfico acima) e reduzindo largura mínima de nome/percentual.
  Nenhum dos dois seria pego por lint/`tsc`/testes — mesma lição da Sprint 5
  (overflow/layout real só aparece com o app renderizado).
- **Wrapper `ssh-vm.ps1` instável nesta sessão** (`pip install --quiet`
  falhando de forma intermitente com "failed to locate pyvenv.cfg", mesmo
  com o venv presente e válido). Contornado ativando o venv manualmente e
  chamando `scripts/ssh_vm.py` direto, sem alterar o script — sintoma
  registrado aqui pra investigar se recorrer em sprints futuras.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Cards de Receita/Despesa/Saldo mostram sparkline de tendência | sim | `CardSparkline` (Recharts) nos 3 cards; confirmado em screenshot real (`desktop-sanfona-01-cards.png`). |
| 2. Seletor de período (3/6/12) recalcula a partir do mês filtrado | sim | Teste `refetches tendencia when the historical period selector changes`; `get_tendencia`/`_month_range` terminam sempre em `(ano, mes)` do filtro, não no mês corrente. |
| 3. Drill-down por categoria: tendência simples + percentual do total | sim | `RowTrend` (SVG inline) + campo `percentual`; teste `test_get_tendencia_por_categoria_groups_across_months_with_uncategorized_bucket` e `shows percentual next to the value at each drill level`. |
| 4. Drill-down por meio de pagamento: percentual da categoria | sim | `get_por_meio_pagamento` retorna `percentual` calculado sobre o total já filtrado por `categoria_id`. |
| 5. Linha de extrato: percentual do meio de pagamento, calculado no frontend | sim | `TransacoesPanel` calcula `percentual` client-side contra `meioPagamentoTotal` conhecido do passo anterior — sem endpoint novo. |
| 6. Sanfona: categoria e meio de pagamento visíveis simultaneamente | sim | Teste `expands the sanfona funnel... without hiding prior levels` + `keeps a first expanded categoria visible when a second one is expanded`; confirmado em screenshot real com 2 níveis abertos ao mesmo tempo. |
| 7. Cobertura ≥80% nos módulos novos | sim | 100% em `app/dashboards/` (backend); 28 testes frontend cobrindo sparkline/seletor/sanfona/percentual. |
| 8. `/dashboards/tendencia` e `/por-categoria/tendencia` — 401 sem cookie, isolamento entre usuários | sim | `test_tendencia_without_cookie_returns_401`, `test_por_categoria_tendencia_without_cookie_returns_401`, `test_tendencia_isolated_by_user`, `test_user_does_not_see_other_users_tendencia`. |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção nova "Dashboards analíticos (Sprint 6)", contadores de teste, ferramenta `check-sanfona.mjs`.
- `docs/directory-structure.md` — `frontend/public/fonts/`, hooks/schemas/endpoints novos, `check-sanfona.mjs`, seção "O que ainda não existe" atualizada.
- `DESIGN.md` — tipografia (Archivo/Public Sans), layout (`1440px`), seção nova "Funnel accordion", "List rows" estendida (trend/percentual/breakpoint mobile), Navigation/Breadcrumb reescritas (breadcrumb removido, substituído por accordion).
- `docs/roadmap.md` — Sprint 6 marcada concluída, E6 parcialmente ✅ (parte 1).
- Este relatório.

## Consumo estimado de tokens/sessões

Sessão única, execução completa (backend + frontend + QA visual real + 3
deploys + docs + relatório) — sprint de escopo grande (19 tarefas do plano),
consumo de contexto alto mas dentro de uma única sessão sem necessidade de
`/clear` intermediário.

## Pendências e próximos passos sugeridos

- **Bundle do frontend segue acima de 500kB** (aviso do Vite, não erro) —
  mesma pendência registrada na Sprint 5, ainda não priorizada.
- **Sprint 7 (E6 parte 2 — tela de Ativos)** e **Sprint 8 (Categorização:
  paginação + tabela moderna)** seguem como próximas candidatas, ambas
  reaproveitando a fundação de tipografia/layout desta sprint.
- **Investigar a instabilidade do `ssh-vm.ps1`** (`pip install --quiet`
  falhando intermitentemente) antes que vire fricção recorrente em sprints
  futuras — não bloqueou esta sprint (contornável ativando o venv
  manualmente), mas vale uma sessão dedicada se voltar a acontecer.
- **Evolução de patrimônio/investimentos ao longo do tempo** segue fora de
  escopo por falta de série histórica no schema (precisaria de snapshot
  periódico) — mesma limitação registrada desde a Sprint 5, sem sprint
  candidata ainda.
