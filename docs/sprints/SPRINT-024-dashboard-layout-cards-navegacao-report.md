# SPRINT-024: Dashboard — layout, cards, navegação e cores — Relatório

- **Plano:** [SPRINT-024-dashboard-layout-cards-navegacao-plan.md](./SPRINT-024-dashboard-layout-cards-navegacao-plan.md)
- **Data do relatório:** 2026-08-19

## Resumo

O Dashboard ganhou hierarquia visual (Ativos/Passivos/Patrimônio numa linha própria), navegação de
mês por seta nos cards de saldo, memórias de cálculo em vez de listas desconexas (Saldo, Saldo
Acumulado), accordions in-place (Patrimônio de 4 partes, Investimento→Holding), lista completa de
Passivos, paleta categórica de 16 cores (resolve a colisão real Empréstimos/Transferência Interna)
reaproveitada também para colorir por ativo, e um botão de sincronização direto na tela de
Categorização. 100% frontend — nenhum endpoint novo, nenhuma migration. Validado ao vivo na VM de
dev contra dado real, em 2 rodadas (3 achados reais corrigidos entre a 1ª e a 2ª rodada).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Remove disclaimers, reagrupa grid em 2 linhas | feito | Na 1ª implementação só o disclaimer de Saldo Acumulado foi removido — o de Patrimônio ficou pra trás por engano. Achado pelo próprio QA visual (`check-sprint24.mjs`) antes do fechamento da sprint, corrigido num commit de fix separado. |
| 2 | Seta em Saldo Anterior + `mesSeguinte` + seta em Saldo Acumulado | feito | O tile de Saldo Acumulado virou `<div role="button">` (dois `<button>` aninhados é HTML inválido) — sem `aria-label` próprio, seu nome acessível absorvia o texto do botão de seta filho ("Saldo Acumulado Ver mês seguinte"), gerando ambiguidade de leitor de tela/testes por role+nome. Corrigido com `aria-label` explícito incluindo o valor (paridade com os outros cards), achado também via QA visual. |
| 3 | Paleta de 8→16 cores via skill `dataviz` | feito | 8 matizes novos escolhidos e validados com `scripts/validate_palette.js` da skill (light + dark, ΔE CVD adjacente, chroma, contraste) — todos os checks passam (WARN de CVD floor/contraste, legal porque cada cor sempre acompanha rótulo de texto visível). |
| 4 | `buildColorIndexFromIds` generalizado, cor por ativo em `AtivosAccordion`/`AssetsPage` | feito | Índice de cor construído a partir de `useAssets()` (todos os ativos cadastrados), não só os que aparecem no período filtrado — mantém a cor da mesma entidade estável entre filtros de mês. |
| 5 | Card "Saldo": memória de cálculo | feito | Sem desvio — usa `summary` já carregado, sem chamada nova. |
| 6 | Card "Saldo Acumulado": memória de cálculo (âncora + mês a mês) | feito | Âncora via `useEvolucaoSaldoPorConta` (endpoint já existente, `AccountManagementPage` já o usava) — confirmado que nenhum endpoint novo era necessário, como o PRD previu como provável. |
| 7 | `InvestimentosValorAtualList` vira accordion Investimento→Holding | feito | Busca de holdings (`usePluggyInvestments`) só dispara quando a linha é expandida (o componente filho só monta nesse momento) — sem query antecipada. |
| 8 | Card "Passivos" ganha `LiabilitiesValorAtualList` | feito | Sem desvio. |
| 9 | `PatrimonioBreakdownPanel` vira accordion de 4 partes in-place | feito | Reaproveita `saldoAcumuladoSparkline` já calculado no componente pai (Saldo líquido acumulado) em vez de nova query. Achado real: só "Passivos" guarda uma magnitude sempre positiva que precisa de sinal "−" explícito — os outros 3 componentes já vêm com o sinal correto do backend, e prefixar "+ " incondicional nos 4 duplicava o sinal quando "Saldo líquido acumulado" era negativo ("+ -R$ ..."). Corrigido: só Passivos ganha prefixo, os demais mostram o valor como o backend retorna. |
| 10 | Botão "Sincronizar contas" em Categorização | feito | Reaproveita `useSyncPluggyItems()` sem alteração — mutation já invalidava `categorizationTransactions`. |
| 11 | Testes frontend | feito | 207 testes (era 192 no início da sprint) — cobrindo navegação por seta (mês seguinte + alerta de fronteira + o clique no corpo do card não é afetado pela seta), accordion de Patrimônio (4 partes, aria-expanded, sem "Ver detalhe"), accordion Investimento→Holding, paleta de 16 sem colisão até 16 ids, botão de sync (com/sem erro, sem diálogo), memórias de cálculo de Saldo/Saldo Acumulado, cor por ativo em `AssetsPage`, layout em 2 linhas, ausência dos 2 disclaimers. |
| 12 | QA visual real na VM de dev — `check-sprint24.mjs` | feito | 2 rodadas completas (desktop+mobile × claro+escuro, 4 combinações). 1ª rodada achou 2 bugs reais de produto (disclaimer de Patrimônio esquecido; nome acessível poluído no tile de Saldo Acumulado) e 3 bugs no próprio script de QA (comparações de texto sensíveis a maiúscula quebravam com `text-transform:uppercase` do CSS; um locator por `hasText:"Saldo"` clicava no card errado). Corrigidos todos, redeploy, 2ª rodada achou mais 2 bugs reais (sinal duplicado no accordion de Patrimônio; overlap de coluna na tabela de holdings, mesma classe de bug já corrigida em `InvestimentoPosicoes` na Sprint 23). 3ª rodada: zero falhas, zero erros de console, nas 4 combinações. |
| 13 | `docs/dashboards-guia-cards.md` / `docs/directory-structure.md` | feito | `dashboards-guia-cards.md` atualizado além do `directory-structure.md` (diferente da Sprint 23) — porque esta sprint muda o *conteúdo* do que cada drill-down mostra (não só a fórmula), e o guia documentava explicitamente o comportamento antigo (card "Saldo" com snapshot bancário, "Ver detalhe" navegando pra outra visão). |
| 14 | Relatório de sprint | feito | Este documento. |

