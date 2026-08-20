# SPRINT-031: Fix — desassociação de transação presa por sugestão automática — Plano

- **PRD(s):** [PRD-031-fix-desassociacao-vinculo-transacao.md](../prd/PRD-031-fix-desassociacao-vinculo-transacao.md)
- **Data do plano:** 2026-08-20

**Nota:** plano escrito retroativamente, na mesma sessão de execução — o CEO reportou o bug ao vivo
(sem sessão de `/plan` prévia), a investigação de causa raiz e o desenho do fix (paliativo vs.
definitivo) foram decididos via `AskUserQuestion` durante a própria execução, e só depois de
implementado, testado e deployado é que este plano e o PRD foram escritos, documentando o que de
fato aconteceu.

## Objetivo da sprint

Uma transação desassociada manualmente de um investimento/ativo/passivo (inclusive escolhendo
"Nenhum") permanece desassociada permanentemente — o motor de sugestão para de repor o vínculo a
cada recarga da tela de Categorização.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Investigar causa raiz do bug reportado (transação presa ao investimento "Tesouro Direto Nubank" mesmo após escolher "Nenhum") | Sonnet: Explore (subagente) | `backend/app/categorization/`, `frontend/src/components/TransactionEditCells.tsx` |
| 2 | Confirmar, por leitura direta de código, que o mesmo padrão de bug afeta Categoria (pedido explícito do CEO: "avaliar se o problema não acontece também com a caixa de seleção de categoria") | Sonnet: implementação | `backend/app/categorization/service.py`, `frontend/src/components/TransactionEditCells.tsx` |
| 3 | Decidir com o CEO (via `AskUserQuestion`): fix paliativo (só limpar sugestão no `set`) vs. definitivo (migration + flag de confirmação manual) | Sonnet: implementação | — |
| 4 | Modelo: 3 colunas booleanas novas em `PluggyTransaction` (`asset_confirmado_manualmente`, `liability_confirmado_manualmente`, `investimento_confirmado_manualmente`) | Sonnet: implementação | `backend/app/models/pluggy.py` |
| 5 | Migration `0020` (reversível), seguindo o padrão de `0019` | Sonnet: implementação | `backend/alembic/versions/0020_confirmacao_manual_vinculos_transacao.py` (novo) |
| 6 | `_apply_suggestions` pula recomputação de asset/liability/investimento quando a flag correspondente já está marcada | Sonnet: implementação | `backend/app/categorization/service.py` |
| 7 | `set_transaction_asset`/`set_transaction_liability`/`set_transaction_investimento` marcam a flag e limpam `*_sugerido_id`/`*_sugestao_confianca` ao gravar a escolha manual (inclusive `None`) | Sonnet: implementação | `backend/app/categorization/service.py` |
| 8 | `set_category`/`bulk_confirm` limpam `subcategoria_sugerida_id` e campos de sugestão associados ao confirmar | Sonnet: implementação | `backend/app/categorization/service.py` |
| 9 | Testes de regressão: 1 por campo (asset/liability/investimento) reproduzindo o cenário exato do bug relatado + 1 para a limpeza de sugestão de categoria | Sonnet: implementação | `backend/tests/test_categorization_service.py` |
| 10 | Suíte completa + lint/format | Sonnet: implementação | `backend/` |
| 11 | Commit + push (branch `main`, autorizado) | Sonnet: implementação | — |
| 12 | Confirmar CI verde (`conclusion: success`) para o commit exato antes de tocar a VM | Sonnet: implementação | `docs/infra/ssh-workflow.md` |
| 13 | Deploy na VM de dev: `git pull` + `docker compose pull` + `docker compose up -d` (migration roda sozinha via entrypoint) | Sonnet: implementação (SSH livre, VM de dev) | `docs/infra/ssh-workflow.md`, `docs/architecture/OVERVIEW.md` |
| 14 | Confirmar migration `0020` aplicada e container `api` saudável via `docker compose logs`/`docker compose ps` | Sonnet: implementação | — |
| 15 | Documentação retroativa: este PRD/plano/relatório + entrada no `docs/roadmap.md` | Sonnet: implementação | `docs/roadmap.md` |

## Coerência de Design (DESIGN.md)

Omitida — sprint 100% backend, sem mudança de UI (o fix corrige o dado que já alimentava o
`<select>` existente, sem tocar em componente/token visual).

## Testes previstos

Unitários (backend, `test_categorization_service.py`): para cada um de asset/liability/
investimento, reproduzir o cenário exato do bug — regra de categorização casando pela descrição,
`set_..._X(id)` seguido de `set_..._X(None)`, depois `list_transactions` confirmando que o campo
`*_id` e `*_sugerido_id` continuam `None` mesmo com a transação ainda pendente e a regra ainda
casando. Para categoria: confirmar categoria diferente de uma sugestão pré-existente e checar que
`subcategoria_sugerida_id` fica `None` após o `set_category`.

## Impacto no roadmap

Cross-epic, sem épico prévio — bug fix isolado, sem impacto em sprints futuras planejadas.

## Riscos / dependências

- Migration de schema (soma coluna, não backfill de dado) — risco baixo, mas ainda assim rodou
  contra o Postgres real da VM de dev (único ambiente real hoje), então seguiu o mesmo cuidado de
  qualquer migration: `alembic heads`/`history` conferidos localmente antes do push, logs do
  container conferidos após o deploy.
- Transações já afetadas pelo bug antes deste fix (com `*_sugerido_id` preso a um valor antigo)
  não são corrigidas retroativamente — resolvem-se na próxima interação manual do usuário com cada
  uma (aceito como fora de escopo, ver PRD).
