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
row Ativos/Passivos/Patrimônio, conferência do Saldo Acumulado sempre visível (sem clique), e
navegador de mês (◀ mês ▶). Dois componentes novos reutilizáveis (`KpiTile`, `ChartTooltip`) e um
utilitário (`computeSharedDomain`) ficam disponíveis pras próximas sprints do épico E10. Cobertura
de testes configurada (`@vitest/coverage-v8`) pela primeira vez no projeto. Implementado, testado,
commitado, CI verde confirmado, deployado na VM de dev, validado ao vivo com browser-check (3
achados de layout corrigidos no processo) e `DESIGN.md`/`docs/roadmap.md` atualizados.

Depois da entrega inicial, na mesma sessão, o CEO pediu 2 ajustes adicionais ao ver o resultado ao
vivo — ambos implementados, testados e deployados como parte desta mesma sprint (ver "Pedidos do
CEO pós-entrega inicial" abaixo): o comparativo Receita/Despesa deixou de ser pequenos múltiplos e
virou um único gráfico com as 3 séries (Receita/Despesa/Saldo Acumulado) sobrepostas na mesma
escala; e a tabela de transações dos drilldowns do Dashboard (`TransactionsTable.tsx`, compartilhada
com Ativos/Passivos) foi restilizada no modelo refinado que apareceu no mockup da tela de
Categorização (não migrada nesta sprint).

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

## Pedidos do CEO pós-entrega inicial (mesma sessão)

Depois de ver o Dashboard novo ao vivo, o CEO pediu 2 mudanças adicionais — tratadas como parte
desta mesma sprint (execução contínua, sem `/clear`), não como sprint separada:

1. **Gráfico combinado.** "Os gráficos Receita/Despesa devem ser sobrepostos... e neste plot,
   adicionar uma linha para o saldo acumulado." Isso reabre uma rejeição explícita do PRD-034
   original a "gráfico de eixo duplo" — mas as 3 séries são valores monetários na mesma unidade,
   então sobrepor não reintroduz o problema real que o PRD queria evitar (grandezas diferentes
   competindo por um eixo). Os 2 painéis de pequenos múltiplos (`ac-sm-grid`, CSS removido —
   ficaria morto) viraram um `ReceitaDespesaSaldoChart` único: 3 `<Line>` do Recharts com o mesmo
   domínio Y (`computeSharedDomain` sobre as 3 séries juntas), tooltip multi-valor
   (`ComparativoTooltipContent`, local — diferente de `ChartTooltip.tsx`, que continua servindo
   gráficos de série única) e legenda HTML.
2. **Tabela dos drilldowns.** "A tabela que é exibida dentro dos acordeões/drilldowns... me parece
   estar no modelo da versão anterior... o design da tabela da tela de Categorias desse esboço
   havia sido ajustado, e ficado num ótimo modelo." Restilizado `TransactionsTable.tsx` (usada nos
   drilldowns Despesa/Receita do Dashboard e também em Ativos/Passivos) pra `.ac-txn-table`: cabeçalho
   ordenável denso/uppercase, hover de linha, valor com seta de direção colorida
   (`--ac-good`/`--ac-bad`) + ícone de meio de pagamento existente (o número em si fica neutro
   `--ac-text-h`, mesmo padrão do mockup — só a seta carrega cor). As células editáveis
   (Descrição/Categoria/Ativo/Investimento, via `TransactionEditCells.tsx`) são compartilhadas com
   `CategorizationReviewPage` (sistema antigo, intocado) — o restyle é só via seletor descendente
   `.ac-txn-table ...`, nunca mudando a classe base desses componentes, e ficam "parecendo texto"
   em repouso, ganhando cromado de campo só no hover/foco. **Limitação técnica assumida:** o popup
   do combobox de categoria é renderizado via portal em `document.body`, fora da subárvore do DOM
   da tabela — um seletor CSS descendente não alcança lá, então o popup em si segue no visual
   antigo. E a exibição "grupo mudo / nome em destaque" de duas cores do mockup não foi replicada
   dentro do `<input>` da combobox (um `<input>` HTML só suporta uma cor de texto); se o CEO quiser
   essa fidelidade visual completa, precisa de um rework do componente pra um modo
   display-vs-edição (como `DescriptionCell` já faz), não coberto nesta sprint.

