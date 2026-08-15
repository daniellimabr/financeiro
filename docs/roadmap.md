# Roadmap

Fases em épicos, derivados do escopo funcional do bootstrap. PRDs individuais serão gerados na primeira sessão de planejamento (`/plan`), um por item, não nesta fase.

## Épicos

| # | Épico | Escopo funcional relacionado |
|---|---|---|
| E1 | Fundação técnica ✅ | Setup de repo, stack (ADR-001), auth Google OAuth, deploy inicial na VM — concluído na Sprint 1 (2026-08-04) |
| E2 | Integração Pluggy ✅ | Extratos, cartão de crédito, investimentos; setup técnico (item 8) — concluído na Sprint 3 (2026-08-08) |
| E3 | Categorização ✅ | Regras + memória de revisão manual; associação despesa↔ativo (item 2) — concluído na Sprint 4 (2026-08-14) |
| E4 | Gestão de dados mestres ✅ | Categorias/subcategorias/natureza (item 10); ativos/passivos (item 9) — concluído na Sprint 2 (2026-08-06) |
| E5 | Dashboards core ✅ | Receita/despesa/saldo/patrimônio com drill-down; filtros ano/mês (itens 3, 7) — concluído na Sprint 5 (2026-08-14) |
| E6 | Dashboards analíticos | Tendência histórica, percentual de representatividade, despesas por ativo (itens 4, 5, 6) — parte 1 (tendência/percentual/design system) ✅ concluída na Sprint 6; parte 2 (Gestão de Ativos) planejada para a Sprint 8; parte 3 (cards Ativos/Passivos, drilldowns, refinamentos de Dashboard) planejada para a Sprint 9; patrimônio/evolução de investimentos segue adiado por falta de série histórica no schema |
| E7 | Conta e perfil | Perfil de usuário, logout, multiusuário (item 11) |
| E8 | Migração de dados legados ✅ | Import de categorias (Sprint 2) + memória de classificação do v1 (Sprint 4) — concluído em 2026-08-14 |

Backlog futuro (não desenhar agora): sync Pluggy agendada, otimização para comercialização/escala >10 usuários, reavaliação do plugin Understand Anything quando o codebase passar de ~100 arquivos.

## Sequência proposta (dependências)

E1 → E8 (import pode rodar assim que houver schema) → E4 (categorias/ativos precisam existir antes de transações reais) → E2 (Pluggy) → E3 (categorização depende de transações existirem) → E5 → E6 → E7 (pode ser paralelo a qualquer ponto após E1).

## Primeiras 3 sprints propostas

### Sprint 1 — Fundação técnica (E1) ✅ concluída em 2026-08-04
- ADR-001 (stack) já aprovado em 2026-08-03.
- Scaffold do backend FastAPI + SQLAlchemy/Alembic + estrutura de testes (pytest).
- Scaffold do frontend React/Vite + estrutura de testes (Vitest).
- Login via Google OAuth (fluxo completo, sessão JWT em cookie httpOnly) — validado end-to-end pelo CEO.
- Docker Compose rodando na VM de dev; pre-commit com ruff/eslint/detect-secrets; CI no GitHub Actions.
- Relatório: [SPRINT-001-fundacao-tecnica-report.md](sprints/SPRINT-001-fundacao-tecnica-report.md) (aprovado pelo CEO em 2026-08-04).

### Sprint 2 — Dados mestres + migração legado (E4, E8) ✅ concluída em 2026-08-06
- Schema de categorias/subcategorias/natureza + CRUD (item 10).
- Script de import do legado (categorias) — 15 grupos / 51 pares confirmados pelo CEO, importados com sucesso na VM de dev. Memória de classificação segue pendente (arquivo do CEO ainda não entregue).
- Schema e CRUD de ativos/passivos (item 9), incluindo baixa por venda e quitação de passivo, ambos idempotentes.
- 51 testes novos (unit + integração), 97% de cobertura nos módulos novos.
- Relatório: [SPRINT-002-dados-mestres-migracao-legado-report.md](sprints/SPRINT-002-dados-mestres-migracao-legado-report.md).

