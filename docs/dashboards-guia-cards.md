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

O toggle afeta Receita, Despesa, Saldo, Ativos, Passivos e Patrimônio. Desde
a Sprint 32, **não afeta mais o Saldo Acumulado** — a fórmula nova sempre usa
a data real de cada transação, não a competência/caixa.

## Saldo

Receita menos despesa **do mês/período filtrado** (competência ou caixa,
conforme o toggle). É um resultado de fluxo — "quanto sobrou (ou faltou) nesse
mês" — não é o saldo bancário atual. Exclui fatura de cartão e limite de
crédito (nunca entra aqui). Clicar no card abre a memória de cálculo
(Receita − Despesa = Saldo, os mesmos três números já carregados no resumo).

## Saldo Acumulado

Redefinido na Sprint 32: **quanto dinheiro o CEO tem, de fato, nas contas
corrente no fim do mês** — soma o saldo real (saldo inicial + todo movimento
real, sem exclusão de categoria nenhuma) de cada conta **tipo "corrente"**
com "Saldo inicial" configurado (tela Configurações), e subtrai qualquer
transação da subcategoria "Salário" cuja data caia no mês mas cuja
competência caia no mês seguinte (o dinheiro já está na conta, mas "pertence"
ao próximo mês). Só conta corrente entra — poupança, cartão de crédito e
conta de investimento nunca entram aqui, mesmo com "Saldo inicial"
configurado. **Não depende mais do toggle Competência/Caixa** — a fórmula
sempre usa a data real de cada transação.

Diferente da versão anterior (Sprint 15–28), este número bate com o extrato
bancário real: Aporte/Resgate de investimento e proventos automáticos (ex.:
rendimento de CDB embutido em conta corrente, dividendo/JCP de corretora) já
contam normalmente, sem exclusão por `categoria_pluggy` — são dinheiro real
que entrou ou saiu da conta.

Uma tabela de conferência fica sempre visível na tela (painel "Conciliação",
acima do drill-down — nenhum clique necessário, desde a Sprint 34): uma linha
"Total em Conta Corrente (100%)" + uma linha por conta corrente, com as
colunas Saldo início do mês, Receitas, Despesas, Saldo fim do mês, Salário
recebido e Saldo efetivo (= Saldo fim − Salário recebido) — pensada para
conferência manual contra o extrato do banco, mês a mês, sem precisar de
SSH/consulta direta ao banco. O drill-down do card (clique no KPI) continua
existindo à parte, com o gráfico de tendência maior e a nota explicativa —
mas não duplica mais a tabela.

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

Desde a Sprint 32, dividendo/JCP/taxa de investimentos administrados por
corretora (`categoria_pluggy` da Pluggy: "Proceeds interests and dividends" /
"Taxes on investments") **voltou a contar normalmente** em Receita/Despesa e
na fila de Categorização — o CEO decidiu que é dinheiro real (rendimento
efetivo, seja do Itaú ou da XP) e deve ser categorizado como qualquer outra
transação, revertendo a exclusão fixada na Sprint 22. Aporte/resgate de
investimento também contam normalmente (categoria "Investments", distinta) —
decisão fixada desde a Sprint 19, sem mudança nesta sprint.

### "Ocultar gasto" (simulação) e gráfico comparativo por categoria

Desde a Sprint 27, dentro do funil Despesa/Receita aberto no Dashboard:

- **Ocultar gasto:** cada linha de transação (na tabela do nível mais
  profundo do funil) tem um ícone de binóculo — clicar marca a transação como
  "oculta" e ela sai do total exibido no Row de grupo e de subcategoria (e do
  mini gráfico de tendência daquele Row, só no ponto do mês/ano atualmente
  filtrado), sem chamada de rede nova. Os cards **Receita/Despesa/Saldo** do
  topo também recalculam ao vivo (mesmo dado do período filtrado, ajustado no
  cliente) — pedido explícito do CEO ao ver o resultado em uso: sem isso não
  dava pra visualizar o impacto real de uma linha oculta no total do mês.
  **Patrimônio e Saldo Acumulado nunca mudam** — vêm de fórmulas sem relação
  direta com "ocultar uma linha de gasto do mês" (patrimônio líquido, saldo
  bancário acumulado), escopo mantido de fora deliberadamente. Estado 100%
  local/efêmero (mesmo padrão de `applyHipoteticas` da tela Projeção, Sprint
  14) — reseta sozinho ao fechar o funil ou trocar o filtro de ano/mês, nunca
  persiste entre sessões.
- **Gráfico comparativo por categoria:** ao abrir o funil Despesa ou Receita,
  aparece um gráfico de área empilhada com a composição de gasto por grupo
  de categoria ao longo dos últimos meses (mesma janela do seletor de
  histórico 3/6/12). Reaproveita o dado de tendência por subcategoria já
  buscado pelo funil (`GET /dashboards/por-categoria/tendencia`, somado por
  grupo) — sem endpoint novo. Independente do "ocultar gasto": mostra a série
  histórica real, não a simulação do mês aberto.

### Indicador de Orçado-vs-Realizado (Sprint 30)

Desde a Sprint 30, cada linha de **Subcategoria** (nível mais detalhado) nos
funis Despesa e Receita do Dashboard mostra um indicador de orçamento, se houver
um orçamento vigente para aquela subcategoria no mês filtrado. O valor sempre
ganha uma legenda muda com o total orçado ("de R$X orçado", abaixo do valor
realizado); a barra de proporção (`.track`) e o símbolo direcional só aparecem
quando o realizado está **fora** do orçado:

