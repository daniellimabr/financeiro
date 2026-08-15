# SPRINT-009: Dashboards analíticos — Ativos/Passivos e refinamentos — Relatório

- **Plano:** [SPRINT-009-dashboards-ativos-passivos-plan.md](./SPRINT-009-dashboards-ativos-passivos-plan.md)
- **PRD:** [PRD-009-dashboards-ativos-passivos.md](../prd/PRD-009-dashboards-ativos-passivos.md)
- **Data do relatório:** 2026-08-15
- **Status:** aprovado pelo CEO em 2026-08-15

## Resumo

Sprint 9 fechou o épico E6 (Dashboards analíticos). `liability_id`/
`liability_sugerido_id`/`liability_sugestao_confianca` novos em
`pluggy_transactions` (migration `0009`), espelhando `asset_id` (Sprint 4)
campo a campo — sugestão automática, filtro em `/pluggy/transactions`,
endpoint de confirmação manual. `delete_liability` ganhou a mesma
desassociação que `delete_asset` ganhou na Sprint 8 (FK sem `ON DELETE`,
mesmo achado), implementada junto da migration, não como correção
posterior. `GET /dashboards/summary` ganhou `ativos`/`passivos`; novos
`GET /dashboards/por-passivo`/`.../tendencia` (mirror de `/por-ativo`, sem
toggle — só despesa) e `GET /dashboards/saldo-por-conta` (snapshot atual,
ignora o filtro de período). No Dashboard: cards Ativos/Passivos/Saldo
clicáveis ao lado dos já existentes; nível "meio de pagamento" removido,
vira ícone por linha ao lado do valor; tabelas de transação ficam
ordenáveis por coluna; gráficos de tendência ganham tooltip. `CardSparkline`/
`TrendChart`/`AccountTipoIcon`/`useTableSort` extraídos como compartilhados
entre `DashboardsPage` e `AssetsPage`.

**Revisão pós-entrega, mesma sessão de execução:** o CEO deu feedback ao
ver o resultado real antes de aprovar a sprint. O funil de Despesa/Receita
ganhou um nível de agrupamento — Categoria (grupo) > Tipo (subcategoria) >
Transação, calculado no frontend a partir do endpoint já existente, sem
mudança de backend — com cores distintas por Categoria e por Tipo (paleta
validada via skill `dataviz`). A coluna % das tabelas de transação ficou
ordenável. `CardSparkline` ganhou tooltip e o `TrendChart` passou a
rotular o eixo X só nos meses de início de trimestre. Investigação do
payload real da Pluggy (`creditData`) confirmou que `PluggyAccount.saldo`
de cartão de crédito já representa a dívida (achado da Sprint 5, correto
— a leitura do CEO de que mostrava "limite" não batia com o payload
inspecionado ao vivo na VM de dev), mas o card "Saldo" passou a mostrar a
soma da fatura atual não paga com o limite de crédito entre parênteses
(migration `0010`, novos `limite_credito`/`fatura_vencimento` em
`pluggy_accounts`).

