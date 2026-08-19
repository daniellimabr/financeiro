# Guia dos cards do Dashboard

Explicação simples do que cada card soma, o que exclui e como o toggle
Competência/Caixa afeta o número. Escrito para quem não vai ler o código —
sem termos técnicos além dos que aparecem na própria tela.

## O toggle Competência/Caixa

No topo do Dashboard (e das telas Ativos/Passivos) há um seletor
**Competência / Caixa**. Ele muda em que mês um gasto ou receita "conta",
não muda os valores em si:

- **Competência** (padrão): um gasto ou receita conta no mês a que ele
  pertence de fato — não necessariamente o mês em que o dinheiro saiu ou
  entrou na conta. Uma compra no cartão de crédito conta no mês seguinte ao
  da compra (mesmo a fatura só sendo paga depois); um salário recebido perto
  do fim do mês conta no mês seguinte (a competência dele).
- **Caixa**: aproxima de quando o dinheiro efetivamente sai/entra da conta.
  Para cartão de crédito, o caixa fica mais 1 mês atrás da competência (o
  gasto só "pesa" quando a fatura é paga). Para as demais contas, caixa e
  competência são o mesmo mês.

O toggle afeta Receita, Despesa, Saldo, Ativos, Passivos, Patrimônio e Saldo
Acumulado.

## Saldo

Receita menos despesa **do mês/período filtrado** (competência ou caixa,
conforme o toggle). É um resultado de fluxo — "quanto sobrou (ou faltou) nesse
mês" — não é o saldo bancário atual. Exclui fatura de cartão e limite de
crédito (nunca entra aqui). Clicar no card abre a memória de cálculo
(Receita − Despesa = Saldo, os mesmos três números já carregados no resumo).

## Saldo Acumulado

Projeção acumulada desde janeiro/2026: começa do saldo inicial das contas
que têm "Saldo inicial" configurado (tela Configurações) e vai somando o
resultado (receita − despesa) de cada mês, por competência ou caixa. A fórmula
é: **Saldo do mês anterior + Receita do mês − Despesa do mês = Saldo
Acumulado**. **Não é o saldo bancário do dia** — é o que o saldo *deveria*
ser se todo mundo pagasse e recebesse exatamente na competência/caixa esperada.
Duas diferenças comuns entre este número e o extrato real do banco:

- Um salário recebido perto do fim do mês só entra na competência do mês
  seguinte, mesmo já estando fisicamente na conta.
- Uma compra no cartão de crédito já entra na competência antes de a fatura
  ser paga.

Cartão de crédito nunca tem "Saldo inicial" (serve só para capturar as
compras feitas nele, não para representar dinheiro guardado) — por isso ele
não entra na âncora deste card, mas suas compras entram na despesa
normalmente, na competência/caixa que lhes cabe.

## Saldo Anterior

O mesmo Saldo Acumulado, mas do mês anterior ao filtrado — um ponto de
referência rápido sem precisar trocar o filtro de mês. Em janeiro/2026 (início
do histórico do sistema) não existe mês anterior; o card avisa em vez de
navegar.

## Receita / Despesa

Soma de créditos/débitos do período filtrado, por competência ou caixa.
Exclui:

- Transações do grupo "Transferência interna" (dinheiro movendo entre contas
  do próprio usuário nunca é renda ou gasto real).
- `credito` em conta de cartão de crédito (pagamento de fatura ou
  estorno/reversão — nunca é receita real).
- Categorias marcadas para excluir de totais (configuração por grupo).
- Desde a Sprint 22, dividendo/JCP/taxa de investimentos administrados por
  corretora (identificado pela própria `categoria_pluggy` da Pluggy:
  "Proceeds interests and dividends" / "Taxes on investments") — chega numa
  conta corrente vinculada à corretora (não numa conta tipo "Investimento",
  achado real do Bloco 0), e o CEO decidiu não precisar administrar/
  categorizar esse fluxo. Mesma exclusão vale na fila de Categorização.
  Aporte/resgate continuam contando normalmente (categoria "Investments",
  distinta) — decisão fixada desde a Sprint 19.

## Ativos / Passivos

Valor atual somado de todos os ativos com status "ativo" (Gestão de Ativos)
e de todos os passivos com status "ativo" (Gestão de Passivos) — sempre
snapshot de hoje, não depende do período filtrado nem do toggle
Competência/Caixa. **A fórmula não mudou desde a Sprint 22** — só os
drilldowns ficaram mais completos:

- **Ativos**: o drill-down mostra três seções, nesta ordem:
  - "Valor atual por Ativo": accordion/drilldown list com barra+% (mesmo estilo
    de "Valor atual por Investimento"), mostrando todos os ativos ativos, saldo
    atual e a percentagem que cada um representa do total de ativos (novo na
    Sprint 25, accordion na Sprint 26). Expandir uma linha mostra Tipo + Adquirido
    em (data de aquisição).
  - "Valor atual por Investimento": accordion Investimento → Holding (Sprint
    24). Cada investimento expande mostrando as holdings vinculadas com saldo
    atual e percentagem de cada holding dentro daquele investimento. Desde a
    Sprint 25, cada investimento tem uma cor distinta (antes era var(--accent)
    fixo) — mesma paleta de `buildColorIndexFromIds` já usada por ativos.
  - "Despesas por Ativo": accordion de gasto por ativo no período filtrado
    (período filtrado, cada item colorido por ativo desde a Sprint 24 —
    antes era uma cor fixa por tipo de transação). Inclui toggle Despesa/
    Receita.

