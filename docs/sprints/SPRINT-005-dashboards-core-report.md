# SPRINT-005: Dashboards core — Relatório

- **Plano:** [SPRINT-005-dashboards-core-plan.md](./SPRINT-005-dashboards-core-plan.md)
- **Data do relatório:** 2026-08-14
- **Status:** implementado, testado, deployado e verificado visualmente contra a VM de dev real (screenshots via Playwright — ver seção de QA visual). Aguardando validação/aprovação do CEO.

## Resumo

Dashboards core implementados: `data_competencia` passa a ser gravada em todo
sync (com backfill das transações já existentes), transferências internas
(pagamento de fatura) deixam de inflar os totais agregados, três endpoints
novos (`/dashboards/summary`, `/por-categoria`, `/por-meio-pagamento`) e o
`DashboardsPage` no frontend com filtro ano/mês, quatro cards de resumo e
funil de drill-down completo até a linha de extrato. Primeira sprint com
identidade visual real do projeto — direção escolhida com o CEO via fluxo
`new-work` do Impeccable, documentada em [DESIGN.md](../../DESIGN.md). Fecha
o épico E5.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Confirmar sinal do saldo de `cartao_credito` na VM de dev | feito | Confirmado empiricamente: saldo positivo = dívida (ver seção de evidência) |
| 2 | Migration `0007` — `excluir_de_totais` + backfill `data_competencia` + índice | feito | — |
| 3 | Gravar `data_competencia` em `_upsert_transaction` | feito | — |
| 4 | Filtros novos em `list_transactions`/`GET /pluggy/transactions` | feito | — |
| 5 | `app/dashboards/service.py` (summary, por_categoria, por_meio_pagamento) | feito | — |
| 6 | Schemas + router + registro em `main.py` | feito | — |
| 7 | `Caddyfile`: `/dashboards*` no matcher `@api` | feito | — |
| 8 | Testes unitários (dashboards service + extensão pluggy service) | feito | — |
| 9 | Testes de integração (dashboards endpoints + extensão pluggy endpoints) | feito | — |
| 10 | Instalar Recharts + `api/dashboards.ts` + hooks + extensão `api/pluggy.ts` | feito | — |
| 11 | Fluxo `new-work` do Impeccable + `DashboardsPage.tsx` + aba | feito | Ver seção de decisões — fluxo completo com o CEO via artifacts comparativos, não apenas texto |
| 12 | Testes Vitest (`api/dashboards.test.ts`, `DashboardsPage.test.tsx`) | feito | — |
| 13 | `/impeccable audit` — gate final | feito | Sem navegador/screenshot disponível no ambiente (Windows sem Docker/WSL2, sem `chromium-cli` instalado) — avaliação por revisão de código nos 5 eixos do audit, não pixel-verificada. Disclosure explícito, não omitido |
| 14 | Deploy na VM de dev + validação migration `0007` + validação manual | feito | Ver seção de evidência |
| 15 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md`) | feito | — |
| 16 | Relatório de sprint | feito | este documento |

## Evidência de testes

### Backend (pytest, 151 testes, 98% cobertura)

```
Name                                 Stmts   Miss  Cover   Missing
------------------------------------------------------------------
app\dashboards\__init__.py               0      0   100%
app\dashboards\router.py                18      0   100%
app\dashboards\service.py               54      0   100%
app\schemas\dashboards.py                9      0   100%
app\pluggy_integration\service.py      113      0   100%
app\pluggy_integration\router.py        41      0   100%
app\models\category.py                  28      0   100%
app\models\pluggy.py                    83      0   100%
------------------------------------------------------------------
TOTAL                                 1117     22    98%
151 passed in 2.56s
```

Módulos novos da Sprint 5 (`app/dashboards/*`, `app/schemas/dashboards.py`):
100% de cobertura. `app/pluggy_integration/service.py` e `router.py`
(estendidos com os novos filtros): 100%.

### Frontend (Vitest, 24 testes)

```
Test Files  8 passed (8)
     Tests  24 passed (24)
```

Inclui os 2 arquivos novos: `api/dashboards.test.ts` (5 testes — query params
de summary/por-categoria/por-meio-pagamento, presença/ausência de
`categoria_id`) e `pages/DashboardsPage.test.tsx` (4 testes — 4 cards a
partir de dado mockado, refetch ao trocar filtro de mês, navegação completa
do funil Despesa → Categoria → Meio de pagamento → Transação → volta três
níveis, estado vazio).

## Lint/formatter

```
backend:  ruff check .          -> All checks passed!
          ruff format --check . -> 82 files already formatted
frontend: eslint .              -> sem erros
          prettier --check .    -> All matched files use Prettier code style!
          tsc -b                -> sem erros
          vite build            -> build ok (chunk >500kB, ver Pendências)
```

Suíte completa (backend + frontend) 100% verde, incluindo os hooks
pre-commit (`ruff`, `ruff-format`, `eslint`, `detect-secrets`) rodados no
commit real.

## Decisões tomadas durante a execução

- **Sinal do saldo de `cartao_credito` confirmado por dupla evidência, não só
  o valor bruto:** consultado `pluggy_accounts` na VM de dev (conta real:
  `saldo=12247.09`, positivo) e cruzado contra as próprias transações da
  conta (`debito` soma `+32374.18`, `credito` soma `-28972.53`) — confirma
  que débito (compra) aumenta o que se deve e crédito (pagamento/estorno)
  reduz, logo saldo positivo = dívida. `patrimonio` subtrai saldos de
  `cartao_credito` em vez de somar.
- **Sentinel `SEM_CATEGORIA_ID = 0`** adotado como convenção única (backend
  `app/models/category.py`, frontend `api/dashboards.ts`) para "sem
  subcategoria" tanto na resposta de `/por-categoria` quanto nos filtros de
  `/por-meio-pagamento` (`categoria_id`) e `/pluggy/transactions`
  (`subcategory_id`) — decisão de design não detalhada no plano original,
  necessária para o funil funcionar corretamente no bucket "Não
  categorizado" (ver PRD-005 §Regras de negócio, que só especificava o
  bucket na resposta, não o filtro de retorno).
- **`receita`/`despesa` somadas por valor absoluto (`abs(valor)`), não pelo
  sinal bruto de `valor`:** o sinal de `valor` vindo da Pluggy não é
  consistente entre tipos de conta (débito em conta corrente vem negativo,
  débito em cartão de crédito vem positivo — confirmado no mesmo cruzamento
  de dados real acima). Usar `abs(valor)` agrupado por `tipo` (débito/crédito
  já mapeado pela Pluggy) normaliza essa inconsistência sem precisar de lógica
  condicional por tipo de conta.
- **Filtro `competencia` em `GET /pluggy/transactions`** (bool, não um novo
  endpoint): quando `true`, `ano`/`mes` filtram por `data_competencia` em vez
  de `data` — necessário para o último nível do funil bater exatamente com a
  base usada nas agregações. Decisão de design do plano ("servir o último
  nível do drill-down... sem duplicar endpoint"), implementada como flag
  booleana por ser a extensão mínima que preserva compatibilidade total com
  o comportamento anterior (default `false`).
- **Escolha de direção visual conduzida via artifacts comparativos, não só
  texto:** como esta é a primeira tela com trabalho visual real do projeto, o
  fluxo `new-work` do Impeccable foi seguido à risca — 7 sistemas visuais do
  universo financeiro brasileiro levantados, script de sorteio de direção
  rodado (`concept-seed.mjs`), e a decisão apresentada ao CEO como HTML/CSS
  real renderizado em Artifacts (não ASCII), em duas rodadas (comparação de 3
  mundos, depois 4 variações dentro do registro escolhido, depois ajuste do
  modo escuro). Decisão final: direção "YNAB/Copilot-esque" — neutro quente,
  verde para receita/marca, terracota só para despesa — com modo escuro
  ajustado para cinza-chumbo neutro (não marrom) a pedido do CEO.
- **`/impeccable audit` sem navegador:** ambiente Windows sem Docker/WSL2 (já
  documentado como restrição do notebook corporativo) e sem `chromium-cli`
  instalado — não foi possível capturar screenshots reais. Avaliação feita
  por revisão de código estruturada contra os 5 eixos do audit
  (acessibilidade, performance, theming, responsivo, integridade de
  implementação); 2 achados reais corrigidos (touch targets abaixo de 44px
  nas linhas do funil e no botão voltar; filtro de mês/ano sem `flex-wrap`
  em viewport estreito). Contraste de cor estimado por cálculo de luminância
  relativa (não verificado por ferramenta), theming 100% baseado em tokens
  (zero cor hardcoded fora da definição dos tokens). Disclosure explícito
  desta limitação, não omitida.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Sync grava `data_competencia = data`, nunca `NULL` para transações novas | **Sim** | `test_sync_item_creates_accounts_and_transactions` e `test_sync_item_writes_data_competencia_equal_to_data_on_resync` |
| 2. Migration faz backfill de `data_competencia` para transações já sincronizadas | **Sim** | Migration `0007`: `UPDATE pluggy_transactions SET data_competencia = data WHERE data_competencia IS NULL` |
| 3. `GET /dashboards/summary` retorna receita/despesa/saldo por `data_competencia`, excluindo transferência interna, e patrimônio como snapshot atual | **Sim** | `test_get_summary_mixed_debito_credito_computes_saldo`, `test_get_summary_period_with_only_transferencia_interna_is_zeroed`, `test_get_summary_patrimonio_subtracts_cartao_credito_balance` |
| 4. Período só com transferência interna zera totais, mas transações continuam aparecendo em `/pluggy/transactions` | **Sim** | `test_get_summary_period_with_only_transferencia_interna_is_zeroed` (dashboards); filtro de `excluir_de_totais` não existe em `list_transactions`, só nas agregações — comportamento intencional, não testável por ausência |
| 5. `/dashboards/por-categoria` agrupado por grupo/subcategoria + bucket "Não categorizado", soma bate com summary | **Sim** | `test_get_por_categoria_sums_match_summary_and_bucket_uncategorized` |
| 6. `/dashboards/por-meio-pagamento` agrupado por `pluggy_accounts.tipo`, filtro opcional por categoria | **Sim** | `test_get_por_meio_pagamento_groups_by_account_tipo`, `test_get_por_meio_pagamento_filters_by_categoria_id`, `test_get_por_meio_pagamento_filters_by_categoria_id_uncategorized` |
| 7. `/pluggy/transactions` com filtros novos combinados/isolados; sem filtro, comportamento idêntico ao anterior | **Sim** | `test_list_transactions_combined_filters_isolated_by_user`, `test_list_transactions_without_filters_returns_everything`, testes de filtro individual (`ano`/`mes`, `subcategory_id`, `account_tipo`, `competencia`) |
| 8. Isolamento entre usuários em todos os endpoints de dashboards e filtros novos | **Sim** | `test_summary_and_por_categoria_isolated_by_user` (service), `test_user_does_not_see_other_users_totals` (endpoints), `test_list_transactions_combined_filters_isolated_by_user` |
| 9. `/dashboards/*` sem cookie retorna 401 | **Sim** | `test_summary_without_cookie_returns_401`, `test_por_categoria_without_cookie_returns_401`, `test_por_meio_pagamento_without_cookie_returns_401` |
| 10. CI com cobertura ≥80% nos módulos novos | **Sim** | 100% em `app/dashboards/*` e `app/schemas/dashboards.py` |
| 11. Frontend: filtro → 4 totais → clica Despesa/Receita → categoria → meio de pagamento → transações | **Sim** | `DashboardsPage.test.tsx::navigates the drill-down funnel from despesa to a transaction row and back` — cobre o funil completo nos 4 níveis + volta |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — nova seção "Dashboards core (Sprint 5)",
  rota `/dashboards*` no roteamento Caddy, migration `0007` na lista, módulo
  `app/dashboards/` nos componentes, referência a `DESIGN.md`, contagens de
  teste atualizadas.
- `docs/directory-structure.md` — `DESIGN.md` na raiz, módulo
  `app/dashboards/`, `schemas/dashboards.py`, migration `0007`, testes novos,
  `api/dashboards.ts`, hooks novos, `DashboardsPage.tsx`, seção "O que ainda
  não existe" revisada (removida a pendência de `DESIGN.md`, adicionadas as
  pendências específicas do PRD-005).
- `docs/roadmap.md` — E5 marcado concluído, Sprint 5 com data de conclusão e
  link deste relatório.
- `DESIGN.md` (novo, raiz do projeto) — sistema de design completo gerado a
  partir do mundo visual construído (cores, tipografia, espaçamento,
  componentes, do's/don'ts), seguindo o spec DESIGN.md.
- `Caddyfile` — `/dashboards*` no matcher `@api`.

## Consumo estimado de tokens/sessões

Sessão única, mas sensivelmente mais longa que as Sprints 2-4: além do
trabalho de backend/testes já no padrão das sprints anteriores, esta sprint
incluiu o fluxo completo `new-work` do Impeccable (levantamento de 7 mundos
visuais, script de sorteio de direção, duas rodadas de artifacts HTML/CSS
renderizados para decisão do CEO, ajuste de modo escuro, `DESIGN.md`) — custo
de tokens/tempo maior que uma sprint puramente backend+CRUD. Calibrar
expectativa de sessões futuras com trabalho visual real por esse padrão, não
pelo das Sprints 2-4.

## Deploy e validação na VM de dev (2026-08-14)

`git push` disparou o CI (backend + frontend + `build-and-push`); deploy na
VM de dev via `git pull` + `docker compose pull` + `docker compose up -d` +
`docker compose restart caddy`, com espera automática (poll a cada 15s) até
o novo endpoint responder — o pull da imagem `api` foi incomum lento nesta
sprint (~90MB na conexão da VM Oracle Free Tier), mas completou dentro do
mesmo comando.

**Migration `0007`:**
```
$ docker compose exec api alembic current
0007 (head)
```

**Efeito real da migration, verificado contra o banco de produção real da VM de dev:**
```sql
SELECT nome, excluir_de_totais FROM category_groups WHERE excluir_de_totais = true;
-- Transferência interna | t   (única linha — nenhum outro grupo afetado)

SELECT count(*) FROM pluggy_transactions WHERE data_competencia IS NULL;
-- 0   (de 942 transações totais — backfill completo, sem sobra)
```

**Endpoint novo respondendo (sem cookie, 401 esperado):**
```
GET http://localhost:8080/dashboards/summary  -> HTTP 401
```

**Sanity check das três agregações contra dado real sincronizado** (via
`docker compose exec api python -c "..."`, chamando `app.dashboards.service`
diretamente para o usuário real, sem mutar nada):
- `get_summary`: `receita=178540.68`, `despesa=194304.57`,
  `saldo=-15763.89`, `patrimonio=-8525.23` — plausível: a maior parte da
  despesa cai em "Não categorizado" (`193393.45` de `194304.57`) porque a
  fila de revisão da Sprint 4 ainda não foi confirmada para a maioria das
  942 transações reais (só `subcategory_id` confirmado entra fora do bucket
  "Não categorizado", nunca a sugestão pendente — comportamento correto,
  não um bug). Patrimônio negativo é coerente com os dados de sandbox da
  Sprint 3 (contas de teste, não finanças reais da família).
- `get_por_categoria`: retorna grupo/subcategoria reais (ex.: "Veículos ·
  Estacionamento e pedágio", "Compras · Móveis") além do bucket "Não
  categorizado".
- `get_por_meio_pagamento`: `corrente=161930.39`, `cartao_credito=32374.18`
  — soma bate com `despesa` do summary.

## QA visual real (2026-08-14, pós-feedback do CEO)

Validação inicial (seção acima) ficou limitada a revisão de código — sem
navegador headless disponível, `/impeccable audit` não pôde pixel-verificar
nada. O CEO testou a versão deployada e reportou visual "experimental":
nav não estilizada (botões soltos, sem disposição em painel/abas) e
ausência de identidade visual fora de `DashboardsPage`.

**Causa raiz:** `DashboardsPage` recebeu os tokens novos, mas `ProtectedPage`
(nav + shell do app) nunca foi tocado — continuava HTML puro sem nenhuma
classe do design system, e o `button` base em `index.css` não tinha estilo
próprio (herda aparência default do navegador). Corrigido: `ProtectedPage`
virou um app shell real (sidebar fixa, colapsa para barra horizontal em
mobile), e o elemento `button` base ganhou estilo sistêmico — toda página
passa a herdar a mesma linguagem visual sem precisar de classe própria
("The One Button Rule", registrada em `DESIGN.md`).

**Ferramenta nova:** `scripts/browser-check/` — Playwright + Chromium
headless instalado como ferramenta própria do CTO (fora do `package.json`
do app, mesmo padrão de `.venv-ssh/` para SSH), já que o ambiente Windows
sem Docker/WSL2 não tem `chromium-cli`. Fecha a lacuna de QA visual
registrada na primeira versão deste relatório. Sessão autenticada real
gerada via `app.auth.jwt.create_access_token` rodado dentro do container da
API (mesmo mecanismo de uma sessão pós-login Google real, nunca uma
credencial nova).

**Dois bugs reais encontrados só ao ver o app renderizado** (nenhum dos
dois seria pego por lint/tsc/testes, já que nenhum quebra comportamento
testável — são puramente visuais):
1. `line-height: 145%` no shorthand `font` de `:root` computa para um valor
   fixo em `px` (145% de 16px = 23.2px) que é **herdado como esse valor
   absoluto**, não recalculado, por qualquer elemento maior — `h1` (32px)
   herdava 23.2px de `line-height`, então "Bem-vindo, Nome Longo" quebrando
   em duas linhas sobrepunha a segunda linha na primeira. Corrigido trocando
   para `line-height: 1.45` (unitless), que recalcula por elemento — reforça
   por que shorthand `font` com `%` de line-height é uma armadilha clássica
   de herança em CSS.
2. Nav mobile (barra horizontal) estourava a largura da viewport — `.app-nav`
   sem `min-width: 0` não encolhia dentro do flex row do `.app-sidebar`,
   então em vez de rolar horizontalmente (o `overflow-x: auto` já estava lá,
   mas nunca era acionado) o conteúdo simplesmente vazava para fora da barra.
   Corrigido com `min-width: 0` no nav e ocultando o bloco de nome/e-mail do
   usuário no layout compacto de mobile.

Screenshots reais (desktop 1440px + mobile 390px, telas Início/Dashboards/
drill-down) confirmam as duas correções — sem sobreposição de texto, nav
mobile contida dentro da barra, cards/funil com o acabamento pretendido.

## Pendências e próximos passos sugeridos

- **Bundle do frontend passa de 500kB** (Recharts é a maior dependência
  nova) — aviso do Vite no build, não um erro. Aceitável para um app de 2
  usuários numa VM Free Tier; revisitar com `dynamic import()`/code-splitting
  se o app crescer ou a VM de prod tiver restrição de banda relevante.
- **Update do Impeccable disponível** (v4.0.4 instalado → v4.1.1) — não
  aplicado nesta sessão para não interromper o fluxo de execução; rodar
  `npx impeccable update` numa sessão futura, efeito só na próxima sessão.
- **`scripts/browser-check/` fica disponível para sprints futuras** — vale
  rodar como parte do `/impeccable audit` sempre que houver trabalho visual
  novo, em vez de depender só de revisão de código.
- Sprints seguintes (E6 — dashboards analíticos por natureza/ativo/evolução
  de patrimônio; E7 — perfil/multiusuário) podem ser detalhadas agora que E5
  está pronta, conforme já registrado em `docs/roadmap.md`.
