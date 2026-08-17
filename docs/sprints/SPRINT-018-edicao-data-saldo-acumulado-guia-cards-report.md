# SPRINT-018: Edição Manual de Data + Investigação de Saldo Acumulado + Guia dos Cards — Relatório

- **Plano:** [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md](./SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md)
- **Data do relatório:** 2026-08-17

## Resumo

Bloco 1 (edição manual de data em Categorizar) implementado, testado e
deployado na VM de dev. Bloco 2 (investigação do card "Saldo Acumulado")
virou uma reconciliação de 3 meses (janeiro, fevereiro, março/2026) feita ao
vivo com o CEO, alternando entre consulta a dado real (VM de dev) e ajustes
de categorização/código: **nenhum bug de fórmula em competência** foi
encontrado — o gap inicial de R$7.830,82 (janeiro) era 100% explicado por
regra de negócio já existente (competência de salário) mais uma
miscategorização pontual da fronteira dez/2025↔jan/2026. Mas fevereiro
revelou um **bug real no regime caixa**: o deslocamento fixo de cartão de
crédito (compra+2 meses) e o pagamento real da fatura podiam contar a mesma
compra 2 vezes. Corrigido com mudança de código (não só categorização) —
sob caixa, cartão de crédito passa a ser totalmente excluído, e a própria
transação de "Pagamento de Fatura" conta como despesa na data real. Os 3
meses foram revalidados após o fix e batem exatos com dado real. UI ganhou
nota explicando a diferença conceitual entre Saldo Acumulado (projeção) e
snapshot bancário. Bloco 3 (guia não técnico dos cards) escrito após o
fechamento dos Blocos 1/2.

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Migration `0014`: `data_editada_manualmente` | feito | Sem desvio |
| 2 | Model `PluggyTransaction` ganha `data_editada_manualmente` | feito | Sem desvio |
| 3 | `_upsert_transaction` trava contra resync | feito | Sem desvio |
| 4 | Schema `DateUpdateIn`; `TransactionOut` +`data_editada_manualmente` | feito | `PluggyTransactionOut` (schemas/pluggy.py) também ganhou o campo — necessário pra manter `PluggyTransaction` (TS) estruturalmente compatível com `EditableTransaction`, já que `TransactionsTable.tsx` passa objetos `PluggyTransaction` pros mesmos componentes compartilhados (`DescriptionCell`/`AssetSelectCell`) que agora exigem o campo na interface — não estava explícito no plano, mas é decorrência direta de reaproveitar `EditableTransaction` |
| 5 | `service.update_data()` | feito | Sem desvio |
| 6 | Endpoint `PUT /categorization/transactions/{id}/data` | feito | Sem desvio |
| 7 | `EditableTransaction` +`data`/`data_editada_manualmente`; `updateData()`; `useUpdateDate.ts` | feito | Sem desvio |
| 8 | Componente `DateCell` | feito | Sem desvio |
| 9 | `CategorizationReviewPage.tsx` — coluna Data vira `<DateCell />` | feito | Sem desvio |
| 10 | Testes backend | feito | Sem desvio |
| 11 | Testes frontend | feito | Sem desvio |
| 12 | Deploy VM de dev (Bloco 1) | feito | Sem desvio — CI verde confirmado por SHA antes do pull, migration `0014` confirmada aplicada via `\d pluggy_transactions` |
| 13 | Investigação Bloco 2 | feito, escopo estendido | Investigação se estendeu de janeiro para fevereiro e março (o CEO continuou validando mês a mês) — ver "Investigação do Saldo Acumulado" abaixo |
| 14 | Ação condicional Bloco 2b | feito, com mudança de código não prevista | Janeiro: diferença conceitual confirmada (não bug), resolvida via categorização + nota de UI. Fevereiro: achado um bug real no regime caixa (dupla contagem de compra de cartão entre o modelo de deslocamento e o pagamento real da fatura) — corrigido com mudança de código em `_base_query`, confirmada explicitamente pelo CEO antes de implementar (regra tocava PRD-016). Não foi necessário renomear `drillTitle.saldo` nem mexer em `SaldoPorContaList` — a hipótese original do plano (fatura/limite de cartão como causa da diferença) não se confirmou como o problema de janeiro, mas acabou sendo exatamente a causa raiz do bug de fevereiro, só que no regime caixa |
| 15 | Guia `docs/dashboards-guia-cards.md` | feito | Sem desvio |
| 16 | Docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md`, `CLAUDE.md`) | feito | Sem desvio |
| 17 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend

```
443 passed, 456 warnings in 7.49s
TOTAL                                 1904     38    98%
app\categorization\service.py          ~99%
app\pluggy_integration\service.py      ~98%
app\dashboards\service.py              99%
```

### Frontend

```
Test Files  24 passed (24)
     Tests  166 passed (166)
