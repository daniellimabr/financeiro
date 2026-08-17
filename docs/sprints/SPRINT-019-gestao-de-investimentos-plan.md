# SPRINT-019: Gestão de Investimentos — Plano

- **PRD(s):** [PRD-019-gestao-de-investimentos](../prd/PRD-019-gestao-de-investimentos.md)
- **Data do plano:** 2026-08-17

## Objetivo da sprint

Ao final: (1) o usuário consegue agrupar carteiras de investimento conectadas via Pluggy
em `Investimento`s lógicos, com saldo-base de 01/01/2026 definido manualmente; (2)
aporte/resgate são categorizados como transações normais (com sugestão automática a
confirmar), contando nos totais de Despesa/Receita; (3) existe uma tela
`InvestimentosPage` com card por investimento e drilldown de extrato; (4) o bloco de
investigação de renda automática usou dado real (conta de investimento conectada pelo
CEO) para documentar achados e decidir, com evidência, se algo além do calculado
(`rendimento_estimado`) é viável nesta integração ou fica para sprint futura.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Migration `0015`: tabelas `investimentos` e `investimento_categorization_rules`; colunas `pluggy_accounts.investimento_id`, `pluggy_transactions.investimento_id`/`investimento_sugerido_id`/`investimento_sugestao_confianca`; seed `CategoryGroup` "Investimentos" (`excluir_de_totais=false`) + subcategorias "Aporte"/"Resgate" | Sonnet: implementação | [alembic/versions/0014_*.py](../../backend/alembic/versions/) (modelo mais recente), [alembic/versions/0008_*.py](../../backend/alembic/versions/) (padrão de seed `ON CONFLICT DO NOTHING`) |
| 2 | Model `Investimento` novo; `InvestimentoCategorizationRule` novo (clone de `AssetCategorizationRule`); `PluggyAccount`/`PluggyTransaction` ganham colunas novas; registro em `models/__init__.py` (`__all__`) | Sonnet: implementação | [models/asset.py](../../backend/app/models/asset.py), [models/pluggy.py:77-178](../../backend/app/models/pluggy.py), [models/categorization.py](../../backend/app/models/categorization.py) |
| 3 | Módulo `app/investimentos/` (service + router + schemas): CRUD + `get_evolucao` (saldo_base, saldo_atual, total_aportes, total_resgates, rendimento_estimado) | Sonnet: implementação | [assets/service.py](../../backend/app/assets/service.py), [assets/router.py](../../backend/app/assets/router.py) (padrão a clonar) |
| 4 | `pluggy_integration/service.py`: `update_account()` ganha `investimento_id` (validado por `user_id`); `list_transactions()` ganha filtro `investimento_id` | Sonnet: implementação | [pluggy_integration/service.py:109-127,191-229](../../backend/app/pluggy_integration/service.py) |
| 5 | `pluggy_integration/router.py` + `schemas/pluggy.py`: `PluggyAccountUpdateIn`/`PluggyAccountOut`/`PluggyTransactionOut` ganham campos novos | Sonnet: implementação | [pluggy_integration/router.py:89-105](../../backend/app/pluggy_integration/router.py), [schemas/pluggy.py](../../backend/app/schemas/pluggy.py) |
| 6 | `categorization/engine.py`: `suggest_investimento`/`suggest_investimento_from_index`/`build_investimento_rules_index`/`build_investimento_historico_index` (clone exato do bloco de asset) | Sonnet: implementação | [categorization/engine.py:143-209](../../backend/app/categorization/engine.py) |
| 7 | `categorization/service.py`: `_apply_suggestions` computa `investimento_sugerido_id`/`_confianca`; nova `set_transaction_investimento` | Sonnet: implementação | [categorization/service.py:108-173,255-268](../../backend/app/categorization/service.py) |
| 8 | `categorization/router.py`: `PUT /categorization/transactions/{id}/investimento` | Sonnet: implementação | [categorization/router.py:86-97](../../backend/app/categorization/router.py) |
| 9 | `dashboards/service.py`: `get_por_investimento`/`get_tendencia_por_investimento` (clone de `get_por_ativo`/`get_tendencia_por_ativo`); **nenhuma mudança** em `_base_query`/`_patrimonio_breakdown`/`get_saldo_acumulado` | Sonnet: implementação | [dashboards/service.py:325-357,670-755](../../backend/app/dashboards/service.py) |
| 10 | `dashboards/router.py` + `schemas/dashboards.py`: `GET /dashboards/por-investimento` (+ tendência) | Sonnet: implementação | [dashboards/router.py:132-156](../../backend/app/dashboards/router.py), [schemas/dashboards.py:80-93](../../backend/app/schemas/dashboards.py) |
| 11 | Registrar router de investimentos em `main.py` | Sonnet: implementação | [main.py](../../backend/app/main.py) |
| 12 | Testes backend: CRUD/evolução/isolamento de `Investimento`, `update_account` com `investimento_id`, filtro `investimento_id` em `/pluggy/transactions`, sugestão de investimento (regra/histórico/fuzzy), `set_transaction_investimento`, `get_por_investimento`/tendência, **teste de regressão** confirmando que totais de Despesa/Receita não mudam para transações não relacionadas | Sonnet + skill tdd-workflow | `test_asset_service.py`, `test_asset_endpoints.py` (padrão), `test_categorization_engine.py`, `test_categorization_service.py`, `test_pluggy_service.py`, `test_pluggy_endpoints.py`, `test_dashboards_service.py`, `test_dashboards_endpoints.py` |
| 13 | `api/investimentos.ts` novo; extensões em `api/pluggy.ts`/`api/dashboards.ts`; hooks novos (`useInvestimentos`, `useCreateInvestimento`, `useUpdateInvestimento`, `useDeleteInvestimento`, `useInvestimentoEvolucao`, `useInvestimentoGastos(Tendencia)`, `useSetTransactionInvestimento`, `useUpdatePluggyAccount` estendido) | Sonnet: implementação | [api/assets.ts](../../frontend/src/api/assets.ts), hooks equivalentes de asset em `frontend/src/hooks/` |
| 14 | `InvestimentosPage.tsx` nova (clone estrutural de `AssetsPage.tsx`): cards, form nome-only, drilldown Aporte/Resgate, sparkline/tendência | Sonnet + skill impeccable | [pages/AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) |
| 15 | `TransactionsTable.tsx`/`TransactionEditCells.tsx`: prop/filtro `investimentoId`, `InvestimentoSelectCell` | Sonnet: implementação | [components/TransactionsTable.tsx:28-54](../../frontend/src/components/TransactionsTable.tsx), [components/TransactionEditCells.tsx:122-149](../../frontend/src/components/TransactionEditCells.tsx) |
| 16 | `CategorizationReviewPage.tsx`: coluna/célula de seleção de Investimento ao lado da já existente de Ativo | Sonnet: implementação | [pages/CategorizationReviewPage.tsx:296-302,360-362](../../frontend/src/pages/CategorizationReviewPage.tsx) |
| 17 | `AccountManagementPage.tsx`: `<select>` inline de Investimento para linhas `tipo=investimento` (mesmo padrão de apelido/saldo_inicial já existente); confirmar que a edição de `saldo_inicial` já funciona sem mudança para esse tipo | Sonnet: implementação | [pages/AccountManagementPage.tsx:186-264](../../frontend/src/pages/AccountManagementPage.tsx) |
| 18 | `ProtectedPage.tsx`: nova aba "Investimentos" na navegação | Sonnet: implementação | [pages/ProtectedPage.tsx](../../frontend/src/pages/ProtectedPage.tsx) |
| 19 | Testes frontend: `InvestimentosPage.test.tsx` novo (clone de `AssetsPage.test.tsx`), extensões em `AccountManagementPage.test.tsx`, `CategorizationReviewPage.test.tsx`, `api/dashboards.test.ts` | Sonnet + skill tdd-workflow | testes equivalentes de asset como referência |
| 20 | Deploy VM de dev (Bloco 1+2) | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 21 | Bloco 3, passo 1: confirmar com o CEO que a conta Nubank Investimentos (e XP, se disponível) foi conectada e sincronizada; esclarecer se em produção ou também em dev, dado que a Sprint 18 já registrou que a VM de dev não é estritamente "sem dados reais" (2 contas reais confirmadas lá) — não presumir, perguntar | Sonnet: investigação, com o CEO | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), [SPRINT-018-report](SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md) |
| 22 | Bloco 3, passo 2: inspeção read-only, comando a comando aprovado pelo CEO, de `pluggy_accounts`/`pluggy_transactions` da conta recém-conectada — `tipo` mapeado, presença/ausência de lançamento de rendimento, formato de `categoria_pluggy` | Sonnet: investigação, com o CEO | dado real da VM (dev ou prod, conforme passo 21); [pluggy_integration/service.py:373-382](../../backend/app/pluggy_integration/service.py) |
| 23 | Bloco 3, passo 3 (condicional): se achado real de rendimento, migration `0016` + subcategoria "Rendimento" (receita) no mesmo padrão de Aporte/Resgate | Sonnet: implementação (só se aplicável) | resultado do passo 22 |
| 24 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `dashboards-guia-cards.md` — nova tela, `roadmap.md` — Sprint 19 + remoção do item correspondente em "Registro de reavaliações futuras") | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, dashboards-guia-cards.md, roadmap.md |
| 25 | Relatório de sprint — documentar achados reais do Bloco 3 e decisão condicional sobre "Rendimento" | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** CRUD e isolamento por usuário de `Investimento`;
  `delete_investimento` desassociando carteiras E transações (dois caminhos, diferente do
  padrão de `delete_asset`); `get_evolucao` (saldo base multi-carteira, aritmética do
  `rendimento_estimado`, considerando só transações confirmadas); `update_account` com
  `investimento_id` (link/unlink/`NotFoundError` cross-user); filtro `investimento_id` em
  `list_transactions`; cascata de sugestão (regra exata, histórico exato, fuzzy ≥0.86,
  sem match) para investimento; `set_transaction_investimento`; `get_por_investimento`/
  tendência; **regressão** — totais de Despesa/Receita idênticos antes/depois da
  introdução do grupo "Investimentos" para transações não relacionadas.
