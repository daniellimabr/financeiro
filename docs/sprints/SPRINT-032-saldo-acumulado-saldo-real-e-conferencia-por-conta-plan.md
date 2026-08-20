# SPRINT-032: Saldo Acumulado redefinido como saldo real por conta + conferência de categorização de investimentos — Plano

- **PRD(s):** [PRD-032-saldo-acumulado-saldo-real-e-conferencia-por-conta.md](../prd/PRD-032-saldo-acumulado-saldo-real-e-conferencia-por-conta.md)
- **Data do plano:** 2026-08-20

**Nota:** plano escrito na mesma sessão da investigação (auditoria mês a mês do CEO contra
extratos reais, sem sessão de `/plan` prévia) — mesmo padrão retroativo das Sprints 30/31. Execução
prevista para uma sessão nova (`/clear`), conforme pedido do CEO.

## Objetivo da sprint

Redefinir o card "Saldo Acumulado" para medir saldo bancário real (por conta, ajustado só por
salário antecipado), parar de excluir Aporte/Resgate e proventos de investimento dos dashboards, e
entregar uma tabela de conferência no drill-down que facilite auditorias futuras mês a mês sem
precisar de SSH/consulta direta ao banco.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Nova lógica de `get_saldo_acumulado`: soma saldo real por conta corrente (reaproveita `get_evolucao_saldo_por_conta`, sem filtro de categoria) menos transações "Salário" competência-deslocadas para o mês seguinte | Sonnet: implementação | `backend/app/dashboards/service.py` |
| 2 | Remover mecanismo de âncora/sentinela (`_salario_ajuste_dez_2025_pluggy_transaction_id`, ancora com `soma_saldo_inicial - valor_sentinela`) — obsoleto com a fórmula nova | Sonnet: implementação | `backend/app/dashboards/service.py` |
| 3 | Remover exclusão por `categoria_pluggy` (`INVESTIMENTO_PROVENTOS_CATEGORIAS_PLUGGY`) de `_base_query` e do uso equivalente em categorization | Sonnet: implementação | `backend/app/dashboards/service.py`, `backend/app/categorization/service.py` |
| 4 | Confirmar com o CEO: card deixa de expor toggle Competência/Caixa (fórmula nova não depende de regime) — ajustar endpoint/schema e frontend de acordo | Sonnet: implementação (confirmar antes via `AskUserQuestion` se não foi respondido no plano) | `backend/app/dashboards/router.py`, `frontend/src/hooks/useDashboardSaldoAcumulado.ts` |
| 5 | Tabela de conferência no drill-down: Total (100%) + linha por conta corrente, colunas Saldo início/Receitas/Despesas/Saldo fim/Salário recebido/Saldo efetivo — sem acordeão, reaproveitando `.dash-table` + padrão "grouped table" (`SubcategoryGroupTable`, Sprint 30) | Sonnet: implementação | `frontend/src/pages/DashboardsPage.tsx`, `frontend/src/components/SubcategoryGroupTable.tsx` (referência de padrão) |
| 6 | Testes backend: fórmula nova batendo com jan/fev/mar (dado real ou fixture equivalente); múltiplas transações "Salário" no mesmo mês; conta sem transações no período; conta sem `saldo_inicial` continua fora | Sonnet: implementação | `backend/tests/test_dashboards_service.py` |
| 7 | Testes backend: Aporte/Resgate e proventos de investimento contam normalmente em Receita/Despesa/funis (regressão dos testes que hoje esperam exclusão) | Sonnet: implementação | `backend/tests/test_dashboards_service.py`, `backend/tests/test_categorization_service.py` |
| 8 | Testes frontend: tabela de conferência renderiza Total + linhas por conta, com as 6 colunas | Sonnet: implementação | `frontend/src/pages/DashboardsPage.test.tsx` |
| 9 | Suíte completa + lint/format (backend e frontend) | Sonnet: implementação | `backend/`, `frontend/` |
| 10 | Commit + push (branch `main`, autorizado) | Sonnet: implementação | — |
| 11 | Confirmar CI verde (`conclusion: success`) para o commit exato antes de tocar a VM | Sonnet: implementação | `docs/infra/ssh-workflow.md` |
| 12 | Deploy na VM de dev: `git pull` + `docker compose pull` + `docker compose up -d` (sem migration nesta sprint) | Sonnet: implementação (SSH livre, VM de dev) | `docs/infra/ssh-workflow.md` |
| 13 | Validar ao vivo: `get_saldo_acumulado` fev/2026 = R$1.543,37 e mar/2026 = R$7.653,54 contra o Postgres real | Sonnet: implementação | — |
| 14 | CEO configura `saldo_inicial` da conta XP (R$421,54) pela tela existente — confirmar que a conta passa a aparecer na tabela de conferência | CEO (fora do código) | Tela Configurações → editar conta |
| 15 | Relatório de sprint + docs vivos (`OVERVIEW.md`, `directory-structure.md`, `dashboards-guia-cards.md`, `roadmap.md`) | Sonnet: implementação | — |