### Sprint 3 — Integração Pluggy (E2)
- Setup técnico: credenciais Pluggy, corte de histórico por item (item 8; data de competência de receita fica como campo no schema, cálculo automático adiado para E3/E5).
- Conexão de conta via widget Pluggy Connect + sync manual (botão) trazendo extratos/cartão/investimentos.
- UI mínima: conectar conta, listar transações sincronizadas (sem categorização).
- Testes automatizados (meta ≥80%), sem depender de credenciais/rede real no CI; validação real contra sandbox feita manualmente.
- PRD: [PRD-003-integracao-pluggy.md](prd/PRD-003-integracao-pluggy.md). Plano: [SPRINT-003-integracao-pluggy-plan.md](sprints/SPRINT-003-integracao-pluggy-plan.md). Relatório: [SPRINT-003-integracao-pluggy-report.md](sprints/SPRINT-003-integracao-pluggy-report.md) — aprovado pelo CEO em 2026-08-08.

**Decisão da sessão de planejamento (2026-08-07):** E2 e E3 foram divididas em
sprints separadas — E2+E3 juntas eram grandes demais para uma sessão de
execução (credenciais externas + widget de terceiro + novo domínio de dados
de um lado; motor de regras+memória multi-camada do outro). E3 só faz sentido
calibrar contra transações reais, que só existem depois de E2 concluída.

### Sprint 4 — Categorização automática (E3, E8) ✅ concluída em 2026-08-14
- Motor de categorização por regras + memória (sem LLM, 2 camadas: match exato + similaridade `difflib >= 0.86`), com fallback para revisão manual (fila de pendências, nunca auto-confirma).
- Associação despesa↔ativo, manual + sugestão automática por heurística.
- Import da memória de classificação do v1 — arquivo `semente-classificacao.json` já entregue pelo CEO (328 regras), atribuído como memória privada da conta do CEO (não seed global; compartilhamento fica opt-in para sprint futura).
- Testes unitários da lógica de categorização (meta ≥80%); competência de receita segue adiada para E3/E5 conforme já registrado em PRD-003.
- Desbloqueada: Sprint 3 validada e aprovada em 2026-08-08, com transações reais sincronizadas (556+386 de 2 contas sandbox).
- PRD: [PRD-004-categorizacao-automatica.md](prd/PRD-004-categorizacao-automatica.md). Plano: [SPRINT-004-categorizacao-automatica-plan.md](sprints/SPRINT-004-categorizacao-automatica-plan.md). Relatório: [SPRINT-004-categorizacao-automatica-report.md](sprints/SPRINT-004-categorizacao-automatica-report.md) — aprovado pelo CEO em 2026-08-14, validação manual da qualidade das sugestões confirmada (99% das categorizações sugeridas corretas).

### Sprint 5 — Dashboards core (E5) ✅ concluída em 2026-08-14
- Cálculo de `data_competencia` em `pluggy_transactions` (campo existia desde a Sprint 3, nunca populado) — igual a `data`, calculado no sync; backfill via migration `0007` para transações já sincronizadas.
- Exclusão de transferências internas (pagamento de fatura de cartão) dos totais agregados, via nova coluna `category_groups.excluir_de_totais`.
- Endpoints de agregação (`app/dashboards/`): `GET /dashboards/summary` (receita/despesa/saldo/patrimônio), `/por-categoria`, `/por-meio-pagamento` — filtráveis por ano/mês, isolados por usuário. Sinal do saldo de `cartao_credito` confirmado empiricamente contra dado real da VM de dev (representa dívida, subtrai do patrimônio).
- Frontend: aba Dashboards com filtro ano/mês e drill-down Receita/Despesa → Categoria → Meio de pagamento → Linha de extrato (funil definido em PRODUCT.md), gráficos via Recharts.
- Primeira sprint com trabalho visual real: `DESIGN.md` gerado via fluxo `new-work` do Impeccable (direção escolhida com o CEO por comparação de esboços renderizados), `/impeccable audit` rodado antes de fechar — sem navegador disponível no ambiente, avaliação por revisão de código; 2 achados reais corrigidos.
- 151 testes backend (98% cobertura, 100% nos módulos novos) + 24 testes frontend.
- PRD: [PRD-005-dashboards-core.md](prd/PRD-005-dashboards-core.md). Plano: [SPRINT-005-dashboards-core-plan.md](sprints/SPRINT-005-dashboards-core-plan.md). Relatório: [SPRINT-005-dashboards-core-report.md](sprints/SPRINT-005-dashboards-core-report.md).

