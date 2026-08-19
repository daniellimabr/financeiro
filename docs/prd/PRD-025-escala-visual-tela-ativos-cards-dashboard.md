# PRD-025: Escala visual do sistema, tela Ativos e cards Ativos/Passivos/Patrimônio/Saldo Acumulado

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO usando o app na prática
  pós-Sprint 24, dividido em 3 sprints temáticas nesta sessão de planejamento — ver PRD-026/PRD-027)
- **Sprint(s):** [SPRINT-025-escala-visual-tela-ativos-cards-dashboard-plan.md](../sprints/SPRINT-025-escala-visual-tela-ativos-cards-dashboard-plan.md)

## Problema

Lista de pontos que o CEO levantou usando o app na prática pós-Sprint 24:

1. O sistema inteiro está grande demais na tela — o CEO relata que zoom de 80% no navegador fica
   melhor de visualizar que 100%.
2. Na tela "Ativos" (Gestão de Ativos, `AssetsPage.tsx`): o toggle Competência/Caixa não é
   relevante ali, deveria ser sempre competência; o extrato de transações do drilldown por ativo é
   uma tabela plana, deveria ser drilldown/accordion; um item "encerramento de dívida" aparece
   classificado em "Receitas/Estornos" dentro do drilldown de despesa de agosto/2026, categoria
   errada pro contexto.
3. Card "Ativos" do Dashboard: falta um drilldown que mostre o valor de cada ativo (só existe hoje
   dentro do accordion do card Patrimônio); o accordion de gasto deveria virar o último da seção,
   com o título "Despesas por Ativo"; "Valor atual por Investimento" continua sendo o 2º drilldown,
   mas está com cor única em vez de uma cor por investimento; "Saldo por conta" ainda aparece nesta
   tela e deveria sair (já existe equivalente no card "Saldo").
4. Nenhum drilldown de "valor atual" do sistema mostra o percentual que cada item representa do
   total da lista — padrão já estabelecido no funil de Despesa/Receita, nunca generalizado.
5. Card "Passivos": a lista "Passivos — saldo devedor" é uma tabela plana, deveria adotar o mesmo
   estilo de drilldown (barra + %) que "Valor atual por Investimento" já tem.
6. Card "Patrimônio": o CEO reporta ainda ver o texto "Atual, fora do filtro de período — sem
   histórico ainda".
7. Card "Saldo Acumulado": falta explicar a fórmula (Saldo do mês anterior + Receita do mês −
   Despesa do mês) no próprio card.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-19), via perguntas diretas:

1. **Divisão em 3 sprints temáticas** (esta + PRD-026 + PRD-027), não uma sprint única — mesmo
   padrão das divisões 7/8/9, 12/13/14/15, 23/24.
2. O item 6 (texto "Atual, fora do filtro...") **já foi corrigido** no QA pós-Sprint 24 (commit
   `2024f45`) — o `Grep` no código não encontra mais a string; só sobra negada em teste de
   regressão (`DashboardsPage.test.tsx:382`). Entra nesta sprint só como item de **validação ao
   vivo**, não como código novo — o CEO pode estar vendo cache de build antiga.
3. O caso "Receitas/Estornos" (item 2) exige investigação com dado real na VM de dev antes de
   decidir se é recategorização pontual ou ajuste no filtro do drilldown por ativo — **Bloco 0**
   desta sprint, sem fix presumido no PRD.

## Escopo

### Incluído

- **Bloco 0 (investigação):** puxar via SSH (VM de dev) a transação real "encerramento de dívida"
  citada pelo CEO — confirmar categoria/subcategoria, `tipo` (débito/crédito) e `asset_id`.
  Decidir com o CEO, por pergunta direta, entre (a) recategorizar a transação (miscategorização
  pontual) ou (b) ajustar o filtro do drilldown por ativo (hoje filtra só por `tipo` bruto da
  transação Pluggy, não pelo grupo Receita/Despesa da categoria) — só codar depois da decisão.
- **Escala visual do sistema:** reduzir os tokens `--text-2xs`..`--text-2xl` e `--space-1`..
  `--space-7` em `frontend/src/index.css` em ~20% (equivalente visual a "zoom 80%"), numa única
  edição — todo `font-size`/`padding`/`gap` do app já referencia esses tokens.
- **Tela Ativos (`AssetsPage.tsx`):**
  - Remove o toggle Competência/Caixa (`RegimeToggle`) — regime fixo em competência.
  - `AssetDrilldown`: troca a tabela plana (`TransactionsTable`) por accordion
    Categoria→Subcategoria→Transação, mesmo padrão do funil Despesa/Receita do Dashboard, escopado
    a um único ativo.
  - Aplica o fix decidido no Bloco 0 para o caso "Receitas/Estornos".
- **Card Ativos do Dashboard:**
  - Nova seção "Valor atual por Ativo" (reaproveita `AssetsValorAtualList`), 1ª do card.
  - "Valor atual por Investimento" continua 2ª — corrige cor única, ganha uma cor por investimento
    (mesmo padrão de `AtivosAccordion`, `buildColorIndexFromIds`).
  - Accordion de gasto ganha o título "Despesas por Ativo" e vira a última seção.
  - Remove a seção "Saldo por conta" (`SaldoPorContaList`) desta tela.
- **Card Passivos:** `LiabilitiesValorAtualList` troca a tabela plana pelo estilo
  `dash-accordion`/`Row` (barra proporcional + %, sem conteúdo ao clicar).
