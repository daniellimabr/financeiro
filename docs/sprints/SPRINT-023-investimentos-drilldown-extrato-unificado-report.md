# SPRINT-023: Investimentos — drilldown de posições e extrato unificado — Relatório

- **Plano:** [SPRINT-023-investimentos-drilldown-extrato-unificado-plan.md](./SPRINT-023-investimentos-drilldown-extrato-unificado-plan.md)
- **Data do relatório:** 2026-08-19

## Resumo

O card de Investimento parou de exibir carteiras/posições como texto solto e agora abre direto no
drilldown de Posições; o extrato passou a unir `PluggyTransaction` (conta) e
`PluggyInvestmentTransaction` (holding) via `GET /investimentos/{id}/transacoes`, corrigindo o
extrato sempre vazio de investimentos só-holdings como "Quitar o AP". `InvestimentoPosicoes`,
`PosicaoHistorico` e a nova tabela de extrato ganharam `<colgroup>`, eliminando o overlap visual de
coluna com nome de holding longo. Validado ao vivo na VM de dev contra dado real.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Bloco 0: investigação read-only na VM de dev | feito | `investimento_id=5` ("Quitar o AP"): 14 holdings, 15 transações, intervalo real 2025-10-06 a 2026-04-30, `tipo` é `BUY`/`SELL` (não `Aporte`/`Resgate`), `descricao` sempre `None` nas 15 linhas — achado que definiu o fallback do frontend pra `holding_nome` quando `descricao` é nulo. Volume baixo confirmado — paginação não se justificou (decisão do PRD mantida). |
| 2 | Schema `InvestimentoTransacaoOut` + serviço `get_transacoes` | feito | Une as duas fontes com `descricao_usuario or descricao` (mesmo padrão de `categorization/service.py`) na fonte "conta"; ordena por data desc. |
| 3 | Rota `GET /investimentos/{id}/transacoes?ano=&mes=` | feito | Sem desvio. |
| 4 | Testes backend: união, filtro, isolamento, 401/404 | feito | 9 testes novos em `test_investimento_service.py`, 4 em `test_investimento_endpoints.py`. |
| 5 | `fetchInvestimentoTransacoes` no frontend | feito | Sem desvio. |
| 6 | Aba "Extrato" troca fonte pro endpoint unificado, tabela com `<colgroup>` | feito | Sem desvio. |
| 7 | Card sem texto de Carteiras/Posições, ação abre em "Posições" | feito | `usePluggyAccounts`/`carteirasDe` ficaram órfãos (só existiam pra alimentar a tag removida) — removidos junto, em vez de deixar código morto. |
| 8 | `<colgroup>` em `InvestimentoPosicoes`/`PosicaoHistorico` | feito | Larguras seguem o padrão já usado (`col-data` ~90px, `col-descricao`/`col-nome` 30%, `col-valor` ~110px); descrição/nome não são 1ª/última coluna nessas 3 tabelas, então o corte com "..." usa `nth-child` em vez do `:first-child`/`:last-child` de `.baseline-table`. |
| 9 | Testes frontend | feito | Suíte de `InvestimentosPage.test.tsx` reescrita: botão renomeado ("Ver posições"), view default "Posições", extrato unificado com fixtures de origem conta+holding, colgroup presente. |
| 10 | QA visual real na VM de dev — `check-sprint23.mjs` | feito | Rodado com sucesso contra dado real (token minerado nesta sessão, aprovado explicitamente pelo CEO — o comando de mint foi bloqueado pelo classificador do modo automático e pausado pra decisão). Screenshots confirmam: cards sem tag solta, "Quitar o AP" abrindo em Posições, extrato de abril/2026 mostrando as 2 transações reais do Bloco 0 (BUY R$ 13.383,41 / SELL R$ 13.837,10, origem "Holding"), colunas sem overlap. |
| 11 | `docs/directory-structure.md` / `dashboards-guia-cards.md` | feito | Só `directory-structure.md` — `dashboards-guia-cards.md` não mudou porque nenhuma fórmula de card foi tocada (confirmado pelo PRD: sprint é só leitura/apresentação). |
| 12 | Relatório de sprint | feito | Este documento. |

## Evidência de testes

Backend (suíte completa):

```
598 passed, 565 warnings in 13.96s

Name                                 Stmts   Miss  Cover
------------------------------------------------------------------
app\investimentos\router.py             51      0   100%
app\investimentos\service.py           103      0   100%
app\schemas\investimento.py             14      0   100%
------------------------------------------------------------------
TOTAL                                 2593     46    98%
```

Backend (módulos tocados, isolado):

```
49 passed in 1.39s
app\investimentos\router.py             51      0   100%
app\investimentos\service.py           103      0   100%
```

Frontend (suíte completa):

```
Test Files  25 passed (25)
     Tests  192 passed (192)
```

Cobertura de lógica de negócio: 98% backend (meta ≥80%) — 100% em `investimentos/router.py` e
`investimentos/service.py`, os módulos tocados nesta sprint.

## Lint/formatter

