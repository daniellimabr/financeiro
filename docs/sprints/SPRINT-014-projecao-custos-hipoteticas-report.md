# SPRINT-014: Projeção de custos futuros com despesas hipotéticas — Relatório

- **Plano:** [SPRINT-014-projecao-custos-hipoteticas-plan.md](./SPRINT-014-projecao-custos-hipoteticas-plan.md)
- **Data do relatório:** 2026-08-16

## Resumo

Endpoint `GET /dashboards/projecao` (média dos últimos N meses de subcategorias
fixa/variável, repetida nos próximos meses do horizonte) e tela nova
"Projeção" (gráfico histórico+projeção, 3 cards, painel de simulação de
hipotéticas única/mensal, 100% local, sem persistência). Fecha o épico E9.
Deploy na VM de dev encontrou e corrigiu um bug real (`crypto.randomUUID`
indisponível fora de secure context) antes de fechar a sprint.

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Backend: `_future_month_range()` + `get_projecao()`, dataclass `PontoProjecao` | feito | Sem desvio |
| 2 | Schema `PontoProjecaoOut` + endpoint `GET /dashboards/projecao` | feito | Sem desvio |
| 3 | Testes backend (service + endpoints) | feito | 11 testes novos (7 service + 4 endpoint), 100% em `app/dashboards/` |
| 4 | `api/dashboards.ts` + `useDashboardProjecao.ts` | feito | Sem desvio |
| 5 | `utils/projecao.ts` (`Hipotetica` + `applyHipoteticas`) | feito | Sem desvio |
| 6 | `components/ProjectionChart.tsx` | feito | Sem desvio — técnica de "mês-base duplicado nos dois campos" validada visualmente (linha sólida→tracejada conectada, sem gap) |
| 7 | `pages/ProjecaoPage.tsx` | feito | Sem desvio |
| 8 | `ProtectedPage.tsx` — aba "Projeção" | feito | Sem desvio |
| 9 | Testes frontend (`utils/projecao.test.ts`, `ProjecaoPage.test.tsx`, `api/dashboards.test.ts`, `ProtectedPage.test.tsx`) | feito | 12 testes novos |
| 10 | `scripts/browser-check/check-sprint14.mjs` + validação na VM de dev | feito | 1ª rodada encontrou bug real (`crypto.randomUUID`, ver "Decisões tomadas"); corrigido e revalidado |
| 11 | Docs vivos (OVERVIEW.md, directory-structure.md, roadmap.md) | feito | `directory-structure.md` também recebeu o catch-up do índice de PRD/sprints (parado na Sprint 10 desde antes desta sessão) — pequeno desvio de escopo, feito por estar diretamente adjacente às linhas já sendo tocadas |
| 12 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend

```
324 passed, 298 warnings in 6.46s
TOTAL                                 1653     33    98%
app\dashboards\service.py              226      0   100%
app\dashboards\router.py                51      0   100%
app\schemas\dashboards.py               34      0   100%
```

### Frontend

```
 Test Files  22 passed (22)
      Tests  144 passed (144)
   Duration  7.02s
```

Cobertura de lógica de negócio: 100% em `app/dashboards/` (backend, módulo
tocado). `utils/projecao.ts` e `components/ProjectionChart.tsx` cobertos por
`projecao.test.ts` (5 casos, incluindo múltiplas hipotéticas e mês-alvo fora
do horizonte) e `ProjecaoPage.test.tsx` (4 casos de integração), sem gap
conhecido. Meta ≥80% atendida.

## Lint/formatter

```
backend: ruff check — All checks passed!
backend: ruff format --check — 86 files already formatted
frontend: tsc -b — sem erros
frontend: eslint . — sem erros
frontend: prettier --check . — All matched files use Prettier code style!
```

## Decisões tomadas durante a execução

- **`crypto.randomUUID()` indisponível fora de secure context (achado real
  via browser-check, não previsto no plano).** A primeira rodada de
  `check-sprint14.mjs` contra a VM de dev travou ao submeter o form de
  hipotética — `pageerror: crypto.randomUUID is not a function`. Causa
  raiz: a VM de dev serve por HTTP puro (porta 8080, sem TLS — decisão de
  infra já registrada), e a Web Crypto API só expõe `randomUUID()` em
  secure context (HTTPS ou `localhost`); localmente o Vite dev server e o
  Vitest/jsdom contam como secure context, então o bug não apareceu em
  nenhum teste automatizado nem na sessão de implementação. Corrigido
  substituindo por um gerador de id local (`Date.now()` + `Math.random()`),
  sem dependência de Web Crypto — suficiente para o caso de uso (chave de
  lista em memória, nunca persistida/comparada entre sessões). Revalidado
  com sucesso.
