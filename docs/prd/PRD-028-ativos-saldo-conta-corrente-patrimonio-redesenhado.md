# PRD-028: Card Ativos (saldo de conta corrente + total completo) e Patrimônio redesenhado

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO usando o app na prática
  pós-Sprint 26)
- **Sprint(s):** [SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-plan.md](../sprints/SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-plan.md)

## Problema

O CEO levantou 3 pontos usando o app na prática:

1. O card **Ativos** do Dashboard tem um drilldown "Despesas por Ativo" que não pertence ali — é
   gasto do período, não composição de patrimônio. Deve sair, dando lugar a um drilldown de
   **saldo de cada conta corrente**.
2. O **total do card Ativos** (hoje R$284.500,00, só soma da Gestão de Ativos) está incompleto — o
   CEO considera "Ativos" tudo que tem como liquidar: Gestão de Ativos (ex.: apartamento ~230k,
   Focus ~35k) **+ Investimentos** (ex.: caixinha Nubank ~67k, caixinha turbo ~10k) **+ saldo das
   contas correntes**.
3. A parcela **"Saldo líquido acumulado"** dentro do card Patrimônio não bate com o card "Saldo
   Acumulado" do Dashboard no mesmo dia (2999,43 no card vs. -8651,04 em competência/-4700,81 em
   caixa dentro de Patrimônio).

## Investigação técnica desta sessão de planejamento

Confirmado por leitura de código (`backend/app/dashboards/service.py`), sem necessidade de
consultar dado ao vivo na VM — a causa do item 3 está inteiramente na lógica, não em dado real
mal-configurado:

- O card "Saldo Acumulado" (`GET /dashboards/saldo-acumulado`) e a parcela "Saldo líquido
  acumulado" de Patrimônio (`_patrimonio_breakdown`) chamam a **mesma** função
  `get_saldo_acumulado()`. Mas `_patrimonio_breakdown` soma por cima um termo extra
  (`_saldo_liquido_fallback`, linha 357): saldo ao vivo de toda conta **sem** "Saldo inicial"
  configurado (com sinal invertido para cartão de crédito, tratado como dívida). O card nunca
  mostra esse termo — daí a divergência.
- `_saldo_liquido_fallback` tem uma única chamada em todo o backend (a de dentro de
  `_patrimonio_breakdown`) — confirmado via grep.
- Ampliar o total de Ativos (item 2) sem redesenhar Patrimônio duplicaria contas
  correntes/investimentos dentro da fórmula atual de Patrimônio (`Ativos + Investimentos + Saldo
  líquido acumulado − Passivos`, sendo que "Saldo líquido acumulado" já carrega saldo de conta via
  o fallback acima).

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-19), via perguntas diretas:

1. **Nova fórmula de Patrimônio:** `Patrimônio = Ativos − Passivos + Saldo Acumulado do Mês`, onde
   "Ativos" já é o número novo e completo do item 2 (Gestão de Ativos + Investimentos + saldo de
   contas correntes) e "Saldo Acumulado do Mês" é exatamente o valor do card "Saldo Acumulado" para
   o mês atual (mesma função `get_saldo_acumulado()`), **sem** o termo extra do fallback — o que
   fecha o bug do item 3 por completo. Investimentos deixa de ser uma parcela solta de Patrimônio
   (passa a viver dentro de "Ativos"); Patrimônio deixa de olhar saldo de conta corrente
   diretamente (só entra via Ativos).
2. O card "Saldo Acumulado" do Dashboard (projeção desde jan/2026) **não muda** — só sai de dentro
   da fórmula de Patrimônio.
3. "Contas correntes", tanto no total de Ativos quanto no novo drilldown, é tratado literalmente
   como `PluggyAccountTipo.corrente` — não inclui poupança nem cartão de crédito.

## Escopo

### Incluído

- Novo campo de total "Ativos" (Gestão de Ativos + Investimentos + saldo ao vivo de contas
  correntes) exposto em `GET /dashboards/summary`, usado pelo card "Ativos" do Dashboard.
- Drilldown do card Ativos perde a seção "Despesas por Ativo" (toggle Despesa/Receita +
  `AtivosAccordion`); ganha uma 3ª seção "Saldo por Conta Corrente" (bar+%, mesmo padrão visual de
  "Passivos — saldo devedor"), usando o endpoint já existente `GET /dashboards/saldo-por-conta`
  (hoje sem nenhum consumidor no frontend) filtrado a contas tipo corrente.
