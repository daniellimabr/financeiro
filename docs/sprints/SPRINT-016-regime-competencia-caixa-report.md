# SPRINT-016: Regime de Competência/Caixa e Patrimônio por Saldo Acumulado — Relatório

- **Plano:** [SPRINT-016-regime-competencia-caixa-plan.md](./SPRINT-016-regime-competencia-caixa-plan.md)
- **Data do relatório:** 2026-08-17

## Resumo

Cartão de crédito passa a ter `data_competencia` sempre no mês seguinte ao
evento (sem dia de corte); novo `data_caixa` (competência + 1 mês extra pra
cartão, igual à competência pros demais tipos). Toggle Competência/Caixa
adicionado no Dashboard, Ativos e Passivos, mudando de fato os números
exibidos (confirmado contra dado real). Patrimônio deixa de ser snapshot
bancário e passa a ser Saldo Acumulado líquido (exclui investimento) + saldo
de investimentos ao vivo + Ativos − Passivos. Bug real de fuso horário em
`_parse_date` corrigido e confirmado contra dado real após re-sync — inclusive
achou uma segunda transação afetada além do caso de verificação do PRD.
Deploy na VM de dev e validação ao vivo sem nenhum bug real na aplicação —
achado foi só no próprio script de QA (assertion invertida). Um ponto de
configuração real ficou pendente do CEO (ver "Pendências").

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Corrigir `_parse_date` (fuso horário) | feito | Sem desvio |
| 2 | `competencia_padrao`/`caixa` em `app/categorization/competencia.py` | feito | Sem desvio |
| 3 | Migration `0013`: `data_caixa` + backfill | feito | `_backfill` extraída como função plana (testável fora do contexto `op` do alembic) — decisão de implementação não detalhada no plano, mesmo espírito do precedente de migrations testáveis |
| 4 | Aplicar `competencia_padrao`/`caixa` nos 3 pontos de escrita | feito | Sem desvio |
| 5 | `_competencia_column`/parâmetro `regime` em `dashboards/service.py` | feito | Sem desvio |
| 6 | `_base_query` +`excluir_investimento`; `get_saldo_acumulado` exclui investimento | feito | Sem desvio |
| 7 | Redesenhar `PatrimonioBreakdown`/`_patrimonio_breakdown` | feito | Fallback de conta sem `saldo_inicial` ficou tipo-aware (cartão de crédito subtrai, demais somam, mesma convenção de `_base_query`) — não estava explícito no plano, necessário pra não inverter o sinal da dívida de cartão no fallback |
| 8 | `regime` nos endpoints de `dashboards/router.py` | feito | Sem desvio |
| 9 | Testes backend | feito | 39 testes novos (418 no total) — inclui `test_migration_0013_data_caixa.py` novo (precedente: migration testada via `importlib`, sem depender do contexto `op`) |
| 10 | `RegimeToggle.tsx` novo | feito | Sem desvio |
| 11 | State `regime` levantado em `DashboardsPage.tsx` | feito | Também levantado em `AssetsPage.tsx`/`LiabilitiesPage.tsx` (não listados explicitamente na tarefa 11, mas exigidos pela tarefa 14 — testes desses arquivos com asserção de `regime` no request só fazem sentido se as páginas tiverem o toggle) |
| 12 | Hooks com parâmetro `regime` | feito | Também `useDashboardCategoriaTendencia` (drill-down de tendência por categoria) — fora da lista literal da tarefa 12, mas o backend já suporta `regime` em `/por-categoria/tendencia` (tarefa 8) e o PRD lista "drill-downs de Categoria" no escopo do toggle; deixar esse hook parado teria sido uma inconsistência visível |
| 13 | `PatrimonioBreakdownPanel.tsx` atualizado | feito | "Ver detalhe" de "Saldo líquido acumulado" passou a abrir o drill-down existente de "Saldo Acumulado" (`TrendChart`) em vez de "Saldo em conta" (que não existe mais) — decisão de UX não especificada no plano |
| 14 | Testes frontend | feito | 7 testes novos (162 no total) — `RegimeToggle.test.tsx` novo, `DashboardsPage`/`AssetsPage`/`LiabilitiesPage` estendidos |
| 15 | Deploy VM de dev + re-sync + `check-sprint16.mjs` | feito | Ver "Decisões tomadas" — 1ª rodada do script achou uma assertion própria errada (não um bug da aplicação), corrigida e revalidada |
| 16 | Validação manual (cartão, toggle, "BRASA E DRINKS", `saldo_inicial`) | parcial | 3 dos 4 itens verificados diretamente contra a API real (ver "Critérios de aceite"); "toggle bate com a planilha do CEO" e "toda conta com `saldo_inicial`" ficam para o CEO — ver "Pendências" |
| 17 | Docs vivos | feito | Sem desvio |
| 18 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend

```
418 passed, 450 warnings in 7.37s
TOTAL                                 1864     38    98%
app\categorization\competencia.py       23      0   100%
app\categorization\service.py          192      2    99%
app\dashboards\service.py              296      3    99%
app\pluggy_integration\service.py      200      4    98%
```

