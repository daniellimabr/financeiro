# SPRINT-022: Manutenção de Investimentos + drilldown de Ativos/Patrimônio — Relatório

- **Plano:** [SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-plan.md](./SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-plan.md)
- **Data do relatório:** 2026-08-18

## Resumo

Entregue as 4 frentes do PRD-022. O Bloco 0 (investigação read-only na VM de dev) derrubou a
premissa central do ponto 1 — não existe conta `tipo=investimento` no dado real — e mudou o
critério de exclusão de microtransações de investimento de "tipo de conta" para
`categoria_pluggy`, decidido com o CEO em tempo real durante a execução. A investigação do
ponto 3 achou a causa raiz real do pico de rendimento (bug de data em duas funções, não
julgamento de mercado), corrigida e validada linha a linha contra dado real. Botão "Excluir
conta" e os 3 drilldowns novos de valor atual (Ativos/Patrimônio) entregues conforme o plano.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Bloco 0: contar transações pendentes/confirmadas em conta `tipo=investimento` | feito | **Achado real:** zero contas `tipo=investimento` no dado real — Nubank Investimentos só retorna holdings via `/investments`, XP só retorna conta `corrente`. As 30 pendências reais eram 100% dividendo/JCP/taxa (`categoria_pluggy`), não transação de conta investimento |
| 2 | Bloco 0: contas XP `sync_enabled=false` + transações ligadas | feito | 2 contas (Cartão XP Visa Infinite, XP corrente antiga), ambas com 0 transações e 0 vínculo a Investimento — exclusão trivial |
| 3 | Bloco 0: campos ao vivo das 4 holdings suspeitas de baseline subestimado | feito | Todas as 4 compradas em 2026 (depois do baseline) — `saldo_inicial=0` estava correto. A causa real do pico era outra (achada só depois, ver item 11) |
| 4 | `_base_query` excluir `tipo=investimento` por padrão | feito, escopo mudou | Exclusão por `account_tipo` implementada como salvaguarda defensiva (hoje no-op) **e** exclusão por `categoria_pluggy` (∈ {"Proceeds interests and dividends", "Taxes on investments"}) — o critério que efetivamente resolve o pedido do CEO, decidido em tempo real via pergunta direta depois do achado do item 1 |
| 5 | `list_transactions` mesmo padrão de exclusão | feito, mesmo desvio do item 4 | — |
| 6 | `delete_account` com desassociação de FKs | feito | Só `descricao_sugestao_origem_id` precisou desassociação manual (FK auto-referenciada sem `ON DELETE`) — `asset_id`/`liability_id`/`investimento_id` etc. são FKs de saída da própria transação sendo excluída, não precisam de desassociação prévia (achado durante implementação, mais simples que o presumido no plano) |
| 7 | Rota `DELETE /pluggy/accounts/{id}` | feito | 404 cross-user/inexistente, 401 sem cookie, 204 no sucesso |
| 8 | Botão "Excluir conta" em `AccountManagementPage.tsx` | feito | Habilitado só quando `sync_enabled=false`, `window.confirm`, `.btn-danger` |
| 9 | `api/pluggy.ts` + `useDeleteAccount` | feito | Invalida pluggyAccounts/pluggyTransactions/categorizationTransactions/evolucaoSaldoPorConta |
| 10 | Aplicar exclusão nas contas XP reais | feito | 2 contas (`id=7`, `id=9`) excluídas na VM de dev via `delete_account`, aprovação explícita do CEO por comando antes de rodar |
| 11 | Reauditar `saldo_inicial` das holdings suspeitas | feito, achado maior que o previsto | Não era ajuste pontual de julgamento — era um **bug real** em `_net_aportes_desde_cutoff` (sem filtro de data, contava compra pré-baseline como aporte novo), subestimando 3 holdings em ~R$22.000 (quase todo o pico reportado). Corrigido com filtro `data > baseline`; baseline recalculado e gravado só nas 4 linhas com diferença real (as demais 10 já aprovadas na Sprint 21 não foram reabertas) |
| 12 | Redistribuir rendimento reconstruído pró-rata | feito, achado adicional durante validação | Algoritmo pró-rata por dias de posição aberta implementado; ao validar contra dado real, achado um **segundo bug** (mesma classe, dentro da própria reconstrução: `net_aportes_total` também sem filtro de data) que produzia resíduo fantasma negativo — corrigido antes de fechar |
| 13 | Rodar correção contra dado real, validar com o CEO | feito | Baseline corrigido gravado, reconstrução+redistribuição rodadas na VM de dev, série mês a mês revisada e aprovada pelo CEO (pico sumiu, total preservado: ~R$674 em 8 meses, plausível pra ~R$67k a CDI) |
| 14 | Testes backend | feito | 23 testes novos (exclusão por categoria_pluggy com regressão de aporte/resgate, `delete_account` completo, os 2 bugs de data com regressão, redistribuição com idempotência/preservação de soma/peso zero antes da compra) |
| 15 | Expor valor atual por Investimento | feito | `GET /investimentos` ganhou campo `valor_atual` (schema `InvestimentoComValorAtualOut`, novo — CRUD continua com `InvestimentoOut` sem o campo); 2 queries agregadas, sem N+1 |
| 16 | `AtivosAccordion` — novas seções | feito | "Valor atual por Investimento" + "Saldo por conta" ao lado do accordion de gasto existente |
| 17 | `PatrimonioBreakdownPanel` — novos destinos | feito | 3 `DrillKind` novos (`patrimonioAtivos`/`patrimonioPassivos`/`patrimonioInvestimentos`), distintos dos usados pelos cards de topo — Ativos/Passivos filtrados por `status=ativo` no frontend |
| 18 | Decidir componente compartilhado | feito | `InvestimentosValorAtualList` reaproveitado nos 2 pontos (seção do card Ativos + destino do painel Patrimônio); `AssetsValorAtualList`/`LiabilitiesValorAtualList` pequenos o bastante pra não justificar abstração extra |
| 19 | Testes frontend | feito | 6 testes novos (`AccountManagementPage` botão habilitado/desabilitado + confirmação cancelável; `DashboardsPage` seções novas + 3 destinos novos) |
| 20 | Deploy + validação ao vivo | feito | CI verde (2 rodadas — 2º commit corrigiu o bug achado na validação real), deploy na VM de dev, `check-sprint22.mjs` novo, sem erros de console |
| 21 | Atualizar docs vivos | feito | OVERVIEW.md, dashboards-guia-cards.md, roadmap.md, directory-structure.md |
| 22 | Relatório de sprint | feito | Este documento |