- **`check-sprint14.mjs` reescrito para esperar mudança de valor (via
  `MutationObserver`) em vez de `waitForTimeout` fixo**, mesmo achado já
  registrado nas Sprints 6/13 sobre `waitForTimeout` fixo ser frágil —
  aplicado aqui desde a primeira versão do script, não como correção
  posterior.
- **`directory-structure.md` recebeu o catch-up do índice de PRD/sprints**
  (estava parado na Sprint 10 desde antes desta sessão — Sprints 11/12/13
  nunca tinham sido adicionadas à árvore de `docs/prd/`/`docs/sprints/`,
  só ao restante do arquivo). Resolvido por estar diretamente adjacente às
  linhas já tocadas para a Sprint 14; não foi feito um catch-up completo de
  outras lacunas de doc viva fora desse ponto específico.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Tela "Projeção" com histórico sólido + projeção tracejada e 3 cards | sim | `ProjectionChart.tsx`; validado ao vivo (`check-sprint14.mjs`, screenshot `01-projecao`) |
| 2. Seletor de horizonte 3/6/12 recalcula gráfico e cards | sim | `ProjecaoPage.test.tsx` "changing the horizonte triggers a new query"; validado ao vivo (screenshot `05-horizonte-3`, nova chamada de rede confirmada) |
| 3. Subcategoria `fixa`/`variavel` entra na média; `eventual`/sem natureza/sem subcategoria não entram | sim | `test_get_projecao_averages_last_janela_meses_of_fixa_variavel`, `test_get_projecao_excludes_eventual_and_null_natureza` |
| 4. Hipotética única afeta só o mês-alvo; mensal afeta todos os meses; sem chamada de rede nova | sim | `projecao.test.ts` (4 casos); `ProjecaoPage.test.tsx` "adding a mensal/unica hipotetica ... without an extra network call"; validado ao vivo (contagem de `request` do Playwright antes/depois, screenshots `02`/`03`) |
| 5. Reload não persiste hipotéticas | sim | Estado 100% local (`useState` em `ProjecaoPage`, `applyHipoteticas` sem I/O) — por construção, nunca escreve em storage/backend; sem teste de reload dedicado (não haveria o que verificar além da ausência de código de persistência) |
| 6. `GET /dashboards/projecao` 401 sem auth / isolado por `user_id` | sim | `test_projecao_without_cookie_returns_401`, `test_projecao_isolated_by_user`, `test_projecao_respects_ano_mes_meses_futuros_janela_media_params` |
| 7. Suíte passa com cobertura ≥80% nos módulos novos, sem regressão | sim | 324 backend (100% em `app/dashboards/`) + 144 frontend, ambas 100% verdes; ver "Evidência de testes" |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção nova "Projeção de custos futuros
  com despesas hipotéticas (Sprint 14) — E9 fechado"; contadores de teste
  atualizados na seção "Qualidade".
- `docs/directory-structure.md` — entradas novas (`ProjecaoPage.tsx`,
  `ProjectionChart.tsx`, `useDashboardProjecao.ts`, `utils/projecao.ts`,
  `check-sprint14.mjs`, schema/router/service/testes de backend); catch-up
  do índice de PRD/sprints até a Sprint 14 (ver "Decisões tomadas").
- `docs/roadmap.md` — Sprint 14 e épico E9 marcados como concluídos, corpo
  da entrada atualizado com o que foi de fato implementado/validado.
- `docs/prd/PRD-014-projecao-custos-hipoteticas.md` e
  `docs/sprints/SPRINT-014-projecao-custos-hipoteticas-plan.md` — já
  existiam da sessão de planejamento, sem alteração.

## Consumo estimado de tokens/sessões

Sessão única de execução (implementação backend+frontend, testes, deploy,
correção de bug real, docs, relatório) — consumo compatível com sprints de
porte médio anteriores (ex.: Sprint 12), sem necessidade de sessão adicional.

## Pendências e próximos passos sugeridos

- Nenhum bloqueio técnico. Aguardando validação/aprovação do CEO — sugerido
  usar a própria tela "Projeção" na VM de dev (`http://financeirov2.duckdns.org:8080`)
  com dado real, especialmente conferir se a leitura "linha tracejada = projeção
  plana, sem tendência" fica clara sem parecer bug (risco já registrado no
  plano da sprint).
- Persistência de hipotéticas como cenários salvos segue registrada como
  candidata futura sem sprint numerada (`docs/roadmap.md`, "Registro de
  reavaliações futuras").
- Sprint 15 (Configurações + competência de salário, E7) é a próxima da fila,
  sem `/plan` própria ainda.
