# SPRINT-036: Redesign visual "Analyst Console" — restante do Épico 10 — Relatório

- **Plano:** [SPRINT-036-redesign-analyst-console-restante-epico10-plan.md](./SPRINT-036-redesign-analyst-console-restante-epico10-plan.md)
- **PRDs:** [PRD-036a](../prd/PRD-036a-redesign-analyst-console-ativos-passivos-orcamento-login.md),
  [PRD-036b](../prd/PRD-036b-redesign-analyst-console-investimentos.md)
- **Data do relatório:** 2026-08-21
- **Aprovado pelo CEO em:** 2026-08-21 ("sprint aprovada") — deploy na VM de dev e validação ao vivo
  já feitos antes da aprovação formal, mesmo padrão das Sprints 34/35 (deploy como tarefa da própria
  sprint, autonomia de execução via `docs/infra/ssh-workflow.md`).

## Resumo

Fecha o épico E10 (Analyst Console). Duas frentes em paralelo:

- **PRD-036a** (reskin mecânico): Ativos, Passivos, Orçamento e Login migraram pro sistema `--ac-*`,
  mesmo padrão "KPI migra, funil fica" já usado 2x no épico, aplicado uma 3ª vez sem decisão de
  design nova. `AcItemCard` extraído (compartilhado Ativos/Passivos, mesmo raciocínio de
  `SubcategoryGroupTable`). Executado por um subagent em worktree isolado, revisado (diffs lidos
  arquivo a arquivo) e integrado a este working tree antes do commit.
- **PRD-036b** (revamp de conteúdo): Investimentos virou uma tela de "análise de progresso" —
  sessão de avaliação de layout via Artifact (3 propostas com dados fictícios, reaproveitando
  `KpiTile`/`TrendLineChart`/`.ac-panel` do Dashboard) resultou na escolha da CEO pela **Proposta C
  ("Split analítico")**: KPIs consolidados com delta/sparkline, gráfico de evolução do patrimônio +
  ranking "Desempenho no mês" lado a lado, grid de `KpiTile` por investimento como porta de entrada
  pro funil (Extrato/Posições/Série histórica, sistema antigo, intocado). Endpoint agregado novo
  (`GET /investimentos/evolucao-mensal`) — decisão de dados também da CEO, escolhida sobre
  composição client-side. `MonthNav` promovido a componente compartilhado (2º consumidor).

Implementado, testado (frontend 291 testes / backend 683 testes, 100% verdes), commitado, CI verde
confirmado por `head_sha` exato a cada commit, deployado na VM de dev, e validado ao vivo com
`scripts/browser-check/check-sprint36a.mjs` e `check-sprint36b.mjs` — 1 achado real de layout
corrigido no processo (ver "Achados do browser-check" abaixo).

## Sequenciamento real da execução

1. Sessão de avaliação de layout de Investimentos (Artifact, 3 propostas) — CEO escolheu Proposta C
   + endpoint agregado, via `AskUserQuestion`.
2. PRD-036a disparado em paralelo (subagent, worktree isolado) enquanto o PRD-036b era detalhado e
   implementado na sessão principal.
3. PRD-036a revisado (diffs lidos, não só o resumo do subagent) e integrado ao working tree
   (`git apply` + resolução manual do único conflito, em `index.css`).
4. Suíte completa (frontend + backend) rodada com as duas frentes já integradas.
5. `DESIGN.md`/`docs/roadmap.md` atualizados fechando o épico E10.
6. Commit único, push, CI verde, deploy na VM de dev, browser-check em 2 scripts (036a/036b).
7. 1 achado real corrigido (overflow horizontal mobile) → novo commit → CI verde → redeploy →
   browser-check reconfirmado.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Sessão de avaliação de layout de Investimentos (Artifact, 2-3 propostas) | feito | 3 propostas (A "Espelho do Dashboard", B "Ranking & composição", C "Split analítico") + seção de decisão de dados no mesmo Artifact; CEO escolheu C + endpoint agregado numa única rodada de `AskUserQuestion` |
