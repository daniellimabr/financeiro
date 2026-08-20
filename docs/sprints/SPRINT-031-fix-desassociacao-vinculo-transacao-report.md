# SPRINT-031: Fix — desassociação de transação presa por sugestão automática — Relatório

- **Plano:** [SPRINT-031-fix-desassociacao-vinculo-transacao-plan.md](./SPRINT-031-fix-desassociacao-vinculo-transacao-plan.md)
- **Data do relatório:** 2026-08-20
- **Aprovado pelo CEO em:** 2026-08-20 — validação técnica ("ok, parece tudo certo", após deploy) e, na sequência, validação real no app ("Deu certo a alteração, ja testei!")

## Resumo

CEO reportou ao vivo que não conseguia desassociar um Pix recebido do investimento "Tesouro Direto
Nubank" na tela de Categorização. Causa raiz: o motor de sugestão recalculava
`investimento_sugerido_id`/`asset_sugerido_id`/`liability_sugerido_id` a cada carregamento da lista
para toda transação pendente, sem saber que o usuário já tinha decidido manualmente (inclusive
decidido "nenhum") — e a UI prioriza o campo de sugestão sobre o valor real ao exibir o `<select>`.
Fix definitivo (não paliativo, escolha explícita do CEO): migration `0020` com 3 flags de
confirmação manual por transação, motor de sugestão passa a respeitá-las, e o mesmo padrão de bug
(mais brando) foi corrigido em Categoria. Implementado, testado, commitado, deployado na VM de dev
e validado nesta mesma sessão.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Investigar causa raiz do bug relatado | feito | Subagente Explore confirmou: sem bug de persistência, causa é a UI priorizar `*_sugerido_id` sobre `*_id`, somado à recomputação constante da sugestão |
| 2 | Avaliar se o mesmo padrão afeta Categoria | feito | Confirmado — efeito mais brando, mitigado (não eliminado) pelo `categorizacao_status` existente |
| 3 | Decidir com o CEO: paliativo vs. definitivo | feito | CEO escolheu fix definitivo com migration |
| 4 | Modelo: 3 colunas booleanas novas | feito | — |
| 5 | Migration `0020` | feito | Reversível, seguiu o padrão de `0019`; validada com `alembic heads`/`history` localmente antes do push |
| 6 | `_apply_suggestions` respeita as flags | feito | — |
| 7 | Setters marcam a flag e limpam sugestão | feito | Inclusive quando o valor escolhido é `None` |
| 8 | `set_category`/`bulk_confirm` limpam sugestão de categoria | feito | Sem coluna nova — `categorizacao_status` já cumpre o papel do flag |
| 9 | Testes de regressão (4 cenários) | feito | 1 teste por campo (asset/liability/investimento) reproduzindo o cenário exato do bug relatado + 1 para categoria |
| 10 | Suíte completa + lint/format | feito | 665 testes, 99% cobertura; `ruff check`/`ruff format --check` limpos |
| 11 | Commit + push | feito | Commit `1baee65` |
| 12 | Confirmar CI verde para o commit exato | feito | `GET /repos/.../actions/runs?branch=main`, run #162, `head_sha=1baee659...`, `conclusion: success` |
| 13 | Deploy na VM de dev | feito | `git pull` + `docker compose pull` + `docker compose up -d` |
| 14 | Confirmar migration aplicada e container saudável | feito | Logs mostram `Running upgrade 0019 -> 0020`; `docker compose ps` reporta `api` `healthy` |
| 15 | Documentação retroativa (PRD/plano/relatório/roadmap) | feito | Este conjunto de documentos |

## Evidência de testes

```
app\categorization\service.py          248      2    99%   201-202
...
app\models\pluggy.py                   164      0   100%
...
------------------------------------------------------------------
TOTAL                                 2777     36    99%
665 passed, 693 warnings in 14.22s
```

