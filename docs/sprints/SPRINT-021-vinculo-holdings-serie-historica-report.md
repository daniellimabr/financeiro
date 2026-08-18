# SPRINT-021: Vínculo holdings↔Investimento + série histórica mensal — Relatório

- **Plano:** [SPRINT-021-vinculo-holdings-serie-historica-plan.md](SPRINT-021-vinculo-holdings-serie-historica-plan.md)
- **PRD:** [PRD-021-vinculo-holdings-serie-historica.md](../prd/PRD-021-vinculo-holdings-serie-historica.md)
- **Progresso/achados detalhados da execução:** [SPRINT-021-progress.md](SPRINT-021-progress.md)
- **Data do relatório:** 2026-08-18

## Resumo

Motor de sugestão automática holding→Investimento (código exato → similaridade de nome),
rotina de proposta de baseline em 31/12/2025 por holding com confiança marcada por linha
(revisada e aprovada pelo CEO antes de gravar), reconstrução retroativa da série mensal
jan-ago/2026 + job de snapshot idempotente dali pra frente, e UI nova (sugestão
pré-selecionada, tela de revisão de baseline, série histórica em gráfico+tabela). Aplicado
de ponta a ponta contra as 22 holdings reais da conta do CEO — baseline aprovado, 18
vínculos holding→caixinha reconstruídos manualmente (o motor de sugestão não resolve CDBs
com nome idêntico/código nulo, achado real registrado no roadmap), validado ao vivo em
Investimentos e Patrimônio.

## Achado que corrigiu a documentação do projeto

Bloco 0 revelou que a premissa registrada desde 2026-08-04 ("VM de dev sem dado real") está
desatualizada: **não existe ambiente de produção provisionado** — a VM de dev é hoje o único
ambiente rodando o app, com dados financeiros reais da família sincronizados via Pluggy (22
holdings). Corrigido em `CLAUDE.md`, `docs/infra/ssh-workflow.md` e
`docs/architecture/OVERVIEW.md` nesta sessão, com aprovação explícita do CEO.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Bloco 0: investigação read-only em produção | feito | Rodou na VM de dev (não em prod — prod não existe, ver achado acima) |
| 2 | Fechar algoritmo de baseline + separação valorização/rendimento | feito | Refinado em relação ao rascunho: taxa CDI/IPCA não é fixa (índice sem histórico integrado); só posição pós-corte e taxa verdadeiramente fixa (`fixedAnnualRate`) têm confiança "alta" |
| 3 | Migration 0017 | feito | — |
| 4 | Models `PluggyInvestment`/`PluggyInvestmentSnapshot` | feito | — |
| 5 | Motor de sugestão `suggest_holding_investimento` | feito | Não resolve holdings com nome idêntico/código nulo (as 18 CDBs Nubank) — limitação real, registrada no roadmap como candidata a sprint futura |
| 6 | Aplicar sugestão em `sync_item` | feito | — |
| 7 | Rotina de baseline + endpoints revisão/confirmação | feito | — |
| 8 | Reconstrução retroativa jan-ago/2026 | feito | — |
| 9 | Job de snapshot mensal idempotente | feito | — |
| 10 | `get_evolucao_mensal` | feito | — |
| 11 | Router + schemas novos | feito | — |
| 12 | Testes backend | feito | 563 passando (+31), 98% cobertura nos módulos tocados |
| 13 | `api/pluggy.ts` + hooks | feito | — |
| 14 | Sugestão pré-selecionada em `AccountManagementPage` | feito | — |
| 15 | Tela de revisão do baseline | feito | — |
| 16 | UI de série histórica | feito | — |
| 17 | Testes frontend | feito | 186 passando (+5) |
| 18 | Deploy VM dev + validação ao vivo | feito | Achou e corrigiu um bug real (colgroup ausente causando texto vazando entre colunas) |
| 19 | Deploy produção + aplicar vínculo/baseline real | feito, com desvio | Não existe prod (achado do Bloco 0) — baseline aplicado direto na VM de dev, único ambiente real. Vínculo das 18 CDBs exigiu reconciliação manual com o CEO (extrato real), fora do escopo original do motor de sugestão |
| 20 | Atualizar docs vivos | feito | + correção da premissa prod/dev em CLAUDE.md/ssh-workflow.md/OVERVIEW.md, não prevista no plano original |
| 21 | Relatório de sprint | feito | Este documento |

## Evidência de testes

Backend (563 passed, 98% cobertura total, 98% em `app/pluggy_integration/`, 100% em
`app/investimentos/`):

```
app\categorization\engine.py           219      9    96%   ...
app\investimentos\router.py             55      0   100%
app\investimentos\service.py           120      0   100%
app\models\pluggy.py                   183      0   100%
app\pluggy_integration\router.py       105      0   100%
app\pluggy_integration\service.py      404      8    98%   234, 245, 324, 397, 596, 613, 747-748
app\schemas\investimento.py             11      0   100%
app\schemas\pluggy.py                   44      0   100%
------------------------------------------------------------------
TOTAL                                 2517     45    98%
563 passed, 566 warnings in 11.57s
```

Frontend (186 passed):

```
 Test Files  25 passed (25)
      Tests  186 passed (186)
   Duration  37.79s
```

## Lint/formatter

`ruff check`/`ruff format` (backend): `All checks passed!`. `eslint`/`prettier --check`
(frontend): sem erros. Pre-commit hook (ruff, ruff-format, eslint, detect-secrets) passou em
ambos os commits da sprint.

