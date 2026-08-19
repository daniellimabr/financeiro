# SPRINT-026: Interatividade de gráficos (ampliar + hover + clique = filtro) — Relatório

- **Plano:** [SPRINT-026-interatividade-graficos-dashboard-plan.md](./SPRINT-026-interatividade-graficos-dashboard-plan.md)
- **Data do relatório:** 2026-08-19

## Resumo

Os 3 componentes de gráfico de linha do sistema (`CardSparkline`, `TrendChart` e o
`RowTrend` — SVG manual, 48×16px, sem interação) foram consolidados num único
`TrendLineChart`, parametrizado por `variant` ("spark"/"row"/"card"), com tooltip
mês/ano+valor no hover e clique-para-filtrar em todo gráfico do sistema (Dashboards,
Ativos, Passivos, Investimentos, Natureza, Projeção — nesta última, só pontos de
histórico real). "Valor atual por Ativo" (card Ativos) virou accordion, fechando a
inconsistência visual encontrada pelo CEO na validação da Sprint 25. Validado ao vivo
contra dado real na VM de dev, desktop+mobile, claro+escuro — 0 falhas, 0 erros de
console.

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Avaliar consolidação: componente único vs. 3 separados | feito | Componente único (`TrendLineChart.tsx`), parametrizado por `variant`/`onSelecionarMes` — os 3 já compartilhavam Recharts e ganhavam a mesma necessidade (tooltip + clique), sem justificar 3 implementações divergentes |
| 2 | Reconstruir `RowTrend` em Recharts, 3x mais largo, com Tooltip | feito | 48px → 144px (variant="row"); altura 16→18px pra folga do hover |
| 3 | Clique-em-ponto → filtro de mês, com destaque de hover | feito | Hover já destaca o ponto ativo por padrão do Recharts (`activeDot`), sem código extra — satisfaz o requisito sem trabalho adicional |
| 4 | Conectar clique ao estado ano/mês de cada tela | feito | `DashboardsPage`, `AssetsPage`, `LiabilitiesPage`, `InvestimentosPage`, `NaturezaPage`, `ProjecaoPage` (via `ProjectionChart`) |
| 5 | Testes de componente | feito | Ver "Evidência de testes" — lógica pura (`resolveClickedPonto`) testada isolada; render/wiring dos 3 variants testado; ver nota sobre limitação de jsdom abaixo |
| 6 | `AssetsValorAtualList` vira accordion | feito | Expande mostrando Tipo + Adquirido em (dado que a tabela antiga só mostrava parcialmente, sem data de aquisição) |
| 7 | QA visual real (`check-sprint26.mjs`) | feito | Rodado 3x contra a VM de dev — as 2 primeiras rodadas encontraram achados reais (ver "Decisões tomadas durante a execução"), corrigidos e revalidados; rodada final: 0 falhas, 0 erros de console, desktop+mobile, claro+escuro |
| 8 | Atualizar `directory-structure.md`/`dashboards-guia-cards.md` | feito | Via subagente `doc-updater`; revisão pega e corrige uma duplicação de bloco que o subagente introduziu antes do commit (ver abaixo) |
| 9 | Relatório de sprint | feito | Este documento |

## Evidência de testes

```
 RUN  v4.1.10 F:/financeiro/frontend

 Test Files  25 passed (25)
      Tests  212 passed (212)
   Start at  18:58:03
   Duration  10.79s (transform 2.60s, setup 3.74s, import 9.91s, tests 31.63s, environment 26.06s)
```

Suíte 100% verde. Sem mudança de backend nesta sprint (confirmado via `git diff --stat`
dos 3 commits — só `frontend/`, `scripts/browser-check/` e `docs/`), então a suíte
Python não foi re-executada (nenhum arquivo tocado).

