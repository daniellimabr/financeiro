# SPRINT-018: Edição Manual de Data + Investigação de Saldo Acumulado + Guia dos Cards — Relatório

- **Plano:** [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md](./SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md)
- **Data do relatório:** 2026-08-17

## Resumo

Bloco 1 (edição manual de data em Categorizar) implementado, testado e
deployado na VM de dev. Bloco 2 (investigação do card "Saldo Acumulado")
concluído: **nenhum bug de fórmula encontrado** — o gap de R$7.830,82 entre
o card e o saldo bancário real (Itaú+NuBank, 31/01/2026) foi reconciliado
por completo com dado real e explicado por 2 efeitos que já eram regra de
negócio existente (competência de salário) mais uma miscategorização pontual
da fronteira dez/2025↔jan/2026, corrigida ao vivo pelo CEO durante a
investigação. UI ganhou nota explicando a diferença conceitual. Bloco 3 (guia
não técnico dos cards) escrito após o fechamento dos Blocos 1/2.

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
| 13 | Investigação Bloco 2 | feito | Ver "Investigação do Saldo Acumulado" abaixo |
| 14 | Ação condicional Bloco 2b | feito | Diferença conceitual confirmada (não bug) — UI ganhou tag no card + parágrafo no drill-down explicando a projeção por competência; não foi necessário renomear `drillTitle.saldo` nem mexer em `SaldoPorContaList` (a hipótese original do plano — fatura/limite de cartão como causa — não se confirmou; a causa real foi competência de salário + uma transação miscategorizada, resolvida sem mudança de código) |
| 15 | Guia `docs/dashboards-guia-cards.md` | feito | Sem desvio |
| 16 | Docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md`, `CLAUDE.md`) | feito | Sem desvio |
| 17 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend

```
438 passed, 449 warnings in 7.47s
TOTAL                                 1891     38    98%
app\categorization\service.py          ~99%
app\pluggy_integration\service.py      ~98%
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
produção — não uma reimplementação paralela).

**Estado inicial reportado pelo CEO:** card "Saldo Acumulado" (competência,
janeiro/2026) não batia com a soma Itaú + NuBank em 31/01/2026.

**Passo 1 — números reais:**

| Fonte | Valor (R$) |
|---|---|
| `get_saldo_acumulado` (competência, jan/2026) | 2.687,81 |
| `get_evolucao_saldo_por_conta` — Itaú (31/01) | 10.518,33 → 10.913,75 após o CEO editar datas de fim de janeiro (usando a feature do Bloco 1, ao vivo) |
| `get_evolucao_saldo_por_conta` — NuBank Conta Corrente (31/01) | 0,30 |
| **Gap** | **7.830,82** (após a edição de datas) |

**Passo 2 — hipótese inicial (card do cartão de crédito) descartada com
dado real:** o CEO extraiu a soma de gastos no cartão com evento em
janeiro/2026 (R$1.283,63, planilha própria) — valor muito menor que o gap,
não justificando a diferença. Confirmado: nenhuma transação de cartão tinha
`data_competencia` em janeiro/2026 nesse momento (todas fora da janela).

**Passo 3 — reconciliação transação a transação:** listagem de toda
transação com `data_competencia` em janeiro/2026 (todas as contas não-
investimento) revelou os dois drivers reais, que somam exatamente o gap:

| Driver | Valor (R$) | Explicação |
|---|---|---|
| Salário deferido | 9.882,83 | Recebido no Itaú em 30/01/2026 (já no saldo bancário real), mas por competência (dia ≥ cutoff padrão 25) pertence a fevereiro/2026 — regra de `competencia_salario` (Sprint 15), funcionando como desenhada |
| Fatura de cartão dez/2025 | −2.052,01 | Transação de 03/01/2026, categorizada como "Transferência interna" (grupo excluído de receita/despesa em todo o app) — reduzia o saldo bancário real mas não o Saldo Acumulado, porque a compra original no cartão (dez/2025, antes do corte de dados) nunca foi sincronizada via Pluggy, então não existe despesa correspondente já contabilizada em nenhum mês |
| **Soma** | **9.882,83 − 2.052,01 = 7.830,82** | Bate exatamente com o gap observado |