- **Passivos**: o drill-down mostra duas seções:
  - Accordion de gasto por passivo (período filtrado, mesmo padrão do Ativos).
  - "Passivos — saldo devedor": lista visual (Sprint 25) com barras proporcionais
    e percentagem que cada passivo representa do total de passivos devedor. Usa
    uma cor fixa (terracotta/var(--despesa)), sem cores distintas por item e sem
    interatividade de expansão — apenas o estilo barra+% para leitura visual
    rápida.

## Patrimônio

Soma de 4 partes, sempre snapshot de hoje: Saldo líquido acumulado (o mesmo
conceito do card "Saldo Acumulado", incluindo contas líquidas sem "Saldo
inicial" pelo saldo ao vivo delas) + saldo em investimentos (ao vivo) +
Ativos − Passivos. Clique no card para ver o detalhamento das 4 partes — a
fórmula somada não mudou desde a Sprint 16. A Sprint 22 trocou o conteúdo de
cada parte de gasto do período/lista sem filtro para itemizados de **valor
atual** (sem depender do período filtrado); a Sprint 24 trocou a forma como
se chega nesse conteúdo — de uma tabela com botões "Ver detalhe" que
navegavam pra outra visão do funil, para um **accordion de 4 partes
expansível in-place** (cada parte expande dentro do próprio painel de
Patrimônio, sem sair dele):

- **Ativos** → lista de ativos ativos com valor atual (`GET /assets`,
  filtrado por `status=ativo` no frontend).
- **Passivos** → lista de passivos ativos com saldo devedor (`GET
  /liabilities`, mesmo filtro).
- **Saldo em investimentos** → lista de Investimentos com valor atual
  agregado (contas + holdings vinculadas, `GET /investimentos`, campo
  `valor_atual` novo na Sprint 22 — antes só CRUD, sem valor).
- **Saldo líquido acumulado** → inalterado (mesmo gráfico de tendência de antes,
  `TrendLineChart` variant="card" desde a Sprint 26).

O saldo em investimentos passou, na Sprint 20, a somar as **posições/
holdings** sincronizadas via Investments da Pluggy (CDBs, ações, títulos do
Tesouro etc., vinculadas a um Investimento na tela "Gestão de contas") —
essa é a fonte preferencial por item conectado. Só entra pelo saldo bruto da
conta bancária tipo "Investimento" quando aquele item **não** tem nenhuma
posição sincronizada (ex.: item que só expõe a conta genérica, sem holdings
dedicadas) — sem dobrar contagem caso um item retorne as duas fontes.

Desde a Sprint 21, cada holding pode ter `saldo_inicial` (baseline em
31/12/2025) preenchido a partir de uma proposta gerada automaticamente e
revisada pelo CEO (confiança "alta"/"estimada" por linha — nunca gravado sem
revisão). O "Rendimento estimado" mostrado no card de cada Investimento em
`InvestimentosPage` (`saldo_atual − saldo_base − aportes + resgates`) muda de
valor quando esse baseline é preenchido, sem nenhuma mudança na fórmula do
card "Patrimônio" em si (`get_evolucao`, snapshot atual, não foi alterada).
A série histórica mês a mês (saldo/valorização/rendimento/dividendos/
aportes/resgates) fica na tela Investimentos (drill-down > "Série
histórica"), não no Dashboard — ver
[PRD-021](prd/PRD-021-vinculo-holdings-serie-historica.md).

## Convenção de percentual em listas "valor atual"

Desde a Sprint 25, toda lista de "valor atual" no Dashboard (Valor atual por
Ativo, Valor atual por Investimento, e Passivos — saldo devedor) mostra a
percentagem que cada item representa **do total daquela lista**. A fórmula é a
mesma do funil Despesa/Receita: `percentual = item.total / totalGeral * 100`.
Essa convenção agora vale por padrão para qualquer novo drill-down de "valor
atual" que venha a ser adicionado no futuro.

## Referências

- [PRD-026](prd/PRD-026-interatividade-graficos-dashboard.md) — origem das variantes
  de gráfico interativo, do clique nos pontos de série histórica navegando por
  mês/ano, da consolidação de CardSparkline/TrendChart em TrendLineChart, e da
  mudança de "Valor atual por Ativo" de tabela para accordion (Sprint 26).
- [PRD-025](prd/PRD-025-escala-visual-tela-ativos-cards-dashboard.md) — origem
  da seção "Valor atual por Ativo" no drill-down de Ativos, das cores distintas
  por investimento, do estilo barra+% para Passivos — saldo devedor, da fórmula
  visível em Saldo Acumulado, e da convenção de percentual em listas "valor
  atual".
- [PRD-024](prd/PRD-024-dashboard-layout-cards-navegacao.md) — origem do
  accordion in-place de Patrimônio, do accordion Investimento → Holding, da
  memória de cálculo de Saldo/Saldo Acumulado, da lista de Passivos e da
  cor por ativo — nenhuma mudança de fórmula, só de apresentação/drilldown.
- [PRD-022](prd/PRD-022-manutencao-investimentos-e-drilldown-patrimonio.md) —
  origem do redesenho dos drilldowns de Ativos/Patrimônio (valor atual
  itemizado) e do campo `valor_atual` em `GET /investimentos`.
- [PRD-018](prd/PRD-018-edicao-data-saldo-acumulado-guia-cards.md) — origem
  deste guia, incluindo a investigação com dado real que confirmou que a
  diferença entre Saldo Acumulado e o extrato bancário é conceitual
  (competência vs. snapshot), não um bug.
- [PRD-016](prd/PRD-016-regime-competencia-caixa-patrimonio.md) — origem do
  toggle Competência/Caixa e do conceito de Patrimônio como Saldo Acumulado +
  investimentos + Ativos − Passivos.
- [PRD-015](prd/PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
  — origem de "Saldo inicial" por conta e do Saldo Acumulado.
