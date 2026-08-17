# SPRINT-019: Gestão de Investimentos — Relatório

- **Plano:** [SPRINT-019-gestao-de-investimentos-plan.md](./SPRINT-019-gestao-de-investimentos-plan.md)
- **Data do relatório:** 2026-08-17

## Resumo

Blocos 1+2 entregues por completo: `Investimento` como agrupamento lógico de
carteiras Pluggy (CRUD, vínculo carteira→investimento), Aporte/Resgate como
categorização normal (contam nos totais de Despesa/Receita, sugestão
automática clonada do padrão de Ativo), `GET /dashboards/por-investimento`, e
tela `InvestimentosPage.tsx` (cards + drilldown). Deploy feito na VM de dev.
Bloco 3 (investigação com dado real) rodou por completo e achou algo real —
rendimento incidental (dividendos/JCP da XP) já flui pelo endpoint genérico
já integrado, mas numa conta que a Pluggy não classifica como
`tipo=investimento` — porém o CEO decidiu não implementar a subcategoria
"Rendimento" condicional nem soltar o filtro de tipo de conta nesta sprint: o
achado revelou que a visão completa de holdings (o que o CEO tinha no v1)
exige as rotas dedicadas de Investments da Pluggy, escopo maior que o
previsto, confirmado como a **próxima sprint**.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Migration `0015` | feito | Sem desvio |
| 2 | Model `Investimento`/`InvestimentoCategorizationRule`, colunas em `PluggyAccount`/`PluggyTransaction` | feito | Sem desvio |
| 3 | Módulo `app/investimentos/` (CRUD + `get_evolucao`) | feito | Sem desvio |
| 4 | `pluggy_integration/service.py`: `update_account`/`list_transactions` +`investimento_id` | feito | Sem desvio |
| 5 | `pluggy_integration/router.py` + schemas | feito | Sem desvio |
| 6 | `categorization/engine.py`: `suggest_investimento` (clone de asset) | feito | Sem desvio |
| 7 | `categorization/service.py`: sugestão em `_apply_suggestions`, `set_transaction_investimento` | feito | Sem desvio |
| 8 | `categorization/router.py`: `PUT .../investimento` | feito | Sem desvio |
| 9 | `dashboards/service.py`: `get_por_investimento`/tendência, sem mudança em `_base_query` | feito | Confirmado como regressão explícita |
| 10 | `dashboards/router.py` + schemas | feito | Sem desvio |
| 11 | Registrar router em `main.py` | feito | Sem desvio |
| 12 | Testes backend | feito | 54 testes novos, 100% em `app/investimentos/` |
| 13 | `api/investimentos.ts` + extensões + hooks | feito | Sem desvio |
| 14 | `InvestimentosPage.tsx` | feito | Sem toggle Competência/Caixa (não pedido no PRD para esta tela) |
| 15 | `TransactionsTable.tsx`/`TransactionEditCells.tsx` | feito | Sem desvio |
| 16 | `CategorizationReviewPage.tsx` — coluna Investimento | feito | Sem desvio |
| 17 | `AccountManagementPage.tsx` — `<select>` de vínculo | feito | **Correção não prevista no plano:** `PUT /pluggy/accounts/{id}` é full-replace — edição de apelido/toggle de sync no frontend passou a enviar `investimento_id` explícito (preservando o valor atual), senão qualquer edição de apelido desvincularia a carteira silenciosamente |
| 18 | `ProtectedPage.tsx` — aba "Investimentos" | feito | Sem desvio |
| 19 | Testes frontend | feito | 10 testes novos |
| 20 | Deploy VM de dev (Bloco 1+2) | feito | CI verde → `git pull` + `docker compose pull` + `up -d`, migration `0015` confirmada nos logs |
| 21 | Bloco 3, passo 1: confirmar ambiente | feito | CEO confirmou: só existe VM de dev em funcionamento hoje — toda inspeção foi lá |
| 22 | Bloco 3, passo 2: inspeção read-only | feito | Ver "Achados do Bloco 3" abaixo |
| 23 | Bloco 3, passo 3: migration `0016` condicional | **não feito** | Achado real de rendimento apareceu (condição do PRD se cumpriu), mas o CEO decidiu não implementar — achado revelou escopo maior (Investments API), não uma subcategoria isolada |
| 24 | Atualizar docs vivos | feito | Ver "Documentação atualizada" |
| 25 | Relatório de sprint | feito | Este documento |