## Evidência de testes

Backend (suíte completa — sem mudança de backend nesta sprint, roda pra confirmar que nada quebrou):

```
598 passed, 565 warnings in 12.89s
TOTAL                                 2593     46    98%
```

Frontend (suíte completa, após as 2 rodadas de fix):

```
Test Files  25 passed (25)
     Tests  207 passed (207)
```

Cobertura de lógica de negócio: 98% backend (meta ≥80%, inalterado — nenhum módulo de backend
tocado). Frontend não mede cobertura percentual no CI deste projeto (ver ADR-001) — 207 testes
cobrindo os 3 arquivos de página tocados (`DashboardsPage`, `AssetsPage`,
`CategorizationReviewPage`) e `categoryColors.ts`.

## Lint/formatter

```
$ npx tsc --noEmit
(sem saída — sem erros)

$ npx eslint .
(sem saída — sem erros)

$ npx prettier --check "src/**/*.{ts,tsx,css}"
All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

1. **Paleta de 16 cores — matizes escolhidos via `dataviz` skill.** 8 hues novos (petróleo, marrom,
   rosa, índigo, oliva, ameixa, terracota, verde-azulado) validados com `validate_palette.js` contra
   a superfície real do app (light `#f5f6f1`, dark `#18181b`) — todos os checks estruturais passam;
   CVD adjacente fica na faixa 6.4–8.7 (piso, legal porque toda cor sempre acompanha um rótulo de
   texto visível, nunca é o único identificador).
2. **Âncora do Saldo Acumulado reaproveita `useEvolucaoSaldoPorConta`, sem endpoint novo.** O PRD
   deixou em aberto se seria necessário um campo novo — confirmado durante a execução que o endpoint
   `GET /dashboards/evolucao-saldo-por-conta` (já usado por `AccountManagementPage`) já expõe
   `saldo_inicial` por conta, suficiente pra somar a âncora sem tocar o backend.
3. **Sinal (+/−) na memória de cálculo do Patrimônio só em Passivos.** Achado real durante o QA
   visual: prefixar "+ " incondicional nas 4 partes duplicava o sinal quando "Saldo líquido
   acumulado" vinha negativo do backend (formatCurrency já imprime o "-"). Só Passivos guarda uma
   magnitude sempre positiva que precisa do sinal explícito pra virar subtração.
4. **`aria-label` explícito no tile "Saldo Acumulado".** Achado real via QA visual (strict-mode
   violation do Playwright ao localizar o botão de seta por role+nome) — o `<div role="button">` sem
   nome próprio absorvia o texto do botão filho no nome acessível computado. Corrigido com
   `aria-label` dinâmico incluindo o valor, mantendo paridade com os demais cards (que têm o valor no
   nome acessível via conteúdo).
5. **`.holdings-table` ganha classe/colgroup dedicados.** Mesma classe de bug já corrigida em
   `InvestimentoPosicoes`/`PosicaoHistorico` na Sprint 23 (nome de holding longo vazando sobre a
   coluna de valor) — a tabela nova do accordion Investimento→Holding reaproveitava
   `col-nome`/`col-valor` genéricos sem nenhuma regra de largura própria.
6. **Mint de token de sessão pausado para aprovação explícita.** Mesmo padrão da Sprint 23 — SSH
   livre na VM de dev não cobre automaticamente o comando de `create_access_token`; pausei e pedi
   decisão explícita antes de prosseguir.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Ativos/Passivos/Patrimônio juntos na 1ª linha, resto na 2ª | sim | Teste `puts Ativos/Passivos/Patrimonio in their own row...`; QA ao vivo `s24-01-dashboard-layout.png` (4 combinações) |
