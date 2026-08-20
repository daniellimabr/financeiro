# SPRINT-032: Saldo Acumulado redefinido como saldo real por conta + conferência de categorização de investimentos — Relatório

- **Plano:** [SPRINT-032-saldo-acumulado-saldo-real-e-conferencia-por-conta-plan.md](./SPRINT-032-saldo-acumulado-saldo-real-e-conferencia-por-conta-plan.md)
- **Data do relatório:** 2026-08-20
- **Aprovado pelo CEO em:** _pendente_ — deploy feito na mesma sessão de execução (mesmo padrão da
  Sprint 31, plano já continha o deploy como tarefa da própria sprint); aguardando validação do CEO
  no app real e confirmação da mudança de valor do "Saldo Acumulado" total (ver achado abaixo).

## Resumo

Redefiniu o card "Saldo Acumulado" para medir saldo bancário real por conta corrente (decisão do
CEO após auditoria manual mês a mês contra os extratos do Itaú/NuBank), removeu o mecanismo de
âncora/sentinela e o toggle Competência/Caixa desse card específico, parou de excluir proventos de
investimento (`categoria_pluggy`) dos dashboards e da fila de Categorização, e entregou uma tabela
de conferência (Total + por conta) no drill-down. Implementado, testado, commitado, CI verde
confirmado, deployado na VM de dev e validado com dado real do Postgres.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Nova lógica de `get_saldo_acumulado` | feito | Soma saldo real por conta `tipo=corrente` com `saldo_inicial`, reaproveitando a lógica de `get_evolucao_saldo_por_conta` via novo helper `_saldo_real_por_conta_e_mes` |
| 2 | Remover âncora/sentinela | feito | `_salario_ajuste_dez_2025_pluggy_transaction_id` removida de `dashboards/service.py`; a feature de gravar a transação sentinela (`pluggy_integration/service.py`) continua existindo, só deixou de ser lida por este card |
| 3 | Remover exclusão por `categoria_pluggy` | feito | `INVESTIMENTO_PROVENTOS_CATEGORIAS_PLUGGY` removida de `models/pluggy.py`, `_base_query` e `categorization.service.list_transactions` |
| 4 | Confirmar remoção do toggle Competência/Caixa do card | feito | Confirmado via `AskUserQuestion` no início da sessão — "Sim, remover do card" |
| 5 | Tabela de conferência no drill-down | feito | `SaldoAcumuladoConferenciaTable` — Total (100%) + 1 linha por conta, 6 colunas, sem acordeão |
| 6 | Testes backend — fórmula nova | feito | Reconciliação multi-conta/multi-mês batendo exato com jan/fev/mar já validados; múltiplas transações de salário no mesmo mês; conta sem transação; conta sem `saldo_inicial`; contas não-corrente excluídas |
| 7 | Testes backend — Aporte/Resgate e proventos contando normalmente | feito | `test_get_summary_investimento_proventos_categoria_pluggy_counts_normally`, `test_list_transactions_includes_investimento_proventos_categoria_pluggy`, `test_get_saldo_acumulado_investment_transactions_no_longer_excluded` |
| 8 | Testes frontend — tabela de conferência | feito | `DashboardsPage.test.tsx` — Total + N contas, 6 colunas, sem controle de expandir |
| 9 | Suíte completa + lint/format | feito | Backend 672 testes/99% cobertura; frontend 223 testes; `ruff`/`eslint`/`prettier`/`tsc` limpos |
| 10 | Commit + push | feito | Commit `9bae0f4` |
| 11 | Confirmar CI verde para o commit exato | feito | `GET /repos/daniellimabr/financeiro/actions/runs?branch=main`, `head_sha=9bae0f47...`, `conclusion: success` |
| 12 | Deploy na VM de dev | feito | `git pull` + `docker compose pull` + `docker compose up -d`; `api`/`frontend` recriados, `docker compose ps` reporta `api` `healthy` |
| 13 | Validar ao vivo contra o Postgres real | **feito, com achado** | Ver seção "Achado da validação ao vivo" abaixo — a fórmula bate exato com jan/fev/mar quando restrita a Itaú+NuBank, mas o "Total" já inclui a conta XP (achado: `saldo_inicial` da XP já está configurado ao vivo, com valor diferente do calculado no PRD) |
| 14 | CEO configura `saldo_inicial` da conta XP | **já estava feito** | Ver achado abaixo — não foi uma ação desta sessão |
| 15 | Relatório de sprint + docs vivos | feito | Este relatório + `OVERVIEW.md`/`directory-structure.md`/`dashboards-guia-cards.md`/`DESIGN.md`/`roadmap.md` |

