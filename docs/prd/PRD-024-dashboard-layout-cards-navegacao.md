# PRD-024: Dashboard — layout, cards, navegação e cores

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO usando `DashboardsPage`/
  `CategorizationReviewPage` na prática pós-Sprint 22, mesmo padrão das Sprints 16/17/18/22)
- **Sprint(s):** [SPRINT-024-dashboard-layout-cards-navegacao-plan.md](../sprints/SPRINT-024-dashboard-layout-cards-navegacao-plan.md)

## Problema

Onze pontos que o CEO levantou usando o Dashboard e a tela de Categorização na prática:

1. Disclaimers redundantes nos cards "Saldo Acumulado" e "Patrimônio" poluem o card — a
   explicação já vive em `docs/dashboards-guia-cards.md` e, no caso de Saldo Acumulado, no texto
   longo do próprio drilldown.
2. Grid de 8 cards sem hierarquia visual — Ativos/Passivos/Patrimônio (visão de patrimônio)
   deveriam ficar juntos numa primeira linha, separados do restante (fluxo do mês).
3. Navegação de mês pelos cards "Saldo Anterior"/"Saldo Acumulado" já existe (clique no card
   inteiro navega pro mês anterior, Sprint 15) mas sem affordance visual de seta — e "Saldo
   Acumulado" hoje só abre drilldown ao clicar, sem forma de navegar pro mês seguinte.
4. Cor duplicada entre "Empréstimos" e "Transferência Interna" no funil de despesas — achado real:
   colisão matemática (`i % 8` com 15 grupos cadastrados e só 8 cores na paleta).
5. Card "Saldo": o drilldown mostra a lista de contas (`SaldoPorContaList`, um snapshot bancário),
   desalinhado do que o card representa (resultado de fluxo Receita−Despesa do período filtrado)
   — e essa lista já está duplicada no card Ativos desde a Sprint 22.
6. Card "Saldo Acumulado": o drilldown só tem o gráfico de tendência — falta a memória de cálculo
   (âncora + acumulação mês a mês) e um resumo de receita/despesa do mês filtrado.
7. Card "Ativos": a seção "Valor atual por Investimento" é uma lista plana — falta um nível de
   drilldown (Investimento → Holding → saldo atual).
8. Card "Passivos": falta a lista de todos os passivos com saldo devedor — o card Ativos já ganhou
   o equivalente (lista de investimentos + saldo por conta) na Sprint 22, Passivos não.
9. Card "Patrimônio": `PatrimonioBreakdownPanel` é uma tabela HTML com botões "Ver detalhe" que
   navegam para outra visão do funil — o CEO quer um drilldown expansível in-place.
10. Drilldown de Ativos (no Dashboard e em `AssetsPage`) usa cor fixa por tipo de transação
    (despesa/receita), não uma cor por ativo — todos os itens da lista ficam com a mesma cor.
11. A tela de Categorização não tem botão de sincronizar contas — hoje só existe em Gestão de
    Contas, obrigando o usuário a trocar de tela no meio da revisão.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-19), respondendo a perguntas diretas sobre os 2
pontos com mais de um caminho de implementação possível:

1. **Card Patrimônio vira accordion expansível in-place** (não mantém navegação "Ver detalhe"
   para outra visão do funil, nem só restiliza a tabela existente).
2. **Botão "Sincronizar contas" em Categorização dispara sync de tudo direto num clique**, sem
   diálogo de seleção de contas (diferente do padrão usado em Gestão de Contas).

## Escopo

### Incluído

- **Disclaimers:** remove o `<span className="tag">` curto dos cards "Saldo Acumulado" e
  "Patrimônio".
- **Layout em 2 linhas:** primeira linha com Ativos/Passivos/Patrimônio; segunda linha com Saldo
  Anterior/Receita/Despesa/Saldo/Saldo Acumulado (ordem atual preservada dentro de cada linha) —
  reagrupamento no JSX, sem mudança na mecânica de grid (`auto-fit` já existente).
- **Ícone de seta no card "Saldo Anterior":** decorativo, dentro do botão já existente que navega
  pro mês anterior (comportamento inalterado, só ganha affordance visual).
- **Navegação pro mês seguinte no card "Saldo Acumulado":** botão de seta-direita separado do
  clique no corpo do card (que continua abrindo o drilldown) — mesmo tratamento de fronteira já
  usado em "Saldo Anterior" (alerta em vez de navegar quando não há mês seguinte com sentido,
  ex. mês corrente real).
- **Paleta categórica:** expande de 8 para 16 cores distintas (`--cat-1`..`--cat-16`), resolvendo
  a colisão Empréstimos/Transferência Interna e dando margem para crescimento futuro do número de
  grupos.
- **Card "Saldo":** troca a lista de contas por uma memória de cálculo (Receita − Despesa = Saldo
  do período filtrado), usando dados já carregados no resumo do dashboard (sem endpoint novo). A
  lista de contas continua acessível via card Ativos.
- **Card "Saldo Acumulado":** drilldown ganha, além do gráfico já existente, a memória de cálculo
  (âncora + acumulação mês a mês até o mês filtrado) e um resumo de receita/despesa do mês
  filtrado.
- **Card "Ativos" → Investimentos:** a lista de investimentos com valor atual vira accordion —
  cada investimento expande mostrando suas holdings com saldo atual.
- **Card "Passivos":** ganha a lista de todos os passivos ativos com saldo devedor, ao lado do
  accordion de gasto por passivo já existente (mesmo padrão que Ativos já tem).
- **Card "Patrimônio":** o painel de detalhamento vira accordion de 4 partes (Ativos, Passivos,
  Saldo em investimentos, Saldo líquido acumulado, mais linha Total), cada parte expansível
  in-place reaproveitando as listas/gráfico já existentes — sem navegar para fora do card. Os
  rótulos com sinal (+/−) de cada parte compõem a própria memória de cálculo do total.