### Frontend

```
Test Files  24 passed (24)
     Tests  162 passed (162)
  Duration  ~7-9s
```

Cobertura de lógica de negócio: 98% total no backend (98-100% nos módulos
tocados por esta sprint). Frontend sem gate de cobertura numérica (padrão do
projeto), mas toda superfície nova (`RegimeToggle`, threading de `regime` nos
9 hooks, `PatrimonioBreakdownPanel` redesenhado) tem teste de integração
dedicado, incluindo asserção do `regime` no request real (`AssetsPage.test.tsx`,
`LiabilitiesPage.test.tsx`, `DashboardsPage.test.tsx`). Meta ≥80% atendida.

## Lint/formatter

```
backend: ruff check . — All checks passed!
backend: ruff format --check . — 91 files already formatted
frontend: tsc -b — sem erros
frontend: eslint . — sem erros
frontend: prettier --check . — All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

- **Cartão de crédito tem prioridade sobre a regra de Salário em
  `_recompute_data_competencia`.** O plano não especificava a ordem de
  checagem entre as duas regras (não deveria colidir na prática — salário
  não entra por cartão — mas o código precisa de uma ordem determinística).
  Decidido checar `account_tipo == cartao_credito` primeiro, competência
  sempre desloca incondicionalmente nesse caso, ignorando a subcategoria;
  regra de Salário só se aplica quando a conta não é cartão.
- **Fallback de Patrimônio para conta sem `saldo_inicial` é tipo-aware
  (sinal invertido pra cartão de crédito).** A primeira implementação somava
  o saldo ao vivo de toda conta sem `saldo_inicial` diretamente, sem
  distinguir tipo — isso inverteria o sinal da dívida de cartão de crédito
  no breakdown (o saldo de um cartão representa o que se deve, não um
  ativo). Corrigido pra espelhar a mesma convenção de sinal já usada em
  `_base_query` desde a Sprint 5 (cartão de crédito subtrai, demais tipos
  somam) — confirmado que `test_get_summary_patrimonio_subtracts_cartao_credito_balance`
  (teste pré-existente da Sprint 5, sem alteração de asserção) continua
  passando com a nova implementação, mesmo com a mudança de semântica de
  "snapshot" pra "acumulado".
- **`_parse_date` bugado afetava mais transações do que o único caso citado
  no PRD.** Depois do re-sync na VM de dev, além da transação "BRASA E
  DRINKS" (`2026-01-23T01:34:27Z`) usada como caso de verificação, uma
  segunda transação do mesmo comerciante também corrigiu a data
  (`2026-01-16` → `2026-01-15`) — evidência real de que o bug não era um
  caso isolado, reforça que a correção (e o re-sync obrigatório pós-deploy)
  era necessária, não cosmética.
- **`check-sprint16.mjs`: 1ª rodada acusou "Ativos não deveria ter toggle
  'Tipo de transação' próprio" — falso positivo do script, não bug da
  aplicação.** A assertion partiu de uma premissa errada: `AssetsPage.tsx`
  já tinha um toggle Despesa/Receita desde a Sprint 8, independente do
  `RegimeToggle` novo desta sprint — os dois coexistem por design. Corrigida
  a assertion pra checar que o toggle antigo **continua presente** (em vez
  de checar que não existe), revalidado com sucesso.
- **401 no console durante o QA visual investigado e confirmado benigno,
  não uma regressão desta sprint.** Rodei um script de diagnóstico à parte
  (navegação idêntica, sem o passo de logout) e o 401 não ocorreu — confirma
  que é o mesmo race condition já documentado na Sprint 15 (chamada em voo
  no instante exato em que o cookie de sessão é limpo pelo logout), não algo
  novo introduzido pelas mudanças de `regime`.
- **Toda validação contra dado real foi feita por leitura direta da API
  (`curl` autenticado com token de sessão), sem nenhuma mutação de dado do
  CEO além do `POST /pluggy/sync` explicitamente previsto no plano** (que é
  idempotente e só corrige `data`/`data_competencia`/`data_caixa` de
  transações já existentes).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Transação de cartão sincronizada sempre tem `data_competencia` = mês seguinte a `data` | sim | `test_competencia_padrao_cartao_shifts_unconditionally_*`, `test_sync_item_credit_card_shifts_data_competencia_to_next_month`; confirmado contra dado real: `GET /pluggy/transactions?account_tipo=cartao_credito` mostra `data=2028-05-29 → data_competencia=2028-06-29` (e as 5 transações seguintes da amostra, mesmo padrão) |
| 2. `data_caixa` = mês seguinte a `data_competencia` para cartão | sim | `test_caixa_cartao_shifts_one_more_month_past_competencia`, `test_sync_item_credit_card_shifts_data_competencia_to_next_month` (`data_caixa=2026-03-15` pra `data=2026-01-15`) |
| 3. `data_caixa = data_competencia` pra conta não-cartão, mesmo com competência deslocada por Salário | sim | `test_caixa_non_cartao_equals_competencia_even_when_shifted_by_salario`, `test_set_category_non_credit_card_sets_data_caixa_equal_to_competencia` |
| 4. Toggle Competência/Caixa recarrega Receita/Despesa/Saldo/tendência/drill-downs/Saldo Acumulado/Patrimônio consistentemente | sim | Testes de regime em cada função de `dashboards/service.py` + `DashboardsPage.test.tsx`; confirmado contra dado real: `Despesa` competência R$ 8.309,59 vs. caixa R$ 8.066,41 no mesmo filtro de período |
| 5. Saldo Acumulado exclui `tipo=investimento` da soma/acumulação | sim | `test_get_saldo_acumulado_excludes_investimento_from_anchor`, `test_get_saldo_acumulado_excludes_investimento_transactions_from_accumulation` |
| 6. Conta líquida sem `saldo_inicial` entra no Patrimônio pelo saldo ao vivo, sem quebrar as demais | sim | `test_patrimonio_breakdown_fallback_account_without_saldo_inicial_uses_live_balance`, `test_patrimonio_breakdown_fallback_credit_card_without_saldo_inicial_subtracts`; **exercitado contra dado real** — a conta "NuBank - Cartão de Crédito" não tem `saldo_inicial`, confirmado que o breakdown segue calculando sem erro (ver "Pendências") |
| 7. Backfill da migration `0013` reflete o novo shift em cartão + popula `data_caixa` pra toda transação | sim | `test_backfill_shifts_competencia_and_sets_caixa_for_credit_card`, `test_backfill_keeps_existing_competencia_and_mirrors_caixa_for_non_credit_card`, `test_backfill_credit_card_clamps_day_overflow_across_two_months`; migration aplicada com sucesso na VM de dev (`alembic current` → `0013 (head)`) |
| 8. Bug de fuso corrigido — "BRASA E DRINKS" (`...T01:34:27Z`) grava `2026-01-22` após re-sync | sim | `test_parse_date_converts_utc_timestamp_near_midnight_brt_to_previous_day`; **confirmado contra dado real da VM de dev**: `GET /pluggy/transactions?ano=2026&mes=1` mostrou a transação mudando de `data=2026-01-23` pra `data=2026-01-22` após `POST /pluggy/sync` |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — banner de topo atualizado; seção nova
  "Regime de Competência/Caixa e Patrimônio por Saldo Acumulado (Sprint 16)
  — sem épico prévio"; seção "Qualidade" renomeada pra "Sprint 1 → Sprint
  16" com o parágrafo de testes desta sprint.
- `docs/directory-structure.md` — entradas atualizadas em
  `categorization/competencia.py`, `categorization/service.py`,
  `pluggy_integration/service.py`, `dashboards/service.py`,
  `dashboards/router.py`, migration `0013`, testes de backend (+
  `test_migration_0013_data_caixa.py` novo), `api/dashboards.ts`, 9 hooks,
  `RegimeToggle.tsx` novo, `DashboardsPage.tsx`/`AssetsPage.tsx`/
  `LiabilitiesPage.tsx`, `check-sprint16.mjs` novo.
- `docs/roadmap.md` — Sprint 16 marcada como concluída, corpo da entrada
  atualizado com o que foi de fato implementado/validado, link do relatório
  adicionado.
- `docs/prd/PRD-016-...md` e `docs/sprints/SPRINT-016-...-plan.md` — já
  existiam da sessão de planejamento, sem alteração.

## Consumo estimado de tokens/sessões

Sessão única de execução (implementação backend+frontend, testes, deploy,
re-sync, validação contra dado real via API, QA visual, correção do próprio
script de QA, docs, relatório) — escopo comparável às Sprints 13/15.

## Pendências e próximos passos sugeridos

- **Ação pendente do CEO, não bloqueia a sprint:** a conta "NuBank - Cartão
  de Crédito" não tem `saldo_inicial` preenchido em Configurações. O
  fallback funciona corretamente (não quebra o cálculo — critério de
  aceite 6 confirmado), mas o card "Patrimônio" só vai refletir o Saldo
  Acumulado real dessa conta específica (em vez do saldo ao vivo bruto)
  depois que o campo for preenchido — mesmo aviso já registrado no plano da
  sessão de planejamento.
- **CEO precisa validar o toggle contra a planilha de referência própria**
  (critério "bate com a expectativa" do plano, item de risco explícito) —
  passo manual, fora do alcance desta execução; os números confirmados aqui
  (Despesa/Patrimônio mudando entre os dois regimes) mostram que o
  mecanismo funciona, mas não substituem a conferência linha a linha contra
  a planilha do CEO.
- Nenhum bloqueio técnico conhecido. Suíte 100% verde, deploy e migration
  aplicados com sucesso na VM de dev, QA visual sem achados reais na
  aplicação.
- Heurística de dia útil para o lag Pluggy vs. extrato bancário real e
  extensão do toggle às telas "Natureza"/"Projeção" seguem fora de escopo
  por decisão explícita do CEO — já registradas em
  `docs/roadmap.md` ("Registro de reavaliações futuras").
