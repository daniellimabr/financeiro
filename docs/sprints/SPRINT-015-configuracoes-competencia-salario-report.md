# SPRINT-015: Configurações, Competência de Salário e Saldo Acumulado — Relatório

- **Plano:** [SPRINT-015-configuracoes-competencia-salario-plan.md](./SPRINT-015-configuracoes-competencia-salario-plan.md)
- **Data do relatório:** 2026-08-17
- **Status:** aguardando aprovação do CEO

## Resumo

Tela "Configurações" (Perfil+logout, Gestão de Contas, Competência de
Salário) substitui a aba "Gestão de contas"; regra de competência de
salário por dia de corte configurável; salário de dez/2025 informado como
transação real (sentinela idempotente, sem código especial em nenhuma
função de agregação); saldo inicial por conta + auditoria mensal; dois
cards novos no Dashboard ("Saldo Acumulado"/"Saldo Anterior"). Fecha o
épico E7. Deploy na VM de dev e validação ao vivo sem achar nenhum bug real
na aplicação — só um ajuste no próprio script de QA e um bug de longa data
no wrapper de SSH (`$ErrorActionPreference`), corrigidos nesta sessão.

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Migration `0012`: `salario_competencia_cutoff_dia`, `saldo_inicial`, backfill | feito | Sem desvio |
| 2 | `POST /auth/logout`; `PUT /auth/me/settings` | feito | Sem desvio |
| 3 | `app/categorization/competencia.py`; hook em `set_category`/`bulk_confirm` | feito | Sem desvio |
| 4 | `upsert_salario_ajuste_dez_2025`; `PUT /pluggy/ajuste-salario-dezembro` | feito | Também adicionado `GET /pluggy/ajuste-salario-dezembro` (não estava no plano) — necessário pro form da tela pré-preencher o valor já salvo em vez de abrir sempre vazio; leitura da própria conta, sem risco |
| 5 | `PluggyAccount.saldo_inicial`; `PUT /pluggy/accounts/{id}/saldo-inicial` | feito | Sem desvio |
| 6 | `get_evolucao_saldo_por_conta`; `GET /dashboards/evolucao-saldo-por-conta` | feito | Sem desvio |
| 7 | Helper de soma extraído de `get_tendencia`; `get_saldo_acumulado`; `GET /dashboards/saldo-acumulado` | feito | Sem desvio |
| 8 | Testes backend | feito | 62 testes novos (379 no total), 98% cobertura total, 99-100% nos módulos tocados |
| 9 | `ConfiguracoesPage.tsx`; `ProtectedPage.tsx` troca de aba | feito | Sem desvio |
| 10 | `AccountManagementPage.tsx`: saldo inicial editável + tabela de auditoria | feito | Sem desvio |
| 11 | `api/auth.ts`, `api/pluggy.ts`, `api/dashboards.ts` + hooks novos | feito | Hook extra `useSalarioAjusteDezembro` (query, não só mutation) — consequência do item 4 acima |
| 12 | `DashboardsPage.tsx`: cards "Saldo Acumulado"/"Saldo Anterior" | feito | Sem desvio |
| 13 | Testes frontend | feito | 11 testes novos (155 no total) — `ConfiguracoesPage.test.tsx` novo, `DashboardsPage.test.tsx`/`AccountManagementPage.test.tsx`/`ProtectedPage.test.tsx` estendidos |
| 14 | `scripts/browser-check/check-sprint15.mjs` + validação na VM de dev | feito | 1ª rodada encontrou um bug no próprio script (ambiguidade `getByRole`, ver "Decisões tomadas"); revalidado com sucesso |
| 15 | Docs vivos (OVERVIEW.md, directory-structure.md, roadmap.md) | feito | Sem desvio |
| 16 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend

```
379 passed, 408 warnings in 8.24s
TOTAL                                 1822     37    98%
app\categorization\competencia.py       14      0   100%
app\categorization\service.py          188      2    99%
app\dashboards\service.py              275      3    99%
app\pluggy_integration\service.py      194      3    98%
app\auth\service.py                     17      0   100%
app\auth\router.py                      34      2    94%
```

### Frontend

```
Test Files  23 passed (23)
     Tests  155 passed (155)
  Duration  ~17-21s
```

