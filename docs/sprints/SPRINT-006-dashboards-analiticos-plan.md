# SPRINT-006: Dashboards analíticos — Plano

- **PRD(s):** [PRD-006-dashboards-analiticos](../prd/PRD-006-dashboards-analiticos.md)
- **Data do plano:** 2026-08-14

## Objetivo da sprint

Ao final, o dashboard tem identidade visual real (tipografia própria,
layout que usa a largura da tela), cada card de resumo mostra tendência
dos últimos 3/6/12 meses, cada linha do drill-down mostra sua tendência e o
percentual que representa do nível acima, e o drill-down expande em
sanfona em vez de esconder o nível anterior.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Rodada de comparação visual de tipografia: 2-3 pares de fonte auto-hospedáveis renderizados via `scripts/browser-check`, CEO escolhe antes de seguir | Sonnet + skill impeccable | [SPRINT-005-report](SPRINT-005-dashboards-core-report.md) §QA visual (mesmo processo usado pra cor) |
| 2 | Aplicar tipografia escolhida (`@font-face` self-hosted) + revisar `.dash-page`/largura em `frontend/src/index.css` pra aproveitar espaço lateral | Sonnet + skill impeccable | [index.css](../../frontend/src/index.css); [DESIGN.md](../../DESIGN.md) (estender, não substituir tokens de cor) |
| 3 | `app/dashboards/service.py`: `get_tendencia(db, user_id, *, ano, mes, meses)` — agregação por `(ano, mês)` extraído de `data_competencia`, uma query, reformatada em série ordenada | Sonnet: implementação | PRD-006 §Dados e modelo, §Critérios 1-2 |
| 4 | `app/dashboards/service.py`: `get_tendencia_por_categoria(db, user_id, *, tipo, ano, mes, meses)` — mesma agregação, agrupada também por `subcategory_id`, uma query só (evita N chamadas por categoria) | Sonnet: implementação | PRD-006 §Dados e modelo, §Critério 3 |
| 5 | `app/dashboards/service.py`: `get_por_categoria`/`get_por_meio_pagamento` ganham campo `percentual` (linha/soma de todas as linhas da resposta); denominador zero → `0` | Sonnet: implementação | PRD-006 §Critérios 3-4, §Regras de negócio |
| 6 | `app/schemas/dashboards.py`: `TendenciaMesOut`, `TendenciaCategoriaOut`; `CategoriaTotalOut`/`MeioPagamentoTotalOut` +`percentual` | Sonnet: implementação | [schemas/dashboards.py](../../backend/app/schemas/dashboards.py) |
| 7 | `app/dashboards/router.py`: `GET /dashboards/tendencia?ano=&mes=&meses=`, `GET /dashboards/por-categoria/tendencia?tipo=&ano=&mes=&meses=` | Sonnet: implementação | [dashboards/router.py](../../backend/app/dashboards/router.py) (padrão já estabelecido) |
| 8 | Testes unitários: tendência (3/6/12 meses, borda de mês, período sem dado), tendência por categoria, percentual (soma bate 100%, denominador zero), isolamento por usuário | Sonnet + skill tdd-workflow | PRD-006 §Critérios 1-4, 8 |
| 9 | Testes de integração: novos endpoints — 401, isolamento entre usuários, combinação de filtros | Sonnet + skill tdd-workflow | PRD-006 §Critério 8 |
| 10 | Frontend: `api/dashboards.ts` — `fetchDashboardTendencia`, `fetchDashboardPorCategoriaTendencia`; hooks `useDashboardTendencia`, `useDashboardCategoriaTendencia` | Sonnet: implementação | [api/dashboards.ts](../../frontend/src/api/dashboards.ts) (padrão já estabelecido) |
| 11 | Frontend: sparkline nos 4 cards de resumo (Recharts, pequeno) + seletor de período histórico (3/6/12 meses); Patrimônio sem sparkline (nota visual "sem histórico ainda") | Sonnet + skill impeccable | PRD-006 §Escopo (patrimônio fora), [DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) |
| 12 | Frontend: tendência simplificada por linha no drill-down de categoria (componente visual mais simples que o dos cards, conforme decisão do CEO) | Sonnet + skill impeccable | PRD-006 §Critério 3 |
| 13 | Frontend: reestruturar `DashboardsPage.tsx` pro modelo sanfona — estado de expansão independente por nível (categoria/meio de pagamento/extrato), sem esconder níveis anteriores; "voltar" vira "recolher" por seção | Sonnet: implementação | PRD-006 §Critério 6, §Regras de negócio (múltiplas categorias expandidas ao mesmo tempo) |
| 14 | Frontend: exibir `percentual` em cada linha do drill-down (categoria, meio de pagamento) e calcular percentual da linha de extrato no cliente contra o total do meio de pagamento já conhecido | Sonnet: implementação | PRD-006 §Critérios 3-5 |
| 15 | Testes Vitest: sparkline com dado mockado, seletor de período refetch, sanfona mantém níveis anteriores visíveis ao expandir mais um nível, percentual exibido corretamente em cada nível | Sonnet + skill tdd-workflow | [DashboardsPage.test.tsx](../../frontend/src/pages/DashboardsPage.test.tsx) (estender, não substituir) |
| 16 | `/impeccable audit` + captura real via `scripts/browser-check` (desktop + mobile, todos os níveis da sanfona expandidos) antes de fechar | Sonnet + skill impeccable | [SPRINT-005-report](SPRINT-005-dashboards-core-report.md) §QA visual |
| 17 | Deploy na VM de dev + validação real (agregações de tendência contra as 942 transações reais já sincronizadas, mesmo processo usado na Sprint 5) | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 18 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `DESIGN.md` — tipografia/layout novos, `roadmap.md` — marcar E6 parte 1 concluída) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, DESIGN.md, roadmap.md |
| 19 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `get_tendencia` com 3/6/12 meses terminando no
  mês filtrado (não no mês corrente do calendário); mês sem nenhuma
  transação aparece com zeros, não ausente da série; `get_tendencia_por_categoria`
  agrupando corretamente por subcategoria ao longo dos meses, incluindo o
  bucket "Não categorizado"; `percentual` somando 100% entre todas as
  linhas de uma resposta (menos arredondamento); `percentual` retornando
  `0` sem erro quando o total do período é zero; isolamento entre usuários
  nos dois endpoints novos.