```

### Lint/formatter

```
backend: ruff check . — All checks passed!
frontend: eslint . — sem erros
frontend: tsc -b — sem erros
frontend: prettier --check . — All matched files use Prettier code style!
```

Cobertura de lógica de negócio: 98% total (meta ≥80%).

## Investigação do Saldo Acumulado — metodologia e resultado

Fonte: dado real da VM de dev (contas Itaú e NuBank do CEO, já reconciliadas
na Sprint 17), consultado via script Python executado dentro do container
`api` (reaproveitando `app.dashboards.service` diretamente, mesma lógica de
produção — não uma reimplementação paralela). O CEO validou mês a mês em
tempo real, ajustando categorias na própria tela Categorizar entre cada
rodada de consulta — a investigação girou 3 vezes (jan → fev → mar) até
fechar.

### Janeiro — diferença conceitual (sem bug)

**Estado inicial reportado pelo CEO:** card "Saldo Acumulado" (competência,
janeiro/2026) não batia com a soma Itaú + NuBank em 31/01/2026.

| Fonte | Valor (R$) |
|---|---|
| `get_saldo_acumulado` (competência, jan/2026) | 2.687,81 |
| `get_evolucao_saldo_por_conta` — Itaú (31/01) | 10.518,33 → 10.913,75 após o CEO editar datas de fim de janeiro (usando a feature do Bloco 1, ao vivo) |
| `get_evolucao_saldo_por_conta` — NuBank Conta Corrente (31/01) | 0,30 |
| **Gap** | **7.830,82** |

Hipótese inicial (card do cartão de crédito) descartada com dado real: o CEO
extraiu a soma de gastos no cartão com evento em janeiro (R$1.283,63,
planilha própria) — bem menor que o gap. Reconciliação transação a transação
(toda transação com `data_competencia` em janeiro) revelou os 2 drivers
reais, que somam exatamente o gap:

| Driver | Valor (R$) | Explicação |
|---|---|---|
| Salário deferido | 9.882,83 | Recebido no Itaú em 30/01/2026 (já no saldo bancário real), mas por competência (dia ≥ cutoff padrão 25) pertence a fevereiro — regra de `competencia_salario` (Sprint 15), funcionando como desenhada |
| Fatura de cartão dez/2025 | −2.052,01 | Transação de 03/01/2026, categorizada "Transferência interna" (excluída de receita/despesa) — reduzia o saldo bancário real mas não o Saldo Acumulado, porque a compra original no cartão (dez/2025, antes do corte de dados) nunca foi sincronizada via Pluggy — sem despesa correspondente em nenhum mês |
| **Soma** | **9.882,83 − 2.052,01 = 7.830,82** | Bate exatamente com o gap |

O CEO recategorizou a transação de R$2.052,01 para "Outras Compras" (ação de
dado, sem código) — depois do fix de fevereiro (abaixo) ela foi revertida
para "Pagamento de Fatura" outra vez, e o número final de janeiro passou a
depender das categorizações feitas ao vivo durante a sessão (ver "Números
finais" no fim desta seção).

### Fevereiro — bug real encontrado no regime caixa

O CEO validou fevereiro usando o regime **caixa**: `11.468,97 − 9.925,60`
(salário pago em 27/02, competência março) `= 1.543,37` esperado; o
dashboard mostrava `1.810,42`, gap de `267,05`. Reconciliação achou 2
transações "Transferência interna" no Itaú que quase se cancelam: um Pix
recebido de +R$1.500 de uma pizzaria (miscategorizado — não é transferência
entre contas próprias, o CEO recategorizou pra "Recebimento de empréstimos")
e um pagamento de fatura de −R$1.767,05.

Ao testar recategorizar o pagamento de fatura pra uma categoria normal (pra
validar o efeito), o regime caixa bateu (`1.543,37`) — mas **competência
quebrou** (caiu pra `-120,92`): a mesma compra de cartão de janeiro passou a
contar 2 vezes em fevereiro — uma pelo modelo (compra+1 mês) e outra pelo
pagamento real da fatura. **Achado real: o regime caixa tinha o mesmo
problema, só que sem o efeito aparecer nesse mês específico** (as compras de
janeiro têm caixa modelado em março, não fevereiro, mascarando a dupla
contagem que aconteceria entre fevereiro-real e março-modelado).

**Causa raiz confirmada, decisão de correção tomada com o CEO** (regra
tocava PRD-016, confirmação explícita antes de implementar — ver "Decisões
tomadas"): sob regime caixa, cartão de crédito deixa de usar o deslocamento
modelado (compra+2 meses) inteiramente; a subcategoria "Pagamento de Fatura"
(já existente, dentro de "Transferência interna") passa a contar como
despesa normal sob caixa, na data real do pagamento. Competência não muda.
Implementado em `app/dashboards/service.py` (`_base_query` ganha parâmetro
`regime`), testado (6 casos novos em `test_dashboards_service.py`),
deployado, revalidado — fevereiro caixa voltou a bater em `1.543,37`,
agora via código, sem precisar de recategorização manual da fatura.

### Março — confirmação do fix + achado de produto (fora de escopo)

Revalidação de março achou outro real, ainda maior: R$10.000 entraram no
NuBank em 20/03 via "Transferência interna" (excluída), sem saída
correspondente do Itaú — resgate de investimento, mesmo padrão já registrado
desde a Sprint 17 ("transferências de/para investimento sem categoria
própria"). O CEO categorizou temporariamente como "Receitas/Outras" para
validar o efeito. Com isso:

```
get_saldo_acumulado (caixa, mar/2026) = R$ 7.653,54
Itaú (31/03, R$10.318,84) + NuBank (31/03, R$7.260,30) − salário (30/03, competência abril, R$9.925,60)
  = 17.579,14 − 9.925,60 = 7.653,54
