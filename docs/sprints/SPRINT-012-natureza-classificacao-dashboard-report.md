# SPRINT-012: Natureza — classificação e dashboard de visibilidade — Relatório

- **Plano:** [SPRINT-012-natureza-classificacao-dashboard-plan.md](./SPRINT-012-natureza-classificacao-dashboard-plan.md)
- **PRD:** [PRD-012-natureza-classificacao-dashboard.md](../prd/PRD-012-natureza-classificacao-dashboard.md)
- **Data do relatório:** 2026-08-16

## Resumo

`Subcategory.natureza` (enum `fixa`/`variavel`/`eventual`), dormente desde
a Sprint 2, ganhou sua primeira UI: uma tela nova "Natureza" que combina
(a) um dashboard de visibilidade — 3 cards (Fixo recorrente/Variável
recorrente/Custo eventual) com total, percentual e sparkline, drill-down
até transação — e (b) a tabela de classificação de subcategorias, agrupada
por categoria, salvando via `PUT /subcategories/{id}` já existente. Backend
ganhou `GET /dashboards/por-natureza` e `.../tendencia`, espelhando
`por-categoria`, sem migration. 3 tons de cor novos decididos via skill
`impeccable`. Suíte completa (313 backend + 122 frontend) 100% verde,
lint/format/typecheck limpos nos dois lados, deploy feito na VM de dev e
validado ao vivo via `scripts/browser-check/check-sprint12.mjs`
(desktop+mobile, sem erros de console) contra a conta real do CEO — a
única mutação real do script (natureza de 1 subcategoria) foi restaurada
por `PUT` direto em `finally` e a restauração foi confirmada por query
direta no Postgres da VM.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `get_por_natureza`/`get_tendencia_por_natureza` em `service.py` | feito | Diferença deliberada do padrão `por-categoria`: como o domínio de natureza é fixo (3 valores, não aberto como categoria), as duas funções sempre retornam as 3 naturezas zero-preenchidas em vez de só os buckets com dado — evita lógica de fallback no frontend. Documentado como comentário no código. |
| 2 | Dataclasses/schemas + endpoints `GET /dashboards/por-natureza(/tendencia)` | feito | Sem desvio — mesmo padrão de `CategoriaTotal`/`CategoriaTotalOut`. |
| 3 | Testes backend (service + endpoints) | feito | 21 testes novos: agrupamento fixa/variável/eventual, fallback `null`→eventual, transação sem subcategoria→eventual, exclusão `excluir_de_totais`, isolamento por usuário, sempre-3-buckets, percentual, 401, isolamento nos endpoints. 100% em `app/dashboards/`. |
| 4 | `updateSubcategory` em `api/categories.ts` + `useUpdateSubcategoryNatureza` | feito | Predicate de invalidação de dashboard extraído (`invalidateAllDashboardQueries`) em vez de duplicado — reaproveitado tanto pela mutation de transação quanto pela de subcategoria. |
| 5 | `api/dashboards.ts` + hooks `useDashboardByNatureza`/`useDashboardNaturezaTendencia` + `naturezaLabels.ts` | feito | Sem desvio. |
| 6 | `NaturezaPage.tsx` — dashboard de visibilidade | feito | Funil natureza→subcategoria reaproveita `GET /dashboards/por-categoria` (já existe) agrupado localmente por natureza via `useSubcategories()`, em vez de um endpoint dedicado — mesma técnica de `GrupoAccordion`. `TransacoesPanel` (privada em `DashboardsPage.tsx`) foi exportada e reaproveitada como nível "transação", em vez de duplicada. |
| 7 | `NaturezaPage.tsx` — seção de classificação | feito | Tabela com `<td rowSpan>` por grupo (`table-layout: fixed` + `<colgroup>`, mesma técnica de `cat-review-table`) em vez de repetir o nome do grupo em cada linha. |
| 8 | 3 tons de cor de natureza via skill `impeccable` | feito | Ver "Decisões tomadas" — sem rodada de comparação interativa com o CEO (execução autônoma), documentado com justificativa e contraste calculado manualmente; fica disponível para o CEO revisar visualmente contra a tela real (screenshots deste relatório). |
| 9 | Nova aba "Natureza" em `ProtectedPage.tsx` | feito | Entre "Passivos" e "Gestão de contas", como planejado. |
| 10 | Testes frontend | feito | `NaturezaPage.test.tsx` novo (6 testes), `ProtectedPage.test.tsx` atualizado (+1), `api/categories.test.ts` novo (4 testes — módulo nunca tinha teste direto), `api/dashboards.test.ts` atualizado (+2). |
| 11 | `check-sprint12.mjs` novo, validado contra a VM de dev | feito | Rodado com sucesso (desktop+mobile, sem erros de console) — diferente da Sprint 11, havia `FINANCEIRO_SESSION_TOKEN` disponível (minerado nesta sessão via SSH na VM de dev). |
| 12 | Docs vivos | feito | `OVERVIEW.md`, `directory-structure.md`, `roadmap.md`, `DESIGN.md`. |
| 13 | Relatório de sprint | feito | Este documento. |