- **▲ em Despesa**: gasto ultrapassou o orçado (estourou) — barra ganha contorno
  (`outline`) e a legenda muda vira "estourou o orçado".
- **▼ em Receita**: receita não atingiu o orçado (ficou aquém) — mesmo contorno,
  legenda "abaixo do orçado".
- Dentro do orçado (ambos os tipos): sem contorno, sem símbolo — só a legenda
  muda com o valor orçado.

O CEO escolheu este design (via uma rodada Impeccable/Artifact) em vez de
introduzir uma nova cor semântica (âmbar/"alerta"), mantendo a paleta restrita
e preservando a regra de "um significado por cor" já documentada em `DESIGN.md`.

## Ativos / Passivos

**Ativos** (desde a Sprint 28) é a soma de tudo que o CEO considera "com o
que pode contar": Gestão de Ativos (status "ativo") + Investimentos (valor
atual, mesmo cálculo dedup-safe usado em Patrimônio) + saldo ao vivo de
todas as contas **tipo "corrente"** — poupança e cartão de crédito ficam de
fora dessa soma. **Passivos** continua sendo só a soma dos passivos com
status "ativo" (Gestão de Passivos). Ambos são sempre snapshot de hoje, não
dependem do período filtrado nem do toggle Competência/Caixa.

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
  - "Saldo por Conta Corrente" (Sprint 28, substitui "Despesas por Ativo" —
    gasto do período, que não pertencia a um card de composição de
    patrimônio): lista visual barra+%, mesmo estilo de "Passivos — saldo
    devedor", com o saldo ao vivo de cada conta tipo "corrente" e a
    percentagem que representa do total dessa lista. Usa o endpoint `GET
    /dashboards/saldo-por-conta`, filtrado no frontend a `account_tipo ===
    "corrente"`.

- **Passivos**: o drill-down mostra duas seções:
  - Accordion de gasto por passivo (período filtrado, mesmo padrão do Ativos).
  - "Passivos — saldo devedor": lista visual (Sprint 25) com barras proporcionais
    e percentagem que cada passivo representa do total de passivos devedor. Usa
    uma cor fixa (terracotta/var(--despesa)), sem cores distintas por item e sem
    interatividade de expansão — apenas o estilo barra+% para leitura visual
    rápida.

## Patrimônio

Desde a Sprint 28, soma de **3 partes**, sempre snapshot de hoje: **Ativos −
Passivos + Saldo Acumulado do Mês**, onde "Ativos" já é o total completo do
card acima (Gestão de Ativos + Investimentos + saldo de contas correntes) e
"Saldo Acumulado do Mês" é exatamente o valor do card "Saldo Acumulado" (ver
seção acima) para o mês atual — mesma função de cálculo, sem nenhum termo
extra. Clique no card para ver o detalhamento das 3 partes, num **accordion
expansível in-place** (cada parte expande dentro do próprio painel de
Patrimônio, sem sair dele; padrão desde a Sprint 24):

- **Ativos** → expande em 3 sub-seções, reaproveitando os mesmos componentes
  do drill-down do card Ativos: Gestão de Ativos (`GET /assets`, filtrado por
  `status=ativo`), Investimentos (`GET /investimentos`, valor atual
  dedup-safe) e Saldo por Conta Corrente (`GET /dashboards/saldo-por-conta`,
  filtrado a `tipo=corrente`).
- **Passivos** → lista de passivos ativos com saldo devedor (`GET
  /liabilities`, filtrado por `status=ativo`).
- **Saldo Acumulado do Mês** (renomeado de "Saldo líquido acumulado") →
  mesmo gráfico de tendência de antes (`TrendLineChart` variant="card" desde
  a Sprint 26), agora sem o termo extra que causava divergência com o card
  "Saldo Acumulado" (ver abaixo).

**Bug corrigido nesta sprint:** antes da Sprint 28, a parcela "Saldo líquido
acumulado" somava, por cima do mesmo cálculo do card "Saldo Acumulado", um
termo extra (saldo ao vivo de toda conta líquida sem "Saldo inicial"
configurado) que o card "Saldo Acumulado" nunca mostrava — daí o card e o
Patrimônio divergirem no mesmo dia. Esse termo foi removido; contas sem
"Saldo inicial" continuam entrando em Patrimônio, mas agora só via "Ativos"
(se forem conta corrente) ou não entram (poupança/cartão de crédito sem
"Saldo inicial" simplesmente não compõem Patrimônio, mesmo tratamento que já
valia pro card "Saldo Acumulado"). Investimentos deixou de ser uma parcela
solta de Patrimônio — passou a viver dentro de "Ativos".

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

- [PRD-032](prd/PRD-032-saldo-acumulado-saldo-real-e-conferencia-por-conta.md) —
  redefinição do Saldo Acumulado como saldo real por conta corrente, fim da
  exclusão de proventos de investimento por `categoria_pluggy`, e a tabela
  de conferência no drill-down.
- [PRD-028](prd/PRD-028-ativos-saldo-conta-corrente-patrimonio-redesenhado.md) —
  origem do total completo de "Ativos" (Gestão de Ativos + Investimentos +
  saldo de contas correntes), da seção "Saldo por Conta Corrente" no
  drill-down de Ativos, e do redesenho de Patrimônio para 3 partes (Ativos −
  Passivos + Saldo Acumulado do Mês), que corrigiu a divergência entre
  "Saldo líquido acumulado" e o card "Saldo Acumulado".
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
