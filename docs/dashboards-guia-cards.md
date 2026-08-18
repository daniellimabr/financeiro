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
Acumulado. Não afeta o card "Saldo" na versão de snapshot bancário (ver
abaixo) nem o drill-down "Saldo por conta" — esses dois sempre mostram o
saldo atual, sem depender de mês.

## Saldo

Receita menos despesa **do mês/período filtrado** (competência ou caixa,
conforme o toggle). É um resultado de fluxo — "quanto sobrou (ou faltou) nesse
mês" — não é o saldo bancário atual. Exclui fatura de cartão e limite de
crédito (nunca entra aqui).

## Saldo Acumulado

Projeção acumulada desde janeiro/2026: começa do saldo inicial das contas
que têm "Saldo inicial" configurado (tela Configurações) e vai somando o
resultado (receita − despesa) de cada mês, por competência ou caixa. **Não é
o saldo bancário do dia** — é o que o saldo *deveria* ser se todo mundo
pagasse e recebesse exatamente na competência/caixa esperada. Duas
diferenças comuns entre este número e o extrato real do banco:

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

## Ativos / Passivos

Valor atual somado de todos os ativos com status "ativo" (Gestão de Ativos)
e de todos os passivos com status "ativo" (Gestão de Passivos) — sempre
snapshot de hoje, não depende do período filtrado nem do toggle
Competência/Caixa.

## Patrimônio

Soma de 4 partes, sempre snapshot de hoje: Saldo líquido acumulado (o mesmo
conceito do card "Saldo Acumulado", incluindo contas líquidas sem "Saldo
inicial" pelo saldo ao vivo delas) + saldo em investimentos (ao vivo) +
Ativos − Passivos. Clique no card para ver o detalhamento das 4 partes.

O saldo em investimentos passou, na Sprint 20, a somar as **posições/
holdings** sincronizadas via Investments da Pluggy (CDBs, ações, títulos do
Tesouro etc., vinculadas a um Investimento na tela "Gestão de contas") —
essa é a fonte preferencial por item conectado. Só entra pelo saldo bruto da
conta bancária tipo "Investimento" quando aquele item **não** tem nenhuma
posição sincronizada (ex.: item que só expõe a conta genérica, sem holdings
dedicadas) — sem dobrar contagem caso um item retorne as duas fontes.

## Saldo por conta (drill-down do card "Saldo")

Lista o saldo bancário **atual** de cada conta conectada — sempre snapshot de
hoje, nunca depende do mês filtrado nem do toggle Competência/Caixa. Para
conta de cartão de crédito com data de vencimento de fatura conhecida, mostra
a fatura atual (ainda não paga) em vez do saldo bruto da conta; o limite de
crédito aparece entre parênteses ao lado, quando disponível. É o card mais
próximo de "abrir o app do banco agora".

## Referências

- [PRD-018](prd/PRD-018-edicao-data-saldo-acumulado-guia-cards.md) — origem
  deste guia, incluindo a investigação com dado real que confirmou que a
  diferença entre Saldo Acumulado e o extrato bancário é conceitual
  (competência vs. snapshot), não um bug.
- [PRD-016](prd/PRD-016-regime-competencia-caixa-patrimonio.md) — origem do
  toggle Competência/Caixa e do conceito de Patrimônio como Saldo Acumulado +
  investimentos + Ativos − Passivos.
- [PRD-015](prd/PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
  — origem de "Saldo inicial" por conta e do Saldo Acumulado.