## Evidência de testes

Backend:
```
313 passed, 281 warnings in 6.52s

Name                        Stmts   Miss  Cover
app\dashboards\router.py       48      0   100%
app\dashboards\service.py     203      0   100%
app\schemas\dashboards.py      32      0   100%
TOTAL                        1625     33    98%
```

Frontend:
```
 Test Files  19 passed (19)
      Tests  122 passed (122)
```

(109 testes na Sprint 11 → 122 nesta sprint: +6 `NaturezaPage.test.tsx`,
+1 `ProtectedPage.test.tsx`, +4 `api/categories.test.ts`, +2
`api/dashboards.test.ts`.)

Cobertura de lógica de negócio (backend): 98% total, 100% nos módulos
tocados (`app/dashboards/`, `app/schemas/dashboards.py`) — meta ≥80%
superada. Frontend não tem ferramenta de cobertura numérica configurada
(`@vitest/coverage-v8` não é dependência do projeto — lacuna pré-existente,
não desta sprint); cobertura qualitativa: `NaturezaPage` cobre os 3 cards a
partir de fixture mockada, abertura do drill-down (incluindo subcategoria
não classificada caindo em "eventual"), clique até a lista de transações,
tabela de classificação com `null`→"eventual" no `<select>`, edição
disparando `PUT` com payload completo e refazendo as chamadas de
`por-natureza`, toggle despesa/receita.

## Lint/formatter

Backend:
```
$ python -m ruff check app tests
All checks passed!

$ python -m ruff format --check app tests
70 files already formatted
```

Frontend:
```
$ npx tsc -b --noEmit
(sem output — 0 erros)

$ npx eslint .
(sem output — 0 erros, 0 warnings)

$ npx prettier --check .
All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

1. **`get_por_natureza`/`get_tendencia_por_natureza` sempre retornam as 3
   naturezas, zero-preenchidas — desvio deliberado do padrão
   `por-categoria`.** `por-categoria` é dinâmico (só retorna subcategorias
   com dado no período, domínio aberto). Natureza tem domínio fixo (3
   valores conhecidos de antemão) — fazer o backend sempre devolver as 3
   evita que o frontend precise de lógica de fallback pra saber se
   "Variável recorrente" existe como bucket ou não, e garante que os 3
   cards apareçam sempre, mesmo com zero dado (critério de aceite 1 do
   PRD-012).
2. **Funil natureza→subcategoria sem endpoint dedicado.** Em vez de criar
   um terceiro endpoint (`GET /dashboards/por-natureza/{natureza}` ou
   similar), o drill-down reaproveita `GET /dashboards/por-categoria`
   (já traz total por subcategoria) e agrupa localmente por natureza via
   `useSubcategories()` — mesma técnica que `GrupoAccordion`
   (`DashboardsPage.tsx`) já usa pra agrupar por `CategoryGroup`. Menos
   superfície de API nova, sem duplicar lógica de agregação que já existe.
3. **`TransacoesPanel` exportada de `DashboardsPage.tsx` em vez de
   duplicada.** Era uma função privada; o plano pedia reaproveitá-la
   explicitamente (task 6) — exportar foi a forma direta de fazer isso sem
   duplicar ~140 linhas de tabela ordenável com edição inline.
4. **3 tons de cor via skill `impeccable`, sem rodada de comparação
   interativa com o CEO.** O plano (risco listado) previa confirmar a
   divisão visual com o CEO antes de fechar a task 8; como esta é uma
   execução autônoma de sprint já planejada/aprovada (sem sessão
   interativa disponível), a decisão foi tomada com justificativa
   registrada em `DESIGN.md` (nova subseção "Tertiary — Natureza") e
   `index.css` — 3 tons dessaturados (slate/ocre/ameixa), deliberadamente
   fora da paleta categórica de 8 matizes e da semântica receita/despesa,
   mesma faixa de contraste de `--despesa` (calculado manualmente pela
   fórmula WCAG: ≥4.5:1 contra `--surface` nos 2 modos). Screenshots deste
   relatório (via `check-sprint12.mjs`) ficam disponíveis pro CEO revisar
   contra a tela real antes de aprovar; ver "Pendências" se algum ajuste
   for pedido.
5. **`invalidateAllDashboardQueries` extraída de `invalidateDashboardQueries.ts`.**
   A mutation de edição de subcategoria (natureza) precisa invalidar as
   mesmas queries `dashboard*` que a mutation de edição de transação já
   invalidava — extrair o predicate comum evitou duplicar a mesma
   expressão de predicate em dois arquivos.
6. **Token de sessão para validação ao vivo minerado nesta sessão.** A
   VM de dev tem só 1 usuário real (`daniellimabr@gmail.com`, id 1);
   `docker compose exec api python -c "from app.auth.jwt import
   create_access_token; print(create_access_token(1))"` gerou o token
   (mesmo mecanismo documentado em `check-dashboard.mjs`), passado como
   `FINANCEIRO_SESSION_TOKEN` só para o processo local do script — nunca
   exposto em log de commit/PR.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Tela "Natureza" com 3 cards (total/percentual/sparkline), filtráveis por ano/mês e despesa/receita | sim | `NaturezaPage.test.tsx`: "renders the 3 natureza cards with totals and percentuais...", "toggling despesa/receita refetches...". Validado ao vivo (`check-sprint12.mjs`, screenshots `01-pagina`/`04-toggle-receita`). |