**Passo 4 — correção e revalidação:** o CEO recategorizou a transação de
R$2.052,01 de "Transferência interna" para "Outras Compras" (ação pontual
via a própria tela Categorizar, sem mudança de código — a compra referente à
fronteira dez/2025↔jan/2026 nunca terá sua contraparte no sistema, então
contar o pagamento da fatura como despesa é o tratamento correto pra esse
caso específico). Após a mudança:

```
get_saldo_acumulado (competência, jan/2026) = R$ 1.031,22
Itaú (31/01) + NuBank Conta Corrente (31/01) − salário deferido
  = 10.913,75 + 0,30 − 9.882,83 = 1.031,22
```

Bate exatamente com a fórmula que o CEO esperava. **Nenhum bug de fórmula ou
de agregação foi encontrado** — as duas regras envolvidas (cutoff de
competência de salário, exclusão de "Transferência interna" de
receita/despesa) já existiam e funcionam como desenhadas desde as Sprints
15/16; o gap era 100% explicado por dado (uma miscategorização pontual da
fronteira de corte de dados) e por uma diferença conceitual esperada
(competência vs. snapshot bancário), não por código incorreto.

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
  investigação revelou uma causa diferente (competência de salário +
  miscategorização pontual). A nota de UI foi implementada no lugar certo
  pra causa real: card/drill-down de "Saldo Acumulado", não "Saldo".

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Edição de data recomputa competência/caixa e reflete nos dashboards | sim | `test_update_data_*` (service/endpoint), invalidação via `invalidateAfterTransactionEdit` (mesmo hook das demais edições) |
| 2. Data editada sobrevive a resync | sim | `test_resync_preserves_manually_edited_date_on_corrente_account`/`_credit_card_account` |
| 3. Transação não editada continua sendo sobrescrita (regressão) | sim | `test_resync_still_overwrites_date_of_non_manually_edited_transaction` |
| 4. Saldo Acumulado investigado com dado real; bug corrigido ou diferença esclarecida na UI | sim (diferença conceitual) | Ver "Investigação do Saldo Acumulado" acima — números reais comparados, causa raiz confirmada, UI ganhou nota no card + drill-down |
| 5. Guia `docs/dashboards-guia-cards.md` explicando todos os cards + toggle | sim | [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção "Edição manual de data +
  investigação de Saldo Acumulado + guia dos cards (Sprint 18)" +
  contadores de teste atualizados na seção "Qualidade"
- `docs/roadmap.md` — Sprint 18 fechada
- `docs/directory-structure.md` — migration `0014`, arquivos novos
  (`useUpdateDate.ts`, `docs/dashboards-guia-cards.md`), campos/funções
  novos anotados nos arquivos tocados
- `CLAUDE.md` — referência ao guia novo na tabela "Onde encontrar cada coisa"
- `docs/dashboards-guia-cards.md` — novo (Bloco 3)

## Consumo estimado de tokens/sessões

Sessão única, acima do padrão das sprints recentes — Bloco 2 envolveu
múltiplas rodadas de investigação com dado real via SSH (VM de dev) e
colaboração ao vivo com o CEO (edição de dados durante a própria
investigação), em vez de um ciclo único de implementação.

## Pendências e próximos passos sugeridos

- **Transferências para investimento sem categoria própria** — pendência já
  registrada na Sprint 17 ("Registro de reavaliações futuras" no roadmap),
  reconfirmada por esta investigação (a transação de R$2.052,01 tratada aqui
  é do mesmo tipo — fluxo de/para investimento sem taxonomia própria). Segue
  como candidata a sprint futura de `/plan`, sem mudança de escopo aqui.
- **Fronteira dez/2025↔jan/2026 do cartão de crédito** — compras feitas em
  dezembro/2025 (antes do corte de dados) e pagas via fatura em janeiro/2026
  não têm, e nunca terão, sua contraparte de despesa no sistema (não foram
  sincronizadas via Pluggy). Tratamento é caso a caso (recategorizar a
  transação de pagamento, como feito aqui) — não é um padrão recorrente que
  justifique uma heurística automática por ora.
