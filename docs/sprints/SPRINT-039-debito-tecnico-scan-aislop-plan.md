# SPRINT-039: Débito técnico do scan aislop — Plano

- **PRD(s):** [PRD-039-debito-tecnico-scan-aislop.md](../prd/PRD-039-debito-tecnico-scan-aislop.md)
- **Data do plano:** 2026-09-12

## Objetivo da sprint

Eliminar o débito técnico real e de baixo risco identificado pelo scan `aislop` de 2026-09-11 (após
excluir o ruído do vendor `.claude/skills`, ver
[docs/audits/aislop-scan-2026-09-11.md](../audits/aislop-scan-2026-09-11.md)): 4 funções de backend
com excesso de parâmetros, 11 blocos de código duplicado no frontend (fora de `scripts/
browser-check/`), e 1 encadeamento `.get(...,{}).get(...)` em `dashboards/service.py`. **Sem nenhuma
mudança de comportamento** — pedido explícito do CEO de não quebrar o projeto. Fora desta sprint:
quebrar os arquivos grandes (backend >400 linhas, frontend >600 linhas) e o código novo/não aprovado
de `planejamento/service.py` (Sprint 38) — registrados como backlog no roadmap.

Ordem de execução: cada item é independente dos outros (arquivos/funções diferentes, sem
dependência entre si) — podem rodar em qualquer ordem. Convém fazer backend antes de frontend só
porque os itens de backend são mais mecânicos/rápidos de validar (suíte pytest roda em segundos).

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| **Fase 1 — Backend: excesso de parâmetros** ||||
| 1 | `assets/service.py`: `create_asset`/`update_asset` passam a receber `payload: AssetIn` em vez dos campos explodidos; `assets/router.py` passa `payload` direto, sem explodir. Atualizar chamadas em `tests/test_assets_service.py`/`test_assets_router.py` para construir `AssetIn(...)` em vez de kwargs soltos | Sonnet: implementação | `backend/app/assets/service.py:44` e vizinha `create_asset`, `backend/app/assets/router.py:19-32,45-64`, `backend/app/schemas/asset.py` (`AssetIn` já existe) |
| 2 | Mesmo fix em `liabilities/service.py` (`create_liability`/`update_liability`) e `liabilities/router.py`, com `LiabilityIn` já existente em `app/schemas/liability.py` | Sonnet: implementação | `backend/app/liabilities/service.py:26-46,48-65`, `backend/app/liabilities/router.py:21,46-60` |
| 3 | `categorization/service.py`: `_apply_suggestions` (9 params) — criar dataclass de contexto (nome sugerido `SuggestionSources`, agrupando `rules_by_pattern`/`historico` de categoria, `asset_rules`/`asset_historico`, `liabilities`, `investimento_rules`/`investimento_historico`) e usar em vez dos parâmetros soltos; atualizar o(s) call site(s) que montam esses dados hoje | Sonnet: implementação | `backend/app/categorization/service.py:152` e call site (buscar `_apply_suggestions(` no arquivo) |
| 4 | `pluggy_integration/service.py`: `_upsert_snapshot` (10 params) — dataclass de valores do snapshot (nome sugerido `SnapshotValores`: `saldo`/`valorizacao`/`rendimento`/`dividendos`/`aportes`/`resgates`/`confianca`) substituindo os parâmetros soltos; atualizar call site(s) | Sonnet: implementação | `backend/app/pluggy_integration/service.py:552` e call site (buscar `_upsert_snapshot(` no arquivo) |
| 5 | `dashboards/service.py:1274`: eliminar `salario_por_conta_mes.get(conta.id, {}).get(mes_atual, Decimal("0"))` — normalizar a estrutura na construção de `salario_por_conta_mes` (ex. `defaultdict(dict)` ou dict completo por conta) ou extrair `_salario_do_mes(mapa, conta_id, mes)` explícito. Confirmar que o valor resultante não muda para nenhuma conta/mês real | Sonnet: implementação | `backend/app/dashboards/service.py:1260-1290` (contexto de `_receita_despesa_bruta_mes`/loop de `conta`) |
| 6 | Suíte backend completa (`pytest`) 100% verde após a Fase 1; confirmar que os 4 achados "too many parameters" e o achado de `dashboards/service.py:1274` não aparecem mais em `npx aislop scan --exclude .claude/skills` | Sonnet: implementação | `scripts/check-all.ps1` (passo `backend: pytest`) |
| **Fase 2 — Frontend: código duplicado** ||||
| 7 | `api/assets.ts`: extrair helper (`toAssetPayload(input: AssetInput)`) reaproveitado por `createAsset`/`updateAsset`. Mesmo padrão em `api/liabilities.ts` (`toLiabilityPayload`) | Sonnet: implementação | `frontend/src/api/assets.ts:35-59`, `frontend/src/api/liabilities.ts:29-53` |
| 8 | `components/TransactionEditCells.tsx`: extrair hook compartilhado (`useInlineEditCell` ou nome equivalente) do padrão draft/editing/salvar-no-blur/Enter-confirma/Escape-cancela repetido entre `DescriptionCell`/`DateCell` (e outras células do arquivo que sigam o mesmo padrão — conferir todas antes de decidir o shape do hook). Preservar exatamente o comportamento de teclado/blur/aria-label por célula | Sonnet: implementação | `frontend/src/components/TransactionEditCells.tsx` (arquivo inteiro — achado em L25-90, mas conferir se há mais células com o mesmo padrão) |
| 9 | Investigar e resolver os 6 blocos restantes apontados pelo scan: `pages/AssetsPage.tsx:366-411`, `pages/LiabilitiesPage.tsx:271-318`, `pages/InvestimentosPage.tsx` (3 blocos: `L260-273`, `L261-287`, `L599-815`), `pages/DashboardsPage.tsx:368-391`, `pages/CategorizationReviewPage.tsx` (2 blocos: `L322-336`, `L325-346`). Para cada um: se a duplicação for lógica real, extrair helper/componente compartilhado; se for semelhança estrutural coincidente sem lógica em comum, documentar no relatório e descartar sem forçar uma abstração artificial | Sonnet: implementação | arquivos listados, localizados por `npx aislop scan --exclude .claude/skills -d` |
| 10 | Suíte frontend completa (`vitest run`) 100% verde após a Fase 2; confirmar que os 11 blocos de duplicação fora de `scripts/browser-check/` não aparecem mais em `npx aislop scan --exclude .claude/skills` | Sonnet: implementação | `scripts/check-all.ps1` (passos `frontend: eslint`/`prettier`/`tsc`/`vitest`) |
| **Fase 3 — Verificação e fechamento** ||||
| 11 | QA visual real novo `scripts/browser-check/check-sprint39.mjs`: telas Ativos, Passivos, Investimentos, Categorização (edição inline de descrição e data — a célula tocada na Fase 2), Dashboard — confirmar zero mudança visual/comportamental (screenshots comparáveis às sprints anteriores, sem erro de console), desktop+mobile | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), `scripts/browser-check/check-sprint13.mjs` (referência de estrutura) |
| 12 | Conferência de saldo real na VM de dev (mesmo endpoint/rotina usado nas Sprints 32/33) para validar que o fix do item 5 não alterou `salario_recebido`/`saldo_efetivo` de nenhuma conta/mês real | Sonnet: implementação | dado real da VM de dev, ver [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 13 | Atualizar `docs/roadmap.md`: registrar esta sprint e criar a entrada de backlog "quebrar arquivos grandes" (lista dos 7 arquivos >400/600 linhas, ver PRD-039 fora de escopo) como candidato a sprint dedicada futura | Haiku: doc-updater | `docs/roadmap.md` |
| 14 | Relatório de sprint (incluir a lista de achados do scan resolvidos vs. descartados por item, com justificativa de cada descarte) | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Backend: `create_asset`/`update_asset`/`create_liability`/`update_liability` continuam validando e
persistindo os mesmos campos, agora via schema em vez de kwargs — nenhum teste de comportamento novo,
só a forma de chamada muda; `_apply_suggestions` e `_upsert_snapshot` mantêm a mesma cobertura
existente com a nova assinatura (dataclass); `dashboards/service.py:1274` ganha um teste explícito
cobrindo o caso de conta/mês ausente do mapa (hoje coberto implicitamente pelo `.get` duplo — o teste
deve provar que o novo código cobre o mesmo caso). Frontend: `TransactionEditCells.test.tsx` (ou
equivalente) continua cobrindo draft/blur/Enter/Escape por célula, agora exercitando o hook
compartilhado; suíte de `AssetsPage`/`LiabilitiesPage`/`InvestimentosPage`/`DashboardsPage`/
`CategorizationReviewPage` sem regressão após cada extração. Nenhuma mudança de cobertura esperada
para baixo — sprint de forma, não de escopo novo.

## Impacto no roadmap

Sem impacto em épico funcional (sprint cross-epic de qualidade de código, mesmo padrão da Sprint 29).
Cria uma entrada de backlog nova: quebrar os 7 arquivos que excedem o limite de tamanho do linter
(`categorization/engine.py`, `categorization/service.py`, `dashboards/service.py`,
`pluggy_integration/service.py`, `AccountManagementPage.tsx`, `DashboardsPage.tsx`,
`InvestimentosPage.tsx`) — candidato a sprint dedicada futura, com plano de fases incrementais
(um arquivo por vez), não priorizada nesta sprint por risco desproporcional.

## Riscos / dependências

- **Maior risco da sprint**: qualquer um dos 13 achados pode, na investigação real, se revelar mais
  sutil do que o scan sugere (ex.: um "bloco duplicado" com uma diferença de comportamento não óbvia
  entre as duas cópias, ou um parâmetro que parece redundante mas carrega um caso de borda). Regra
  fixa desta sprint (PRD-039, seção "Regras de negócio"): ao encontrar essa situação, parar aquele
  item específico e confirmar com o CEO antes de prosseguir — não decidir sozinho por unificar ou
  manter o comportamento.
- `_apply_suggestions`/`_upsert_snapshot` são funções internas de módulos centrais (motor de
  categorização e sync de investimentos) — mesmo sendo só reorganização de parâmetros, exigem rodar a
  suíte completa (não só os testes do módulo) antes de considerar a fase concluída.
- Item 9 (6 blocos restantes) é o item com escopo menos definido do plano — o scan aponta início/fim
  do bloco, não a causa da duplicação. Se a investigação mostrar que um bloco não vale a pena
  extrair (abstração forçada, sem ganho real de manutenibilidade), documentar e descartar é uma saída
  válida — não é obrigatório "resolver" todos os 6 a qualquer custo, dado o princípio geral de não
  introduzir abstração prematura.
- Sequenciamento: Fases 1 e 2 são independentes entre si (podem até rodar em paralelo se a sessão de
  execução preferir) e cada tarefa dentro delas também é independente (arquivos diferentes). Fase 3
  depende de 1 e 2 completas.
- Dependência externa: item 12 (conferência de saldo) precisa da VM de dev com dado real — mesmo
  procedimento de SSH via `scripts/ssh_vm.py` já usado desde a Sprint 32.