Cobertura de lógica de negócio: 99% backend (meta ≥80%). `app/models/pluggy.py` 100%.

## Lint/formatter

```
$ ruff check app tests
All checks passed!
$ ruff format --check app tests
90 files already formatted
```

## Decisões tomadas durante a execução

- **Fix definitivo em vez de paliativo**: o paliativo (só limpar `*_sugerido_id` no momento do
  `set`) resolveria a tela na hora, mas o bug voltaria assim que a lista recarregasse com a
  transação ainda pendente — o motor recalcula a sugestão do zero a cada `list_transactions`,
  independente do que tinha sido limpo momentos antes. CEO escolheu o definitivo, aceitando o custo
  de uma migration para um bug de escopo pequeno.
- **Categoria não precisou de coluna nova**: diferente de asset/liability/investimento,
  `set_category` já move a transação para `categorizacao_status = confirmada`, e transações
  confirmadas já saem do recálculo de sugestão em `list_transactions` — bastou limpar
  `subcategoria_sugerida_id` no momento da confirmação para fechar o mesmo padrão de bug ali, sem
  precisar de um flag equivalente.
- **Transações já afetadas pelo bug não são corrigidas retroativamente** — decisão explícita,
  registrada no PRD como fora de escopo: a próxima interação manual do usuário com cada uma delas
  resolve o caso individualmente, sem necessidade de backfill em massa.
- **Deploy na mesma sessão de execução**, sem esperar aprovação formal do relatório antes — pedido
  explícito do CEO, dado que o vínculo estava travado no app real que ele estava usando.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Investimento desassociado manualmente permanece `NULL` mesmo com sugestão de histórico ainda casando | sim | `test_set_transaction_investimento_manual_clear_is_not_reapplied_by_suggestion` (reproduz o cenário exato do Tesouro Direto Nubank) |
| 2. Mesmo comportamento para ativo e passivo | sim | `test_set_transaction_asset_manual_clear_is_not_reapplied_by_suggestion`, `test_set_transaction_liability_manual_clear_is_not_reapplied_by_suggestion` |
| 3. Categoria: sugestão antiga não sobrepõe categoria confirmada | sim | `test_set_category_clears_stale_suggestion_on_confirm` |
| 4. Suíte 100% verde, sem regressão, com os 4 cenários como testes de regressão | sim | 665 testes passed, 4 testes novos cobrindo exatamente os cenários do PRD |
| 5. Migration reversível, aplicada com sucesso contra o Postgres real da VM de dev via entrypoint | sim | `docker compose logs api` confirma `Running upgrade 0019 -> 0020`; `docker compose ps` reporta `healthy`; migration nunca executada manualmente (evitando a corrida de processos já documentada em `docs/architecture/OVERVIEW.md`) |

## Documentação atualizada

Este PRD/plano/relatório (retroativos) + entrada da Sprint 31 em `docs/roadmap.md` (incluindo
atualização do contador da cadência de auditoria estrutural) + entrada da migration `0020` em
`docs/directory-structure.md`. Nenhum outro doc vivo precisou de atualização — sprint sem tela
nova, sem rota nova, sem mudança de comportamento de dashboard/guia de cards.

## Consumo estimado de tokens/sessões

Sprint pequena, mas com um subagente Explore de investigação + um ciclo completo de deploy (build
CI + SSH + migration + validação de container) — comparável em custo a uma sprint técnica média,
apesar do escopo de código pequeno (1 migration + 4 arquivos tocados).

## Pendências e próximos passos sugeridos

1. ~~CEO validar na prática...~~ — **feito**: CEO confirmou em 2026-08-20 que a desassociação do
   Tesouro Direto Nubank funciona no app real, fechando o único item pendente da sprint.
2. Sem QA visual automatizado (`browser-check`) para este fix — sprint 100% backend, sem mudança de
   UI a validar visualmente. Não considerado necessário dado o item 1 confirmado diretamente pelo
   CEO.