**Correções pós-Sprint 5 (2026-08-14, mesma sessão, antes do plano da Sprint 6):**
validação visual real do CEO no navegador revelou que só `DashboardsPage`
tinha recebido os tokens do design system — `ProtectedPage` (nav do app)
seguia HTML sem estilo. Corrigido: `ProtectedPage` virou app shell com
sidebar, `button` base ganhou estilo sistêmico (`index.css`). Dois bugs
visuais reais só visíveis em screenshot também corrigidos: herança de
`line-height` percentual sobrepondo texto de heading, overflow de nav
mobile. Ferramenta nova `scripts/browser-check/` (Playwright headless)
instalada para QA visual real em sprints futuras — detalhes em
[SPRINT-005-report](sprints/SPRINT-005-dashboards-core-report.md). Na
mesma leva, a fila de Categorização (E3) tinha um N+1 real (recomputava
histórico/regras/ativos do zero a cada transação pendente) — corrigido,
~2,6x mais rápido contra dado real (8,48s → 3,29s); o restante da
lentidão (centenas de UPDATEs individuais por página cheia) fica para a
Sprint 8, que paginará o endpoint.

### Sprint 6 — Dashboards analíticos: tendência e percentual (E6, parte 1) ✅ concluída em 2026-08-15
- Design system: tipografia Archivo/Public Sans (escolhida pelo CEO por
  comparação visual real via artifact — 3 pares renderizados com conteúdo
  real do dashboard, mesmo processo usado pra direção de cor na Sprint 5) +
  `.dash-page` alargado (1440px) pra aproveitar a largura da tela, em vez
  da coluna estreita centralizada da Sprint 5. Fontes auto-hospedadas em
  `frontend/public/fonts/` (`.woff2`, licença OFL), sem CDN externo.
- Tendência histórica (3/6/12 meses, seletor no filtro) nos cards de
  Receita/Despesa/Saldo (sparkline Recharts) e, num modelo visual mais
  simples (SVG inline), em cada linha do drill-down de categoria.
  Patrimônio fica de fora — não há série histórica de saldo/valor de ativo
  no schema (mesma limitação já registrada na Sprint 5), com nota visual
  explícita no card.
- Percentual de representatividade em cada nível do funil (categoria % do
  total do período; meio de pagamento % da categoria; linha de extrato %
  do meio de pagamento, calculado no frontend contra o total já conhecido).
- Drill-down em formato sanfona — expandir um nível não esconde os
  anteriores (múltiplas categorias podem estar expandidas ao mesmo tempo),
  diferente do comportamento de "substituir tela" da Sprint 5. Botão
  "Fechar" recolhe o funil inteiro.
- Backend: `GET /dashboards/tendencia` e `GET /dashboards/por-categoria/tendencia`
  — cada um numa única query agregada (evita N chamadas por mês/categoria).
- QA visual real via `scripts/browser-check/check-sanfona.mjs` (novo)
  contra a VM de dev encontrou 2 bugs mobile reais (tabela de extrato
  cortando a coluna % em vez de rolar; linha da sanfona apertada demais em
  390px com 6 elementos) — ambos corrigidos e revalidados com screenshot.