Cobertura de lógica de negócio: 98% total no backend (99-100% nos módulos
tocados por esta sprint). Frontend sem gate de cobertura numérica (padrão
do projeto), mas toda superfície nova (`ConfiguracoesPage`, saldo inicial +
auditoria em `AccountManagementPage`, cards novos em `DashboardsPage`, os 6
hooks novos) tem teste de integração dedicado. Meta ≥80% atendida.

## Lint/formatter

```
backend: ruff check . — All checks passed!
backend: ruff format --check . — 88 files already formatted
frontend: tsc -b — sem erros
frontend: eslint . — sem erros
frontend: prettier --check . — All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

- **`GET /pluggy/ajuste-salario-dezembro` adicionado além do `PUT` já
  previsto no plano.** Sem ele, o form de "Salário de dezembro/2025" abriria
  sempre vazio mesmo depois de já ter sido preenchido — decisão pragmática
  de UX, leitura da própria conta do usuário, sem risco de segurança nem
  mudança de escopo de produto.
- **Padrão "draft não tocado até editar" em vez de `useEffect` pra
  sincronizar form com dado de servidor** (`ConfiguracoesPage.tsx`, form de
  ajuste de salário). A primeira versão usava `useEffect` pra copiar
  `ajusteQuery.data` pro estado local assim que a query resolvia — violava
  a regra do eslint `react-hooks/set-state-in-effect` (cascading render).
  Corrigido com `useState<T | null>(null)` por campo (valor exibido =
  draft ?? valor da query), sem efeito nenhum — primeiro precedente desse
  padrão no projeto (o único `useEffect` existente até então, em
  `CategoryCombobox.tsx`, é pra listener de DOM, não sincronização de
  servidor).
- **Bug real de CI (não da aplicação): `id(object())` como gerador de "id
  único" em `test_dashboards_endpoints.py` colidia sob CPython/Linux.**
  CPython recicla o endereço de memória de um `object()` temporário sem
  referência viva — em Linux/Python 3.12 (ambiente do CI) duas chamadas
  seguidas de `id(object())` retornavam o mesmo valor, violando a unique
  constraint de `pluggy_items.pluggy_item_id`; não reproduzia em
  Windows/Python 3.14 (ambiente local), nem recriando o venv do zero.
  Diagnosticado lendo o log real do job via API do GitHub (permissão do CEO
  pra usar o PAT existente, já que o classificador de segurança do Claude
  Code bloqueou a primeira tentativa por expor um token num comando).
  Corrigido com um contador `itertools`, mesmo padrão já usado em todos os
  outros arquivos de teste do projeto.
- **Achado de infraestrutura (não da aplicação): `scripts/ssh-vm.ps1` tinha
  `$ErrorActionPreference = "Stop"` global.** PowerShell 5.1 trata qualquer
  escrita em stderr de um comando nativo como erro terminante nesse modo,
  mesmo com exit code 0. Como `git pull` sempre escreve seu progresso em
  stderr (convenção do git) e o wrapper encaminha stderr do comando remoto
  pro stderr local (`ssh_vm.py::_pump`), **todo deploy que envolvesse um
  `git pull` com output real derrubava o script antes do comando remoto
  terminar de rodar** — não tinha aparecido antes porque sessões anteriores
  rodavam os comandos remotos um a um, interativamente. Corrigido trocando
  pra `"Continue"` (a propagação de erro real já era via `exit
  $LASTEXITCODE`, não por exceção do PowerShell).
- **`check-sprint15.mjs`: ambiguidade de `getByRole` (case-insensitive por
  padrão no Playwright) entre `<h3>Gestão de Contas</h3>` (seção nova desta
  sprint) e `<h2>Gestão de contas</h2>` (título interno do
  `AccountManagementPage` reaproveitado).** Corrigido com `{ level: 3 }` no
  locator. Único achado da rodada de QA — não é um bug da aplicação.
- **Toda mutação de dado real feita pelo script de QA foi revertida e
  confirmada por leitura direta da API depois do script terminar** (dia de
  corte, saldo inicial das 3 contas reais, ajuste de salário de
  dezembro/2025) — nenhum dado do CEO foi alterado permanentemente.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `POST /auth/logout` limpa cookie, `GET /auth/me` seguinte retorna 401 | sim | `test_logout_clears_cookie_and_invalidates_session`; validado ao vivo (`check-sprint15.mjs`, screenshot `08-logout`) |
| 2. "Gestão de contas" não existe mais como aba própria; "Configurações" com 3 seções | sim | `ProtectedPage.test.tsx` "orders the nav ... Configurações"; `ConfiguracoesPage.test.tsx` "renders the 3 sections"; validado ao vivo (screenshot `01-configuracoes`) |
| 3. Transação confirmada em "Salário" com `data.day >= cutoff` desloca `data_competencia` pro mês seguinte (com rollover) | sim | `test_set_category_salario_at_or_above_cutoff_shifts_data_competencia`, `test_competencia_salario_december_rollover` |
| 4. Recategorizar pra fora de "Salário" reseta `data_competencia = data` | sim | `test_set_category_recategorizing_out_of_salario_resets_competencia` |
| 5. Salário de dez/2025 aparece no drill-down de jan/2026 e soma em summary/tendência/por-categoria sem código especial | sim | `test_salario_ajuste_flows_through_dashboards_aggregations_without_special_case`; validado ao vivo (`03-ajuste-salario-editado`, `PUT /dashboards/summary` refletindo o valor) |
| 6. Auditoria de saldo por conta = saldo inicial + soma cumulativa por `data` real desde 2026-01-01, sem exclusão de cartão/competência | sim | `test_get_evolucao_saldo_por_conta_credit_card_direction_is_opposite`, `test_get_evolucao_saldo_por_conta_uses_data_real_not_competencia`; validado ao vivo (`04-saldo-inicial-auditoria`) |
| 7. Cards "Saldo Acumulado" e "Saldo Anterior" aparecem no Dashboard com saldo inicial configurado | sim | `DashboardsPage.test.tsx` "renders Saldo Acumulado ... and Saldo Anterior"; validado ao vivo (`05-dashboard-cards`) |
| 8. Clicar "Saldo Anterior" fora de jan/2026 navega o filtro pro mês anterior | sim | `DashboardsPage.test.tsx` "navigates the filter to the previous month"; validado ao vivo (`06-saldo-anterior-navegado`) |
| 9. Clicar "Saldo Anterior" em jan/2026 alerta, não navega | sim | `DashboardsPage.test.tsx` "alerts instead of navigating"; validado ao vivo (`window.alert` capturado via `page.on("dialog")`) |
| Suíte com cobertura ≥80% nos módulos novos, sem regressão | sim | 379 backend (98-100% nos módulos tocados) + 155 frontend, ambas 100% verdes |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção nova "Configurações, Competência
  de Salário e Saldo Acumulado (Sprint 15) — E7 fechado"; contadores de
  teste atualizados na seção "Qualidade" (título "Sprint 1 → Sprint 15").
- `docs/directory-structure.md` — entradas novas/atualizadas em models,
  schemas, `auth/`, `categorization/`, `pluggy_integration/`,
  `dashboards/`, migration `0012`, testes de backend, `api/`, hooks,
  `ConfiguracoesPage.tsx`, `AccountManagementPage.tsx`, `ProtectedPage.tsx`,
  `DashboardsPage.tsx`, `check-sprint15.mjs`; seção "O que ainda não existe"
  atualizada (perfil/logout saem da lista, multiusuário/UI de gestão de
  usuários permanece).
- `docs/roadmap.md` — Sprint 15 e épico E7 marcados como concluídos, corpo
  da entrada atualizado com o que foi de fato implementado/validado.
- `docs/prd/PRD-015-...md` e `docs/sprints/SPRINT-015-...-plan.md` — já
  existiam da sessão de planejamento, sem alteração.

## Consumo estimado de tokens/sessões

Sessão única de execução (implementação backend+frontend, testes,
diagnóstico e correção de um bug real de CI, deploy, correção de um bug de
longa data no wrapper de SSH, QA visual ao vivo, docs, relatório) — a maior
sprint em escopo desde a Sprint 13, mas concluída numa sessão só.

## Pendências e próximos passos sugeridos

- Nenhum bloqueio técnico conhecido. Aguardando revisão/aprovação do CEO.
- UI de gestão de usuários (multiusuário, item 11 do escopo original de E7)
  segue registrada como candidata futura sem sprint numerada
  (`docs/roadmap.md`, "Registro de reavaliações futuras") — arquitetura já
  suporta, sem trabalho novo necessário até o CEO priorizar.
- CEO ainda precisa fazer a auditoria real: comparar a tabela de evolução
  de saldo por conta contra o extrato bancário de cada conta, mês a mês,
  pra validar que os saldos iniciais informados batem com a realidade (item
  4 da seção "Verificação" do plano de sessão) — passo manual, fora do
  alcance desta execução.
