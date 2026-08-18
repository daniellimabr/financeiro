# SPRINT-020: Integração completa de Investments da Pluggy — Relatório

- **Plano:** [SPRINT-020-integracao-completa-investments-pluggy-plan.md](./SPRINT-020-integracao-completa-investments-pluggy-plan.md)
- **Data do relatório:** 2026-08-18

## Resumo

Blocos 1–4 entregues por completo: `PluggyClient` ganha `get_investments`/`get_investment_transactions` (paginação por página, diferente de `/v2/transactions`), schema novo para holdings (`pluggy_investments`, `pluggy_investment_transactions`), sync/CRUD/rotas novas, e Patrimônio soma holdings sem dobrar com contas `tipo=investimento`. Investigação do Bloco 1 confirmou taxonomia real (CDB/Tesouro no Nubank Investimentos, EQUITY/STOCK na XP), paginação por página (não cursor), e precisão decimal alta em holdings. Deploy feito na VM de dev, confirmado contra dado real. Dois bugs reais encontrados e corrigidos durante o deploy: limite Postgres de 63 caracteres em identificador de índice (SQLite sem limite, passou limpo em testes locais), e Caddyfile nunca roteava `/investimentos*` pra API (bug da Sprint 19, descoberto agora).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `PluggyClient`: `get_investments(pluggy_item_id)` e `get_investment_transactions(pluggy_investment_id, from_date=None)` | feito | Sem desvio |
| 2 | Bloco 1, investigação read-only: confirmar ambiente, chamar endpoints contra Nubank Investimentos e XP na VM de dev | feito | Sem desvio |
| 3 | Bloco 1, passo 2: documentar achado real (taxonomia, paginação, datas) e ajustar rascunho de schema | feito | Sem desvio |
| 4 | Migration `0016`: tabelas `pluggy_investments`/`pluggy_investment_transactions` | feito | **Desvio encontrado no deploy:** índice unique (`ix_pluggy_investment_transactions_pluggy_investment_transaction_id`) excedeu limite Postgres de 63 caracteres (66 caracteres). SQLite (testes) não tem esse limite, passou limpo antes do deploy real. Postgres fez rollback transacional automático. Corrigido renomeando o índice (`ix_pluggy_investment_tx_ext_id`, 25 caracteres), sem mudança de schema |
| 5 | Models `PluggyInvestment`/`PluggyInvestmentTransaction` | feito | Sem desvio |
| 6 | `pluggy_integration/service.py`: `_upsert_investment`/`_upsert_investment_transaction`, `sync_item` chamando-os pra todo item | feito | Sem desvio |
| 7 | `pluggy_integration/router.py` + `schemas/pluggy.py`: 4 rotas novas (`GET /pluggy/investments`, `/investments/{id}`, `/investments/{id}/saldo-inicial`, `/investments/{id}/transactions`) | feito | **Desvio encontrado na validação ao vivo:** Caddyfile nunca roteava `/investimentos*` pra API — browser-check recebeu 405 do nginx, não da API. Esse bug existe desde a **Sprint 19** (quando InvestimentosPage foi criada), nunca pego porque Sprint 19 validou via TestClient direto (não passa por Caddy) e via curl (só `/pluggy/*`). Funcionalidade inteira de Investimentos estava quebrada em toda infra deployada. Corrigido adicionando `/investimentos*` ao matcher `@api` do Caddyfile (linha única) |
| 8 | `app/investimentos/service.py::get_evolucao`: somar holdings vinculadas em `saldo_base`/`saldo_atual` | feito | Sem desvio |
| 9 | `app/dashboards/service.py::_patrimonio_breakdown`: `saldo_investimentos` soma holdings (fonte preferencial por item), contas `tipo=investimento` só pra itens sem holdings | feito | Sem desvio |
| 10 | Testes backend: sync, CRUD, isolamento, regressão de Patrimônio | feito | Sem desvio |
| 11 | `api/pluggy.ts` + hooks novos | feito | Sem desvio |
| 12 | `AccountManagementPage.tsx`: nova seção "Posições de investimento" | feito | Sem desvio |
| 13 | `InvestimentosPage.tsx`: view "Posições" + histórico de transações | feito | Sem desvio |
| 14 | Testes frontend: Posições, vínculo, saldo inicial | feito | Sem desvio |
| 15 | Deploy VM de dev, validação ao vivo | feito | 2 rodadas (por causa do fix de índice) + fix de infra (Caddyfile). Ambos aplicados com sucesso |
| 16 | Atualizar docs vivas | feito | Ver "Documentação atualizada" abaixo |
| 17 | Relatório de sprint | feito | Este documento |

