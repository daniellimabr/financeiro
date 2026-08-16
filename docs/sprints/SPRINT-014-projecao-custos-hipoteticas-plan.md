# SPRINT-014: Projeção de custos futuros com despesas hipotéticas — Plano

- **PRD(s):** [PRD-014-projecao-custos-hipoteticas](../prd/PRD-014-projecao-custos-hipoteticas.md)
- **Data do plano:** 2026-08-16

## Objetivo da sprint

Ao final, o CEO consegue abrir a tela "Projeção", escolher um horizonte
(3/6/12 meses à frente), ver receita/despesa/saldo projetados (média dos
últimos 3 meses de subcategorias fixo/variável recorrente) num gráfico que
combina histórico real e projeção, e simular o efeito de gastos/receitas
hipotéticos ad-hoc sobre esse cenário — sem nenhuma persistência nova
(simulação efêmera, decisão do CEO nesta sessão de planejamento). Fecha o
épico E9.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Backend: `_future_month_range()` + `get_projecao()` em `app/dashboards/service.py`, dataclass `PontoProjecao` | Sonnet: implementação | [dashboards/service.py:139-158](../../backend/app/dashboards/service.py) (`_month_range`/`_date_bounds`); [dashboards/service.py:161-182](../../backend/app/dashboards/service.py) (`_base_query`); [dashboards/service.py:450-478](../../backend/app/dashboards/service.py) (`get_por_natureza`, filtro por natureza) |
| 2 | Schema `PontoProjecaoOut` em `app/schemas/dashboards.py`; endpoint `GET /dashboards/projecao?ano=&mes=&meses_futuros=&janela_media=` em `app/dashboards/router.py` | Sonnet: implementação | [schemas/dashboards.py](../../backend/app/schemas/dashboards.py) (`TendenciaMesOut`); [dashboards/router.py:71-79](../../backend/app/dashboards/router.py) (`/tendencia`) |
| 3 | Testes backend: `test_dashboards_service.py` (média sobre janela, exclusão eventual/null/cartão-crédito-crédito/excluir_de_totais, `meses_futuros`/`janela_media` parametrizáveis, valor constante repetido, isolamento) + `test_dashboards_endpoints.py` (rota nova, 401, params) | Sonnet + skill tdd-workflow | testes existentes de `tendencia`/`por_natureza` no mesmo arquivo |
| 4 | `api/dashboards.ts`: `PontoProjecao` + `fetchDashboardProjecao()`; `hooks/useDashboardProjecao.ts` novo | Sonnet: implementação | [api/dashboards.ts:143-147](../../frontend/src/api/dashboards.ts) (`fetchDashboardTendencia`); [hooks/useDashboardTendencia.ts](../../frontend/src/hooks/useDashboardTendencia.ts) |
| 5 | `utils/projecao.ts`: tipo `Hipotetica` + `applyHipoteticas(pontos, hipoteticas)` (lógica pura, única vs. mensal) | Sonnet: implementação | nenhum precedente direto — função nova, testável sem DOM |
| 6 | `components/ProjectionChart.tsx`: gráfico combinando histórico real (linha sólida) e projeção (linha tracejada) por série (receita/despesa/saldo) | Sonnet + skill impeccable | [components/TrendChart.tsx](../../frontend/src/components/TrendChart.tsx) (padrão de linha única + tooltip + eixo por trimestre) |
| 7 | `pages/ProjecaoPage.tsx`: `PeriodFilter` (mês-base) + seletor de horizonte 3/6/12, `ProjectionChart`, 3 cards (`.dash-tile`), painel de simulação (form + lista de hipotéticas, estado local) | Sonnet + skill impeccable | [pages/DashboardsPage.tsx:99-162](../../frontend/src/pages/DashboardsPage.tsx) (seletor de horizonte 3/6/12 já existente); [pages/AssetsPage.tsx](../../frontend/src/pages/AssetsPage.tsx) (padrão período+toggle+cards); `DESIGN.md` |
| 8 | `ProtectedPage.tsx`: nova aba "Projeção" em `NAV_ITEMS`, entre "Natureza" e "Gestão de contas" | Sonnet: implementação | [ProtectedPage.tsx](../../frontend/src/pages/ProtectedPage.tsx) |
| 9 | Testes frontend: `utils/projecao.test.ts` (única/mensal/múltiplas/fora do horizonte), `ProjecaoPage.test.tsx` (cards a partir de fixtures, add/remove hipotética recalcula sem nova chamada de rede, troca de horizonte refaz query), `api/dashboards.test.ts`/`ProtectedPage.test.tsx` atualizados | Sonnet + skill tdd-workflow | testes existentes de `AssetsPage.test.tsx`/`DashboardsPage.test.tsx` |
| 10 | `scripts/browser-check/check-sprint14.mjs` novo: cards/gráfico corretos, hipotética única e mensal refletindo sem reload, mobile, sem erros de console — validado contra a VM de dev | Sonnet: implementação | [scripts/browser-check/check-sprint13.mjs](../../scripts/browser-check/check-sprint13.mjs) (script mais recente equivalente) |
| 11 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` fechando Sprint 14 e épico E9, registrar "persistir hipotéticas" em "Registro de reavaliações futuras") | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 12 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** `get_projecao` — média correta sobre a janela
  passada, exclusão de `eventual`/`natureza` nula/`cartao_credito`+`credito`/
  `excluir_de_totais`, valor constante repetido em todos os meses futuros,
  `meses_futuros`/`janela_media` parametrizáveis, isolamento por `user_id`.
- **Integração (pytest, TestClient):** `GET /dashboards/projecao` — 401 sem
  auth, filtros `ano`/`mes`/`meses_futuros`/`janela_media`, isolamento entre
  usuários.
- **Unitários (Vitest):** `applyHipoteticas` — hipotética única só afeta o
  mês-alvo, mensal afeta todos os meses do horizonte, múltiplas hipotéticas
  somam corretamente, mês-alvo fora do horizonte não quebra nem afeta nada.
- **Componente/integração (Vitest + Testing Library):** `ProjecaoPage` —
  cards renderizam valores corretos a partir de fixtures de
  histórico+projeção, adicionar/remover hipotética recalcula cards/gráfico
  sem nova chamada de API, troca de horizonte 3/6/12 dispara nova query.
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa (backend +
  frontend) 100% verde antes de fechar.

## Impacto no roadmap

Fecha o **épico E9 — Natureza e projeção de custos** (aberto na Sprint 12).
Não fecha nenhum outro épico. Épico E7 (Configurações + competência de
salário) segue como Sprint 15, sem alteração.

## Riscos / dependências

- **Gráfico "real vs. projetado" é o primeiro do projeto a combinar 2
  fontes de dado (histórico real via `/dashboards/tendencia` já existente +
  projeção via `/dashboards/projecao` nova) na mesma série visual** — sem
  precedente direto em `TrendChart.tsx` (que só desenha uma fonte). Vale
  confirmar com o CEO se o corte visual (sólido→tracejado) fica claro antes
  de fechar (task 6/7, skill `impeccable`).
- **Projeção "plana" (valor constante) pode surpreender o CEO visualmente**
  — o gráfico projetado vai aparecer como uma linha reta a partir do
  mês-base, sem tendência. Isso é a decisão explícita do CEO nesta sessão
  (sem crescimento/sazonalidade), mas vale deixar claro na UI (ex.: rótulo
  "projeção — média dos últimos 3 meses") para não parecer um bug.
- **Sem migration, sem mudança de contrato em endpoints existentes** — risco
  de regressão é baixo. Maior risco é escopo: não deixar o painel de
  simulação crescer para virar um CRUD disfarçado (ex.: "salvar cenário"
  não pedido) — decisão explícita do CEO de manter efêmero.