```
$ ruff check app/investimentos app/schemas/investimento.py tests/test_investimento_service.py tests/test_investimento_endpoints.py
All checks passed!

$ ruff format --check ...
1 file reformatted (test_investimento_service.py, linhas longas de _investment_transaction) — corrigido antes do commit.

$ npx eslint .
(sem saída — sem erros)

$ npx prettier --check "src/**/*.{ts,tsx,css}"
2 arquivos precisavam de --write (InvestimentosPage.tsx/.test.tsx) — corrigido antes do commit
(gotcha conhecido: pre-commit local só roda eslint, CI roda eslint+prettier).

$ npx tsc --noEmit
(sem saída — sem erros)
```

## Decisões tomadas durante a execução

1. **Fallback de descrição pro nome da holding.** O Bloco 0 confirmou que
   `PluggyInvestmentTransaction.descricao` é sempre `None` na prática (15/15 linhas de "Quitar o
   AP") — não estava explícito no PRD qual texto mostrar nessa coluna pra origem "holding". Decisão:
   frontend usa `descricao ?? holding_nome ?? "—"`, então a linha nunca aparece com célula vazia.
2. **Remoção de `usePluggyAccounts`/`carteirasDe` órfãos.** Não estava no plano, mas ficaram sem
   nenhum outro uso depois que a tag "Carteiras: ..." saiu do card — removidos em vez de deixar
   import/hook morto (regra geral do projeto: sem código não utilizado).
3. **`nth-child` em vez de `:first-child`/`:last-child` pro corte de texto.** `.baseline-table`
   (única referência anterior de overflow-ellipsis em `<td>`) tinha a coluna longa na 1ª/última
   posição; nas 3 tabelas desta sprint a coluna longa (Descrição/Nome) fica no meio — usar
   `nth-child(2)`/`nth-child(3)` explícito, documentado no CSS.
4. **Mint de token de sessão pausado para aprovação explícita.** O comando de mineração de token
   (`docker compose exec api python -c "...create_access_token..."`) foi bloqueado pelo classificador
   do modo automático apesar de SSH na VM de dev ser autonomia padrão — pausei e pedi decisão
   explícita ao CEO antes de prosseguir, em vez de tentar contornar.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Investimento só-holdings mostra transações de holding no extrato filtrado | sim | `test_get_transacoes_only_holdings_returns_holding_side`; QA ao vivo: "Quitar o AP" em abril/2026 mostra 2 linhas reais (`s23-04-quitar-ap-extrato-abril-2026.png`) |
| 2. Investimento com carteira bancária continua mostrando extrato sem regressão | sim | `test_get_transacoes_unites_conta_and_holding_sources`, `test_get_transacoes_uses_descricao_usuario_override` |
| 3. Card abre direto em "Posições", sem texto solto | sim | `toggleDrilldown` seta `drillView="posicoes"`; teste frontend + QA ao vivo (`s23-01`, `s23-02`) confirmam ausência de "Carteiras:"/"Posições:" e toggle "Posições" com `aria-pressed=true` no primeiro clique |
| 4. Nenhuma coluna vaza com nome de holding longo | sim | `<colgroup>` + CSS em `InvestimentoPosicoes`/`PosicaoHistorico`/extrato unificado; QA ao vivo mostra "CDB - NU FINANCEIRA S.A. - SOCIEDADE DE CRE..." truncado sem vazar |
| 5. Isolamento por `user_id` em toda query nova | sim | `test_get_transacoes_isolated_by_user`, `test_get_other_users_transacoes_returns_404` |
| 6. 401 sem cookie, 404 cross-user | sim | `test_transacoes_without_cookie_returns_401`, `test_get_other_users_transacoes_returns_404` |
| 7. Suíte 100% verde, cobertura ≥80% nos módulos tocados | sim | 598 backend + 192 frontend, 100% em `investimentos/router.py`/`service.py` |

## Documentação atualizada

- `docs/directory-structure.md` — hook `useInvestimentoTransacoes.ts`, entrada `investimentos/`
  (backend), `investimentos.ts` (frontend api), descrição de `InvestimentosPage.tsx` atualizada com
  as mudanças da Sprint 23.
- `docs/roadmap.md` — seção da Sprint 23 já existia (escrita na sessão de planejamento).
- Este relatório.
- `dashboards-guia-cards.md` não precisou de mudança — nenhuma fórmula de card foi tocada.

## Consumo estimado de tokens/sessões

Sessão única — Bloco 0 (investigação SSH), implementação backend+frontend (6 arquivos de produção +
2 de teste + 1 hook novo), deploy completo (push → CI → VM de dev → mint de token pausado pra
aprovação → browser-check), correção de 1 finding real do próprio script de QA (seletor
`getByRole` ambíguo entre "Posições" do toggle e "Ver/Fechar posições" dos cards). Consumo médio,
concentrado na etapa de deploy/QA (orquestração) mais do que na lógica de negócio em si (união de
duas queries já existentes, sem cálculo novo).

## Pendências e próximos passos sugeridos

- Nenhuma pendência técnica. Sprint 24 (Dashboard: layout/cards/navegação) já planejada
  separadamente, independente desta.
