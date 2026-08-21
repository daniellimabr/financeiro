# SPRINT-034: Redesign visual "Analyst Console" — fundação + Dashboard — Relatório

- **Plano:** [SPRINT-034-redesign-analyst-console-fundacao-dashboard-plan.md](./SPRINT-034-redesign-analyst-console-fundacao-dashboard-plan.md)
- **Data do relatório:** 2026-08-21
- **Aprovado pelo CEO em:** deploy autorizado antecipadamente na mesma sessão ("go ahead and deploy
  as well when its time", "go full auto on this sprint, require less aprovals from me") — segue o
  mesmo padrão das Sprints 31/32, plano com deploy como tarefa da própria sprint.

## Resumo

Levou a direção visual "Analyst Console" (Proposta 3, escolhida pelo CEO entre 3 propostas
comparadas em Artifacts) do mockup ao sistema real: novo namespace de tokens `--ac-*` coexistindo
com o sistema atual (nenhum token antigo alterado), tipografia Inter self-hosted, shell/sidebar
novo em todas as abas, e o Dashboard migrado por completo — 5 KPIs de fluxo com delta+sparkline,
row Ativos/Passivos/Patrimônio, conferência do Saldo Acumulado sempre visível (sem clique),
comparativo Receita/Despesa em pequenos múltiplos com escala compartilhada e tooltip funcional, e
navegador de mês (◀ mês ▶). Dois componentes novos reutilizáveis (`KpiTile`, `ChartTooltip`) e um
utilitário (`computeSharedDomain`) ficam disponíveis pras próximas sprints do épico E10. Cobertura
de testes configurada (`@vitest/coverage-v8`) pela primeira vez no projeto. Implementado, testado,
commitado, CI verde confirmado, deployado na VM de dev, validado ao vivo com browser-check (3
achados de layout corrigidos no processo) e `DESIGN.md`/`docs/roadmap.md` atualizados.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `@vitest/coverage-v8`, script `test:coverage`, threshold 80% | feito | Threshold aplicado por glob nos arquivos de lógica de negócio desta sprint (`KpiTile.tsx`, `ChartTooltip.tsx`, `sharedChartDomain.ts`) — piso global fica pra sprint futura dedicada, ver comentário em `vite.config.ts` |
| 2 | Inter self-hosted, pesos 400–800 | feito | Mesma técnica do Archivo/Public Sans (fonte variável única, copiada sob 5 nomes de peso) |
| 3 | Tokens Analyst Console em `index.css` | feito | Namespace `--ac-*` inteiramente separado do sistema antigo (não scoped CSS) — decisão registrada em `DESIGN.md`, ver seção "Por quê" |
| 4 | `KpiTile.tsx` + testes | feito | Uma densidade `compact` a mais que o mockup previa explicitamente (Ativos/Passivos/Patrimônio) |
| 5 | Helper de tooltip/crosshair + testes | feito | `ChartTooltip.tsx` — construído sobre o `<Tooltip>` do Recharts (já a única lib de gráfico do app), não SVG manual como o mockup estático fazia |
| 6 | Restilizar `ProtectedPage.tsx` | feito | 4 ícones de nav novos (Natureza/Orçamento/Categorias/Configurações) no mesmo traço dos 5 do mockup, que só cobria 6 telas |
| 7 | Investigar viabilidade do delta sem endpoint novo | feito, com desvio reportado | Os 5 KPIs de fluxo usam dado já buscado (sem endpoint novo); Ativos/Passivos/Patrimônio precisariam de um endpoint de série histórica que não existe — decisão do CEO via `AskUserQuestion`: não expandir o backend agora, os 3 tiles ficam sem delta/sparkline (`compact`) |
| 8 | Migrar `DashboardsPage.tsx` | feito | Funil de drill-down (accordion categoria→transação) permanece no sistema antigo, fora do escopo — só o topo da página migrou |
| 9 | Atualizar `DashboardsPage.test.tsx` teste a teste | feito | ~20 testes ajustados (seletores/navegador de mês/escopo de query); nenhum teste de regra de negócio removido, só readaptado à nova estrutura |
| 10 | Lint/format/tsc/test/coverage | feito | Ver "Evidência de testes" abaixo |
| 11 | Reescrever `DESIGN.md` | feito | Nova seção "Analyst Console (Sprint 34, épico E10)" documentando o sistema novo lado a lado com o antigo, não uma substituição |
| 12 | Browser-check claro/escuro/desktop/mobile | feito, com 3 achados corrigidos | Ver "Achados do browser-check" abaixo |
| 13 | `docs/roadmap.md`: épico E10 + decisão de adiar auditoria | feito | Já registrado na sessão de planejamento; complementado nesta sessão com o desvio do item 7 e o fechamento datado de Sprint 34 |
| 14 | Relatório pós-sprint | feito | Este documento |

## Achados do browser-check (3 bugs reais, não capturados pelos testes de jsdom)

O browser-check (Playwright contra a VM de dev real, sessão autenticada) achou 3 problemas de
layout que a suíte de testes (jsdom, sem `ResizeObserver`/layout real) não detecta por natureza —
mesma classe de achado que motivou o browser-check ser obrigatório neste tipo de sprint:

1. **Sparklines dos 5 KPIs de fluxo não apareciam.** `.ac-kpi-foot .spark` (o `<span>` que envolve
   o `ResponsiveContainer` do Recharts) não tinha largura/altura explícitas — um `<span>` é
   `display: inline` por padrão, então o Recharts media a largura do pai como `0px` via
   `ResizeObserver` e não desenhava nada. Corrigido com `width: 70px; height: 22px` (mesma técnica
   do mockup aprovado). Commit `5d36a0c`.
2. **KPIs vazavam pra fora do viewport no mobile.** `.ac-kpi` como item de grid sem
   `min-width: 0` nunca encolhe abaixo do min-content do próprio conteúdo (label+delta+valor de
   22px) — o grid `1fr` cresce a coluna pra caber, e a linha inteira de KPIs vazava pra fora da
   tela em 390px em vez de quebrar em 2 colunas. Commit `9d7c9aa`.
3. **Cabeçalho do card "Saldo Acumulado" (label+delta+selo, o mais cheio dos 5) colava a segunda
   linha do label no delta/selo em mobile.** `flex-wrap: wrap` no `.ac-kpi-head` resolve — o
   delta/selo cai pra baixo do label quando ele quebra em 2 linhas, em vez de sobrepor visualmente.
   Commit `8680c14`.

Cada achado foi corrigido, reimplantado (novo commit → CI verde → `docker compose pull/up -d`) e
reconfirmado com um novo browser-check antes de seguir — 3 ciclos completos de fix→deploy→validar
nesta sessão, além do deploy inicial. Screenshots finais (claro/escuro × desktop/mobile) em
`scripts/browser-check/shots/sprint34-*.png`, mais um screenshot do tooltip/crosshair em hover
funcionando (`sprint34-tooltip-hover.png`) e um de regressão confirmando que a Categorização (tela
não tocada, sistema antigo) renderiza sem nenhum vazamento do sistema novo
(`sprint34-regressao-categorizar.png`).

## Evidência de testes

Frontend (único stack tocado nesta sprint — nenhuma mudança de backend):

```
Test Files  28 passed (28)
     Tests  251 passed (251)
```

Cobertura (`npm run test:coverage`):

```
Statements   : 89.09% ( 1822/2045 )
Branches     : 81.76% ( 1282/1568 )
Functions    : 90.44% ( 805/890 )
Lines        : 92.04% ( 1655/1798 )
```

Thresholds por arquivo (100% nos 3 arquivos de lógica de negócio novos desta sprint — `KpiTile.tsx`,
`ChartTooltip.tsx`, `sharedChartDomain.ts`) passam sem erro. `npx tsc -b` limpo. `npx eslint .`: 0
erros, 3 warnings pré-existentes de `react-refresh/only-export-components` (arquivos que exportam
componente + função auxiliar — mesmo padrão já tolerado em outros arquivos do projeto).
`npx prettier --check .` limpo.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `index.css` usa a paleta/tipografia Analyst Console; Inter self-hosted, sem CDN | sim | Tokens `--ac-*`; `@font-face` locais em `frontend/public/fonts/inter-*.woff2` |
| 2. `ProtectedPage` renderiza no novo sistema, navegação idêntica | sim | `ProtectedPage.test.tsx` 100% cobertura, todas as 9 abas navegam; screenshot de regressão confirma Categorização (tela antiga) intacta |
| 3. Dashboard: 5 KPIs com delta+sparkline; tabela de conferência sempre visível; comparativo com escala compartilhada + tooltip; navegador de mês respeita o limite do mês corrente | sim | `sprint34-desktop-claro.png`; `computeSharedDomain` testado; `resolveKpiDeltaPercent` testado; `isMesAtual`/botão "Próximo mês" `disabled` confirmado ao vivo |
| 4. Nenhuma mudança de valor/cálculo | sim | Nenhum hook/query de dado alterado — só JSX/CSS; `SaldoAcumuladoConferenciaTable` reaproveita a mesma query (`useSaldoAcumuladoConferencia`) sem tocar na lógica |
| 5. `KpiTile`/tooltip helper existem isolados, testados, reaproveitados | sim | `KpiTile` usado 8x na página (5 primário + 3 compact), `ChartTooltip` usado 2x (Receita/Despesa) |
| 6. `test:coverage` roda e reporta; lógica nova ≥80% | sim | Ver "Evidência de testes" |
| 7. Suíte 100% verde, lint sem erros, `tsc` sem erros | sim | Ver "Evidência de testes" |
| 8. `DESIGN.md` reflete o sistema de fato implementado | sim | Nova seção "Analyst Console (Sprint 34, épico E10)" |
| 9. Browser-check claro/escuro/desktop/mobile sem overflow/quebra | sim, após 3 correções | Ver "Achados do browser-check" |
| 10. `docs/roadmap.md` com épico E10 e decisão de adiar auditoria, datado | sim | Linha do épico E10 + seção "Auditoria estrutural (cadência)", ambas datadas 2026-08-21 |

## Desvios de escopo registrados

- **Sparkline/delta de Ativos/Passivos/Patrimônio:** não implementado — endpoint de série histórica
  não existe hoje. Decisão do CEO (via `AskUserQuestion` no início da execução): não expandir o
  backend nesta sprint. Registrado em `docs/roadmap.md` § Decisões e descartes.
- **Indicador de conciliação na sidebar** (mockup): já estava fora de escopo desde o PRD, confirmado
  não implementado.

## Deploy

Commits `d87c858` (feature), `5d36a0c`/`9d7c9aa`/`8680c14` (fixes do browser-check) — todos com CI
verde confirmado (`GET /repos/daniellimabr/financeiro/actions/runs`, `conclusion: success` pro
`head_sha` exato) antes de cada `docker compose pull && docker compose up -d` na VM de dev. Estado
final: `api`/`frontend`/`postgres`/`caddy` todos `healthy`/`running` no commit `8680c14`.

## Próximos passos (backlog do épico E10)

As 10 telas restantes (Categorização, Ativos, Investimentos, Passivos, Configurações, Natureza,
Orçamento, Categorias, Login) seguem no sistema visual antigo — cada uma vira uma sprint própria do
épico E10, a planejar individualmente via `/plan`.