Deploy na VM de dev validado em 2 rodadas (CI verde, migrations `0009` e
`0010` aplicadas, containers saudáveis) e QA visual real
(`check-sprint9.mjs`, atualizado depois pra cobrir os 3 níveis do funil)
confirmou os 3 drilldowns novos, o funil com cores, ícone ao lado do
valor, ordenação (incl. %) e o limite de crédito entre parênteses no card
do cartão, tudo sem erros de console.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Migration `0009`: `liability_id`/`liability_sugerido_id`/`liability_sugestao_confianca` em `pluggy_transactions`, mirror de `0006` | feito | Sem desvio — campo a campo idêntico ao padrão de `asset_id` |
| 2 | `app/models/pluggy.py`: 3 colunas novas | feito, escopo ampliado | Também ganhou `@property account_tipo` (tarefa 8 combinada aqui por eficiência de diff) |
| 3 | `app/categorization/engine.py`: `LiabilitySuggestion`/`suggest_liability`/`suggest_liability_from_index`/`build_liabilities_index` | feito | Mirror exato do bloco de asset (heurística substring, confiança "media") |
| 4 | `app/categorization/service.py`: `list_transactions`/`_apply_suggestions` considerando passivo, novo `set_transaction_liability` | feito | Sem desvio |
| 5 | `app/schemas/categorization.py`/`router.py`: campos de passivo em `TransactionOut`, `LiabilityAssociationIn`, `PUT .../liability` | feito | Sem desvio |
| 6 | `app/pluggy_integration/service.py`/`router.py`: filtro `liability_id` | feito | Sem desvio |
| 7 | `app/liabilities/service.py::delete_liability`: desassociação antes de excluir | feito | Mirror exato de `delete_asset`, implementada junto da migration nesta sprint (risco identificado no planejamento) |
| 8 | `app/schemas/pluggy.py::PluggyTransactionOut`: `account_tipo` via `@property` + eager-load | feito | `joinedload(PluggyTransaction.account)` em `list_transactions`, confirmado sem N+1 |
| 9 | `app/dashboards/service.py`: `_calcula_patrimonio` com helper `_ativos_e_passivos`, `get_summary`/`Summary` +ativos/passivos, `get_por_passivo`/`get_tendencia_por_passivo`, `get_saldo_por_conta` | feito | Sem desvio |
| 10 | `app/schemas/dashboards.py`/`router.py`: novos schemas/endpoints | feito | Sem desvio |
| 11 | Testes backend novos | feito | 32 testes novos (271 no total) |
| 12 | `frontend/src/api/dashboards.ts`: passivo/saldo | feito | Sem desvio |
| 13 | `frontend/src/api/pluggy.ts`/`api/categorization.ts`: `liabilityId`, `account_tipo`, `setTransactionLiability` | feito | Sem desvio |
| 14 | Hooks novos: `useLiabilityGastos`, `useLiabilityGastosTendencia`, `useSaldoPorConta`, `useSetTransactionLiability`; `usePluggyTransactions` +`liabilityId` | feito | Sem desvio |
| 15 | Extrair `CardSparkline`/`TrendChart`/`useTableSort`/`AccountTipoIcon` | feito | Sem desvio |
| 16 | `AssetsPage.tsx`: refatorar para componentes compartilhados | feito | Testes existentes passam sem mudança de assertion (refactor puro) |
| 17 | `DashboardsPage.tsx`: cards Ativos/Passivos/Saldo, funil sem meio de pagamento, ordenação | feito | Reescrita completa do arquivo — drill state virou union discriminado (`receita`/`despesa`/`ativos`/`passivos`/`saldo`) em vez de só `credito`/`debito`; `DashChart` (gráfico de barras redundante) removido |
| 18 | Testes Vitest novos e atualizados | feito | 13 testes novos/reescritos em `DashboardsPage.test.tsx` + `CardSparkline.test.tsx`/`TrendChart.test.tsx`/`useTableSort.test.ts` novos (68 no total) |
| 19 | Deploy na VM de dev + validação manual real | feito | CI verde, `alembic upgrade 0008 → 0009` aplicada, containers 4/4 saudáveis |
| 20 | `scripts/browser-check/check-sprint9.mjs` novo; deletar/reescrever `check-sanfona.mjs` | feito | `check-sanfona.mjs` deletado (premissa — sanfona de 3 níveis — removida, não fazia sentido reescrever) |
| 21 | Atualizar docs vivos | feito | OVERVIEW.md, directory-structure.md, roadmap.md |
| 22 | Relatório de sprint | feito | Este documento |

## Revisão pós-entrega (mesma sessão, feedback do CEO)

Itens abaixo não estavam no plano original — pedidos pelo CEO depois de
ver a entrega inicial rodando de verdade, ainda na mesma sessão, antes de
aprovar a sprint (mesmo padrão da revisão de escopo da Sprint 8).

