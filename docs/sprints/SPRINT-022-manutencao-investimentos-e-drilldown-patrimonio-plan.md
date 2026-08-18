# SPRINT-022: Manutenção de Investimentos + drilldown de Ativos/Patrimônio — Plano

- **PRD(s):** [PRD-022-manutencao-investimentos-e-drilldown-patrimonio](../prd/PRD-022-manutencao-investimentos-e-drilldown-patrimonio.md)
- **Data do plano:** 2026-08-18

## Objetivo da sprint

Ao final: (1) transações de contas `tipo=investimento` somem da fila de Categorização e dos
totais de Receita/Despesa, sem afetar dividendo/JCP legítimo em conta `corrente`; (2) o CEO
pode excluir dado de uma conta desativada (`sync_enabled=false`) pela própria UI de Gestão de
Contas, aplicado às contas XP reais já desativadas; (3) a série histórica do Investimento
"Quitar o AP" não tem mais um pico artificial de R$22.674,22 concentrado em agosto — o
baseline das holdings suspeitas foi reauditado com o CEO e o crescimento reconstruído (jan-jul)
foi redistribuído; (4) o drilldown do card Ativos mostra valor atual por Investimento e saldo
por conta, e o drilldown do card Patrimônio mostra listas itemizadas reais de Ativos/Passivos/
Investimentos em vez de gasto do período ou lista de contas sem filtro.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Bloco 0: contar transações pendentes/confirmadas em contas `tipo=investimento` por conector/conta (SQL read-only na VM de dev), confirmar se dividendo/JCP da XP roda em conta `corrente` (não deve ser afetado) | Sonnet: investigação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), achado da Sprint 19 (roadmap.md) |
| 2 | Bloco 0: listar contas XP com `sync_enabled=false` e contar `pluggy_transactions` ligadas — define escopo exato da limpeza | Sonnet: investigação | mesmo procedimento acima |
| 3 | Bloco 0: puxar `code`/`isin`/`purchaseDate`/`rate`/`fixedAnnualRate` ao vivo das 4 holdings "Quitar o AP" com `saldo_inicial=0` via `PluggyClient.get_investments()`; revisar com o CEO se alguma merece baseline >0 | Sonnet: investigação, com o CEO | [pluggy_integration/client.py](../../backend/app/pluggy_integration/client.py), achado real registrado no PRD-022 |
| 4 | `dashboards/service.py::_base_query`: excluir por padrão transações de conta `tipo=investimento` dos totais de Receita/Despesa (mesmo padrão da exclusão cartão de crédito+crédito, linha ~219-267); regressão explícita contra `get_saldo_acumulado`/`_patrimonio_breakdown`/`get_por_investimento` | Sonnet: implementação | [dashboards/service.py:219-267](../../backend/app/dashboards/service.py) |
| 5 | `categorization/service.py::list_transactions`: join a `PluggyAccount`, excluir `tipo=investimento` (mesmo padrão de join do filtro `account_tipo` em `pluggy_integration/service.py::list_transactions`) | Sonnet: implementação | [categorization/service.py:57-](../../backend/app/categorization/service.py), [pluggy_integration/service.py](../../backend/app/pluggy_integration/service.py) (padrão `account_tipo`) |
| 6 | `DELETE /pluggy/accounts/{id}` + `delete_account` em `pluggy_integration/service.py`: desassocia `asset_id`/`asset_sugerido_id`/`liability_id`/`liability_sugerido_id`/`investimento_id`/`investimento_sugerido_id`/`descricao_sugestao_origem_id` antes de `db.delete` (cascade ORM cobre `PluggyTransaction` da própria conta); nunca toca `PluggyInvestment` (linka por `item_id`) | Sonnet: implementação | [assets/service.py:64-77](../../backend/app/assets/service.py), [liabilities/service.py:68-82](../../backend/app/liabilities/service.py) (padrão de desassociação) |
| 7 | `pluggy_integration/router.py`: rota `DELETE /accounts/{id}`, 404 para conta de outro usuário/inexistente, 401 sem cookie | Sonnet: implementação | [pluggy_integration/router.py](../../backend/app/pluggy_integration/router.py) |
| 8 | `AccountManagementPage.tsx`: botão "Excluir conta" (habilitado só quando `sync_enabled=false`), confirmação via `window.confirm` (mesmo padrão de `deleteAsset`/`AssetsPage`) | Sonnet: implementação | [pages/AccountManagementPage.tsx:279-320](../../frontend/src/pages/AccountManagementPage.tsx) |
| 9 | `api/pluggy.ts` + hook `useDeleteAccount`, invalidação de queries de contas/transações após exclusão | Sonnet: implementação | [api/pluggy.ts](../../frontend/src/api/pluggy.ts), padrão `useDeleteAsset` |
| 10 | Aplicar exclusão nas contas XP reais desativadas na VM de dev — aprovação explícita do CEO por comando antes de rodar | Sonnet: implementação, com aprovação do CEO | dado real da VM de dev |
| 11 | Reauditar `saldo_inicial` das holdings suspeitas com o CEO (achado da tarefa 3) — ajuste pontual via `confirm_baseline_dez_2025`, sem reabrir as demais 10 holdings já aprovadas | Sonnet: implementação, com o CEO | [pluggy_integration/service.py:214-317,351-362](../../backend/app/pluggy_integration/service.py) |
| 12 | `_reconstruct_holding_snapshots`/`snapshot_current_month`: redistribuir o crescimento observado (resíduo do primeiro snapshot `confianca="real"`) pelos meses reconstruídos em vez de concentrar tudo no mês corrente — algoritmo exato (pró-rata por dias desde aporte, usando `_juros_compostos` quando `fixedAnnualRate` é conhecido; fórmula reversa proporcional nos demais casos) definido durante a execução a partir do achado da tarefa 3 | Sonnet: implementação | [pluggy_integration/service.py:320-328,365-440,484-546](../../backend/app/pluggy_integration/service.py) |
| 13 | Rodar a correção contra dado real da VM de dev (baseline reauditado + redistribuição), validar linha a linha com o CEO antes de fechar | Sonnet: implementação, com o CEO | dado real da VM de dev |
| 14 | Testes backend: exclusão de conta investimento na fila/totais (fixture + regressão de aporte/resgate continuando a contar); `delete_account` (desassociação completa, isolamento, 404 idempotente numa segunda tentativa); redistribuição do rendimento reconstruído (fixture com resíduo conhecido, soma bate exatamente, idempotência ao rodar 2x) | Sonnet + skill tdd-workflow | `test_dashboards_service.py`, `test_categorization_service.py`, `test_pluggy_service.py`, `test_pluggy_endpoints.py` |
| 15 | `dashboards/service.py` ou `investimentos/service.py`: expor valor atual por Investimento pronto para o drilldown do card Ativos (reaproveitar `GET /investimentos` se já cobrir; endpoint fino só se não cobrir) | Sonnet: implementação | [investimentos/service.py](../../backend/app/investimentos/service.py), [dashboards/service.py:341-384](../../backend/app/dashboards/service.py) (`_patrimonio_breakdown`) |
| 16 | `AtivosAccordion` (`DashboardsPage.tsx:622-`): novas seções de valor atual por Investimento e saldo por conta (`useSaldoPorConta`, já existe), mesmo padrão visual `.dash-table`+`colgroup` | Sonnet: implementação | [pages/DashboardsPage.tsx:622-](../../frontend/src/pages/DashboardsPage.tsx), [hooks/useSaldoPorConta.ts](../../frontend/src/hooks/useSaldoPorConta.ts) |
| 17 | `PatrimonioBreakdownPanel` (`DashboardsPage.tsx:768-846`): botões "Ver detalhe" de Ativos/Passivos passam a abrir lista itemizada de valor atual (`useAssets`/`useLiabilities`); "Saldo em investimentos" passa a abrir lista de Investimentos com valor atual (fonte da tarefa 15) em vez de `SaldoPorContaList` sem filtro | Sonnet: implementação | [pages/DashboardsPage.tsx:768-846](../../frontend/src/pages/DashboardsPage.tsx), [pages/AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx)/[LiabilitiesPage.tsx](../../frontend/src/pages/LiabilitiesPage.tsx) (hooks a reaproveitar) |
| 18 | Decidir durante a execução se justifica extrair componente compartilhado de "lista de valor atual" (mesmo critério de duplicação de sprints anteriores) ou se é aceitável duplicar uma tabela pequena | Sonnet: implementação | — |
| 19 | Testes frontend: `AtivosAccordion` (novas seções), `PatrimonioBreakdownPanel` (novos destinos de "Ver detalhe"), `AccountManagementPage` (botão "Excluir conta" habilitado/desabilitado conforme `sync_enabled`) | Sonnet + skill tdd-workflow | testes equivalentes existentes como referência |
| 20 | Deploy VM de dev (CI verde → `git pull` + `docker compose pull` + `up -d`), validação ao vivo (`scripts/browser-check/`, novo script ou extensão de um existente): fila de Categorização sem transação de investimento, botão "Excluir conta", série histórica de "Quitar o AP" sem pico, drilldowns de Ativos/Patrimônio | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), `scripts/browser-check/` |
| 21 | Atualizar docs vivos (`OVERVIEW.md`, `dashboards-guia-cards.md`, `directory-structure.md` se necessário, `roadmap.md` — fecha o item de backlog "Microtransações de investimento") | Haiku: doc-updater | OVERVIEW.md, dashboards-guia-cards.md, roadmap.md |
| 22 | Relatório de sprint — achados do Bloco 0, algoritmo final de redistribuição, resultado da reauditoria de baseline com o CEO, lista de contas XP efetivamente excluídas | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** exclusão de `tipo=investimento` na fila de Categorização
  e nos totais (`_base_query`, `list_transactions`), com regressão explícita de que
  aporte/resgate (conta corrente) continuam contando e dividendo/JCP em conta `corrente` não é
  afetado; `delete_account` (desassociação completa de todas as FKs relevantes, isolamento por
  usuário, 404 para conta de outro usuário, idempotência numa segunda tentativa); redistribuição
  do rendimento reconstruído (fixture com resíduo conhecido — soma exata, sem sobra/falta;
  idempotência ao rodar a reconstrução 2x); regressão de `get_evolucao`/`get_evolucao_mensal`
  inalterados fora do escopo da correção.