| 2 | Detalhar PRD-036b com critérios de aceite da proposta escolhida | feito | Seção "Fase 2" adicionada ao PRD-036b com os 8 critérios concretos |
| 3 | `AcItemCard.tsx` + teste | feito (via subagent) | 8 testes, 100% cobertura nas 4 métricas |
| 4 | Restilizar `LoginPage.tsx` (só CSS) | feito (via subagent) | Sem mudança de JSX, conforme especificado |
| 5 | Restilizar `OrcamentoPage.tsx` | feito (via subagent) | `.simple-list` manteve o componente/classe compartilhado com `AccountManagementPage`, ganhou retonização escopada (`.ac-page .simple-list`) — mesma decisão que a Sprint 35 tomou pro Drawer, registrada como decisão de execução no PRD |
| 6 | Restilizar `AssetsPage.tsx` usando `AcItemCard` | feito (via subagent) | Funil/`Row` intocados; "Ver gasto no período" manteve `.ac-btn` sem `-ghost` pra preservar a hierarquia visual original (só ele era "default", os outros 3 são ghost) |
| 7 | Restilizar `LiabilitiesPage.tsx` usando `AcItemCard` | feito (via subagent) | Sparkline `var(--ac-bad)` no card migrado, funil mantém `var(--despesa)` — cores intencionalmente divergentes entre os 2 sistemas, conforme PRD |
| 8 | Atualizar testes de seletor (`AssetsPage`/`LiabilitiesPage`/`OrcamentoPage`) | feito (via subagent) | `OrcamentoPage.test.tsx` não precisou de mudança (asserts já eram por role/label/texto); `ProtectedPage.test.tsx` também precisou de ajuste (não previsto) — ver desvios |
| 9 | Lint/format/tsc/test/coverage — PRD-036a | feito | Ver "Evidência de testes" |
| 10 | Atualizar `DESIGN.md` — PRD-036a | feito (via subagent, revisado/estendido) | Registra `AcItemCard`; seção "What stays" reescrita depois pra refletir o fechamento completo do épico (ambos PRDs) |
| 11 | Browser-check PRD-036a (4 telas + Login standalone) | feito | `check-sprint36a.mjs`, 0 erro de console nas 8 combinações |
| 12 | Endpoint agregado `GET /investimentos/evolucao-mensal` | feito | `_aggregate_snapshots_por_mes` extraída como função pura, compartilhada com o endpoint por-investimento existente; 8 testes pytest novos (agregação multi-investimento, mês misto, isolamento por usuário, sem investimentos, sem holdings, holding não-vinculado ignorado) + 4 testes de endpoint |
| 13 | Promover `MonthNav` | feito | Junto com `mesAnterior`/`mesSeguinte`/`isMesAtual` (`frontend/src/utils/monthNav.ts`) — `DashboardsPage.tsx` passou a importar do mesmo lugar |
| 14 | `InvestimentosPage.tsx` consolidada (Proposta C) | feito | Ver "Resumo"; Editar/Excluir (sem espaço no tile de entrada) moveram pro cabeçalho do funil — desvio de UI não previsto no PRD original, necessário pela mudança de forma do card |
| 15 | Extrair lógica de agregação como função pura testável | feito | `frontend/src/utils/investimentosConsolidado.ts` (`evolucaoMensalParaPontos`, `encontrarMesEAnterior`, `temMesReconstruido`), 11 testes unitários |
| 16 | Atualizar `InvestimentosPage.test.tsx` + testes de hooks novos | feito | 13 testes (era 8) — reescritos pro novo tile-como-botão (sem "Ver posições" separado) + 2 testes novos do KPI/ranking consolidado |
| 17 | Suíte completa (frontend + backend) — PRD-036b | feito | Ver "Evidência de testes" |
| 18 | Atualizar `DESIGN.md`/`docs/roadmap.md` (E10 fecha) | feito | Épico marcado ✅ na tabela de épicos; contador de auditoria estrutural atualizado (7/5 sprints) |
| 19 | Browser-check PRD-036b (Investimentos, claro/escuro/desktop/mobile) | feito, com 1 achado corrigido | Ver "Achados do browser-check" |
| 20 | Relatório pós-sprint | feito | Este documento |

## Achados do browser-check (1 problema real, não capturado pelos testes de jsdom)