- `GET /dashboards/patrimonio/breakdown` passa de 4 para 3 partes: Ativos (agora o total completo,
  expansível em Gestão de Ativos/Investimentos/Saldo por Conta Corrente), Passivos, Saldo Acumulado
  do Mês (renomeado de "Saldo líquido acumulado", sem o termo de fallback).
- Remoção de `_saldo_liquido_fallback` (dead code após a mudança).

### Fora de escopo (explicitamente)

- Mudar o card "Saldo Acumulado" do Dashboard em si (fórmula/UI) — permanece como está.
- Incluir poupança/cartão de crédito no total de "Ativos" ou no novo drilldown.
- Qualquer alteração em `app/investimentos/service.py::list_investimentos_com_valor_atual` (usado
  por `GET /investimentos`) — cálculo separado, não relacionado a este PRD.
- Migration/schema novo — mudança é só de agregação e formato de resposta sobre tabelas já
  existentes.

## Critérios de aceite

1. Dado o card "Ativos" do Dashboard, então o valor exibido é a soma de Gestão de Ativos (status
   ativo) + Investimentos (valor atual, holdings com o mesmo cálculo dedup-safe já usado em
   Patrimônio) + saldo ao vivo de todas as contas tipo corrente do usuário.
2. Dado o drilldown do card Ativos, então a seção "Despesas por Ativo" não existe mais e uma nova
   seção "Saldo por Conta Corrente" lista cada conta corrente com saldo e percentual do total da
   lista, seguindo a convenção já documentada em "Convenção de percentual em listas 'valor atual'".
3. Dado o card Patrimônio, então o drilldown mostra 3 partes (Ativos, Passivos, Saldo Acumulado do
   Mês) cuja soma (`Ativos − Passivos + Saldo Acumulado do Mês`) bate com o total exibido.
4. Dado o mesmo dia/mês/regime (competência ou caixa), o valor de "Saldo Acumulado do Mês" dentro
   de Patrimônio é **idêntico** ao valor exibido no card "Saldo Acumulado" do Dashboard.
5. Dado dois usuários diferentes, toda query nova respeita isolamento por `user_id`.
6. Dado o CI, a suíte roda 100% verde com cobertura ≥80% nos módulos tocados.

## Regras de negócio

- Nenhuma regra de categorização/competência nova. Mudança é de agregação (quais componentes somam
  em quais totais) e apresentação (drilldown).
- `_saldo_investimentos` (extraída de `_patrimonio_breakdown`) mantém a regra de dedup já existente
  desde a Sprint 20: holdings (`PluggyInvestment.valor_atual`) são a fonte preferencial por item
  Pluggy; conta `tipo=investimento` só entra pelo saldo bruto quando o item não tem holding
  sincronizada.

## Dados e modelo

- Sem tabela nova, sem migration. Consultas novas/alteradas leem `Asset`, `Liability`,
  `PluggyAccount`, `PluggyInvestment` — todas já existentes e já filtradas por `user_id`.

## Segurança

- Isolamento por usuário preservado (nenhuma consulta nova ignora `user_id`).
- Nenhum secret novo introduzido.

## Referências

- [PRD-022 — Manutenção de Investimentos + drilldown completo de Ativos/Patrimônio](PRD-022-manutencao-investimentos-e-drilldown-patrimonio.md)
  — origem da decisão de que o CEO considera Investimentos parte do conceito de "Ativos"; esta
  sprint completa essa visão incluindo saldo de conta corrente também.
- [PRD-016 — Regime competência/caixa em Patrimônio](PRD-016-regime-competencia-caixa-patrimonio.md)
  — origem do conceito de Patrimônio como Saldo Acumulado + Investimentos + Ativos − Passivos,
  substituído nesta sprint pela fórmula de 3 termos.
- [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) — guia dos cards, seções "Ativos /
  Passivos" e "Patrimônio" a reescrever após a execução desta sprint.
- Plano de sessão: `C:\Users\Daniel\.claude\plans\planejar-sprint-28-com-scalable-elephant.md`.