- **Integração:** `/dashboards/tendencia` e `/dashboards/por-categoria/tendencia`
  sem cookie retornam 401; usuário A não vê tendência/percentual de
  usuário B; combinação de `meses=3|6|12` com `ano`/`mes` do filtro.
- **Frontend (Vitest):** sparkline renderiza a partir de dado mockado de
  tendência; trocar o seletor de período (3/6/12) dispara refetch;
  expandir uma segunda categoria não recolhe a primeira (sanfona);
  percentual aparece corretamente ao lado do valor em cada nível.
- Meta ≥80% de cobertura nos módulos novos — mesmo padrão das sprints
  anteriores.

## Impacto no roadmap

Fecha a primeira metade do épico E6 (dashboards analíticos: tendência e
percentual). Deixa a segunda metade de E6 (despesas por ativo — Sprint 7,
tela de Ativos) e a modernização de Categorização (Sprint 8) como próximas
candidatas, ambas dependentes da fundação de design system (tipografia,
layout) que esta sprint estabelece.

## Riscos / dependências

- **Tipografia precisa de aprovação visual real antes de virar código** —
  não travar uma fonte só por descrição em texto; usar
  `scripts/browser-check` (já existe, ver Sprint 5) pra renderizar opções
  reais e deixar o CEO escolher, mesmo processo que funcionou bem pra
  direção de cor.
- **Sanfona multiplica queries potencialmente** — com múltiplas categorias
  expandidas ao mesmo tempo, cada uma dispara sua própria busca de meio de
  pagamento (e cada meio de pagamento expandido, sua própria busca de
  transações). Não é o mesmo padrão N+1 corrigido na Categorização (aqui
  cada busca é iniciada por uma ação explícita do usuário, não por um loop
  automático no backend), mas vale desenhar o `useQuery` de cada nível com
  `enabled` bem escopado (só busca quando aquele nível específico está
  expandido) pra não disparar tudo de uma vez.
- **Tendência por categoria é a query nova mais pesada** — agrupar por
  `(ano, mês, subcategory_id)` num intervalo de até 12 meses, contra uma
  base que já passou de 940 transações reais na VM de dev. Validar tempo
  de resposta real contra esse dado (não só dado sintético de teste) antes
  de fechar a sprint — mesmo cuidado que revelou o problema de performance
  da Categorização nesta sessão.
- **Patrimônio sem tendência pode confundir o usuário** se o card não
  deixar isso explícito — mesmo cuidado de copy já usado na Sprint 5 pro
  rótulo "atual, fora do filtro de período".
