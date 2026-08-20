# PRD-032: Saldo Acumulado redefinido como saldo real por conta + conferência de categorização de investimentos

- **Status:** implementado e aprovado pelo CEO em 2026-08-20 (deploy na VM de dev)
- **Épico relacionado:** nenhum (nasceu de uma auditoria manual do CEO, mês a mês contra extratos
  bancários reais — sem sessão de `/plan` prévia)
- **Sprint(s):** [SPRINT-032-saldo-acumulado-saldo-real-e-conferencia-por-conta-plan.md](../sprints/SPRINT-032-saldo-acumulado-saldo-real-e-conferencia-por-conta-plan.md)

## Problema

O CEO auditou o card "Saldo Acumulado" mês a mês (jan/fev/mar de 2026) contra os extratos reais do
Itaú e do NuBank, tentando fechar os valores na casa dos centavos. A investigação (sessão de
conversa, sem sprint formal) achou 3 causas reais de divergência, todas confirmadas com dado real
via SSH na VM de dev:

1. **Rendimentos automáticos do Itaú excluídos por engano.** `_base_query`
   (`backend/app/dashboards/service.py`) exclui qualquer transação cujo `categoria_pluggy` seja
   `"Proceeds interests and dividends"`/`"Taxes on investments"` — regra pensada na Sprint 22 para
   não contar variação de valor de mercado da XP como receita. Só que o Itaú usa o mesmo rótulo da
   Pluggy para os créditos automáticos de um CDB embutido na própria conta corrente
   (`"Rendimentos REND PAGO APLIC AUT MAIS"`) — dinheiro real, já na conta, sendo excluído do
   cálculo. Impacto medido: R$5,28 (jan) + R$1,39 (fev) + R$1,56 (mar) = R$8,23 acumulado até
   março, crescendo todo mês.
2. **Aporte/Resgate de investimento categorizados como "Transferência interna".** Achadas 8
   transações históricas (RDB do NuBank e "Valor recebido/transferido de Investimentos") assim
   categorizadas — o que as exclui dos dashboards, incluindo um resgate de R$10.000,00 em março que
   inflava o card sem que o CEO conseguisse enxergar o motivo.
3. **A própria definição do card divergia da necessidade de conferência bancária do CEO.** O
   desenho atual (âncora de `saldo_inicial` + receita/despesa por competência/caixa, excluindo
   transferências e investimento) mede um "resultado operacional" — não bate com "quanto dinheiro
   eu tenho", que é o que o CEO quer conferir contra o extrato.

## Decisão do CEO (nova definição do Saldo Acumulado — não reabrir sem pedido explícito)

> "Saldo Acumulado = quanto dinheiro eu tenho no fim do mês, menos o salário recebido em conta
> naquele mês (pois ele é competência do mês seguinte)."

Consequências explicitadas pelo CEO durante a auditoria:

- **Aporte/Resgate de investimento são receita/despesa legítima do mês** — devem constar
  normalmente em todos os dashboards (Saldo Acumulado, Receita/Despesa, funis). Não devem ser
  excluídos.
- **"Transferência interna" continua excluída**, mas seu uso correto é só para movimentos reais
  entre contas corrente do próprio usuário — nunca para aporte/resgate de investimento.
- **Cartão de crédito mantém a lógica de competência/caixa como está hoje** — validada, funcionando
  bem, fora de escopo desta sprint.
- **Todas as contas corrente devem entrar no Saldo Acumulado**, inclusive a XP (hoje sem
  `saldo_inicial` configurado, portanto ausente do cálculo).
- **Rendimentos automáticos do Itaú e proventos de investimento da XP recebem o mesmo
  tratamento** — ambos contam como receita/resgate, sem exclusão por categoria bruta da Pluggy (o
  CEO confirmou: a XP também é rendimento real de ações que ele possui lá).

## Investigação — evidência