## Achado da validação ao vivo (tarefas 13/14)

Rodando `get_saldo_acumulado`/`get_saldo_acumulado_conferencia` contra o Postgres real da VM de
dev (`user_id=1`, mesmo método das Sprints 17/18/20/21/22 — script Python dentro do container
`api`):

```
02/2026: total = 2094.70
03/2026: total = 8556.12
```

Isso **diverge** do critério de aceite 1 do PRD (fev = R$1.543,37, mar = R$7.653,54). Investigando
via `get_saldo_acumulado_conferencia`, a causa é clara e não é um bug de fórmula:

| Conta | Fev — saldo efetivo | Mar — saldo efetivo |
|---|---|---|
| Itaú | 1.543,07 | 393,24 |
| NuBank | 0,30 | 7.260,30 |
| **Itaú + NuBank** | **1.543,37** ✅ (bate exato com o PRD) | **7.653,54** ✅ (bate exato com o PRD) |
| XP | 551,33 | 902,58 |
| **Total (3 contas)** | **2.094,70** | **8.556,12** |

A soma de Itaú+NuBank bate **exatamente**, ao centavo, com os dois valores já reconciliados no PRD
— confirma que a fórmula nova está correta. A diferença vem inteiramente da conta XP (id 8), que
**já tem `saldo_inicial` configurado ao vivo (R$535,55)** — diferente do valor calculado no PRD
(R$421,54, baseado no saldo atual da conta menos a movimentação real desde 01/01/2026 registrada na
investigação). Como o PRD documentava a XP como "hoje sem `saldo_inicial` configurado" no momento da
investigação (mesmo dia, mais cedo), e a tarefa 14 do plano previa essa configuração como ação do
CEO **depois** da tarefa 13 desta sprint, a configuração já presente no banco não foi feita por esta
sessão — é dado que já estava lá, presumivelmente configurado pelo próprio CEO em algum momento
entre a investigação e agora, com um valor próprio (diferente do que eu tinha calculado).