- **Percentual do total em todo drilldown de "valor atual":** `AssetsValorAtualList`,
  `LiabilitiesValorAtualList` e `InvestimentoHoldingsList` ganham indicador de percentual do total
  da própria lista — mesmo cálculo já usado no funil Despesa/Receita (`percentual`/
  `formatPercent`), que vira o padrão documentado pra qualquer drilldown novo do sistema.
- **Card Patrimônio:** validação ao vivo de que o texto disclaimer não aparece mais — sem código
  novo esperado.
- **Card Saldo Acumulado:** adiciona a frase da fórmula (Saldo do mês anterior + Receita do mês −
  Despesa do mês), visível no tile ou logo no topo do drilldown, reaproveitando
  `SaldoAcumuladoMemoriaCalculo` já existente.

### Fora de escopo (explicitamente)

- Interatividade de gráficos (ampliar, hover, clique = filtro) — vira PRD-026.
- "Ocultar gasto" (binóculo) e gráfico comparativo de categorias — vira PRD-027.
- Mudar a fórmula de `Summary.ativos`/`passivos`/`patrimonio`/`saldo` — todas as mudanças desta
  sprint são de apresentação/drilldown/estilo, exceto o eventual fix do Bloco 0, que pode tocar
  categorização de uma transação específica (dado, não fórmula).
- Regime Competência/Caixa nas telas Natureza/Projeção — backlog já registrado, não reaberto aqui.
- `LiabilitiesPage.tsx` (tela "Gestão de Passivos", separada do card "Passivos" do Dashboard) — só
  o card do Dashboard foi pedido.

## Critérios de aceite

1. Dado qualquer tela do app, quando carregada, então a densidade visual equivale a ~80% do
   tamanho atual (tokens `--text-*`/`--space-*` reduzidos), sem texto cortado ou ilegível em
   `--text-2xs`.
2. Dado a tela Ativos, então não existe mais toggle Competência/Caixa — todo drilldown usa
   competência.
3. Dado o drilldown de um ativo na tela Ativos, então as transações aparecem agrupadas em
   accordion Categoria→Subcategoria→Transação, não mais tabela plana.
4. Dado o caso "encerramento de dívida"/"Receitas/Estornos", então o comportamento reflete a
   decisão tomada com o CEO no Bloco 0 (recategorização ou ajuste de filtro).
5. Dado o card "Ativos" do Dashboard, então mostra, nesta ordem: "Valor atual por Ativo", "Valor
   atual por Investimento" (cada investimento com cor própria), "Despesas por Ativo" — sem seção
   "Saldo por conta".
6. Dado o card "Passivos", então "Passivos — saldo devedor" usa o mesmo estilo de barra+% de
   "Valor atual por Investimento".
7. Dado qualquer drilldown de "valor atual" (Ativos, Passivos, holdings de Investimento), então
   cada item mostra o percentual que representa do total da própria lista.
8. Dado o card "Patrimônio", quando aberto, então não exibe texto disclaimer sobre estar "fora do
   filtro".
9. Dado o card "Saldo Acumulado", então a fórmula (Saldo do mês anterior + Receita do mês − Despesa
   do mês) está visível no card ou no início do seu drilldown.
10. Dado dois usuários diferentes, todo drilldown/consulta alterada continua isolado por
    `user_id`.
11. Dado o CI, quando a suíte roda, então os testes novos/alterados passam com cobertura ≥80% nos
    módulos tocados, suíte completa 100% verde.

## Regras de negócio

- Nenhuma mudança de fórmula de agregação prevista — exceto o que o Bloco 0 revelar sobre o filtro
  do drilldown por ativo, que seria uma correção de comportamento, não uma mudança de conceito
  (o card "Ativos" continua somando `Asset.valor_atual`, sem alteração).
- O padrão de percentual do total (`percentual = item.total / totalGeral * 100`, `formatPercent`)
  passa a ser a convenção obrigatória de todo drilldown de "valor atual" novo, não só desta sprint.

## Dados e modelo

- Sem tabela nova, sem migration prevista.
- Se o Bloco 0 decidir por recategorizar a transação "encerramento de dívida", é uma correção de
  dado via API existente (`PUT /categorization/transactions/{id}/category`), não schema novo.

## Segurança

- Isolamento por usuário preservado em todas as consultas reaproveitadas (nenhuma consulta nova).
- Nenhum secret novo introduzido.

## Fora de escopo / decisões adiadas

- Consolidar os componentes de gráfico de linha (`CardSparkline`/`TrendChart`/`RowTrend`) num só —
  candidato de execução da Sprint 26, não desta.
- Cor por passivo no drilldown de "Passivos — saldo devedor" — o CEO pediu só o estilo
  barra+%, sem cor distinta por item (diferente do que já existe para Ativos/Investimentos).

## Referências

- [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) — definição vigente dos cards,
  atualizada ao final desta sprint com os drilldowns novos/reordenados.
- [PRD-024 — Dashboard: layout, cards, navegação e cores](PRD-024-dashboard-layout-cards-navegacao.md)
  — origem do accordion Investimento→Holding, da cor por ativo e do accordion de Patrimônio,
  estendidos nesta sprint.
- Plano de sessão: `C:\Users\Daniel\.claude\plans\planejar-sprint-25-ou-distributed-noodle.md`.