- **Cor por ativo:** o drilldown de Ativos (Dashboard e `AssetsPage`) passa a colorir cada item
  por ativo (dentro da paleta de 16 cores), em vez de uma cor fixa por tipo de transação.
- **Botão "Sincronizar contas" em Categorização:** dispara sincronização de todas as contas com um
  clique, reaproveitando a mutation já usada em Gestão de Contas — a fila de Categorização
  atualiza sozinha ao terminar.

### Fora de escopo (explicitamente)

- Mudar a fórmula de `Summary.ativos`/`patrimonio`/`saldo` — todas as mudanças são de
  apresentação/drilldown, preservam os números já documentados em `docs/dashboards-guia-cards.md`.
- Cor por item no drilldown de Passivos — só o drilldown de Ativos foi pedido.
- Regime Competência/Caixa nas telas Natureza/Projeção — backlog já registrado, não reaberto aqui.
- Diálogo de seleção de contas no botão de sincronizar de Categorização — decisão explícita do
  CEO de ir direto, sem diálogo.

## Critérios de aceite

1. Dado o Dashboard, quando carregado, então Ativos/Passivos/Patrimônio aparecem juntos na
   primeira linha de cards, o restante na segunda.
2. Dado os cards "Saldo Acumulado" e "Patrimônio", então não exibem mais o texto disclaimer curto
   no corpo do card.
3. Dado o card "Saldo Anterior", quando clicado em qualquer ponto, então navega pro mês anterior
   como hoje, agora com ícone de seta visível.
4. Dado o card "Saldo Acumulado", quando o usuário clica no ícone de seta-direita, então navega
   pro mês seguinte (com alerta se não houver mês seguinte com sentido); quando clica no resto do
   card, então abre o drilldown com memória de cálculo, resumo de receita/despesa e gráfico.
5. Dado o funil de despesas, quando "Empréstimos" e "Transferência Interna" aparecem juntos, então
   têm cores visualmente distintas.
6. Dado o card "Saldo", quando clicado, então mostra a memória de cálculo (Receita−Despesa=Saldo),
   não mais a lista de contas.
7. Dado o card "Ativos", quando a seção "Valor atual por Investimento" é expandida por
   investimento, então mostra as holdings daquele investimento com saldo atual.
8. Dado o card "Passivos", quando aberto, então mostra a lista de todos os passivos ativos com
   saldo devedor, além do accordion de gasto já existente.
9. Dado o card "Patrimônio", quando aberto, então cada uma das 4 partes expande in-place, sem
   navegar para fora do card.
10. Dado o drilldown de Ativos, quando há mais de um ativo na lista, então cada um tem cor
    distinta (dentro da paleta de 16 cores).
11. Dado a tela de Categorização, quando o botão "Sincronizar contas" é clicado, então dispara
    sync de todas as contas e a fila é atualizada sem reload manual.
12. Dado dois usuários diferentes, todo drilldown/consulta alterada continua isolado por
    `user_id`.
13. Dado o CI, quando a suíte roda, então os testes novos/alterados passam com cobertura ≥80% nos
    módulos tocados, suíte completa 100% verde.

## Regras de negócio

- Nenhuma mudança de fórmula de agregação — todas as alterações desta sprint são de camada de
  apresentação (reorganização de layout, drilldown, cor), reaproveitando dados/endpoints já
  existentes.
- A paleta categórica de 16 cores é usada tanto para categoria/grupo (funil de despesas) quanto
  para ativo (drilldown de Ativos) — mesma fonte de verdade (`categoryColors.ts` generalizado),
  evitando duas implementações divergentes de atribuição de cor.
- O botão de sincronizar em Categorização usa a mesma mutation (`useSyncPluggyItems`) já usada em
  Gestão de Contas — nenhuma lógica de sync nova no backend.

## Dados e modelo

- Sem tabela nova, sem migration prevista.
- Nenhum endpoint novo previsto — a memória de cálculo de Saldo/Saldo Acumulado é montada a partir
  de campos já retornados por `GET /dashboards/summary` e `GET /dashboards/saldo-acumulado`; se a
  execução encontrar um campo faltante nesses schemas, o ajuste (aditivo, sem quebrar contrato
  existente) é registrado como achado real no relatório da sprint, não presumido aqui.

## Segurança

- Isolamento por usuário preservado em todas as consultas reaproveitadas (nenhuma consulta nova).
- Nenhum secret novo introduzido.

## Fora de escopo / decisões adiadas

- Cor por item no drilldown de Passivos — candidata a sprint futura, se o CEO priorizar.
- Persistir a paleta de 16 cores como configurável por usuário — fora de escopo, paleta é global
  do app como já é hoje.
- Botão de sincronizar com seleção de contas em Categorização — decisão explícita do CEO de manter
  simples (sync de tudo).

## Referências

- [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) — definição vigente de
  Saldo/Saldo Acumulado/Ativos/Passivos/Patrimônio, não alterada por esta sprint (só a
  apresentação/drilldown).
- [PRD-022 — Manutenção de Investimentos + drilldown de Ativos/Patrimônio](PRD-022-manutencao-investimentos-e-drilldown-patrimonio.md)
  — origem do drilldown atual de Ativos/Patrimônio, estendido nesta sprint.
- [PRD-015 — Configurações, competência de salário e Saldo Acumulado](PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
  — origem dos cards "Saldo Acumulado"/"Saldo Anterior" e da navegação por clique no card.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-nova-sprint-para-foamy-falcon.md` — a sessão de
  execução deve ler este PRD + o plano de sprint associado; não é necessário reler o plano de
  sessão bruto.