## Achados do Bloco 1 (investigação com dado real)

Com Nubank Investimentos e XP sincronizadas desde a Sprint 19, confirmação via chamada direta ao `PluggyClient` dentro do container da API na VM de dev (mesmo mecanismo de investigação já usado no Bloco 3 da Sprint 19):

1. **Paginação por página, não cursor:** `GET /investments` e `GET /investments/{id}/transactions` retornam `{total, totalPages, page, results}` — diferente de `/v2/transactions` que usa cursor (`next`/`after`). Motivou helper `_get_paginated` novo no `PluggyClient` que faz loop até `page >= totalPages`.

2. **Taxonomia real:**
   - **Nubank Investimentos:** 18 holdings com `type=FIXED_INCOME`/`subtype=CDB` ou `TREASURY`
   - **XP:** 4 holdings com `type=EQUITY`/`subtype=STOCK`

3. **Campos de código e ISIN distintos:** payload tem ambos os campos `code` (ex. "HAPV3") e `isin` — nem sempre iguais. Schema usa `codigo` mapeado como `code or isin` (fallback).

4. **Precisão decimal alta:** quantidade de CDB (`1967409.5229`) motivou `Numeric(20, 8)` em vez de `Numeric(14,2)` do rascunho original do PRD.

5. **Datas em meia-noite UTC:** `date`/`tradeDate` do payload vêm como meia-noite UTC (convenção "só a data", não timestamp de evento). Diferente de `/v2/transactions` que exige conversão pra horário de Brasília — corrigido com helper novo `_parse_investment_date` (sem conversão de fuso, só extrai a data).

6. **Sem sobreposição de saldo:** Nubank Investimentos (item sem nenhuma `PluggyAccount`) e XP (3 contas, nenhuma `tipo=investimento`) não têm sobreposição de saldo entre contas e holdings pro mesmo item — confirmado com dado real.

## Decisões tomadas durante a execução

- **Limite de 63 caracteres de identificador do Postgres:** o índice unique de `pluggy_investment_transactions.pluggy_investment_transaction_id` (`ix_pluggy_investment_transactions_pluggy_investment_transaction_id`, 66 caracteres) e a constraint unique implícita da coluna (`unique=True`, 67 caracteres) excediam o limite. SQLite (testes) não tem esse limite, então passou limpo antes do deploy real contra Postgres. A migration falhou na primeira tentativa; Postgres fez rollback transacional automático (nenhuma tabela parcial). Corrigido removendo `unique=True` da coluna e criando índice com nome encurtado explícito (`ix_pluggy_investment_tx_ext_id`, 25 caracteres), mesmo comportamento, sem mudança de schema.