- **Componente (Vitest):** `AtivosAccordion` (novas seções), `PatrimonioBreakdownPanel` (novos
  destinos de "Ver detalhe"), `AccountManagementPage` (botão "Excluir conta").
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde antes de fechar.
- Testes do Bloco 0 (investigação) não são previsíveis de antemão — dependem do achado real,
  mesmo precedente das Sprints 17-21.

## Impacto no roadmap

Sprint sem épico prévio (cross-epic, mesmo padrão das Sprints 16/17/18). Ao fechar, remove o
item de backlog "Microtransações de investimento na fila de Categorização" (registrado desde a
Sprint 21) de "Registro de reavaliações futuras" em `docs/roadmap.md`, e adiciona a entrada
padrão de sprint concluída com referência a PRD-022/SPRINT-022.

## Riscos / dependências

- **Escopo exato da exclusão de microtransações depende do Bloco 0** — se o achado real
  mostrar que XP mistura dividendo legítimo e transação interna de holding na mesma conta
  `investimento` (diferente do padrão observado na Sprint 19, onde ficavam em conta
  `corrente`), a exclusão simples por `account_tipo` pode não ser suficiente e precisa de
  critério adicional — decidir com o CEO antes de implementar, não presumir.
- **Algoritmo de redistribuição do rendimento reconstruído é o item de maior risco técnico** —
  qualquer fórmula escolhida precisa preservar o total observado (não pode mudar o rendimento
  total acumulado, só a distribuição mês a mês) e precisa ser validada linha a linha com o CEO
  contra dado real antes de fechar, mesmo padrão de revisão humana já usado no baseline
  original da Sprint 21.
- **Exclusão de dado real (contas XP) é irreversível** — exige aprovação explícita do CEO por
  comando antes de rodar contra a VM de dev (único ambiente real), mesmo com a UI e o backend
  já validados por teste automatizado.
- **Sprint com 4 frentes distintas** (categorização, exclusão de conta, correção de série
  histórica, redesign de 2 drilldowns) — comparável às Sprints 10/18. Se alguma frente revelar
  complexidade maior que o previsto (especialmente o Bloco 0 de redistribuição), dividir o que
  faltar em sprint futura é uma saída válida, mesmo precedente das Sprints 7/8/9, 12/13/14/15.