## Coerência de Design (DESIGN.md)

Sprint toca UI (tabela nova no drill-down do Saldo Acumulado). Reaproveita dois padrões já
existentes e documentados, sem introduzir idioma visual novo:

- **`.dash-table`** (idioma unificado de tabela, Sprint 13) — colgroup fixo, mesma linguagem de
  todas as outras tabelas do app.
- **"Grouped table"** (`SubcategoryGroupTable`, Sprint 30) — separador de borda entre grupos, já
  validado para o caso "linhas agrupadas por uma entidade pai sem perder a posição na lista". Aqui o
  agrupamento é Total (100%) como cabeçalho + uma linha por conta corrente.

Sem cor/token novo. Sem acordeão (pedido explícito do CEO: tabela sempre visível, não expansível).

## Testes previstos

- **Fórmula nova (backend):** reconstrução dos 3 meses já validados nesta auditoria (jan = 1.030,92,
  fev = 1.543,37, mar = 7.653,54) como teste de regressão explícito, usando fixtures equivalentes ao
  dado real (saldo_inicial, transações reais, transação de salário competência-deslocada).
- **Múltiplas transações de salário no mesmo mês:** fixture com 2 transações "Salário" no mesmo
  mês, ambas competência mês seguinte — resultado deve subtrair as duas (cenário real de abril,
  confirmado pelo CEO como válido: bônus + salário).
- **Conta sem transações no período:** aparece no total com o próprio `saldo_inicial`, sem erro de
  divisão/índice.
- **Conta sem `saldo_inicial`:** continua fora do cálculo (regressão do comportamento já existente).
- **Aporte/Resgate/proventos contam em Receita/Despesa:** teste de regressão nos testes existentes
  que hoje esperam exclusão por `categoria_pluggy` — devem ser atualizados para esperar inclusão.
- **Frontend:** tabela renderiza Total + N contas, 6 colunas, sem controle de expandir/colapsar.

## Impacto no roadmap

Cross-epic, sem épico prévio — nasceu de auditoria manual do CEO. Sem impacto em sprints futuras
planejadas, além de destravar a continuação da própria auditoria mês a mês (abril em diante), que
o CEO fará em sessão separada usando a tabela de conferência entregue aqui.

## Riscos / dependências

- **Card para de expor o toggle Competência/Caixa** — mudança de comportamento visível para o
  usuário. Confirmado como consequência lógica da nova definição durante a investigação, mas não
  foi uma pergunta direta respondida pelo CEO — reconfirmar antes de implementar (tarefa 4).
- **Testes existentes que dependem da exclusão de `categoria_pluggy` ou do mecanismo de
  âncora/sentinela** vão quebrar e precisam ser atualizados para refletir o comportamento novo —
  não é regressão, é mudança de contrato esperado.
- **Abril/2026 fica sem validação fechada** — aceito explicitamente pelo CEO como próximo passo,
  não bloqueia esta sprint.
- **8 transações de Aporte/Resgate mal categorizadas** seguem erradas até o CEO recategorizar
  manualmente (fora desta sprint) — o comportamento novo (Aporte/Resgate como receita/despesa
  legítima) só terá efeito visível nelas depois da recategorização.