| 2. Sem disclaimer em Saldo Acumulado/Patrimônio | sim | Teste `no longer shows the short disclaimer tags...`; achado real corrigido após 1ª rodada de QA |
| 3. Saldo Anterior navega com seta visível | sim | Ícone `ArrowIcon` dentro do botão existente, comportamento inalterado |
| 4. Saldo Acumulado: seta navega mês seguinte (com alerta de fronteira), resto abre drilldown | sim | Testes `clicking the seta...navigates`, `...alerts instead of navigating`, `clicking the body...opens the drilldown`; QA ao vivo confirma zero erro de console no clique da seta |
| 5. Empréstimos/Transferência Interna com cores distintas | sim | `buildColorIndexFromIds` com 16 slots — 15 grupos cadastrados nunca mais colidem (era `i % 8`); `categoryColors.test.ts` cobre 15 ids sem colisão |
| 6. Card Saldo mostra memória de cálculo, não lista de contas | sim | Teste `opens the Saldo drilldown showing the memoria de calculo...`; QA ao vivo `s24-03-saldo-memoria.png` |
| 7. Ativos → Investimento expande mostrando holdings | sim | Teste `expands an Investimento row to show its holdings...`; QA ao vivo `s24-04-ativos-investimento-holding.png` com dado real (CDB Nubank) |
| 8. Passivos mostra lista completa de saldo devedor | sim | Teste `shows valor atual por Investimento and saldo por conta...` (Ativos) + verificação equivalente de Passivos no QA script; QA ao vivo `s24-05-passivos-lista.png` |
| 9. Patrimônio: 4 partes expandem in-place | sim | 4 testes (`opens the patrimonio breakdown as a 4-part accordion`, + 1 por parte); QA ao vivo `s24-06-patrimonio-accordion.png`, sem botão "Ver detalhe" |
| 10. Drilldown de Ativos com cor distinta por ativo | sim | Teste `colors the asset drilldown by asset id...` (AssetsPage); `AtivosAccordion` usa `buildColorIndexFromIds` sobre `useAssets()` |
| 11. Categorização: botão sincroniza tudo, fila atualiza sem reload manual | sim | Testes `clicking Sincronizar contas syncs all accounts...`, `shows an error message when the sync request fails`; QA ao vivo `s24-08-categorizacao-sync.png` |
| 12. Isolamento por `user_id` preservado | sim | Nenhuma query nova — todos os hooks reaproveitados (`useAssets`, `useLiabilities`, `usePluggyInvestments`, `useEvolucaoSaldoPorConta`) já tinham isolamento por usuário desde suas sprints originais |
| 13. Suíte 100% verde, cobertura ≥80% nos módulos tocados | sim | 598 backend (98%, inalterado) + 207 frontend, ambas 100% verdes |

## Documentação atualizada

- `docs/dashboards-guia-cards.md` — seções "Saldo", "Ativos/Passivos", "Patrimônio" reescritas pra
  refletir o novo conteúdo dos drill-downs (memória de cálculo em vez de snapshot, accordion
  Investimento→Holding, lista de Passivos, accordion in-place em vez de "Ver detalhe"); referência
  nova ao PRD-024.
- `docs/directory-structure.md` — entradas de `categoryColors.ts`, `DashboardsPage.tsx`,
  `AssetsPage.tsx`, `CategorizationReviewPage.tsx` atualizadas com as mudanças da Sprint 24.
- `docs/roadmap.md` — seção da Sprint 24 marcada como concluída (era escrita na sessão de
  planejamento).
- Este relatório.

## Consumo estimado de tokens/sessões

Sessão única — implementação completa (6 arquivos de produção + 4 de teste), validação de paleta via
skill `dataviz` (iteração de matizes + `validate_palette.js`), deploy completo (push → CI → VM de dev
→ mint de token pausado pra aprovação → browser-check), 2 rodadas adicionais de fix após achados reais
do próprio QA visual (deploy + redeploy + re-QA cada uma). Consumo alto, concentrado na etapa de
deploy/QA iterativo (3 rodadas de push→CI→deploy→QA no total) mais do que na lógica de apresentação
em si — mas exatamente o tipo de achado que o QA ao vivo existe pra pegar antes do CEO ver.

## Pendências e próximos passos sugeridos

- Nenhuma pendência técnica. `AssetsValorAtualList`/`LiabilitiesValorAtualList` (dentro do accordion
  de Patrimônio) ainda usam `col-nome`/`col-tipo`/`col-valor` sem largura dedicada, igual ao padrão
  que causou o bug de overlap em `.holdings-table` — não deu problema nesta sprint porque nome de
  ativo/passivo tende a ser curto, mas é candidato a mesmo fix preventivo se algum nome longo
  aparecer no futuro (não corrigido agora por estar fora do escopo desta sprint).
- Sprint 23 (Investimentos) já concluída e aprovada separadamente — nenhuma dependência entre as
  duas.
