# SPRINT-028: Card Ativos (saldo de conta corrente + total completo) e Patrimônio redesenhado — Relatório

- **Plano:** [SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-plan.md](./SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-plan.md)
- **Data do relatório:** 2026-08-19
- **Status:** aprovado pelo CEO em 2026-08-19

## Resumo

O card "Ativos" do Dashboard passou a somar Gestão de Ativos + Investimentos (dedup-safe) +
saldo ao vivo de contas tipo "corrente" (antes só Gestão de Ativos); seu drilldown trocou a
seção "Despesas por Ativo" (gasto do período, fora de lugar num card de composição de
patrimônio) por "Saldo por Conta Corrente". O card "Patrimônio" foi redesenhado de 4 para 3
partes — `Ativos − Passivos + Saldo Acumulado do Mês` — removendo o termo extra
(`_saldo_liquido_fallback`) que fazia a parcela "Saldo líquido acumulado" divergir do card
"Saldo Acumulado" no mesmo dia. Validado ao vivo contra dado real da VM de dev (desktop,
claro+escuro): "Saldo Acumulado do Mês" (R$ 2.999,43) bate exatamente com o card "Saldo
Acumulado" — o bug relatado pelo CEO está fechado.

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Extrair `_saldo_investimentos(db, user_id)` do cálculo dedup-safe inline | feito | Sem mudança de comportamento, só extração |
| 2 | Nova `_saldo_contas_correntes(db, user_id)` | feito | Soma `PluggyAccount.saldo` filtrando `tipo == corrente` |
| 3 | Nova `_ativos_totais`; campo `ativos_totais` em `Summary`/`SummaryOut` | feito | `ativos` (só Gestão de Ativos) mantido intocado ao lado do novo campo |
| 4 | Remover `_saldo_liquido_fallback`; reescrever `_patrimonio_breakdown` | feito | `ativos_totais − passivos + saldo_acumulado_mes`, `saldo_acumulado_mes` = `get_saldo_acumulado()` do mês atual, sem fallback |
| 5 | Atualizar dataclasses/schemas Pydantic | feito | `PatrimonioBreakdown`/`PatrimonioBreakdownOut` viram `ativos_totais`/`passivos`/`saldo_acumulado_mes`/`total` |
| 6 | Grep de confirmação (sem chamador externo, `list_investimentos_com_valor_atual` intocado) | feito | Confirmado — só `dashboards/service.py`/`router.py`/`schemas/dashboards.py` referenciam os símbolos alterados |
| 7 | Testes backend | feito | `test_dashboards_service.py`: 2 testes existentes reescritos (novos valores) + 8 novos/renomeados na seção de Patrimônio, cada remoção de teste de fallback pareada com um teste novo provando o valor entrando em `ativos_totais`; `test_dashboards_endpoints.py` atualizado; teste de regressão explícito comparando `saldo_acumulado_mes` com `get_saldo_acumulado()` |
| 8 | `frontend/src/api/dashboards.ts` | feito | `DashboardSummary.ativos_totais`, `PatrimonioBreakdown` com os 4 campos novos |
| 9 | Novo hook `useSaldoPorConta.ts` | feito | Mesmo padrão de `usePatrimonioBreakdown.ts` |
| 10 | `DashboardsPage.tsx`: card Ativos + drilldown | feito | Lê `ativos_totais`; `ativosTipo`/`AtivosAccordion`/toggle removidos; `SaldoContaCorrenteList` novo (padrão `LiabilitiesValorAtualList`) |
| 11 | `PatrimonioBreakdownPanel`: 3 partes | feito | "Ativos" expande em Gestão de Ativos/Investimentos/Saldo por Conta Corrente (3 sub-listas reaproveitadas); "Saldo Acumulado do Mês" mantém o `TrendLineChart` existente, só renomeada |
| 12 | Testes frontend | feito | `SUMMARY_FIXTURE.ativos_totais`; drilldown de Ativos (3 seções sem toggle); `stubPatrimonioBreakdown` + accordion de 3 partes, Ativos expandindo as 3 sub-seções, rótulo renomeado |
| 13 | QA visual real na VM de dev | feito | `check-sprint28.mjs` — ver "Evidência de testes"; 0 falhas, 0 erros de console, desktop claro+escuro |
| 14 | Atualizar `docs/dashboards-guia-cards.md` | feito | Seções "Ativos / Passivos" e "Patrimônio" reescritas; referência a PRD-028 adicionada |
| 15 | Relatório de sprint | feito | Este documento |

## Evidência de testes

Backend (`pytest`, suíte completa):

```
602 passed, 663 warnings in 13.08s
TOTAL: 2594 stmts, 46 miss, 98% cover
app/dashboards/service.py     334 stmts,  3 miss, 99%
app/schemas/dashboards.py      40 stmts,  0 miss, 100%
```

Frontend (`vitest run`, suíte completa):

```
 Test Files  25 passed (25)
      Tests  211 passed (211)
```

QA visual ao vivo (`check-sprint28.mjs`, contra dado real do CEO na VM de dev):

```
[desktop-claro] done
[desktop-escuro] done
done, sem erros de console, sem falhas de asserção
```

Conferido manualmente nos screenshots (`s28-01/02/03`, claro+escuro): card Ativos =
R$ 378.662,10 = Gestão de Ativos (R$ 284.500,00) + Investimentos (R$ 91.196,07) + Saldo por
Conta Corrente (R$ 2.966,03); Patrimônio = R$ 378.662,10 − R$ 65.000,00 + R$ 2.999,43 =
R$ 316.661,53 (bate com o total exibido); "Saldo Acumulado do Mês" dentro de Patrimônio e o
card "Saldo Acumulado" mostram o mesmo valor exato, R$ 2.999,43 — fechando o bug relatado
pelo CEO (item 3 do PRD).