| # | Pedido do CEO | Status | Implementação |
|---|---|---|---|
| R1 | Funil deve agrupar Despesa/Receita > Categoria > Tipo > Transação | feito | `GrupoAccordion`/`SubcategoriaAccordion` novos em `DashboardsPage.tsx`, calculados no frontend a partir do `GET /dashboards/por-categoria` já existente (agregação por `group_id`) — sem endpoint novo |
| R2 | Ícone de tipo de gasto ao lado esquerdo da coluna Valor | feito | Ícone movido pra dentro da célula Valor (`.valor-cell`), não mais coluna própria |
| R3 | Categorias devem ter cores diferentes ("tá tudo laranja") | feito | Paleta categórica de 8 matizes (`frontend/src/utils/categoryColors.ts`), validada via skill `dataviz` (`scripts/validate_palette.js`) contra a superfície real do app, light e dark |
| R4 | Tipos também devem variar em cores | feito | Tipo deriva um tint `color-mix()` da cor do grupo pai (4 níveis de mistura, ciclados dentro do grupo) |
| R5 | Saldo do cartão deveria mostrar soma da próxima fatura não paga, limite entre parênteses | feito | Investigação do payload real (`creditData`) confirmou `balance` = dívida (não limite); `get_saldo_por_conta` soma débitos na janela `(fatura_vencimento - 1 mês, fatura_vencimento]`; migration `0010` persiste `limite_credito`/`fatura_vencimento` |
| R6 | Tooltip no mouse-over deve exibir o valor do ponto | feito | `CardSparkline` ganhou `<Tooltip>` (não tinha nenhum antes) |
| R7 | Legenda do eixo X por trimestre | feito | `TrendChart` rotula só os meses de início de trimestre (`formatQuarterTick`); ponto de dado continua mensal |
| R8 | Porcentagem também deve ordenar a tabela | feito | Coluna % vira `SortableHeader` em `TransacoesPanel` |

## Evidência de testes

### Backend (pytest)

```
278 passed, 297 warnings in 5.26s
```

Cobertura de lógica de negócio: 98% (1541 stmts, 35 miss).

**Breakdown por módulo (novos/tocados nesta sprint, incluindo a revisão):**
- `dashboards/service.py`: 99% (2 linhas não cobertas — ramo defensivo sem impacto de negócio)
- `dashboards/router.py`: 100%
- `liabilities/service.py`: 100%
- `models/pluggy.py`: 100%
- `pluggy_integration/service.py`: 99% (pré-existente, não relacionado à Sprint 9)
- `pluggy_integration/router.py`: 100%
- `categorization/service.py`: 98% (pré-existente)
- `categorization/engine.py`: 92% (ramos de `suggest_category`/`suggest_asset` pré-existentes, não tocados nesta sprint)
- `categorization/router.py`: 92%
- `schemas/dashboards.py`, `schemas/categorization.py`, `schemas/pluggy.py`: 100%

**Testes específicos Sprint 9 (32 na entrega inicial):**
- `test_categorization_engine.py`: `suggest_liability` — match por substring normalizado, isolamento por usuário, sem match
- `test_categorization_service.py`: `set_transaction_liability` — sets/clears, passivo de outro usuário → 404, transação inexistente → 404
- `test_liability_service.py`: `delete_liability` desassociando transações vinculadas (`liability_id`/`liability_sugerido_id` → `NULL`) sem excluí-las — crítico, mirror direto de `test_asset_service.py`
- `test_dashboards_service.py`: `get_summary.ativos`/`.passivos` batendo com a mesma base de `patrimonio`; `get_por_passivo`/`get_tendencia_por_passivo` — nunca soma crédito, zero-preenchida, isolamento; `get_saldo_por_conta` — fallback apelido→nome, isolamento
- `test_dashboards_endpoints.py`: 401 sem cookie e isolamento entre usuários nas 3 rotas novas (`por-passivo`, `.../tendencia`, `saldo-por-conta`)
- `test_categorization_endpoints.py`: `PUT .../liability` — set/clear, 404 (inválido e cross-user), 401 sem cookie
- `test_pluggy_endpoints.py`: filtro `liability_id` (isolado e isolado por usuário), `account_tipo` na resposta

**Testes da revisão pós-entrega (7 novos):**
- `test_pluggy_service.py`: `_upsert_account` persiste `limite_credito`/`fatura_vencimento` de `creditData`; ausência de `creditData` deixa os dois campos `None`
- `test_dashboards_service.py`: `get_saldo_por_conta` de cartão soma a fatura da janela (inclui limite/exclui fora da janela/nunca soma crédito), cai pro saldo bruto sem `fatura_vencimento`, conta não-cartão ignora `limite_credito`; `_subtract_month` — rollover de ano em janeiro, clamp de dia (31 mar → 28 fev)