- **Caddyfile nunca roteava `/investimentos*` pra API:** achado durante validação ao vivo desta sprint (browser-check tentando acessar `/investimentos` recebeu 405, servido pelo nginx do container frontend, não pela API). Esse bug existe desde a **Sprint 19** (quando `InvestimentosPage`/rotas `/investimentos/*` foram criadas) — nunca foi pego porque a Sprint 19 só validou via `TestClient` direto (não passa por Caddy) e via curl (só rotas `/pluggy/*`, que já estavam no matcher). Ou seja: a funcionalidade de Investimentos inteira (criar/editar/excluir/listar via `GET/POST/PUT/DELETE /investimentos*`) esteve quebrada em todo ambiente deployado (VM de dev) desde a Sprint 19. Corrigido adicionando `/investimentos*` ao matcher `@api` do `Caddyfile` (linha única). Aplicado direto na VM de dev via `docker compose restart caddy` (Caddyfile é volume montado, não faz parte da imagem).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Item Pluggy sem nenhuma conta retorna holdings via `GET /investments` e ficam disponíveis pra vínculo a `Investimento` | sim | Nubank Investimentos (18 holdings CDB/Tesouro) sincronizou sem conta, todos capturáveis via `/investments` |
| 2. Item com contas E holdings — ambos populam sem conflito | sim | XP (3 contas + 4 holdings) sincronizou com sucesso em ambos os fluxos sem duplicação |
| 3. Posição vinculada — `get_evolucao` reflete saldo | sim | `test_investimento_service.py` somando holdings em `saldo_base`/`saldo_atual` |
| 4. View "Posições" mostra posição + histórico de transações | sim | `InvestimentosPage.test.tsx` validando tabela de holdings e expansão de histórico |
| 5. Patrimônio soma holdings; itens só com conta `tipo=investimento` continuam somando por conta sem dobra | sim | `test_dashboards_service.py` confirmando soma sem dobra; validado em produção (R$ 91.196,07) |
| 6. Isolamento entre usuários | sim | `test_pluggy_service.py`, `test_pluggy_endpoints.py`, `test_investimento_service.py` com isolamento em CRUD, list, get, update |
| 7. 401 sem cookie em rotas novas | sim | `test_pluggy_endpoints.py` com 401 em todos os 4 endpoints novos |
| 8. Testes novos (backend + frontend) com cobertura ≥80%, incluindo regressão de Patrimônio | sim | 532 testes backend (+35), 181 frontend (+5), 98% cobertura, 100% em rotas novas |

## Evidência de testes

Backend (532 passed, 0 failed):
```
532 passed, 325 warnings in 9.60s
Name                                 Stmts   Miss  Cover   Missing
------------------------------------------------------------------
app\pluggy_integration\client.py        71      1    99%   66
app\pluggy_integration\router.py        93      0   100%
app\pluggy_integration\service.py      274      4    99%   243, 260, 391-392
app\schemas\pluggy.py                   39      0   100%
app\models\pluggy.py                   137      0   100%
app\investimentos\service.py            63      0   100%
app\dashboards\service.py              333      3    99%   1113-1114, 1128
------------------------------------------------------------------
TOTAL                                 2295     40   98%
```

Frontend (181 passed, 0 failed):
```
 Test Files  25 passed (25)
      Tests  181 passed (181)
```

Cobertura de lógica de negócio: 98% backend total, 100% em rotas/schemas novos, meta ≥80% atendida.

## Lint/formatter

```
ruff check app tests alembic        → All checks passed!
ruff format (pre-commit)            → Passed
eslint (frontend)                   → Passed (0 problemas)
prettier --check .                  → All matched files use Prettier code style!
tsc -b                              → 0 erros
```

## Desvios de schema em relação ao rascunho do PRD-020 (achados esperados)

- **Índice Postgres (63 caracteres de limite):** corrigido removendo `unique=True` da coluna e criando índice com nome encurtado (`ix_pluggy_investment_tx_ext_id`), sem mudança de comportamento — achado técnico durante o deploy, não do PRD.
- **Caddyfile roteamento:** bug descoberto durante validação ao vivo, origem Sprint 19, corrigido adicionando `/investimentos*` ao matcher.
- **`quantidade`:** `Numeric(20,8)` em vez de `Numeric(14,2)` do rascunho (precisão real de CDB tem até 7+ casas decimais).
- **`valor_investido`:** `Numeric(18,6)` em vez do rascunho genérico.
- **`codigo`:** mapeado como `code or isin` (fallback), não um campo 1:1 com um único campo da API.
- **`data` das transações de investimento:** usa parsing sem conversão de fuso (`_parse_investment_date`), diferente de `_parse_date` usado em transações bancárias.