## Decisões tomadas durante a execução

- **Campos de taxa/vencimento não persistidos em `pluggy_investments`.** A rotina de
  baseline busca `rate`/`rateType`/`fixedAnnualRate`/`purchaseDate` ao vivo via
  `PluggyClient.get_investments()` no momento da geração da proposta, em vez de colunas
  novas na migration — esses campos só são necessários uma vez (aprovação do baseline), não
  em todo carregamento de tela.
- **Baseline: só 2 casos de confiança "alta" (não todo `FIXED_INCOME`, como o PRD
  antecipava).** Achado real do Bloco 0: taxa CDI/IPCA é percentual sobre um índice cujo
  histórico o sistema não integra (mesma fronteira de mercado já fora de escopo pra ações).
  Confiança "alta" só quando a posição foi comprada depois do baseline (fato, saldo=0) ou a
  taxa é verdadeiramente fixa (`fixedAnnualRate`, juros compostos). Resto cai em fórmula
  reversa de fluxo, confiança "estimada".
- **Vínculo das 18 CDBs Nubank reconstruído manualmente**, fora do motor de sugestão — ele
  não resolve holdings com nome idêntico e `code`/`isin` nulos. Reconciliação feita
  interativamente com o CEO: correspondência exata de valor de aporte contra o extrato real
  de cada caixinha ("Quitar o AP", "Turbo Ultravioleta 120% CDI", "Reserva de Emergência",
  mais os 2 títulos do "Tesouro Direto Nubank"). Registrado como limitação conhecida no
  roadmap, candidata a sprint futura.
- **Colgroup ausente nas 2 tabelas novas**, achado ao vivo (screenshot real mostrando texto
  de holding vazando sobre a coluna Tipo) — corrigido com `<colgroup>` + `overflow:hidden`/
  `text-overflow:ellipsis` no primeiro/último `<td>` (convenção de toda `.dash-table` desde
  a Sprint 13, que o `<col>` sozinho não propaga pra célula).
- **Correção da premissa prod/dev** em `CLAUDE.md`/`docs/infra/ssh-workflow.md`/
  `docs/architecture/OVERVIEW.md` — não existe ambiente de produção; dev é hoje o único
  ambiente real. Feita com aprovação explícita do CEO durante a sessão.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Sync com holdings sem `investimento_id` recebe sugestão via cascata, sem sobrescrever vínculo manual | sim | `test_sync_item_applies_codigo_exato_suggestion_for_unlinked_holding`, `test_sync_item_never_overwrites_manually_linked_holding`; validado ao vivo (sync real, 0 falsos positivos nas 22 holdings) |
| 2. `<select>` pré-seleciona sugestão com confiança, aceita ou troca manualmente | sim | `AccountManagementPage.test.tsx`, validado ao vivo (screenshot) |
| 3. Baseline gera proposta com confiança explícita, sem persistir até aprovação | sim | `propose_baseline_dez_2025` (read-only) + `confirm_baseline_dez_2025` (persiste só quando chamado); aprovado pelo CEO linha a linha nesta sessão |
| 4. Baseline aprovado → série retroativa populada, valorização/rendimento/dividendos separados por tipo | sim | `reconstruct_historical_snapshots`, validado ao vivo (154 snapshots reais, jan-jul/2026) |
| 5. Job de snapshot mensal idempotente | sim | `test_snapshot_current_month_is_idempotent`; validado ao vivo (rodar 2x não duplicou: 176→176) |
| 6. Endpoint de série mensal sem alterar `get_evolucao` | sim | `test_get_evolucao_unchanged_by_snapshots` (regressão explícita) |
| 7. Isolamento por usuário | sim | testes `_isolated_by_user` em todas as funções novas |
| 8. 401 sem cookie em toda rota nova | sim | `test_baseline_endpoints_without_cookie_return_401`, `test_evolucao_mensal_without_cookie_returns_401` |
| 9. CI com cobertura ≥80% nos módulos tocados | sim | 98% em `pluggy_integration/`, 100% em `investimentos/` |

## Documentação atualizada

`CLAUDE.md` (correção Infra/SSH), `docs/infra/ssh-workflow.md` (correção prod/dev),
`docs/architecture/OVERVIEW.md` (seção Sprint 21 + correção Infraestrutura de
desenvolvimento + contagem de testes), `docs/directory-structure.md` (migration 0017, hooks
novos, browser-check novos), `docs/dashboards-guia-cards.md` (nota sobre baseline/série
histórica), `docs/roadmap.md` (fecha lacuna E6, entrada Sprint 21, 2 itens novos em
"Registro de reavaliações futuras").

## Pendências e próximos passos sugeridos

- **Sugestão automática pra holdings com nome idêntico** (CDBs Nubank) — candidata a sprint
  futura, sem PRD/plano ainda (ver roadmap).
- **Microtransações de investimento na fila de Categorização** — feedback do CEO durante a
  execução; ele prefere controlar aporte/resgate pela conta corrente, não pela transação
  interna da holding. Não investigado nem escopado nesta sprint; registrado no roadmap.
- **4 posições de ações XP (HAPV3, VALE3, TAEE11, BBSE3) seguem sem vínculo** — o CEO só
  confirmou os 18 vínculos de CDB/Tesouro nesta sessão; os 4 vínculos de ação são
  inequívocos por ticker (mesmo padrão `XP - <TICKER>` já usado nos `Investimento`
  existentes) mas não foram aplicados sem pedido explícito.