### Frontend (vitest)

```
Test Files  13 passed (13)
     Tests  77 passed (77)
```

**Testes específicos Sprint 9 (13 na entrega inicial, em `DashboardsPage.test.tsx` + 3 arquivos novos):**
- `DashboardsPage.test.tsx`: cards Ativos/Passivos/Saldo incluídos no resumo; funil expandindo direto de categoria pra transações; percentual na linha de extrato; ícone de meio de pagamento por linha; reordenação da tabela ao clicar num cabeçalho de coluna; drill-down de Ativos com toggle despesa/receita; drill-down de Passivos sem toggle; drill-down de Saldo ignorando o filtro ano/mês
- `CardSparkline.test.tsx` (novo): nada renderizado com <2 valores, spark renderizado com ≥2
- `TrendChart.test.tsx` (novo): container `.dash-chart` renderizado, sem crash com 1 ponto
- `useTableSort.test.ts` (novo): ordena pela chave/direção inicial, alterna direção no mesmo clique, reseta pra asc numa chave diferente, não muta o array original

**Testes da revisão pós-entrega (9 novos/reescritos):**
- `DashboardsPage.test.tsx`: funil reescrito pra 3 níveis (expande Categoria, depois Tipo, só então chega na transação); sanfona testada nos dois níveis (2 grupos expandidos simultaneamente; 2 tipos do mesmo grupo expandidos simultaneamente); percentual verificado nos 3 níveis (grupo contra total, tipo contra grupo, transação contra tipo); ícone confirmado dentro da célula Valor; coluna % ordenável; limite de crédito entre parênteses no saldo do cartão
- `categoryColors.test.ts` (novo): atribuição por id estável (não por ordem de input), wrap após 8 grupos, fallback neutro pra grupo desconhecido, tint derivado do grupo pai, tint index escopado por grupo

**Refactor validado (sem mudança de assertion):**
- `AssetsPage.test.tsx`: 100% verde pós-extração de `CardSparkline`/`TrendChart`

### Lint/formatter