- 165 testes backend (98% cobertura) + 28 testes frontend.
- PRD: [PRD-006-dashboards-analiticos.md](prd/PRD-006-dashboards-analiticos.md). Plano: [SPRINT-006-dashboards-analiticos-plan.md](sprints/SPRINT-006-dashboards-analiticos-plan.md). Relatório: [SPRINT-006-dashboards-analiticos-report.md](sprints/SPRINT-006-dashboards-analiticos-report.md) — aprovado pelo CEO em 2026-08-15.

### Sprint 7 — Categorização (rework), eliminação de Transações e Gestão de Contas (E3, E2) ✅ concluída em 2026-08-15

CEO trouxe um pedido de ajustes de tela bem mais amplo que o "escopo a
definir" originalmente reservado aqui — cobre 3 fatias de épico distintas,
divididas em Sprints 7/8/9 nesta sessão de planejamento (2026-08-15).

- Migration `0008`: `apelido`/`sync_enabled` em `pluggy_accounts`;
  `descricao_usuario`/`descricao_sugerida`/`descricao_sugestao_origem_id`
  em `pluggy_transactions`; seed idempotente da subcategoria "Aluguel" sob
  o grupo "Receitas" (distinta da despesa "Aluguel" já existente sob
  "Moradia").
- `GET /categorization/transactions` (renomeado de `/pending`, sem shim):
  filtro `status` (pendente/confirmada/todas, default todas) e `tipo`
  (débito/crédito); `POST .../bulk-confirm` confirma uma lista em uma
  chamada, reportando sucesso/falha por item; `PUT .../category` vira
  `set_category` (sem trava de status — já podia reeditar confirmada
  antes desta sprint); `PUT .../description` edita a descrição exibida e
  propaga sugestão pendente (match normalizado exato + mesma categoria)
  para transações idênticas do mesmo usuário — nunca aplicada
  automaticamente, aceitar/descartar via `.../description/confirm`/`dismiss`.
- `PUT /pluggy/accounts/{id}` (apelido/sync_enabled) e `POST /pluggy/sync`
  (sincronização em lote, pula conta com `sync_enabled=false`).
- Frontend: `CategorizationReviewPage.tsx` vira a listagem única de
  transações (filtro `status=todas` cobre o que `TransactionsPage.tsx`
  oferecia — página removida) — filtro tipo/status, seleção em lote +
  "Aprovar marcadas", categoria editável em linha confirmada, descrição
  inline com nota de propagação. `AccountManagementPage.tsx` (renomeia
  `ConnectAccountPage.tsx`, aba "Gestão de contas"): apelido/sync_enabled
  editáveis por conta, diálogo único "Sincronizar MeuPluggy" com
  pré-seleção. `formatCurrency` extraído para `utils/format.ts`.
- QA visual real (`scripts/browser-check/check-sprint7.mjs`, novo) contra
  a VM de dev encontrou um bug real de overflow desktop — sem teto de
  largura, os selects/botão de descrição empurravam a tabela de
  Categorização para além de 1440px, escondendo o botão "Confirmar" fora
  da área rolável sem indício visual — corrigido e revalidado.
- 219 testes backend (98% cobertura) + 44 testes frontend.
- PRD: [PRD-007-categorizacao-gestao-contas.md](prd/PRD-007-categorizacao-gestao-contas.md).
  Plano: [SPRINT-007-categorizacao-gestao-contas-plan.md](sprints/SPRINT-007-categorizacao-gestao-contas-plan.md).
  Relatório: [SPRINT-007-categorizacao-gestao-contas-report.md](sprints/SPRINT-007-categorizacao-gestao-contas-report.md) — aprovado pelo CEO em 2026-08-15.

### Sprint 8 — Gestão de Ativos (E6, parte 2)
*Escopo ainda não detalhado em PRD/plano — planejar em sessão própria.*