1. **`.ac-two-col` (painel de Investimentos consolidada) estourava horizontalmente em mobile
   (390px).** Item de grid CSS sem `min-width: 0` explícito não encolhe abaixo do min-content do
   conteúdo — a tabela de ranking (nomes de investimento sem quebra de linha, ex. "Caixinha Nubank
   Turbo Ultravioleta (120% CDI)") forçava o painel inteiro a manter sua largura intrínseca mesmo
   com `grid-template-columns: 1fr` já aplicado corretamente pela media query de 960px. Mesma classe
   de bug que `.ac-kpi` já documentava e evitava desde a Sprint 34 (comentário no CSS: "sem
   min-width:0 o item nunca encolhe...") — `.ac-two-col > .ac-panel` não tinha essa regra. Corrigido
   com `min-width: 0` explícito. Commit `f180808`. Confirmado corrigido em nova captura mobile — o
   painel de ranking agora respeita o viewport, com sua própria tabela rolando internamente via
   `.ac-table-wrap { overflow-x: auto }` (padrão já estabelecido, não um bug).

   Durante a investigação desse achado, uma captura intermediária mostrou o tile "XP - TAEE" vazio
   (sem valor/legenda/sparkline) — investigado antes de reportar como bug (regra "investigar antes
   de reinterpretar"): não se repetiu na recaptura pós-fix nem em nenhuma das 4 combinações
   claro/escuro/desktop/mobile subsequentes, consistente com um straggler de rede (8 investimentos
   disparam 8 queries `useInvestimentoEvolucao` em paralelo; uma pode legitimamente responder
   depois do timeout do script) e não com um bug de código — descartado.

Nenhum erro de console em nenhuma das 12 combinações capturadas (4 telas PRD-036a × claro/escuro ×
desktop/mobile + Investimentos consolidada/funil PRD-036b × claro/escuro × desktop/mobile), além dos
401 esperados no fluxo de Login sem sessão (a própria checagem de sessão do app, não um erro).
Screenshots em `scripts/browser-check/shots/sprint36{a,b}-*.png` (gitignored, dado financeiro real).

## Evidência de testes

Frontend:

```
Test Files  32 passed (32)
     Tests  291 passed (291)
```

Cobertura (`npm run test:coverage`):

```
Statements   : 89.37% ( 1892/2117 )
Branches     : 81.68% ( 1325/1622 )
Functions    : 90.58% ( 837/924 )
Lines        : 92.14% ( 1713/1859 )
```

`AcItemCard.tsx`, `MonthNav.tsx`, `frontend/src/utils/monthNav.ts` e
`frontend/src/utils/investimentosConsolidado.ts` (toda a lógica de negócio inteiramente nova desta
sprint) fecham em 100% nas 4 métricas — não aparecem na tabela por arquivo do reporter porque só
lista arquivos abaixo de 100%. `npx tsc -b` limpo. `npx eslint .`: 0 erros, 6 warnings pré-existentes
(3 de `coverage/` gerado, 3 de `react-refresh/only-export-components` em arquivos que já tinham esse
padrão antes desta sprint — nenhum novo). `npx prettier --check` limpo em todos os arquivos tocados.

Backend:

```
683 passed, 99% coverage
```

`app/investimentos/router.py` e `app/investimentos/service.py` em 100% de cobertura. `ruff check .`
e `ruff format --check .` limpos (1 arquivo de teste reformatado automaticamente por `ruff format`
antes do commit, sem mudança de comportamento).

## Critérios de aceite dos PRDs — verificação item a item

### PRD-036a

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `AcItemCard` isolado e testado, reaproveitado por Ativos/Passivos | sim | `AcItemCard.test.tsx`, 8 testes, 100% cobertura |
| 2. Ativos/Passivos/Orçamento em `.ac-*` na camada de topo, funis sem regressão | sim | `AssetsPage.test.tsx`/`LiabilitiesPage.test.tsx`/`OrcamentoPage.test.tsx` reescritos com novos seletores, mesma cobertura funcional |
| 3. Login com tokens `--ac-*`/Inter, comportamento idêntico | sim | Só CSS alterado, JSX intocado |
| 4. Nenhuma mudança de valor/cálculo | sim | Nenhum hook/query alterado nas 4 telas |
| 5. Suíte 100% verde, lint/tsc sem erros, cobertura ≥80% | sim | Ver "Evidência de testes" |
| 6. `DESIGN.md` atualizado (`AcItemCard` + lista de telas restantes) | sim | Seção "Analyst Console" |
| 7. Browser-check claro/escuro/desktop/mobile, Login standalone | sim | `check-sprint36a.mjs`, 0 erro de console |

### PRD-036b

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Identidade visual 100% `--ac-*`/Inter na camada consolidada nova | sim | `InvestimentosPage.tsx`, browser-check |
| 2. Extrato/Posições sem regressão, funil no sistema antigo | sim | `InvestimentosPage.test.tsx` (9 testes de funil reescritos, mesmo comportamento) |
| 3. Nenhuma mudança de valor/cálculo em dado já exibido | sim | `useInvestimentoEvolucao`/`useInvestimentoGastos*`/`useInvestimentoTransacoes` intocados |
| 4. Endpoint agregado isolado por usuário, testado (multi-investimento, sem investimentos/holdings) | sim | 8 testes pytest em `test_investimento_service.py`, 4 em `test_investimento_endpoints.py` |
| 5. Lógica de agregação extraída como função pura testável | sim | `_aggregate_snapshots_por_mes` (backend), `evolucaoMensalParaPontos`/`encontrarMesEAnterior`/`temMesReconstruido` (frontend) |
| 6. Suíte 100% verde, lint/tsc sem erros, cobertura ≥80% | sim | Ver "Evidência de testes" |
| 7. `DESIGN.md`/`docs/roadmap.md` atualizados, E10 fecha | sim | Épico ✅ na tabela de épicos |
| 8. Browser-check claro/escuro/desktop/mobile, atenção a overflow/`position:fixed` | sim, após 1 correção | Ver "Achados do browser-check" |

## Desvios de escopo registrados

- **Editar/Excluir por investimento moveram do card pro cabeçalho do funil** (ao lado de "Fechar") —
  não previsto no PRD-036b original. O tile de entrada virou um único alvo de clique (reaproveitando
  `KpiTile` como o PRD exige, "zero componentes novos"), sem espaço pra um grupo de botões como o
  card antigo tinha. Julgado a solução de menor risco (reaproveita `.dash-filter`/`.btn-ghost`, sem
  CSS novo) frente a inventar um layout de botões dentro do `KpiTile`.
- **`ProtectedPage.test.tsx` precisou de ajuste não previsto** (via subagent, PRD-036a) — remoção do
  `<h2>` de título em `LiabilitiesPage`/`OrcamentoPage` (seguindo o precedente já estabelecido por
  `NaturezaPage`/`CategorizationReviewPage` na Sprint 35: a aba do sidebar já rotula a tela) quebrou
  2 asserts que buscavam esse heading; corrigidos para buscar um elemento distintivo da tela.
- **`.ac-kpi-grid`/`.ac-two-col`** — 2 classes CSS de layout não listadas explicitamente no plano,
  necessárias porque as grids fixas de `.ac-kpi-row` (5 ou 3 colunas) não servem pra um número
  variável de investimentos, e não havia precedente de layout de 2 colunas no sistema `--ac-*` até
  esta sprint.
- **Limitação do endpoint agregado comunicada explicitamente na UI** (não um desvio de escopo, mas
  registrado por ser uma decisão de design tomada durante a execução, não no PRD): como o endpoint
  por-investimento já existente, `GET /investimentos/evolucao-mensal` só soma holdings com snapshot
  Pluggy — investimentos só-carteira-bancária ficam de fora do histórico mensal. O painel "Evolução
  do patrimônio" diz isso na legenda em vez de deixar a lacuna implícita.
- Nenhuma migration em nenhum dos 2 PRDs — confirma o que ambos já previam em "Dados e modelo".

## Deploy

Commits `b1504a6` (feature, os 2 PRDs integrados) e `f180808` (fix: overflow mobile do
`.ac-two-col`) — ambos com CI verde confirmado (`head_sha` exato) antes de cada deploy. Estado
final: `api`/`frontend`/`postgres`/`caddy` todos `healthy`/`running` no commit `f180808` na VM de
dev. Nenhuma migration — `alembic upgrade head` no entrypoint do `api` foi no-op nos 2 deploys.

## Próximos passos

Épico E10 (Analyst Console) fechado — nenhuma tela resta no sistema visual original fora dos
fragmentos de funil/drill-down já documentados em `DESIGN.md`. Itens de backlog não fechados por
esta sprint (indicador de conciliação na sidebar, sparkline/delta de Ativos/Passivos/Patrimônio)
seguem em `docs/roadmap.md` § Backlog futuro, agora sem vínculo a um épico específico — candidatos a
sprint própria se a CEO priorizar.