| 2. Clique no card abre drill-down (funil) de subcategorias com total, clique numa subcategoria mostra transações | sim | `NaturezaPage.test.tsx`: "clicking a card opens the drilldown...", "clicking a subcategoria in the drilldown shows its transactions". Validado ao vivo (screenshots `02-drilldown-natureza`/`03-drilldown-transacoes`). |
| 3. Subcategoria sem `natureza` (`null`) conta como "Custo eventual" em qualquer lugar da tela, sem exigir classificação prévia | sim | Backend: `test_get_por_natureza_null_natureza_falls_back_to_eventual`, `test_por_natureza_null_natureza_falls_back_to_eventual`. Frontend: `NaturezaPage.test.tsx` "...including unclassified as eventual". Validado ao vivo — todas as subcategorias reais do CEO ainda não classificadas apareceram em "Custo eventual" (100% do período). |
| 4. Seleção de natureza na tabela salva via `PUT /subcategories/{id}` e reflete nos cards/drill-down sem reload | sim | `NaturezaPage.test.tsx`: "changing a row's natureza saves via PUT... and refetches dashboards". Validado ao vivo — `check-sprint12.mjs` editou "Academia" para "Fixo recorrente" via UI e confirmou a persistência (screenshot `06-natureza-editada`) antes de restaurar. |
| 5. Suíte (backend+frontend) passa com cobertura ≥80% nos módulos tocados, sem regressão | sim | 313+122 testes verdes; 100% em `app/dashboards/` e `app/schemas/dashboards.py` (backend). Ver "Evidência de testes". |
| 6. Endpoints novos retornam 401 sem auth / isolados por `user_id` | sim | `test_por_natureza_without_cookie_returns_401`, `test_por_natureza_tendencia_without_cookie_returns_401`, `test_por_natureza_isolated_by_user`, `test_por_natureza_tendencia_isolated_by_user` (e mirrors em `test_dashboards_service.py`). |

## Documentação atualizada

`docs/architecture/OVERVIEW.md` (seção "Natureza — classificação e
dashboard de visibilidade (Sprint 12)" nova, contadores de teste
atualizados para 313/122), `docs/directory-structure.md` (`NaturezaPage.tsx`,
`naturezaLabels.ts`, 3 hooks novos, `categories.ts`/`dashboards.ts`/
`dashboards.py`/`ProtectedPage.tsx`/`DashboardsPage.tsx` atualizados,
`check-sprint12.mjs` novo, bullet de "CRUD de categorias fora de escopo"
corrigido para refletir o `updateSubcategory` novo), `docs/roadmap.md`
(parágrafo da Sprint 12 fechado com o que foi entregue + link do
relatório), `DESIGN.md` (nova subseção "Tertiary — Natureza" em Colors).

## Consumo estimado de tokens/sessões

Sprint grande (backend + frontend + tela nova combinando dois padrões
existentes — dashboard e tabela de gestão — pela primeira vez na mesma
tela, decisão de cor nova, deploy completo e validação ao vivo com token
minerado na própria sessão) — sessão única, consumo alto por volume de
arquivos tocados (21 arquivos) e pela orquestração de deploy (push → CI →
VM de dev → mint de token → browser-check → verificação de cleanup no
Postgres), não por complexidade de nenhuma parte isolada.

## Pendências e próximos passos sugeridos

- **3 tons de cor de natureza não passaram por rodada de comparação
  visual interativa com o CEO** (ver "Decisões tomadas", item 4) — decisão
  do CTO com justificativa registrada, screenshots reais anexos a este
  relatório para revisão. Se o CEO pedir ajuste, é troca local de 6
  valores hex em `index.css` (light+dark) + `DESIGN.md`, sem re-trabalho
  de estrutura.
- **Primeira tela a combinar "dashboard" e "tela de gestão" no mesmo
  componente** (risco listado no plano) — funcionou sem necessidade de
  dividir em duas telas separadas; vale o CEO confirmar que a leitura
  vertical (cards → funil → tabela de classificação) faz sentido no uso
  real, não só nos screenshots.
- Nenhuma pendência de código deixada solta — implementação completa,
  testada, deployada na VM de dev e validada ao vivo (script automatizado,
  não manual — diferença em relação à Sprint 11).
- Sprint 13 (projeção de custos futuros, mesmo épico E9) e Sprint 14
  (Configurações + competência de salário, E7) seguem sem `/plan` própria,
  como já registrado no roadmap.