**Achado real durante o redeploy destes 2 pedidos:** o primeiro ciclo de deploy do segundo pedido
serviu a imagem Docker **errada** — o script de checagem de CI (`GET .../actions/runs?branch=main
&per_page=1`, sem filtrar por `head_sha`) confirmou "completed/success" olhando pro run do commit
*anterior* (que já tinha terminado), não pro run do commit que acabara de ser empurrado (que
ainda não tinha nem aparecido como "latest run" na API). `docker compose pull` então buscou a tag
`:latest` de antes do build novo terminar de publicar. Detectado ao vivo comparando o CSS servido
(`curl` no bundle `/static/index-*.css`, `grep -c "ac-txn-table"` retornando 0) contra o que estava
no commit; corrigido com `docker compose pull && docker compose up -d --force-recreate` depois de
confirmar via `GET .../actions/runs?per_page=5` que o `head_sha` exato do commit já tinha
`conclusion: success`. Nenhum dado de usuário em risco (só o frontend estava desatualizado por
~15 minutos, dev VM). Lição registrada em memória: sempre conferir `head_sha` no payload da API do
GitHub Actions antes de declarar o CI verde para um commit específico — checar só `status:
completed` do "último run" sem essa comparação pode capturar o run de um commit anterior.

## Achado adicional: categoria errada exibida nos drilldowns (dado, não visual)

Depois do restyle da tabela de transações, o CEO reportou que a Categoria exibida numa linha do
drilldown de Despesa ("Empréstimos / Empréstimos Concedidos") não batia com o grupo do accordion em
que ela estava aninhada (Moradia → Aluguel), mesmo a categoria real estando salva corretamente.
Investigado antes de qualquer mudança (regra "investigar antes de reinterpretar dado"):

- `CategorySelectCell` (`TransactionEditCells.tsx`) mostra `subcategoria_sugerida_id ??
  subcategory_id` — prioriza a sugestão pendente sobre a categoria real confirmada.
- O código atual (`list_transactions`, `backend/app/categorization/service.py`) só recalcula
  `subcategoria_sugerida_id` pras linhas **pendentes** da página — já correto, sem bug de código
  ativo. Confirmado com um teste novo
  (`test_list_transactions_never_recomputes_suggestion_for_confirmed_transaction`, passou de
  primeira contra o código sem alteração).
- O problema era **dado histórico sujo** na VM de dev: 876 transações já confirmadas do CEO (todas
  do `user_id=1` real) ainda carregavam um `subcategoria_sugerida_id` de antes deste guard existir
  — 27 delas com valor de fato divergente da categoria confirmada (as outras 849 coincidiam por
  acaso). Corrigido com um `UPDATE` direto no Postgres da VM de dev (não uma migration — correção
  de estado derivado/cache, não mudança de schema), limpando os 5 campos de sugestão
  (`subcategoria_sugerida_id`/`sugestao_confianca`/`sugestao_fonte_tipo`/`sugestao_fonte_id`/
  `sugestao_score`) nas transações confirmadas, mesmo padrão que `set_category`/`bulk_confirm` já
  aplicam ao confirmar. Verificado ao vivo: a transação do exemplo (id 24) agora mostra "Moradia /
  Aluguel", batendo com o accordion.

## Evidência de testes

Frontend:

```
Test Files  28 passed (28)
     Tests  252 passed (252)
```

Backend (só o arquivo de teste do achado de categoria acima — nenhum código de produção mudou):

```
75 passed (tests/test_categorization_service.py)
```

Cobertura (`npm run test:coverage`):

```
Statements   : 88.96% ( 1830/2057 )
Branches     : 81.22% ( 1289/1587 )
Functions    : 90.27% ( 808/895 )
Lines        : 91.91% ( 1660/1806 )
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
- **Gráfico combinado (Receita/Despesa/Saldo Acumulado) e restyle da tabela de drilldowns:** não
  estavam no PRD-034 original (que pedia pequenos múltiplos e não tocava no funil) — pedidos
  explícitos do CEO durante a execução, tratados como parte desta sprint. Ver "Pedidos do CEO
  pós-entrega inicial".

## Deploy

Commits `d87c858` (feature), `5d36a0c`/`9d7c9aa`/`8680c14` (fixes do browser-check), `48e81ca`
(gráfico combinado) e `b292c2a` (restyle da tabela de transações) — todos com CI verde confirmado
antes do deploy. O deploy de `b292c2a` serviu a imagem errada na primeira tentativa (ver "Pedidos
do CEO pós-entrega inicial" acima); corrigido com `--force-recreate` depois de reconfirmar o
`head_sha` exato no CI. Estado final: `api`/`frontend`/`postgres`/`caddy` todos `healthy`/`running`
no commit `b292c2a`, CSS servido confirmado (`grep -c "ac-txn-table"` no bundle > 0).

## Próximos passos (backlog do épico E10)

As 10 telas restantes (Categorização, Ativos, Investimentos, Passivos, Configurações, Natureza,
Orçamento, Categorias, Login) seguem no sistema visual antigo — cada uma vira uma sprint própria do
épico E10, a planejar individualmente via `/plan`.