Tela `AssetsPage.tsx` com cards por ativo (reaproveitando `.dash-tile`),
botão/formulário para cadastrar/editar ativo (backend de CRUD já existe em
`app/assets/` desde a Sprint 2 — falta só mutation hooks no frontend, hoje
só há leitura via `fetchAssets`), filtro de data igual às outras telas,
drill-down de custos por ativo (total gasto + transações vinculadas via
`asset_id`, associação já existente desde a Sprint 4).

### Sprint 9 — Dashboard analítico: Ativos/Passivos e refinamentos (E6, parte 3)
*Escopo ainda não detalhado em PRD/plano — planejar em sessão própria.*

Cards "Ativos" e "Passivos" no Dashboard (soma via `Asset.valor_atual`/
`Liability.saldo_devedor`, já usados em `_calcula_patrimonio`); clicar em
"Ativos" abre drilldown de receita/despesa por ativo no mês filtrado;
clicar em "Passivos" abre drilldown de despesas por passivo; clicar em
"Saldo" abre drilldown de saldo por conta **restrito ao mês corrente** —
sem histórico de saldo no schema (mesma limitação já documentada nas
Sprints 5/6 para Patrimônio); tooltip no hover dos gráficos; eixo X
reduzido; remoção do gráfico de categorias (mantém só o drilldown);
remoção do nível "meio de pagamento" do funil (vira ícone por linha —
reverte uma decisão até então tratada como fechada em PRD-005/006, feita
explicitamente pelo CEO nesta sessão de planejamento); ordenação por
coluna nos drilldowns do Dashboard.

**Gap descoberto na sessão de planejamento de 2026-08-15:** não existe
associação despesa↔passivo (`liability_id`) em `pluggy_transactions` — só
despesa↔ativo (`asset_id`, desde a Sprint 4). O drilldown "despesas por
passivo" pedido pelo CEO precisa dessa associação nova (schema + sugestão
automática, espelhando o padrão de `asset_id`) — planejar como parte do
escopo desta sprint, não descobrir só na execução.

### Sprint 10 — Categorização: tabela moderna (E3, polish)
*Escopo ainda não detalhado em PRD/plano — planejar em sessão própria.*

A lentidão (N+1 na busca de sugestões, depois o recálculo da fila inteira
a cada refetch) já foi corrigida fora de sprint formal — ver nota
"Correções pós-Sprint 6" abaixo: `GET /categorization/pending` (renomeado
para `/categorization/transactions` na Sprint 7) pagina (page/page_size) e
filtra por ano/mês, com o mesmo seletor visual da `DashboardsPage`; a
Sprint 7 também adicionou filtro tipo/status e ações em lote. Falta só
modernizar a tabela em si (hoje HTML puro, sem nenhum token do design
system) reaproveitando a fundação de tipografia/layout da Sprint 6.

**Correções pós-Sprint 6 (2026-08-15, sessão própria):** CEO reportou o
botão "Confirmar" da fila de Categorização parecendo travado. Causa real:
o clique confirma rápido (update de uma linha), mas o refetch da fila
recalculava sugestão para **todas** as pendências a cada chamada, não só a
confirmada — mesmo após o fix de N+1 da Sprint 5, o custo ainda escalava
com o tamanho total da fila (929 pendências reais na VM de dev). Corrigido
paginando `GET /categorization/pending` (`page`/`page_size`, default 20) e
adicionando filtro `ano`/`mes`; frontend ganhou o mesmo seletor ano/mês da
`DashboardsPage` + navegação Anterior/Próxima. Validado contra dado real:
refetch completo pós-confirmação caiu de vários segundos para ~250ms.
Ferramenta nova `scripts/browser-check/check-categorizacao.mjs`.

## Registro de reavaliações futuras

- **Understand Anything:** reavaliar instalação quando o codebase ultrapassar ~100 arquivos (ver ADR-002-plugins).
- **Sync Pluggy agendada:** só entra no roadmap se o CEO priorizar explicitamente.