## Achados do Bloco 3 (investigação com dado real)

Com a CEO confirmando que a VM de dev é o único ambiente em funcionamento
(toda inspeção foi read-only, via `scripts/ssh-vm.ps1 dev`, sem aprovação por
comando):

1. **Nubank Investimentos** (item já conectado antes desta sessão):
   `POST /pluggy/items/{id}/sync` retornou sucesso (`status=updated`, sem
   erro), mas **zero contas** vieram do endpoint genérico `GET /accounts` da
   Pluggy — nada capturável por aí.
2. **XP** (conectada pelo CEO durante esta sessão, via o botão "Conectar
   conta bancária"): sync trouxe 3 contas, nenhuma classificada
   `tipo=investimento` pelo `_map_account_tipo` existente (2 `corrente` + 1
   `cartao_credito`).
3. Uma dessas contas "corrente" carrega **dezenas de transações reais de
   dividendos/JCP** desde jan/2026 — `categoria_pluggy` =
   `"Proceeds interests and dividends"` (crédito) / `"Taxes on investments"`
   (débito), citando tickers reais (TAEE11, BBSE3, VALE3, HAPV3).

**Conclusão:** rendimento *incidental* já flui pelo endpoint genérico já
integrado (`GET /transactions`), mas a visão completa de posições/holdings
que o CEO tinha no v1 (CDBs via "Caixinha Nubank", posições em ações) exige
as rotas dedicadas de Investments da Pluggy (`GET /investments`,
`GET /investments/transactions`), nunca chamadas neste projeto — confirmado
pelo próprio CEO como algo que ele obtinha no v1. Apresentado o achado, o CEO
optou por **não** implementar a subcategoria "Rendimento" nem soltar o
filtro de tipo de conta nesta sprint — a integração completa de Investments
(holdings/posições) vira a **próxima sprint**, já registrada em
[docs/roadmap.md](../roadmap.md) ("Registro de reavaliações futuras").

## Evidência de testes

Backend (497 passed, 0 failed):
```
497 passed, 301 warnings in 8.29s
Name                                 Stmts   Miss  Cover
------------------------------------------------------------------
app\investimentos\__init__.py            0      0   100%
app\investimentos\router.py             39      0   100%
app\investimentos\service.py            61      0   100%
------------------------------------------------------------------
TOTAL                                 2147     40    98%
```

Frontend (176 passed, 0 failed):
```
 Test Files  25 passed (25)
      Tests  176 passed (176)
```

Cobertura de lógica de negócio: 98% backend total (100% em `app/investimentos/`), meta ≥80% atendida.

## Lint/formatter

```
ruff check app tests alembic        → All checks passed!
ruff format (pre-commit)            → Passed
eslint (frontend)                   → Passed (0 problemas)
prettier --check .                  → All matched files use Prettier code style!
tsc -b                              → 0 erros
```

## Decisões tomadas durante a execução

- **`PUT /pluggy/accounts/{id}` é full-replace, não parcial** — descoberto ao
  escrever `updatePluggyAccount` no frontend: como `PluggyAccountUpdateIn.
  investimento_id` tem default `None`, qualquer chamada que omitisse o campo
  desvincularia a carteira silenciosamente. Corrigido fazendo o frontend
  sempre enviar `investimento_id` explícito (valor atual da conta) em toda
  chamada de `updatePluggyAccount`, inclusive edição de apelido/toggle de
  sync — não é uma mudança de contrato do backend, só uma correção de uso no
  frontend antes de virar bug real em produção.
- **Bloco 3 exigiu sincronizar as contas manualmente via API** (não só
  inspecionar dado já presente) — os items Nubank Investimentos/XP existiam
  mas nunca tinham sido sincronizados (`last_synced_at` nulo). Disparado
  `POST /pluggy/items/{id}/sync` para os dois via um token JWT gerado dentro
  do próprio container da API (mesmo mecanismo de sessão real, nunca
  bypass de auth) — mesma ação que o CEO faria clicando "Sincronizar
  MeuPluggy" na tela.
- **Escopo do Bloco 3 ficou maior que o previsto** — confirmado com o CEO via
  pergunta direta (não presumido pelo CTO): a subcategoria "Rendimento"
  condicional do PRD não resolveria o problema real (visão de holdings), e
  soltar o filtro de tipo de conta sem a integração completa teria valor
  questionável. Registrado como próxima sprint, não implementado agora.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Criar Investimento (só nome) aparece como card | sim | `InvestimentosPage.test.tsx` — "creates a new investimento" |
| 2. Vincular carteira compõe saldo do investimento no card | sim | `test_investimento_service.py::test_get_evolucao_sums_saldo_base_and_saldo_atual...`, `AccountManagementPage.test.tsx` — "linking a carteira to an investimento" |
| 3. `saldo_inicial` entra no cálculo de `saldo_base` | sim | `test_get_evolucao_sums_saldo_base_and_saldo_atual_across_multiple_carteiras` |
| 4. Transação de transferência recebe sugestão Aporte/Resgate + investimento, nunca auto-confirmada | sim | `test_list_transactions_applies_investimento_suggestion_but_never_confirms` |
| 5. Aporte/Resgate confirmados contam nos totais normais — regressão | sim | `test_aporte_resgate_group_does_not_change_totals_of_unrelated_transactions` |
| 6. Drilldown bate com `/dashboards/por-investimento` e `/pluggy/transactions?investimento_id=` | sim | `InvestimentosPage.test.tsx` — "opens the drilldown..."; `test_list_transactions_filters_by_investimento_id` |
| 7. Excluir investimento desassocia (não exclui) carteiras e transações | sim | `test_delete_investimento_disassociates_accounts_and_transactions` |
| 8. Isolamento entre usuários (criar/editar/excluir/vincular/consultar) | sim | testes de isolamento em todos os módulos tocados (backend) |
| 9. 401 sem cookie de sessão em toda rota nova | sim | `test_list_investimentos_without_cookie_returns_401` e equivalentes |
| 10. Bloco de investigação de renda com dado real, achados documentados independente do resultado | sim | Ver "Achados do Bloco 3" acima |
| 11. Cobertura ≥80% nos módulos tocados | sim | 98% backend total, 100% em `app/investimentos/` |

## Documentação atualizada

- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) — seção nova
  "Gestão de Investimentos, Blocos 1+2 (Sprint 19)", contadores de
  teste/cobertura atualizados, header do doc.