## Lint/formatter

```
$ ruff check app tests          → All checks passed!
$ ruff format --check app tests → 1 file reformatted (aplicado), depois: 80 files já formatados
$ npx eslint .                  → sem saída, 0 erros
$ npx tsc -b                    → sem saída, 0 erros
$ npx prettier --check .        → All matched files use Prettier code style!
```

Pre-commit local (`ruff`, `ruff-format`, `eslint`, `detect-secrets`) passou no commit.

## Decisões tomadas durante a execução

- **`_ativos_totais` recalcula `_ativos_e_passivos` uma vez a mais dentro de `get_summary` e
  de `_patrimonio_breakdown`** (uma query extra de `Asset`/`Liability`) — risco já aceito no
  plano, não otimizado preventivamente (custo desprezível na escala do app).
- **Testes de dedup de holdings (`saldo_investimentos`) migrados para testar
  `service._saldo_investimentos` diretamente**, em vez de passar por
  `get_patrimonio_breakdown().saldo_investimentos` — esse campo não existe mais na resposta
  pública (`PatrimonioBreakdown` só expõe `ativos_totais`/`passivos`/`saldo_acumulado_mes`/
  `total`), mas a regra de dedup em si (holdings preferencial, conta só quando item não tem
  holding) continua exatamente igual e precisava de cobertura direta — padrão já usado no
  arquivo para outras funções privadas (`_percentual`, `_subtract_month`, etc.).
- **`test_get_summary_patrimonio_subtracts_cartao_credito_balance` virou
  `test_get_summary_patrimonio_reflects_saldo_conta_corrente_via_ativos`, com asserção
  diferente (700,00 → 1000,00).** Mudança de comportamento real, não só de nome: sob a
  fórmula antiga, cartão de crédito sem "Saldo inicial" entrava em Patrimônio pelo fallback
  removido (saldo ao vivo, com sinal invertido, subtraindo como dívida). Sob a fórmula nova,
  cartão de crédito nunca é "conta corrente" (PRD-028 critério 3) e não tem esse fallback —
  sem "Saldo inicial", simplesmente não entra em Patrimônio nenhum. Decisão do CEO (não uma
  escolha de implementação): confirmada explicitamente na sessão de planejamento como
  consequência aceita de remover o termo extra.
- **Sub-headings dentro do painel expandido de "Ativos" em Patrimônio usam `<h3>`**, mesmo
  nível dos headings do drilldown de Ativos (não `<h4>`, que não tem estilo definido em
  `index.css` — usar um nível sem CSS próprio teria criado inconsistência visual não pedida
  pelo plano).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Card "Ativos" = Gestão de Ativos (ativo) + Investimentos (dedup-safe) + saldo ao vivo de contas corrente | sim | `_ativos_totais` (backend, testado); confirmado ao vivo: R$ 284.500 + R$ 91.196,07 + R$ 2.966,03 = R$ 378.662,10 (`s28-01`) |
| 2. Drilldown de Ativos sem "Despesas por Ativo"; nova seção "Saldo por Conta Corrente" com % da lista | sim | `s28-01-ativos-drilldown.png`; headings testados em `DashboardsPage.test.tsx`; convenção de percentual (Sprint 25) reaproveitada em `SaldoContaCorrenteList` |
| 3. Patrimônio com 3 partes cuja soma bate com o total | sim | `s28-02`: Ativos R$ 378.662,10 − Passivos R$ 65.000,00 + Saldo Acumulado do Mês R$ 2.999,43 = R$ 316.661,53 = total exibido |
| 4. "Saldo Acumulado do Mês" idêntico ao card "Saldo Acumulado" no mesmo dia/mês/regime | sim | Ambos mostram R$ 2.999,43 em `s28-02`/`s28-03`; teste de regressão explícito no backend comparando as duas fontes |
| 5. Toda query nova respeita isolamento por `user_id` | sim | `_saldo_contas_correntes`/`_saldo_investimentos`/`_ativos_totais` todas filtram por `user_id`; sem consulta nova sem esse filtro |
| 6. CI 100% verde, cobertura ≥80% nos módulos tocados | sim | 602/602 backend (99% em `dashboards/service.py`), 211/211 frontend |

## Documentação atualizada

- `docs/dashboards-guia-cards.md` — seções "Ativos / Passivos" e "Patrimônio" reescritas
  (total completo de Ativos, nova seção "Saldo por Conta Corrente", fórmula de 3 partes de
  Patrimônio, explicação do bug corrigido); referência a PRD-028 adicionada.
- `docs/roadmap.md` — não tocado nesta sessão de execução; fechamento fica para a aprovação
  do CEO, mesmo padrão de sprints anteriores.

## Consumo estimado de tokens/sessões

Sprint de porte médio-alto: reescrita de lógica de agregação em `dashboards/service.py` +
schemas + ~15 testes backend (2 reescritos, 8 novos) + 4 arquivos frontend (2 novos) + ~6
testes frontend reescritos, mais 1 ciclo completo de deploy (push → CI → VM de dev → mint de
token pausado pra aprovação → QA visual). QA ao vivo passou de primeira, sem achado real
exigindo correção — coube confortavelmente numa única sessão de execução.

## Pendências e próximos passos sugeridos

Nenhuma pendência conhecida. Sprint 27 ("Ocultar gasto" + comparativo de categorias) já tem
PRD/plano aprovados e é a próxima da fila, conforme pedido do CEO no início desta sessão.