```
backend: ruff check . → All checks passed!
backend: ruff format --check . → 85 files already formatted
frontend: npx eslint . → 0 problems
frontend: npx tsc -b --noEmit → 0 errors
frontend: npx prettier --check . → All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

1. **`account_tipo` via `@property` no model, não coluna duplicada** — Pydantic v2 `from_attributes` trata `@property` como atributo comum, menor diff que desnormalizar o tipo de conta em `pluggy_transactions`. Risco identificado no plano (N+1 — toda linha passaria a acessar `tx.account`) confirmado e mitigado com `joinedload(PluggyTransaction.account)` em `list_transactions`.

2. **`asset_id`/`liability_id` não adicionados a `PluggyTransactionOut`** — cogitado ao implementar `account_tipo`, revertido: o plano só pedia `account_tipo` nesse schema, e nada no frontend precisava dos dois campos ali (a listagem básica de `/pluggy/transactions` não é o mesmo schema usado pela fila de Categorização, que já expõe esses campos via `TransactionOut`). Mantido como diff mínimo.

3. **`DashChart` (gráfico de barras acima da lista) removido, não mantido "para reuso futuro"** — primeira versão do arquivo manteve a função exportada por precaução; corrigido para excluí-la de fato, conforme pedido explícito do PRD/plano ("remoção do gráfico de barras redundante") e a diretriz do projeto de não deixar código morto por especulação.

4. **`useDashboardByMeioPagamento.ts` deletado, `GET /dashboards/por-meio-pagamento` mantido no backend** — o hook ficou órfão (só `DashboardsPage` o usava) após a remoção do nível "meio de pagamento" do funil; o endpoint backend não foi tocado — nada no PRD pediu removê-lo, e mantê-lo preserva a capacidade de agregação para uma futura tela que precise dela, sem custo de manutenção (não é código morto, é uma rota testada e funcional sem consumidor no momento).

5. **Drill state do Dashboard virou union discriminado (`DrillKind`) com um único `expandedRows: number[]`** — a estrutura antiga (`expandedCategorias`/`expandedMeios` aninhados) existia só por causa do terceiro nível do funil, que deixou de existir. Como só uma seção (`receita`/`despesa`/`ativos`/`passivos`/`saldo`) fica aberta por vez, um único array de ids expandidos cobre os três casos que expandem linha (categoria/ativo/passivo) sem precisar de estruturas aninhadas por card.

6. **`TransacoesPanel` unificado para os três funis (categoria/ativo/passivo)** — em vez de 3 componentes de tabela quase idênticos, um único componente parametrizado por `categoriaId`/`assetId`/`liabilityId`/`tipo`/`totalParaPercentual` (coluna % só aparece quando `totalParaPercentual` é passado — só o funil de categoria tem essa base hoje). Reaproveita `useTableSort` e `AccountTipoIcon` uma única vez.

7. **Token de sessão para QA visual gerado via `docker compose exec api python -c "...create_access_token(1)..."` na VM de dev** — mesmo mecanismo das sprints anteriores (nunca uma credencial nova ou bypass de auth); usuário `id=1` confirmado como o único cadastrado (`daniellimabr@gmail.com`) antes de gerar o token.

### Revisão pós-entrega

8. **Agrupamento Categoria>Tipo calculado 100% no frontend, sem endpoint novo** — `GET /dashboards/por-categoria` já retorna cada linha com `group_id`/`group_nome` junto do `subcategory_id`/`subcategory_nome`; bastou agregar client-side por `group_id` (soma dos totais, recomputa percentual contra o total geral reconstituído somando os próprios totais). Evitou um endpoint de agregação por grupo só pra isso.

9. **Cor por identidade (id estável), nunca por ranking do período** — non-negotiable da skill `dataviz` ("color follows the entity, never its rank"): a primeira tentativa cogitada foi colorir pela posição no ranking (categoria #1 do mês = cor 1), descartada porque a mesma categoria mudaria de cor mês a mês conforme o ranking mudasse. A versão final busca `GET /category-groups`/`GET /subcategories` (catálogo completo, não escopado ao período) e atribui cor pelo índice do id em ordem crescente — estável para sempre, mesmo que a categoria não apareça em todo período.

10. **Paleta com 8 slots, sem ciclar além disso** — o catálogo real do CEO tem mais de 8 grupos (import do legado trouxe 15). A skill `dataviz` proíbe gerar uma 9ª cor ciclando o array (colide identidade). Solução: módulo 8 do índice estável — grupos além do 8º **compartilham** cor com um grupo anterior (colisão aceita, documentada), em vez de um "Outros" cinza que apagaria a cor de categorias reais. Trade-off registrado no PRD-009 e no roadmap.

11. **Tint do Tipo via `color-mix(in oklch, ...)` em vez de uma segunda paleta hardcoded** — deriva a cor do Tipo a partir da cor do grupo pai misturada com `var(--surface)` (85%/65%/45%/25%), o que automaticamente adapta pro tema claro/escuro sem duplicar valores — misturar com `--surface` (branco no claro, `#212024` no escuro) já produz o tom certo em cada tema.

12. **Janela de fatura auto-contida `(vencimento - 1 mês, vencimento]`, sem depender de `balanceCloseDate`** — a Pluggy retornou `balanceCloseDate: null` no payload real inspecionado; só `balanceDueDate` veio preenchido. Em vez de esperar por um dado que pode nunca vir, a janela é derivada só do próprio vencimento (recorrência mensal), sem qualquer outro campo do sync.