- [docs/directory-structure.md](../directory-structure.md) — módulo
  `app/investimentos/`, migration `0015`, arquivos frontend novos, extensões
  em módulos existentes.
- [docs/roadmap.md](../roadmap.md) — Sprint 19 registrada como concluída;
  item "Categorização de Aporte/Resgate..." removido de "Registro de
  reavaliações futuras" (resolvido); novo item "Integração completa de
  Investments da Pluggy" registrado como a próxima sprint confirmada.
- `docs/dashboards-guia-cards.md` — **sem mudança**: nenhum card do Dashboard
  mudou de comportamento nesta sprint (Aporte/Resgate contam nos totais
  normais, sem lógica de exclusão nova).

## Consumo estimado de tokens/sessões

Sprint grande (full-stack: migration, 6 módulos backend tocados, 1 módulo
novo, 8 arquivos frontend tocados, 2 páginas/módulos novos, 64 testes novos,
deploy + investigação com dado real) — consumida em uma única sessão longa.

## Pendências e próximos passos sugeridos

- **Próxima sprint confirmada pelo CEO:** integração completa de Investments
  da Pluggy (`GET /investments`, `GET /investments/transactions`) — holdings/
  posições (CDBs, ações, "Caixinha"), a partir do achado real desta sprint.
  Precisa de `/plan` própria (schema novo para posições, decisões de UI).
- **Trava de tipo de conta no vínculo carteira→investimento** continua só de
  UI (contas `tipo≠investimento` não aparecem no seletor) — o achado do
  Bloco 3 mostrou um caso real onde isso importa (a conta XP com dividendos é
  `tipo=corrente`), mas o CEO decidiu não mexer nisso agora; deve ser
  revisado junto do planejamento da integração de Investments.
- **Subcategoria "Rendimento"** segue não implementada — decisão explícita
  do CEO, não uma lacuna esquecida; reavaliar junto da sprint de Investments.