```

Bate exato (uma primeira comparação do CEO usou por engano o saldo de
fevereiro do Itaú — corrigido durante a sessão). Competência de março também
fechou (`9.850,17`).

### Números finais (pós-fix, dado real na VM de dev)

| Mês | Competência | Caixa |
|---|---|---|
| Janeiro | 3.082,93 | 1.030,92 |
| Fevereiro | 3.698,14 | 1.543,37 |
| Março | 9.850,17 | 7.653,54 |

**Conclusão:** competência nunca teve bug de fórmula — toda a divergência de
janeiro e o resto de fevereiro/março foi dado (miscategorizações pontuais em
fronteiras onde a Pluggy não tem histórico, ou transferências para
investimento sem categoria própria). **Caixa tinha um bug real** (dupla
contagem de compra de cartão), corrigido com mudança de código nesta sprint.
A R$10.000 de março fica sem correção definitiva aqui — decisão explícita do
CEO de tratar como pauta da sprint de investimentos já registrada no
roadmap, não como ajuste pontual.

## Decisões tomadas durante a execução

- **Achado do R$5.000 "Impostos e taxas" (03/01/2026) revisitado, sem
  mudança:** o CEO mencionou essa transação (já flagada na Sprint 17 como
  candidata a "Investimento/Aporte" futuro) como possível causa do gap.
  Verificado que ela conta igualmente nos dois lados da comparação (é uma
  transação real de conta corrente, sem deslocamento de competência) — não
  contribui pro gap. Mantida como está (decisão do CEO: fica "Impostos e
  taxas" até a categoria "Investimento/Aporte" existir).
- **`PluggyTransactionOut` (schemas/pluggy.py) ganhou `data_editada_manualmente`**
  não previsto explicitamente no plano — necessário pra manter
  `EditableTransaction` (TS) estruturalmente válido nos dois pontos onde é
  usado (Categorização e drill-downs do Dashboard/Ativos/Passivos via
  `TransactionsTable.tsx`). Não adiciona edição de data fora da tela
  Categorizar (mantém o escopo do PRD) — só torna o campo legível onde o
  tipo compartilhado já circula.
- **Bloco 2b não seguiu a hipótese original do plano** (renomear
  `drillTitle.saldo`, nota em `SaldoPorContaList` sobre fatura/limite) —
  aquela hipótese assumia que a causa seria o cartão de crédito; a
  investigação de janeiro revelou uma causa diferente (competência de
  salário + miscategorização pontual). A nota de UI foi implementada no
  lugar certo pra causa real: card/drill-down de "Saldo Acumulado", não
  "Saldo".
- **Mudança de regra de negócio em `_base_query` (regime caixa),
  confirmada explicitamente antes de implementar:** a investigação de
  fevereiro achou um bug real (dupla contagem de compra de cartão sob
  caixa), mas a correção tocava uma regra já decidida no PRD-016 (o
  deslocamento fixo compra+2 meses). Apresentado o achado com números reais
  reconciliados, o CEO confirmou a direção do fix (cartão inteiramente fora
  de caixa, "Pagamento de Fatura" conta na data real) antes de qualquer
  código ser escrito — mesmo processo do PRD para "corrigir gap toca regra
  já decidida, volta ao CEO antes de prosseguir".
- **R$10.000 de investimento em março, categorizado temporariamente como
  "Receitas/Outras"** — não é a categorização final (decisão explícita do
  CEO: fica assim até a sprint de investimentos definir a taxonomia certa,
  mesmo item já registrado no roadmap desde a Sprint 17).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Edição de data recomputa competência/caixa e reflete nos dashboards | sim | `test_update_data_*` (service/endpoint), invalidação via `invalidateAfterTransactionEdit` (mesmo hook das demais edições) |
| 2. Data editada sobrevive a resync | sim | `test_resync_preserves_manually_edited_date_on_corrente_account`/`_credit_card_account` |
| 3. Transação não editada continua sendo sobrescrita (regressão) | sim | `test_resync_still_overwrites_date_of_non_manually_edited_transaction` |
| 4. Saldo Acumulado investigado com dado real; bug corrigido ou diferença esclarecida na UI | sim (ambos: diferença conceitual em janeiro + bug real corrigido em fevereiro) | Ver "Investigação do Saldo Acumulado" acima — jan/fev/mar reconciliados com dado real; UI ganhou nota no card + drill-down; bug de dupla contagem em caixa corrigido em `_base_query`, testado, deployado e revalidado |
| 5. Guia `docs/dashboards-guia-cards.md` explicando todos os cards + toggle | sim | [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção "Edição manual de data +
  investigação de Saldo Acumulado + guia dos cards (Sprint 18)" +
  contadores de teste atualizados na seção "Qualidade"
- `docs/roadmap.md` — Sprint 18 fechada, novo item em "Registro de
  reavaliações futuras" (resgate de investimento de março)
- `docs/directory-structure.md` — migration `0014`, arquivos novos
  (`useUpdateDate.ts`, `docs/dashboards-guia-cards.md`), campos/funções
  novos anotados nos arquivos tocados, incluindo `_base_query`/regime caixa
- `CLAUDE.md` — referência ao guia novo na tabela "Onde encontrar cada coisa"
- `docs/dashboards-guia-cards.md` — novo (Bloco 3)

## Consumo estimado de tokens/sessões

Sessão longa, bem acima do padrão das sprints recentes — Bloco 2 se
transformou numa investigação de 3 meses (jan/fev/mar) com múltiplas rodadas
de dado real via SSH (VM de dev), colaboração ao vivo com o CEO (edição de
categorias durante a própria investigação, decisões tomadas em tempo real) e
uma mudança de código não prevista no plano original (regra de negócio de
regime caixa para cartão de crédito).

## Pendências e próximos passos sugeridos

- **Transferências para investimento sem categoria própria** — pendência já
  registrada na Sprint 17 ("Registro de reavaliações futuras" no roadmap),
  reconfirmada 2 vezes nesta investigação (R$2.052,01 em janeiro, R$10.000
  em março). Segue como candidata a sprint futura de `/plan`, sem mudança de
  escopo aqui — mas o padrão já apareceu 2x em 3 meses só nesta sessão,
  reforçando a prioridade.
- **Fronteira dez/2025↔jan/2026 do cartão de crédito** — compras feitas em
  dezembro/2025 (antes do corte de dados) e pagas via fatura em janeiro/2026
  não têm, e nunca terão, sua contraparte de despesa no sistema (não foram
  sincronizadas via Pluggy). Tratamento é caso a caso (recategorizar a
  transação de pagamento, como feito aqui) — não é um padrão recorrente que
  justifique uma heurística automática por ora.
- **R$10.000 de resgate em março segue como "Receitas/Outras"** — categoria
  temporária, não a taxonomia final; deve ser revisitada quando a sprint de
  investimentos (Aporte/Resgate) for planejada.