13. **Card "Saldo" mostra a fatura calculada a partir de `pluggy_transactions`, não o campo `balance` bruto** — pedido explícito do CEO ("somarmos o valor de itens não pagos"), mesmo a investigação tendo confirmado que `balance` já é a dívida total. Os dois números podem divergir na prática (validado contra dado real: `balance`=R$12.585,36 vs. fatura da janela=R$3.846,59) porque `balance` inclui parcelamentos futuros/dívida acumulada, enquanto a janela isola só o ciclo mais recente — a leitura mais próxima de "quanto vou pagar na próxima fatura".

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `GET /dashboards/summary` inclui `ativos`/`passivos` consistentes com `patrimonio` | sim | `test_get_summary_ativos_passivos_match_patrimonio_base`: `patrimonio == ativos - passivos + saldo_contas - saldo_cartoes` na mesma base; QA visual confirmou contra dado real (R$284.500,00 ativos, R$0,00 passivos) |
| 2. Cards Ativos/Passivos ao lado dos existentes, cada um abre o drill-down correto (Ativos com toggle, Passivos só despesa) | sim | `DashboardsPage.test.tsx`: "opens the ativos drilldown with despesa/receita toggle"/"opens the passivos drilldown without a despesa/receita toggle"; QA visual: screenshots `sprint9-02`/`sprint9-03` |
| 3. Card Saldo abre saldo atual por conta, ignora filtro ano/mês | sim | `test_saldo_por_conta_returns_current_balance_ignoring_period` (backend, sem parâmetro de período); `DashboardsPage.test.tsx`: "opens the saldo por conta drilldown and ignores the ano/mes filter" — troca de filtro não muda a chamada `saldo-por-conta` |
| 4. Transação com `liability_id` soma no total do passivo, nunca aparece se `tipo=credito` | sim | `test_get_por_passivo_never_sums_credito`; `get_por_passivo` filtra `tipo=debito` internamente, sem parâmetro exposto |
| 5. Sugestão automática preenche `liability_sugerido_id`/`liability_sugestao_confianca` | sim | `test_suggest_liability_matches_by_normalized_contains`; `test_list_transactions_applies_suggestion_but_never_confirms` (mirror de asset) cobre a integração via `_apply_suggestions` |
| 6. `PUT .../liability`: passivo de outro usuário/inexistente → 404; válido associa sem alterar `asset_id`/`subcategory_id` | sim | `test_set_transaction_liability_other_users_liability_raises_not_found`, `test_set_and_clear_liability_association` (endpoint) |
| 7. `DELETE /liabilities/{id}` com transações vinculadas: exclui o passivo, desassocia (nunca exclui transação) | sim | `test_delete_liability_disassociates_transactions_without_deleting_them` |
| 8. Funil de Despesa/Receita expande em Categoria > Tipo antes da transação; ícone de meio de pagamento ao lado do valor; Categoria e Tipo com cores distintas (revisado) | sim | `DashboardsPage.test.tsx`: "expands the funnel from despesa through grupo and tipo down to the transaction list"; "each transaction row renders an account tipo icon to the left of the value"; QA visual: screenshot `sprint9-06-tipo-expandido` mostra cores por nível e ícone na célula Valor |
| 9. Clique em cabeçalho reordena a tabela, incluindo a coluna % (revisado) | sim | `useTableSort.test.ts`: toggle de direção no mesmo clique, reset pra asc em chave diferente; `DashboardsPage.test.tsx`: "reorders the transaction table..." e "sorts the transaction table by percentual..." |
| 10. Hover num ponto mostra tooltip com valor exato; eixo X do gráfico de tendência rotula só trimestres (revisado) | sim | `CardSparkline.tsx`/`TrendChart.tsx`: `<Tooltip formatter={...}>` do Recharts; `formatQuarterTick` só rotula meses ≡1 (mod 3); verificado visualmente (Recharts Tooltip não é testável de forma confiável em jsdom) |
| 11. Card "Saldo" com cartão de crédito mostra fatura atual + limite entre parênteses (novo, revisão) | sim | `test_get_saldo_por_conta_credit_card_shows_sum_of_current_invoice`; QA visual: screenshot `sprint9-04-drilldown-saldo` mostra "R$ 3.846,59 (limite R$ 15.300,00)" contra dado real |
| 12. Isolamento entre usuários nos endpoints novos | sim | `test_get_por_passivo_isolated_by_user`, `test_get_tendencia_por_passivo_isolated_by_user`, `test_get_saldo_por_conta_isolated_by_user`, `test_list_transactions_filters_by_liability_id_isolated_by_user` |
| 13. Rotas novas sem cookie → 401 | sim | `test_por_passivo_without_cookie_returns_401`, `test_por_passivo_tendencia_without_cookie_returns_401`, `test_saldo_por_conta_without_cookie_returns_401`, `test_set_liability_without_cookie_returns_401` |
| 14. Testes novos passam com cobertura ≥80% nos módulos tocados | sim | 278 backend (98%) + 77 frontend, todos os módulos tocados em 92-100% |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md`: nova seção "Ativos/Passivos no Dashboard (Sprint 9) — E6 fechado" com schema, endpoints, decisão de `account_tipo`/`joinedload`, remoção do nível "meio de pagamento", componentes compartilhados extraídos, QA visual; contagem de testes atualizada em "Qualidade (Sprint 1 → Sprint 9)"; header do doc, bullet "Banco (PostgreSQL)" (+migrations 0009/0010) e bullet "Frontend" (funil de 3 níveis, cores, cards atualizados)
- `docs/directory-structure.md`: migrations `0009`/`0010`, `models/pluggy.py`/`schemas/*`/`categorization/*`/`pluggy_integration/*`/`liabilities/service.py`/`dashboards/*` atualizados; `components/CardSparkline.tsx`/`TrendChart.tsx`/`AccountTipoIcon.tsx`, `hooks/useLiabilityGastos*`/`useSaldoPorConta.ts`/`useSetTransactionLiability.ts`/`useTableSort.ts`, `utils/categoryColors.ts` adicionados, `useDashboardByMeioPagamento.ts` removido; `check-sprint9.mjs` adicionado (depois atualizado pro funil de 3 níveis), `check-sanfona.mjs` removido; "O que ainda não existe" atualizado (Ativos/Passivos no Dashboard entregues; CRUD de passivos pela UI registrado como pendência nova)
- `docs/roadmap.md`: E6 marcado ✅ (épico fechado); Sprint 9 marcada "✅ concluída em 2026-08-15" com resumo completo do que foi entregue, incluindo um parágrafo dedicado à revisão pós-entrega
- `docs/prd/PRD-009-dashboards-ativos-passivos.md`: nota de revisão explícita (2026-08-15) + Escopo/Critérios de aceite/Regras de negócio/Dados e modelo atualizados pra refletir o funil de 3 níveis, cores, fatura+limite do cartão e migration `0010` — o escopo original fica registrado na nota, mesmo padrão da revisão do PRD-008 na Sprint 8

## Consumo estimado de tokens/sessões

Sprint 9 implementou 22 tarefas planejadas (10 backend, 7 frontend, deploy,
QA, docs, relatório) + 8 itens de revisão pós-entrega (funil de 3 níveis,
paleta categórica, reposicionamento de ícone, ordenação de %, tooltips,
eixo X por trimestre, fatura+limite do cartão) numa única sessão longa de
execução. Volume bem acima do usual — maior peso no backend (mirror
completo de asset→liability em 6 módulos + investigação de payload real
da Pluggy + migration extra) e no frontend (reescrita de
`DashboardsPage.tsx` duas vezes — remoção de um nível do funil na entrega
inicial, depois reintrodução de dois níveis com cores na revisão). Modelo:
Sonnet para toda a implementação/testes/debug/deploy/investigação; este
relatório também gerado por Sonnet, sem handoff para Haiku.

## Pendências e próximos passos sugeridos

### Sprint 10 (E3, polish)
Modernização visual da tabela de Categorização (hoje HTML puro, sem
tokens do design system) reaproveitando tipografia/layout do design
system. Sem dependência desta sprint.

### Registrado como pendência nova (não estava em "O que ainda não existe" antes)
CRUD de passivos pela UI (criar/editar/quitar) — só a associação
transação↔passivo entrou nesta sprint (schema, sugestão, filtro,
drill-down de leitura), conforme escopo explícito do PRD-009. Backend de
CRUD já existe em `app/liabilities/` desde a Sprint 2; fica para quando o
roadmap priorizar, mesmo padrão de `assets` (Sprint 8).

### Risco documentado, não bloqueante
Mais de 8 grupos de categoria reais (o import do legado trouxe 15) fazem
a paleta categórica repetir cor a partir do 9º grupo (por id, estável —
nunca por ranking). Aceito conscientemente na revisão em vez de um bucket
"Outros" cinza; se incomodar na prática, a saída é ampliar a paleta (mais
matizes validados via `dataviz`) em vez de mudar o mecanismo de
atribuição.

---

**Sprint aprovada pelo CEO em 2026-08-15.**
