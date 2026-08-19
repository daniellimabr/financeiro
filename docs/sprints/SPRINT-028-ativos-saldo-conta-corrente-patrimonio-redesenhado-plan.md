# SPRINT-028: Card Ativos (saldo de conta corrente + total completo) e Patrimônio redesenhado — Plano

- **PRD(s):** [PRD-028-ativos-saldo-conta-corrente-patrimonio-redesenhado.md](../prd/PRD-028-ativos-saldo-conta-corrente-patrimonio-redesenhado.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

O card "Ativos" do Dashboard passa a somar Gestão de Ativos + Investimentos + saldo de contas
correntes (hoje só soma Gestão de Ativos), e seu drilldown troca "Despesas por Ativo" (gasto do
período, fora de lugar) por "Saldo por Conta Corrente". O card "Patrimônio" é redesenhado para
`Ativos − Passivos + Saldo Acumulado do Mês` (3 partes em vez de 4), o que também corrige o bug
relatado pelo CEO: a parcela "Saldo líquido acumulado" de Patrimônio não batia com o card "Saldo
Acumulado" do Dashboard porque somava um termo extra (`_saldo_liquido_fallback`) que o card nunca
mostrava — esse termo deixa de existir no novo desenho.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Extrair `_saldo_investimentos(db, user_id)` do cálculo dedup-safe hoje inline em `_patrimonio_breakdown` (linhas 365-382) | Sonnet: implementação | `backend/app/dashboards/service.py` |
| 2 | Nova `_saldo_contas_correntes(db, user_id)`: soma `PluggyAccount.saldo` filtrando `tipo == PluggyAccountTipo.corrente` | Sonnet: implementação | `backend/app/dashboards/service.py`, `backend/app/models/pluggy.py` (enum) |
| 3 | Nova `_ativos_totais(db, user_id)` = Gestão de Ativos + `_saldo_investimentos` + `_saldo_contas_correntes`; adicionar `ativos_totais` a `Summary`/`get_summary` e a `SummaryOut` | Sonnet: implementação | `backend/app/dashboards/service.py`, `backend/app/schemas/dashboards.py` |
| 4 | Remover `_saldo_liquido_fallback` (única chamada, linha 357) e reescrever `_patrimonio_breakdown`: `ativos_totais`, `passivos`, `saldo_acumulado_mes` (= `get_saldo_acumulado()` do mês atual, sem fallback), `total = ativos_totais - passivos + saldo_acumulado_mes` | Sonnet: implementação | `backend/app/dashboards/service.py` |
| 5 | Atualizar dataclasses `PatrimonioBreakdown`/`Summary` e `PatrimonioBreakdownOut`/`SummaryOut` para os campos novos | Sonnet: implementação | `backend/app/dashboards/service.py`, `backend/app/schemas/dashboards.py` |
| 6 | Grep de confirmação: zero chamadores de `_ativos_e_passivos`/`_patrimonio_breakdown`/`_saldo_liquido_fallback` fora de `dashboards/service.py`/`router.py`; não tocar `app/investimentos/service.py::list_investimentos_com_valor_atual` (cálculo separado, sem dedup, usado por `GET /investimentos`) | Sonnet: implementação | `backend/app/` (grep) |
| 7 | Testes backend: reescrever a seção de testes de `saldo_liquido_acumulado`/`saldo_investimentos`/fallback em `test_dashboards_service.py` (~linhas 2492-2660) e os testes de `/summary`/`/patrimonio/breakdown` em `test_dashboards_endpoints.py`; teste de regressão reproduzindo a fixture do bug relatado (card e Patrimônio batendo em "Saldo Acumulado do Mês") | Sonnet: implementação | `backend/tests/test_dashboards_service.py`, `backend/tests/test_dashboards_endpoints.py` |
| 8 | `frontend/src/api/dashboards.ts`: `DashboardSummary.ativos_totais`, `PatrimonioBreakdown` com os 4 campos novos (`ativos_totais`/`passivos`/`saldo_acumulado_mes`/`total`) | Sonnet: implementação | `frontend/src/api/dashboards.ts` |
| 9 | Novo hook `useSaldoPorConta.ts` sobre `fetchSaldoPorConta` (já existe, sem consumidor hoje) | Sonnet: implementação | `frontend/src/hooks/useSaldoPorConta.ts` (novo), `frontend/src/hooks/usePatrimonioBreakdown.ts` (padrão a seguir) |
| 10 | `DashboardsPage.tsx`: card Ativos lê `ativos_totais`; remover estado `ativosTipo` + bloco "Despesas por Ativo" + função `AtivosAccordion`; novo componente `SaldoContaCorrenteList` (padrão bar+% de `LiabilitiesValorAtualList`, filtra `account_tipo === "corrente"`) como 3ª seção do drilldown de Ativos | Sonnet: implementação | `frontend/src/pages/DashboardsPage.tsx` |
| 11 | `PatrimonioBreakdownPanel`: `PatrimonioParte` vira 3 valores; parte "Ativos" expande em Gestão de Ativos/Investimentos/Saldo por Conta Corrente (reaproveitando `AssetsValorAtualList`/`InvestimentosValorAtualList`/`SaldoContaCorrenteList`); parte "Saldo Acumulado do Mês" mantém o `TrendLineChart variant="card"` existente, só renomeada | Sonnet: implementação | `frontend/src/pages/DashboardsPage.tsx` |
| 12 | Testes frontend: `SUMMARY_FIXTURE` + `ativos_totais`; drilldown de Ativos (3 seções sem toggle Despesa/Receita); `stubPatrimonioBreakdown` + testes do accordion de Patrimônio (3 partes, expandir Ativos mostra as 3 sub-seções, renomear "Saldo líquido acumulado"→"Saldo Acumulado do Mês") | Sonnet: implementação | `frontend/src/pages/DashboardsPage.test.tsx` |
| 13 | QA visual real na VM de dev — `scripts/browser-check/check-sprint28.mjs` (novo): card Ativos com valor completo e drilldown novo (Saldo por Conta Corrente no lugar de Despesas por Ativo); card Patrimônio com 3 partes; "Saldo Acumulado do Mês" batendo com o card "Saldo Acumulado" no mesmo dia — comparação com dado real do CEO, fechando o bug relatado | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 14 | Atualizar `docs/dashboards-guia-cards.md` (seções "Ativos / Passivos" e "Patrimônio") | Haiku: doc-updater | `docs/dashboards-guia-cards.md` |
| 15 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Backend: `_ativos_totais` soma corretamente Gestão de Ativos + Investimentos (dedup-safe,
holdings vs. conta sem holding) + contas tipo corrente, excluindo poupança/cartão/investimento;
`get_summary` retorna `ativos` (inalterado, só Gestão de Ativos) e `ativos_totais` (novo) com
valores distintos numa fixture onde divergem; `_patrimonio_breakdown` soma exatamente `ativos_totais
- passivos + saldo_acumulado_mes`; teste de regressão específico provando que "Saldo Acumulado do
Mês" (Patrimônio) e `GET /dashboards/saldo-acumulado` (card) retornam o mesmo valor para o mesmo
dia/regime. Frontend: drilldown de Ativos mostra as 3 seções corretas na ordem certa, sem o toggle
removido; accordion de Patrimônio com 3 partes, expandir "Ativos" mostra as 3 sub-listas.

## Impacto no roadmap

Cross-epic, sem épico prévio — sprint isolada, sem divisão em partes.

## Riscos / dependências

- `_ativos_totais` recalcula `_ativos_e_passivos` uma vez a mais dentro de `get_summary` (uma query
  extra de `Asset`) — custo desprezível na escala do app, não otimizar preventivamente.
- `SaldoConta.account_tipo` no frontend é `string`, não enum — conferir se já existe um tipo
  compartilhado para `account_tipo` usado em outro lugar do frontend antes de escrever a
  comparação `=== "corrente"` do zero.
- Classe CSS `dash-toggle` (usada pelo toggle Despesa/Receita removido) é reaproveitada por outros
  toggles da página — remover só o uso específico deste drilldown, não a classe.
- 2 testes de `_saldo_liquido_fallback` em `test_dashboards_service.py` são removidos por testarem
  um mecanismo que deixa de existir — cada remoção pareada com um teste novo provando que o valor
  correspondente passa a entrar em `ativos_totais`, para não parecer perda de cobertura sem
  contrapartida.
- Nenhuma migration — mudança é só de agregação/formato de resposta sobre tabelas já existentes.