## Evidência de testes

Backend:

```
586 passed, 601 warnings in 13.39s
TOTAL coverage: 98%
```

Frontend:

```
 Test Files  25 passed (25)
      Tests  192 passed (192)
```

Cobertura de lógica de negócio: 98% (backend, meta ≥80%). Módulos tocados
(`app/pluggy_integration/service.py`, `app/dashboards/service.py`, `app/categorization/service.py`,
`app/investimentos/service.py`) todos ≥96%.

## Lint/formatter

```
backend: ruff — All checks passed! / ruff format — 80 files already formatted
frontend: eslint — sem erros / prettier --check — All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

1. **Critério de exclusão de microtransações mudou de `account_tipo` para `categoria_pluggy`**
   — decisão do CEO em tempo real, depois do achado do Bloco 0 de que nenhuma conta
   `tipo=investimento` existe no dado real. Sem essa mudança, a implementação literal do PRD
   seria um no-op contra a fila real (69 pendências, 30 delas dividendo/JCP/taxa de
   investimento administrado, todas em conta `corrente`).
2. **Baseline dez/2025 não foi só "reauditado" — teve um bug de código real corrigido**
   (`_net_aportes_desde_cutoff` sem filtro de data). Achado por investigação read-only contra o
   payload real da Pluggy (mesmo precedente de "investigar antes de reinterpretar dado" já
   usado em sprints anteriores), não por julgamento de mercado.
3. **Segundo bug da mesma classe achado só na validação contra dado real**
   (`_reconstruct_holding_snapshots::net_aportes_total`) — reforça o valor de validar toda
   correção financeira contra dado real antes de fechar, não só contra teste sintético.
4. **`delete_account` ficou mais simples que o desenhado no plano** — só
   `descricao_sugestao_origem_id` precisa de desassociação manual; os demais campos citados no
   plano (`asset_id`, `liability_id`, `investimento_id` etc.) são FKs de saída da própria
   transação sendo excluída, não geram violação de constraint.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Transação de conta `tipo=investimento` some da fila/totais, sem afetar dividendo/JCP em conta `corrente` | **Sim, com escopo revisado** | Critério original presumia conta `tipo=investimento` existente (não existe). Implementado por `categoria_pluggy` — dividendo/JCP de investimento administrado (XP) **também sai** da fila/totais agora, por pedido explícito do CEO nesta sessão (supera o "sem afetar" original, que partia da premissa errada) |
| 2. Excluir conta `sync_enabled=false` remove conta + transações, desassocia FKs, não afeta holdings de outras contas do item | Sim | `test_delete_account_removes_account_and_transactions`, `test_delete_account_desassocia_descricao_sugestao_origem`, `test_delete_account_never_touches_investment_holdings_of_same_item` |
| 3. Botão indisponível pra conta `sync_enabled=true` | Sim | `disabled={account.sync_enabled}` + teste `disables the delete button while the account is still sync_enabled` |
| 4. Baseline reauditado + redistribuição: sem pico, total preservado | Sim | Validado ao vivo — ver tabela mês a mês na seção Resumo; `test_reconstruct_historical_snapshots_distributes_growth_instead_of_dumping` (soma exata) |
| 5. Drilldown Ativos com valor atual por Investimento + saldo por conta, card sem mudar | Sim | Fórmula de `Summary.ativos` intocada; screenshot `s22-04-ativos-drilldown.png` |
| 6. Drilldown Patrimônio (Ativos/Passivos/Saldo em investimentos) com lista itemizada de valor atual | Sim | Screenshots `s22-06`/`s22-07` |
| 7. Isolamento por `user_id` em toda rota nova/alterada | Sim | `test_delete_account_other_user_raises_not_found`, `test_list_investimentos_com_valor_atual_isolated_by_user`, etc. |
| 8. 401 sem cookie nas rotas novas | Sim | `test_delete_account_without_cookie_returns_401` |
| 9. CI verde, cobertura ≥80% nos módulos tocados | Sim | 98% nos módulos tocados, suíte completa verde |

## Documentação atualizada

- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) — seção nova "Manutenção de
  Investimentos + drilldown de Ativos/Patrimônio (Sprint 22)", contagem de testes atualizada.
- [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) — exclusão por `categoria_pluggy`
  em Receita/Despesa, drilldowns redesenhados de Ativos/Patrimônio.
- [docs/directory-structure.md](../directory-structure.md) — `useDeleteAccount.ts`,
  `AccountManagementPage.tsx`, `DashboardsPage.tsx`, `check-sprint22.mjs`.
- [docs/roadmap.md](../roadmap.md) — Sprint 22 marcada concluída, item de backlog
  "Microtransações de investimento na fila de Categorização" removido (resolvido).

## Consumo estimado de tokens/sessões

Sessão única, longa — 4 frentes distintas (categorização, exclusão de conta, correção de série
histórica com 2 bugs reais achados em investigação, redesign de 2 drilldowns), mais 2 rodadas de
deploy (o bug achado na validação real exigiu um segundo commit/CI/deploy). Comparável às
Sprints 10/18 em escopo; a investigação real (Bloco 0 + validação linha a linha do baseline)
consumiu proporção maior da sessão que o normal, mas evitou fechar a sprint com o critério de
exclusão errado (teria sido um no-op) e com o pico de rendimento sem explicação real.

## Pendências e próximos passos sugeridos

- Nenhuma pendência dos 22 itens do plano.
- Sugestão automática pra holdings CDB com nome idêntico/código nulo (Sprint 21) e fonte de
  cotação histórica de mercado seguem fora de escopo, registradas no roadmap.