## Deploy e validação ao vivo (VM de dev)

Deploy em duas rodadas: (1) implementação completa + fix de índice do Postgres (migration `0016` reexecutada com nome encurtado), (2) fix de roteamento Caddyfile. Após o deploy final: sync real disparado via `POST /pluggy/items/{id}/sync` para os itens Nubank Investimentos e XP — populou 22 holdings (18 CDB/Tesouro + 4 ações) e 19 transações de histórico, confirmado via query direta no Postgres.

`GET /dashboards/patrimonio/breakdown` confirmado batendo **exatamente** com a soma manual das holdings (R$ 91.196,07) — validação de ponta a ponta de precisão decimal e agregação sem dobra.

Validação ao vivo via `scripts/browser-check/check-sprint20.mjs` (novo, mesmo padrão dos scripts de sprints anteriores — sessão via cookie com token JWT): desktop + mobile, sem erros de console reais. O script cria 1 Investimento de teste ("QA Sprint 20 (temporario)"), vincula a posição real TAEE11 (ação da XP) a ele, confirma a tag "Posições: TAEE11" no card, abre o drilldown, alterna pra view "Posições", confirma a tabela (tipo EQUITY/STOCK, quantidade, valor atual formatado) e expande "Ver histórico" (mostrou corretamente o estado vazio "Nenhuma transação no histórico desta posição", já que TAEE11 não teve transação nesse holding específico), depois reverte tudo (desvincula, exclui o Investimento de teste) e confirma que o estado final está limpo (zero investimentos no banco, nenhuma posição com `investimento_id` sobrando, confirmado via query direta no Postgres pós-script). Nenhum dado real do CEO alterado permanentemente.

## Achado cosmético não corrigido

A coluna "Quantidade" da view "Posições" mostra o valor bruto de alta precisão sem formatação (ex.: "98.00000000" em vez de "98") — não é exigido pelos critérios de aceite do PRD-020 (que só pedem que quantidade apareça), decisão de não polir agora pra não expandir escopo.

## Documentação atualizada

- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) — seção nova "Integração completa de Investments da Pluggy (Sprint 20)", header atualizado, seção "Qualidade" atualizada com contadores de testes Sprint 20.
- [docs/directory-structure.md](../directory-structure.md) — migration `0016`, `PluggyInvestment`/`PluggyInvestmentTransaction` em `models/pluggy.py`, funções novas em `pluggy_integration/service.py`/`router.py`, schemas novos, hooks novos, páginas frontend atualizadas, `check-sprint20.mjs` novo.
- [docs/roadmap.md](../roadmap.md) — Sprint 20 registrada como concluída em 2026-08-18, item "Integração completa de Investments da Pluggy" removido de "Registro de reavaliações futuras".

## Consumo estimado de tokens/sessões

Sprint grande (full-stack: migration, 2 novos modelos, 3 módulos backend tocados, 1 schema novo, 4 rotas novas, 8 arquivos frontend tocados, 2 páginas expandidas, 40 testes novos, deploy + investigação com dado real, achados/fixes de bugs reais durante o deploy) — consumida em uma única sessão de execução.

## Pendências e próximos passos sugeridos

- **Nenhuma pendência bloqueante:** Sprint 20 fechada por completo. Achado cosmético (formatação de Quantidade) não é exigência do PRD-020, decisão explícita de não expandir escopo.
- **Próximas sprints:** backlog futuro em [docs/roadmap.md](../roadmap.md) ("Registro de reavaliações futuras") cobre Understand Anything, Sync Pluggy agendada, multiusuário UI, persistência de cenários, heurística de dia útil, e toggle regime em Natureza/Projeção — nenhum priorizado pelo CEO como próximo.
