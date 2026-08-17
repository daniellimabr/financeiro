# SPRINT-018: Edição Manual de Data + Investigação de Saldo Acumulado + Guia dos Cards — Plano

- **PRD(s):** [PRD-018-edicao-data-saldo-acumulado-guia-cards](../prd/PRD-018-edicao-data-saldo-acumulado-guia-cards.md)
- **Data do plano:** 2026-08-17

## Objetivo da sprint

Ao final: (1) o CEO consegue corrigir manualmente a data de uma transação na
tela Categorizar, e essa correção sobrevive a resyncs futuros da Pluggy; (2)
a divergência percebida no card "Saldo Acumulado" (Itaú + NuBank, 31/01/2026)
foi investigada com dado real e, ou corrigida (se bug real) ou esclarecida na
UI (se diferença conceitual esperada); (3) existe um guia não técnico
explicando o que cada card do Dashboard soma/exclui.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Migration `0014`: `pluggy_transactions.data_editada_manualmente` (Boolean, not null, default False) | Sonnet: implementação | [alembic/versions/0013_*.py](../../backend/alembic/versions/) (modelo mais recente a seguir) |
| 2 | Model `PluggyTransaction` ganha `data_editada_manualmente` | Sonnet: implementação | [models/pluggy.py](../../backend/app/models/pluggy.py) |
| 3 | `_upsert_transaction`: trava `data`/`data_competencia`/`data_caixa` contra resync quando `data_editada_manualmente=True` | Sonnet: implementação | [pluggy_integration/service.py:329-362](../../backend/app/pluggy_integration/service.py) |
| 4 | Schema `DateUpdateIn`; `TransactionOut` ganha `data_editada_manualmente` | Sonnet: implementação | [schemas/categorization.py](../../backend/app/schemas/categorization.py) |
| 5 | `service.update_data()`: seta `data`+flag, recomputa competência via `_recompute_data_competencia` (reaproveitado sem mudar assinatura), rejeita data futura | Sonnet: implementação | [categorization/service.py:37-47,185-202](../../backend/app/categorization/service.py) |
| 6 | Endpoint `PUT /categorization/transactions/{id}/data` | Sonnet: implementação | [categorization/router.py](../../backend/app/categorization/router.py) (padrão de `update_description`) |
| 7 | `EditableTransaction` ganha `data`/`data_editada_manualmente`; `api/categorization.ts` ganha `updateData()`; hook `useUpdateDate.ts` novo | Sonnet: implementação | [utils/transactionEdit.ts](../../frontend/src/utils/transactionEdit.ts), [api/categorization.ts](../../frontend/src/api/categorization.ts), [hooks/useUpdateDescription.ts](../../frontend/src/hooks/useUpdateDescription.ts) (modelo) |
| 8 | Componente `DateCell` (mesmo padrão `DescriptionCell`, `input type=date`, indicador visual quando editada) | Sonnet + skill impeccable | [components/TransactionEditCells.tsx:11-46](../../frontend/src/components/TransactionEditCells.tsx) |
| 9 | `CategorizationReviewPage.tsx`: coluna Data estática vira `<DateCell />` | Sonnet: implementação | [pages/CategorizationReviewPage.tsx](../../frontend/src/pages/CategorizationReviewPage.tsx) |
| 10 | Testes backend: `update_data` (competência recomputada por tipo de conta/categoria), endpoint (200/400/401/404), resync não sobrescreve data editada (conta corrente + cartão), resync continua sobrescrevendo transação não editada (regressão) | Sonnet + skill tdd-workflow | [test_categorization_service.py](../../backend/tests/test_categorization_service.py), [test_categorization_endpoints.py](../../backend/tests/test_categorization_endpoints.py), [test_pluggy_service.py](../../backend/tests/test_pluggy_service.py) |
| 11 | Testes frontend: `DateCell` (edição, indicador visual), ajuste de `CategorizationReviewPage.test.tsx` para a célula nova | Sonnet + skill tdd-workflow | [TransactionEditCells.test.tsx](../../frontend/src/components/TransactionEditCells.test.tsx), [CategorizationReviewPage.test.tsx](../../frontend/src/pages/CategorizationReviewPage.test.tsx) |
| 12 | Deploy VM de dev (Bloco 1) | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 13 | Investigação Bloco 2: confirmar as 2 contas reais na VM de dev, puxar `saldo_inicial`/`get_saldo_acumulado` (competência e caixa)/`get_evolucao_saldo_por_conta` para jan/2026, obter saldo devedor real do cartão NuBank em 31/01/2026 com o CEO, comparar contra Itaú R$ 10.913,75 (já confirmado na Sprint 17) | Sonnet: investigação, com o CEO | dado real da VM de dev; [SPRINT-017-report](SPRINT-017-filtro-conta-validacao-extrato-report.md); [dashboards/service.py](../../backend/app/dashboards/service.py) |
| 14 | Ação condicional Bloco 2b: se bug real, corrigir com teste de regressão (escopo definido na execução); se diferença conceitual, renomear `drillTitle.saldo` e adicionar nota em `SaldoPorContaList` esclarecendo fatura/limite como snapshot | Sonnet: implementação | [pages/DashboardsPage.tsx:160-168,724-754](../../frontend/src/pages/DashboardsPage.tsx) |
| 15 | Guia `docs/dashboards-guia-cards.md` (não técnico, todos os cards + efeito do toggle) — escrever só depois de 13/14 fecharem | Haiku: docs | resultado dos Blocos 1/2 |
| 16 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` — Sprint 18) + referência ao guia novo na tabela do `CLAUDE.md` | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md, CLAUDE.md |
| 17 | Relatório de sprint — documentar o achado real do Bloco 2 (números comparados, bug ou diferença conceitual) | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** `update_data` recomputando competência
  corretamente para conta corrente (sem deslocamento), cartão de crédito
  (`competencia_padrao`/`caixa`), e categoria Salário confirmada
  (`competencia_salario`); rejeição de data futura; 404 cross-user;
  resync preservando `data`/`data_competencia`/`data_caixa` de transação
  editada (conta corrente e cartão) e continuando a sobrescrever transação
  não editada (regressão). Testes específicos ao achado do Bloco 2 não são
  previsíveis de antemão (mesmo precedente da Sprint 17).
- **Componente (Vitest):** `DateCell` — edição via clique/blur/Enter/Escape,
  payload correto, no-op se valor igual/vazio, indicador visual quando
  editada; ajuste de seletores em `CategorizationReviewPage.test.tsx`.
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde
  antes de fechar.

## Impacto no roadmap

Sprint sem épico prévio (item trazido diretamente pelo CEO). Não bloqueia
sprints futuras de feature nova (diferente da Sprint 17) — mas o Bloco 2 pode
revelar necessidade de ajuste em regra de negócio já fechada (PRD-015/016),
o que exigiria voltar ao CEO antes de prosseguir.

## Riscos / dependências

- **Escopo de correção do Bloco 2 não é fechado de antemão** — depende do
  que a investigação com dado real revelar (bug vs. diferença conceitual).
  Qualquer mudança de regra de negócio já decidida exige confirmação
  explícita do CEO antes de implementar.
- **Confirmar que as 2 contas Pluggy reais (Itaú, NuBank) estão conectadas
  na VM de dev** antes de investigar — `CLAUDE.md` descreve a VM de dev
  como "sem dados reais", mas a Sprint 17 já reconciliou dado real lá; não
  presumir.
- **Saldo devedor real do cartão NuBank em 31/01/2026 não está em nenhum
  PDF disponível** — precisa ser obtido diretamente com o CEO durante a
  execução.
- **Dependência de dado real da VM de dev** para o Bloco 2, mesmo fluxo de
  sessões anteriores (sem Docker/Postgres local no notebook).
- **Bloco 3 depende do fechamento dos Blocos 1 e 2** — a terminologia final
  usada no guia (ex. rótulo do drill-down "Saldo por conta") só é definida
  depois da decisão do Bloco 2b.