- **Componente (Vitest):** `InvestimentosPage` (criar/editar/excluir, cards, drilldown,
  toggle Aporte/Resgate), `InvestimentoSelectCell`, extensão de `AccountManagementPage`
  (vínculo carteira→investimento) e `CategorizationReviewPage` (coluna nova).
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde antes de
  fechar.
- Testes do Bloco 3 não são previsíveis de antemão (mesmo precedente das Sprints 17/18) —
  dependem do achado real.

## Impacto no roadmap

Sprint sem épico prévio (item já registrado em "Registro de reavaliações futuras" desde a
Sprint 17, formalizado nesta sessão). Ao fechar, o item correspondente deve ser removido
dessa lista e substituído pela entrada padrão de sprint concluída, com referência a
PRD-019/SPRINT-019. Não bloqueia sprints futuras — mas o Bloco 3 pode gerar uma nova
entrada em "Registro de reavaliações futuras" (integração explícita com Investments da
Pluggy), dependendo do achado.

## Riscos / dependências

- **Bloco 3 depende de uma ação externa do CEO** (conectar + sincronizar a conta real de
  investimento) que não está sob controle do Claude — pode não estar pronta no início da
  execução; nesse caso, Blocos 1/2 seguem normalmente e o Bloco 3 fecha depois, sem
  bloquear o resto da sprint.
- **Ambiente onde a conta real será conectada (dev vs. prod) precisa ser confirmado, não
  presumido** — `CLAUDE.md` descreve a VM de dev como "sem dados reais", mas a Sprint 18
  já registrou 2 contas reais conectadas lá para fins de reconciliação. Task #21 trata
  isso explicitamente antes de qualquer inspeção.
- **Achado do Bloco 3 é imprevisível** — se nenhum dado de rendimento aparecer
  organicamente (cenário mais provável, já que a Pluggy separa endpoints bancários dos de
  Investments), a sprint fecha com `rendimento_estimado` como único indicador disponível,
  e uma sprint futura de integração explícita vira candidata registrada no roadmap — isso
  é um resultado válido, não uma falha da sprint.
- **Trava de tipo de conta no vínculo carteira→investimento é só de UI** — se o CEO
  descobrir, usando a tela, que quer essa trava no backend também, é uma mudança pequena
  e pode entrar como ajuste dentro da própria sprint sem precisar de novo `/plan`.
- **Nenhuma dependência de dado real para os Blocos 1/2** — toda a mecânica (modelo,
  categorização, telas) é testável com dados fictícios/fixtures, como já é padrão neste
  projeto.