**Nota sobre limitação de ambiente de teste:** `ResponsiveContainer` (Recharts) só
resolve dimensões percentuais (`width="100%"`, usado pelas variantes "spark"/"card")
medindo o container via `ResizeObserver` — que o jsdom não dispara (stub no-op em
`src/test/setup.ts`, já existia antes desta sprint). Isso significa que essas 2
variantes nunca montam o `LineChart` de verdade em teste (mesma limitação que já
existia para `CardSparkline`/`TrendChart`, cujos testes originais só verificavam o
wrapper). A variante "row" usa dimensões numéricas fixas (144×18, não porcentagem) e
por isso monta de verdade em jsdom — testada com clique real via `fireEvent`. A lógica
de resolução do clique (`resolveClickedPonto`: índice do recharts → `{ano, mes}`,
compartilhada entre `TrendLineChart` e `ProjectionChart`) é pura e testada
isoladamente, cobrindo o comportamento que os 3 variants realmente dependem. A
validação end-to-end do clique-para-filtrar contra dado real ficou por conta do
`check-sprint26.mjs` na VM de dev (ver task 7).

## Lint/formatter

```
$ npx eslint .
(sem saída — 0 erros, 0 warnings)

$ npx tsc --noEmit -p tsconfig.app.json
(sem saída — 0 erros)

$ npx prettier --check "src/**/*.{ts,tsx}"
Checking formatting...
All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

- **Consolidação virou um único componente, não 3.** A ambiguidade de design deixada
  pelo PRD foi resolvida olhando os 3 usos lado a lado: todos usam a mesma família
  Recharts (`LineChart`/`Tooltip`/`ResponsiveContainer`), a única diferença real é
  tamanho/eixo/dot — parametrizar por `variant` evitou triplicar a lógica de
  clique-para-filtrar.
- **"Valor atual por Ativo" expande mostrando Tipo + Adquirido em.** O risco do plano
  deixava em aberto "o que cada linha expande" (nada, como Passivos — saldo devedor;
  ou reabrir o extrato, como Despesas por Ativo). Nenhuma das duas opções fazia
  sentido: sem conteúdo seria um accordion decorativo (o Row já tem chevron/expand
  sugerindo conteúdo), e reabrir o extrato duplicaria a seção "Despesas por Ativo"
  logo abaixo. A tabela antiga tinha uma coluna "Tipo" que a linha colapsada do Row
  não tem espaço pra mostrar — virou o conteúdo natural do expand, e ganhou também a
  data de aquisição (que a tabela antiga não mostrava em nenhuma coluna).
- **`event.stopPropagation()` só dispara quando um ponto válido é resolvido.** Em
  `Row`/`dash-tile clickable`, o gráfico de linha vive dentro de um `<button>` que
  também tem `onClick` (expandir linha / abrir funil). Sem o guard, um clique que caiu
  fora de qualquer ponto de dado ainda precisa poder abrir/fechar o pai normalmente.
- **`ProjectionChart`: clique só em pontos de histórico real.** Confirmado o
  comportamento já anotado como "fora de escopo fino" no PRD — um ponto projetado é
  uma média repetida (`get_projecao`), não corresponde a "um mês real" que a tela
  possa filtrar; o guard usa o mesmo `resolveClickedPonto` mas descarta o clique se o
  ponto resolvido não for `real`.
- **Achado real do QA (rodada 1 do `check-sprint26.mjs`): `locator.click()` do
  Playwright não dava tempo pro Recharts resolver o ponto ativo via `mousemove` antes
  do evento de clique, então o clique "vazava" pro elemento pai (abria/fechava o
  funil) sem nunca chamar `onSelecionarMes`.** Diagnosticado com um script descartável
  (`diag-click.mjs`, removido antes do commit) que confirmou via
  `document.elementFromPoint` que o próprio SVG do Recharts recebia o clique
  corretamente — o problema era só timing do driver de teste, não do produto. Corrigido
  no script de QA trocando `locator.click()` por `mouse.move` + `wait(150ms)` +
  `mouse.down/up` explícitos; o comportamento da aplicação em si já estava correto (a
  tela mudava de mês quando testado manualmente com essa sequência).
- **Achado real do QA (rodada 2): tooltip do card "Saldo" não aparecia no viewport
  mobile.** O card fica abaixo da dobra em 390px — `boundingBox()` retornava
  coordenadas fora da área visível, então `mouse.move` "mirava" num ponto sem elemento
  renderizado ali. Corrigido com `scrollIntoViewIfNeeded()` antes de calcular a posição
  do hover. Nenhuma das duas causas era bug de produto — ambas eram do próprio script
  de QA, mas só apareceram testando contra o app real, o que confirma o valor de rodar
  esse script antes de fechar a sprint.
- **Doc-updater duplicou um bloco `utils/` inteiro em `directory-structure.md`.** O
  subagente Haiku, ao adicionar `resolveClickedPonto.ts`, criou um segundo bloco
  `utils/` completo (10 linhas duplicadas) logo depois do bloco `components/`, além de
  ter colocado `resolveClickedPonto.ts` erroneamente dentro da listagem de
  `components/` antes disso. Pego na revisão antes do commit e corrigido diretamente
  (removida a duplicação, `resolveClickedPonto.ts` movido pro único bloco `utils/`
  correto). Também corrigida uma referência residual a `TrendChart` (nome antigo) em
  `dashboards-guia-cards.md` que o subagente deixou passar.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Mini gráfico de linha do funil ~3x mais largo | sim | 48px → 144px (`ROW_WIDTH` em `TrendLineChart.tsx`); confirmado visualmente em `check-sprint26.mjs` (`s26-03-funil-rowtrend.png`, desktop+mobile+dark) |
| 2. Hover em qualquer gráfico de linha mostra mês/ano+valor com destaque no ponto | sim | Tooltip testado ao vivo nos cards (`s26-02-hover-tooltip.png`) e no funil; `activeDot` do Recharts já destaca o ponto sob hover por padrão |
| 3. Clique num ponto filtra a tela pelo mês/ano daquele ponto | sim | Validado ao vivo no card Despesa (Dashboards) e no drilldown de Investimentos — mudança real de mês/ano confirmada via leitura do `<select>` pós-clique |
| 4. Nenhuma consulta nova quebra isolamento por `user_id` | sim | Sem endpoint novo, sem mudança de backend nesta sprint (só apresentação/interação sobre dado já carregado) |
| 5. CI: testes novos passam, cobertura ≥80%, suíte 100% verde | sim | 212/212 testes frontend; sem mudança de backend (suíte Python intocada); ver nota de limitação de jsdom acima |
| 6. "Valor atual por Ativo" usa o mesmo estilo de drilldown/accordion das outras 2 seções do card | sim | `AssetsValorAtualList` reescrito com `Row`/`dash-accordion`, expande mostrando Tipo+data de aquisição; confirmado em `s26-04-ativos-accordion.png` |

## Documentação atualizada

- `docs/directory-structure.md` — `CardSparkline.tsx`/`TrendChart.tsx` removidos da
  listagem, `TrendLineChart.tsx` novo (3 variantes); `resolveClickedPonto.ts` novo em
  `utils/`.
- `docs/dashboards-guia-cards.md` — "Valor atual por Ativo" documentado como
  accordion (era tabela); referência a PRD-026 adicionada.
- `docs/roadmap.md` — não tocado nesta sessão; será fechado junto da aprovação do CEO
  (mesmo padrão das sprints anteriores).

## Consumo estimado de tokens/sessões

Sprint de porte médio: consolidação de componente tocando 3 arquivos deletados + 1
novo + 6 páginas + `ProjectionChart`, mais 1 sessão de QA visual com 2 achados reais
de script (não de produto) corrigidos em loop. Cabe confortavelmente numa única sessão
de execução — não precisou dividir.

## Pendências e próximos passos sugeridos

Nenhuma pendência conhecida. PRD-027 ("Ocultar gasto" + comparativo de categorias) é a
3ª sprint desta sessão de planejamento, ainda sem execução.
