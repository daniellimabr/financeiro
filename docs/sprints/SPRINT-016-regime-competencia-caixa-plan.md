# SPRINT-016: Regime de Competência/Caixa e Patrimônio por Saldo Acumulado — Plano

- **PRD(s):** [PRD-016-regime-competencia-caixa-patrimonio](../prd/PRD-016-regime-competencia-caixa-patrimonio.md)
- **Data do plano:** 2026-08-17

## Objetivo da sprint

Ao final, transações de cartão de crédito têm competência sempre no mês
seguinte ao evento (sem exceção), o CEO consegue alternar um toggle
Competência/Caixa em todo o Dashboard (Receita/Despesa/Saldo, tendência,
drill-downs de Ativo/Passivo, Saldo Acumulado/Anterior, Patrimônio), o
Patrimônio passa a ser calculado por Saldo Acumulado líquido + investimentos
ao vivo + Ativos − Passivos (em vez de só snapshot bancário), e um bug real
de fuso horário que gravava a data de algumas transações um dia à frente do
extrato bancário real está corrigido.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Corrigir `_parse_date` (`app/pluggy_integration/service.py:378`) para converter o timestamp UTC bruto da Pluggy para `America/Sao_Paulo` (`zoneinfo`) antes de `.date()` — bug independente do resto da sprint, sem dependência de migration (dado histórico se autocorrige via re-sync) | Sonnet: implementação | [pluggy_integration/service.py](../../backend/app/pluggy_integration/service.py) (`_parse_date`, `sync_item`) |
| 2 | `app/categorization/competencia.py`: `competencia_padrao(data, account_tipo)` e `caixa(data_competencia, account_tipo)` novas — cartão sempre desloca (competência = evento+1, caixa = competência+1), demais tipos sem defasagem | Sonnet: implementação | [categorization/competencia.py](../../backend/app/categorization/competencia.py) (`shift_to_next_month`/`competencia_salario` existentes) |
| 3 | Migration `0013`: `pluggy_transactions.data_caixa` (Date, nullable) + backfill Python (recalcula `data_competencia` de transações de cartão existentes, popula `data_caixa` para toda transação) | Sonnet: implementação | [alembic/versions/0012_configuracoes_e_competencia_salario.py](../../backend/alembic/versions/0012_configuracoes_e_competencia_salario.py) (última migration, precedente de backfill em Python) |
| 4 | Aplicar `competencia_padrao`/`caixa` nos 3 pontos de escrita: `_upsert_transaction` (sync), `_recompute_data_competencia` (`set_category`/`bulk_confirm`), `upsert_salario_ajuste_dez_2025` | Sonnet: implementação | [pluggy_integration/service.py:324-348](../../backend/app/pluggy_integration/service.py); [categorization/service.py:36-42](../../backend/app/categorization/service.py) |
| 5 | `app/dashboards/service.py`: helper `_competencia_column(regime)`; parâmetro `regime: Literal["competencia","caixa"]="competencia"` em `get_summary`, `get_por_categoria`, `_receita_despesa_por_periodo`, `get_tendencia`, `get_tendencia_por_categoria`, `get_por_ativo`, `get_tendencia_por_ativo`, `get_por_passivo`, `get_tendencia_por_passivo`, `get_saldo_acumulado` — troca toda referência direta a `data_competencia` pelo helper | Sonnet: implementação | [dashboards/service.py](../../backend/app/dashboards/service.py) (`_base_query`, `_apply_periodo`, todas as funções listadas) |
| 6 | `_base_query` ganha `excluir_investimento: bool=False`; `get_saldo_acumulado` passa a excluir contas `tipo=investimento` da âncora (`saldo_inicial`) e da acumulação | Sonnet: implementação | [dashboards/service.py:942-980](../../backend/app/dashboards/service.py) (`get_saldo_acumulado`) |
| 7 | Redesenhar `PatrimonioBreakdown`/`_patrimonio_breakdown`: `saldo_liquido_acumulado` (via `get_saldo_acumulado(regime=..., ano/mes=hoje)`, com fallback de saldo ao vivo por conta sem `saldo_inicial`) + `saldo_investimentos` (snapshot ao vivo) + `ativos` + `passivos`; `get_summary` propaga `regime` para o patrimônio | Sonnet: implementação | [dashboards/service.py:236-290](../../backend/app/dashboards/service.py) (`_patrimonio_breakdown`, `_calcula_patrimonio`, `get_patrimonio_breakdown`) |
| 8 | `app/dashboards/router.py`: query param `regime` em `/summary`, `/tendencia`, `/por-categoria`, `/por-categoria/tendencia`, `/por-ativo`, `/por-ativo/tendencia`, `/por-passivo`, `/por-passivo/tendencia`, `/saldo-acumulado`, `/patrimonio/breakdown` | Sonnet: implementação | [dashboards/router.py](../../backend/app/dashboards/router.py) |
| 9 | Testes backend: `_parse_date` (fixture "BRASA E DRINKS"); `competencia_padrao`/`caixa` (cartão vs. outros tipos, rollover); os 3 pontos de escrita; cada função de `dashboards/service.py` com `regime="caixa"`; `get_saldo_acumulado` excluindo investimento; Patrimônio com fallback de conta sem `saldo_inicial`; migration `0013` (backfill contra fixture com cartão histórico) | Sonnet + skill tdd-workflow | testes existentes de `test_pluggy_service.py`, `test_categorization_service.py`, `test_dashboards_service.py`, `test_dashboards_endpoints.py` |
| 10 | `frontend/src/components/RegimeToggle.tsx` novo (`aria-pressed`, mesmo padrão do toggle despesa/receita) | Sonnet + skill impeccable | [pages/AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) (toggle despesa/receita existente) |
| 11 | Estado `regime` levantado em `DashboardsPage.tsx`, propagado para `GrupoAccordion`/`SubcategoriaAccordion`, `AtivosAccordion`, `PassivosAccordion`, `PatrimonioBreakdownPanel`, painel de Saldo Acumulado | Sonnet + skill impeccable | [pages/DashboardsPage.tsx](../../frontend/src/pages/DashboardsPage.tsx) |
| 12 | Hooks com parâmetro `regime` (incluído na query key): `useDashboardSummary`, `useDashboardTendencia`, `useDashboardPorCategoria`, `useDashboardSaldoAcumulado`, `useAssetGastos`/`useAssetGastosTendencia`, `useLiabilityGastos`/`useLiabilityGastosTendencia`, `usePatrimonioBreakdown` | Sonnet: implementação | [api/dashboards.ts](../../frontend/src/api/dashboards.ts) |
| 13 | `PatrimonioBreakdownPanel.tsx` atualizado para a nova forma de `PatrimonioBreakdown` (saldo líquido acumulado + investimentos, não mais saldo_contas/saldo_cartoes) | Sonnet + skill impeccable | [components/PatrimonioBreakdownPanel.tsx](../../frontend/src/components/PatrimonioBreakdownPanel.tsx) |
| 14 | Testes frontend: `RegimeToggle.test.tsx`; `DashboardsPage.test.tsx`/`AssetsPage.test.tsx`/`LiabilitiesPage.test.tsx` estendidos com asserção de `regime` no request | Sonnet + skill tdd-workflow | testes existentes equivalentes |
| 15 | Deploy VM de dev; re-sincronizar contas (`POST /pluggy/sync`) para autocorrigir o bug de fuso em dado histórico; `scripts/browser-check/check-sprint16.mjs` novo (toggle, cards, drill-downs, desktop+mobile) | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md); [scripts/browser-check/check-sprint15.mjs](../../scripts/browser-check/check-sprint15.mjs) |
| 16 | Validar manualmente: compra de cartão recente cai na competência do mês seguinte; toggle muda Despesa/Saldo/Patrimônio de forma consistente com a planilha de referência do CEO; "BRASA E DRINKS" vira 22/jan após re-sync; toda conta líquida com `saldo_inicial` preenchido (Configurações) antes de aprovar | Sonnet: implementação | dado real da VM de dev |
| 17 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` — Sprint 16, sem épico prévio) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 18 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `_parse_date` (timestamp UTC próximo da virada de
  dia em BRT, incl. caso sem cruzar meia-noite); `competencia_padrao`/`caixa`
  (cartão vs. outros tipos, rollover dez→jan, clamp de dia); os 3 pontos de
  escrita respeitando cartão vs. salário vs. default; `_competencia_column`/
  regime em cada função de `dashboards/service.py`; `get_saldo_acumulado`
  excluindo investimento (com/sem conta de investimento); fallback de
  Patrimônio para conta sem `saldo_inicial`.
- **Integração (pytest, TestClient):** todo endpoint que ganha `regime` —
  competência (default, comportamento atual preservado) vs. caixa,
  isolamento entre usuários; migration `0013` — backfill contra fixture com
  cartão histórico.
- **Componente (Vitest + Testing Library):** `RegimeToggle`; suites
  existentes de Dashboard/Ativos/Passivos com asserção de `regime` no
  request; `PatrimonioBreakdownPanel` com a nova forma de dado.
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde
  antes de fechar.

## Impacto no roadmap

Sprint sem épico prévio no roadmap (item trazido diretamente pelo CEO nesta
sessão de planejamento) — registrada como Sprint 16, fora da sequência
E1–E9 já fechada. Não reabre nenhum épico concluído: `get_summary`/
`get_tendencia`/`get_por_categoria`/`get_por_ativo`/`get_por_passivo`
ganham um parâmetro novo com default que preserva o comportamento atual
(`regime="competencia"`), sem mudança de contrato para quem não passa o
parâmetro.

## Riscos / dependências

- **Backfill de `data_competencia` para cartão é retroativo e visível** —
  números históricos de Receita/Despesa/Tendência por competência em meses
  já fechados vão mudar de aparência após o deploy. Esperado e intencional,
  mas o CEO precisa validar que a mudança bate com a expectativa antes de
  aprovar o relatório (não assumir silenciosamente que está certo).
- **Patrimônio passa a depender de `saldo_inicial` em toda conta líquida**
  — hoje é validado e correto (bate com extrato real) como snapshot ao
  vivo; o fallback por conta sem `saldo_inicial` (tarefa 7) mitiga quebra
  total, mas o CEO deve conferir em Configurações que toda conta relevante
  tem o campo preenchido antes do deploy final.
- **Correção do bug de fuso não tem migration** — depende de re-sync
  (`POST /pluggy/sync`) rodado explicitamente após o deploy para
  autocorrigir dado histórico; se esquecido, o bug fica corrigido só para
  transações novas, criando inconsistência silenciosa entre dado antigo e
  novo. Task 15 e 16 cobrem isso explicitamente — não pular.
- **Ordem de implementação importa:** tarefas 2–4 (competência/caixa nos
  pontos de escrita) precisam estar funcionando antes de tarefas 5–7
  (threading do regime nas agregações), que por sua vez precisam estar
  prontas antes de tarefa 13 (Patrimônio no frontend).
- **Escopo grande (comparável às Sprints 13/15)** — se a sessão de execução
  achar grande demais, cortar o toggle de Ativo/Passivo (tarefas parciais
  de 5, 8, 11, 12) para uma sprint de extensão é uma opção aceitável, desde
  que a competência de cartão + bug de fuso + toggle em Receita/Despesa/
  Saldo/Patrimônio permaneçam completos.
- **Nenhuma heurística de dia útil para o lag Pluggy vs. extrato real** —
  decisão explícita do CEO de não implementar nesta sprint; não reabrir sem
  pedido dele.