Reconciliação feita com dado real (script Python rodando `app.dashboards.service` dentro do
container `api` da VM de dev, reaproveitando a lógica de produção — mesmo método usado nas Sprints
17/18) e, para validar que nada mudou por causa do deploy da Sprint 30, comparação direta contra o
backup pré-migration (`~/pre-sprint30-backup.dump`) restaurado num banco descartável (removido ao
final). A fórmula nova, testada manualmente com os dados reais dos 3 meses:

| Mês | Saldo real (soma das contas) | Salário antecipado (competência seguinte) | Resultado | Confere com |
|---|---|---|---|---|
| Jan | 10.913,45 (Itaú) + 0,30 (NuBank) | −9.882,83 | **1.030,92** | Sprint 18 (validado 17/08) |
| Fev | 11.468,67 + 0,30 | −9.925,60 | **1.543,37** | Extrato real do Itaú (CEO) |
| Mar | 10.318,84 + 7.260,30 | −9.925,60 | **7.653,54** | Extrato real Itaú+NuBank (CEO) |

Bate exato nos 3 meses. Abril ficou como pendência aberta (ver "Fora de escopo") — tem uma
anomalia real (duas transações "Salário" no mesmo fim de semana: R$11.118,85 de bônus + R$9.925,60
de salário normal, ambas competência maio, confirmadas como legítimas pelo CEO) que precisa de
validação com a ferramenta nova antes de fechar.

## Escopo

### Incluído

1. **Nova lógica de `get_saldo_acumulado`** (`backend/app/dashboards/service.py`): para cada conta
   corrente do usuário com `saldo_inicial` configurado, soma o saldo real no fim do mês filtrado
   (reaproveitando a lógica de `get_evolucao_saldo_por_conta` — sem nenhum filtro de categoria),
   soma entre contas, e subtrai o valor de qualquer transação da subcategoria "Salário" cuja `data`
   caia no mês filtrado mas `data_competencia` caia no mês seguinte (cobre o caso de múltiplas
   transações de salário no mesmo mês, como abril).
2. **Aposentar o mecanismo de âncora com transação-sentinela** (`_salario_ajuste_dez_2025_...`) —
   fica obsoleto com a fórmula nova (a fórmula nova não precisa de ajuste de baseline, só soma saldo
   real).
3. **Remover a exclusão por `categoria_pluggy`** (`INVESTIMENTO_PROVENTOS_CATEGORIAS_PLUGGY`) de
   `_base_query` (`dashboards/service.py`) e do equivalente em `categorization/service.py` — nem
   Itaú nem XP devem ter proventos excluídos dos dashboards.
4. **Card deixa de variar com o toggle Competência/Caixa** — consequência direta da fórmula nova
   (não depende de regime). O toggle continua existindo e valendo normalmente para os outros cards
   (Receita/Despesa, funis). Confirmar esse comportamento com o CEO ao revisar o plano antes de
   implementar, já que não foi perguntado explicitamente.
5. **Tabela de conferência no drill-down do card Saldo Acumulado**: uma linha "Total em Conta
   Corrente (100%)" + uma linha por conta corrente, sem acordeão (sempre visível, lado a lado),
   colunas: Saldo início do mês, Receitas, Despesas, Saldo fim do Mês, Salário recebido, Saldo
   efetivo. Reaproveita o idioma de tabela unificado (`.dash-table`) e o padrão "grouped table" já
   existente (`SubcategoryGroupTable`, Sprint 30) para o agrupamento Total/por-conta.
6. **Saldo inicial da conta XP** (id 8): configurar via tela existente (Configurações → editar
   conta) com valor **R$421,54** — calculado nesta auditoria (saldo atual R$992,11 menos R$570,57 de
   movimentação real desde 01/01/2026, 30 transações). Ação do CEO na UI, não requer código.