**Isso não é um problema de código** — é exatamente o comportamento pretendido pelo PRD ("Todas as
contas corrente devem entrar no Saldo Acumulado, inclusive a XP"). O card "Saldo Acumulado" no app
real hoje mostra ~R$2.094,70 (fev) / ~R$8.556,12 (mar), não os valores originalmente citados no PRD
— **pendente de confirmação do CEO** se R$535,55 é o valor correto de `saldo_inicial` pra XP (ou se
foi um valor de teste que precisa ser ajustado).

## Evidência de testes

Backend:

```
app\dashboards\service.py              432      2    99%
app\models\pluggy.py                   150      0   100%
app\categorization\service.py          242      2    99%
------------------------------------------------------------------
TOTAL                                 2830     36    99%
672 passed, 708 warnings in 16.09s
```

Frontend:

```
Test Files  25 passed (25)
     Tests  223 passed (223)
```

Cobertura de lógica de negócio: 99% backend (meta ≥80%).

## Lint/formatter

```
$ ruff check app tests
All checks passed!
$ ruff format --check app tests
90 files already formatted
$ npx eslint src
(sem saída, sem erros)
$ npx tsc --noEmit
(sem saída, sem erros)
$ npx prettier --check src
All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

- **Toggle Competência/Caixa removido do card**: confirmado explicitamente via `AskUserQuestion`
  no início da sessão, conforme o risco já sinalizado no PRD/plano (não tinha sido perguntado
  diretamente ao CEO antes).
- **`_patrimonio_breakdown` chama `get_saldo_acumulado` sem `regime`**: como consequência, o card
  Patrimônio também deixou de variar com o toggle (nenhuma das outras 2 parcelas —
  `ativos_totais`/`passivos` — jamais dependeu de regime). `regime` continua aceito na assinatura de
  `get_patrimonio_breakdown`/`get_summary` (não removido da API pública, fora do escopo desta
  sprint) mas não afeta mais o resultado.
- **`excluir_investimento` removido de `_base_query`/`_receita_despesa_por_periodo`**: parâmetro
  existia só para a fórmula antiga do Saldo Acumulado (comentário original já dizia isso
  explicitamente) — virou código morto com a reescrita, removido.
- **Feature de "ajuste de salário de dezembro" (`pluggy_integration/service.py`) preservada**:
  fora do escopo do plano (arquivos listados eram só `dashboards/service.py`) — continua existindo
  como configuração manual, só deixou de ser lida pelo Saldo Acumulado.
- **Teste de regime×patrimônio reescrito, não deletado**: `test_patrimonio_breakdown_regime_caixa_shifts_accumulation`
  virou `test_patrimonio_breakdown_regime_no_longer_shifts_saldo_acumulado_mes` — documenta o novo
  contrato (competência e caixa produzem o mesmo total) em vez de simplesmente sumir.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `get_saldo_acumulado` fev/2026 = R$1.543,37, mar/2026 = R$7.653,54 (dado real) | **parcial — ver achado acima** | A soma Itaú+NuBank bate exato; o total de 3 contas diverge porque a XP já tem `saldo_inicial` configurado com valor diferente do calculado no PRD (dado fora do controle desta sessão) |
| 2. Conta com `saldo_inicial` e zero transações aparece no total com o próprio `saldo_inicial` | sim | `test_get_saldo_acumulado_conta_sem_transacoes_aparece_com_saldo_inicial` |
| 3. Duas transações de "Salário" competência-deslocadas no mesmo mês subtraem as duas | sim | `test_get_saldo_acumulado_multiplas_transacoes_salario_mesmo_mes_subtrai_as_duas` (cenário exato de abril) |
| 4. Aporte/Resgate conta normalmente em Receita/Despesa e funis | sim | `test_get_summary_investment_aporte_still_counts` (pré-existente, sem regressão) + `test_get_saldo_acumulado_investment_transactions_no_longer_excluded` (novo) |
| 5. Proventos automáticos (Itaú/XP) contam normalmente em Receita/Despesa | sim | `test_get_summary_investimento_proventos_categoria_pluggy_counts_normally` |
| 6. Tabela nova mostra Total (100%) + 1 linha por conta corrente, 6 colunas, sem acordeão | sim | `DashboardsPage.test.tsx` — 2 testes novos (conteúdo da tabela + ausência de `<button>`) |
| 7. Suíte 100% verde, sem regressão, cobertura ≥80% | sim | 672 backend (99%) + 223 frontend, 0 falhas |

## Documentação atualizada

`OVERVIEW.md` (seção nova), `directory-structure.md` (linhas de `dashboards/service.py`,
`dashboards/router.py`, `categorization/service.py`, `models/pluggy.py`,
`schemas/dashboards.py`, hooks e `DashboardsPage.tsx`), `dashboards-guia-cards.md` (seções "toggle",
"Saldo Acumulado", "Receita/Despesa"), `DESIGN.md` (nota sobre o reuso do padrão de borda de
"grouped table"), `roadmap.md` (entrada da Sprint 32 + contador da cadência de auditoria
estrutural).

## Consumo estimado de tokens/sessões

Sprint de porte médio-grande: reescrita de uma função central (`get_saldo_acumulado`) com efeito em
~10 outros testes pré-existentes, endpoint novo, componente de tabela novo no frontend, e um ciclo
completo de deploy+validação com dado real (achado que exigiu investigação adicional). Comparável a
uma sprint técnica grande, mesmo sem migration de schema.

## Pendências e próximos passos sugeridos

1. **CEO confirmar o valor de `saldo_inicial` da conta XP (R$535,55, já configurado ao vivo)** —
   se está correto ou se precisa de ajuste; o Total do card "Saldo Acumulado" no app real hoje é
   ~R$2.094,70 (fev/2026) / ~R$8.556,12 (mar/2026), não os valores originalmente citados no PRD.
2. **Fechar a validação de abril/2026** — usando a nova tabela de conferência, próxima sessão de
   auditoria mês a mês do CEO (já era um "fora de escopo" explícito desta sprint).
3. **Recategorizar as 8 transações de Aporte/Resgate hoje em "Transferência interna"** — ação
   manual do CEO, fora do código, já sinalizada no PRD.
4. **Sem QA visual automatizado (`browser-check`) nesta sprint** — validação ao vivo foi feita via
   script Python contra o Postgres real (mesmo método das sprints anteriores de reconciliação), não
   via navegador. Recomendado que o CEO abra o card "Saldo Acumulado" no app real para confirmar a
   tabela de conferência visualmente antes de aprovar o relatório.