7. Testes cobrindo: fórmula nova batendo com os 3 meses já validados (jan/fev/mar); conta corrente
   sem nenhuma transação no período; múltiplas transações de "Salário" competência-deslocadas no
   mesmo mês (cenário real de abril); conta sem `saldo_inicial` configurado continua fora do
   cálculo.

### Fora de escopo (explicitamente)

- **Recategorizar as 8 transações de Aporte/Resgate hoje em "Transferência interna"** — o CEO faz
  manualmente, fora desta sprint.
- **Fechar a validação de abril/2026** — fica para a próxima sessão de auditoria mês a mês, já
  usando a tabela de conferência nova.
- **Configurar `saldo_inicial` da segunda conta XP** (id 11, sem nenhum movimento desde sempre) —
  decisão do CEO (manter ou remover a conexão), fora do escopo de código.
- **Qualquer mudança em Receita/Despesa/funis além de parar de excluir Aporte/Resgate e proventos de
  investimento** — regime competência/caixa e a lógica de cartão de crédito permanecem intactos,
  validados, sem mudança.

## Critérios de aceite

1. `get_saldo_acumulado` para fev/2026 retorna R$1.543,37; para mar/2026, R$7.653,54 (dado real da
   VM de dev, user_id do CEO) — bate exato com os valores já confirmados nesta auditoria.
2. Uma conta corrente com `saldo_inicial` configurado e zero transações no período aparece no total
   com o próprio `saldo_inicial`, sem erro.
3. Um mês com duas transações de "Salário" competência-deslocadas (caso abril) subtrai as duas do
   saldo real do mês.
4. Transação de Aporte/Resgate conta normalmente em Receita/Despesa e nos funis (nenhuma exclusão
   por categoria de investimento).
5. Transação de proventos automáticos (Itaú ou XP) conta normalmente em Receita/Despesa.
6. Tabela nova no drill-down mostra Total (100%) + uma linha por conta corrente, com as 6 colunas
   pedidas, sem acordeão.
7. Suíte 100% verde, sem regressão, cobertura ≥80% em lógica de negócio nova/alterada.

## Regras de negócio

- Salário antecipado: qualquer transação da subcategoria "Salário" cuja `data` esteja no mês
  filtrado e `data_competencia` no mês seguinte é subtraída do saldo real do mês — sem limite de
  quantidade por mês (mais de uma transação de salário no mesmo mês é um cenário real, não um erro
  de dado).
- Aporte/Resgate de investimento (grupo "Investimentos") é receita/despesa normal — nenhuma
  exclusão de categoria específica para esse grupo.
- "Transferência interna" continua sendo o único grupo com `excluir_de_totais=true` — reservado
  para movimento real entre contas corrente do próprio usuário, nunca para aporte/resgate.
- Contas corrente sem `saldo_inicial` configurado continuam fora do Saldo Acumulado (mesma regra já
  existente) — é responsabilidade do usuário configurar o baseline de cada conta que quiser
  rastrear.

## Dados e modelo

- Nenhuma migration de schema prevista — a mudança é só de lógica de agregação
  (`dashboards/service.py`) e de configuração (`saldo_inicial` da conta XP, feito pela tela
  existente).
- Nenhum dado sensível novo, nenhum secret.

## Segurança

- Sem mudança de isolamento por usuário — as queries já filtram por `user_id`.

## Referências

- Investigação completa: conversa de auditoria de 2026-08-20 (sem sprint própria) — reconciliação
  com dado real via SSH (`scripts/ssh-vm.ps1 dev`), comparação contra backup pré-Sprint 30 para
  confirmar que a migration de categorias por usuário não alterou nenhum valor.
- [docs/sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md](../sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md)
  — reconciliação original de jan/fev/mar, base de comparação desta auditoria.
- [DESIGN.md](../../DESIGN.md) — seção "Table" (`.dash-table` unificado) e "Grouped table"
  (`SubcategoryGroupTable`, Sprint 30), reaproveitados na tabela de conferência nova.
