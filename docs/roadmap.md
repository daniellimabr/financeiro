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
| E6 | Dashboards analíticos ✅ | Tendência histórica, percentual de representatividade, despesas por ativo (itens 4, 5, 6) — parte 1 (tendência/percentual/design system) ✅ Sprint 6; parte 2 (Gestão de Ativos) ✅ Sprint 8; parte 3 (cards Ativos/Passivos, drilldowns, refinamentos de Dashboard) ✅ Sprint 9 — épico fechado. Série histórica de investimentos (lacuna registrada desde a Sprint 5/6) fechada na Sprint 21 |
| E7 | Conta e perfil ✅ | Perfil de usuário, logout; tela de Configurações (absorve Gestão de Contas) + regra de competência de salário + saldo inicial por conta/Saldo Acumulado — ✅ Sprint 15 (2026-08-17). Multiusuário/item 11 (UI de convidar/remover) adiado pra sprint futura, decisão do CEO — arquitetura já suporta |
| E8 | Migração de dados legados ✅ | Import de categorias (Sprint 2) + memória de classificação do v1 (Sprint 4) — concluído em 2026-08-14 |
| E9 | Natureza e projeção de custos ✅ | Classificação de subcategoria por natureza (fixo recorrente/variável recorrente/eventual) + dashboard de visibilidade — ✅ Sprint 12 (2026-08-16); rótulo "Eventual", funil Natureza>Categoria>Subcategoria>Transação e redesign de tabelas/botões do app — ✅ Sprint 13 (2026-08-16); projeção de custos futuros (receita/despesa/saldo) com simulação efêmera de hipotéticas — ✅ Sprint 14 (2026-08-16) — épico fechado |

Backlog futuro (não desenhar agora): sync Pluggy agendada, otimização para comercialização/escala >10 usuários, reavaliação do plugin Understand Anything quando o codebase passar de ~100 arquivos.

## Auditoria estrutural (cadência)

O CTO propõe rodar `structural-auditor` ([ADR-003](architecture/adr/ADR-003-agentes-coerencia-design-auditoria-estrutural.md))
a cada 5 sprints executadas e aprovadas (sprints substituídas antes da execução, sem nenhum
código implementado, não contam — não é mais o caso da 27: substituída mais cedo no dia
2026-08-19, mas o CEO reverteu a decisão no mesmo dia e pediu a execução do escopo original,
concluída e aprovada). A checagem é proativa — o CTO verifica esta tabela ao final de cada
sprint / início de cada novo planejamento — mas a execução em si só acontece com aprovação
explícita do CEO a cada vez, nunca automática/agendada.

| Última auditoria | Sprint de referência | Próxima checagem devida | Status |
|---|---|---|---|
| nenhuma ainda | — | Sprint 34 (30 + 4) | 2/5 sprints completadas (Sprint 30, Sprint 31); mecanismo criado na Sprint 29 |

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
  explícita no card. Fechado para investimentos na Sprint 21
  (`pluggy_investment_snapshots` + série mensal em `InvestimentosPage`).
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

### Sprint 8 — Gestão de Ativos (E6, parte 2) ✅ concluída em 2026-08-15

Tela `AssetsPage.tsx` com cards por ativo (reaproveitando `.dash-tile`),
formulário para cadastrar/editar/vender/excluir ativo (backend de CRUD já
existe em `app/assets/` desde a Sprint 2 — mutation hooks implementados no
frontend), filtro de período igual às outras telas, drill-down de custos
por ativo (total + transações vinculadas via `asset_id`, associação já
existente desde a Sprint 4). Endpoints novos: `GET /dashboards/por-ativo`
(agregando por `tipo` — despesa ou receita) e `GET /dashboards/por-ativo/tendencia`
(série mensal por ativo), mais parâmetros `asset_id`/`tipo` em
`/pluggy/transactions`. Componente `PeriodFilter` extraído de
`DashboardsPage`/`CategorizationReviewPage` e reutilizado em `AssetsPage`,
eliminando duplicação. Investigação de risco (FK em `pluggy_transactions.asset_id`)
realizada — sem cláusula `ON DELETE`, implementada desassociação explícita
em `delete_asset`. **Revisão de escopo pedida pelo CEO ainda na sessão de
execução:** o drill-down (inicialmente dentro do card, só despesa) foi
movido para um painel fora do card (mesmo padrão do funil de Dashboards),
ganhou toggle despesa/receita e gráfico de histórico (6 meses), replicado
como sparkline em cada card — PRD-008 atualizado para refletir o escopo
final. Testes backend (239 passed, 98% cobertura) + frontend (55 passed).
Deploy realizado (2 rodadas), QA visual validou grid de cards, CRUD,
drill-down fora do card, toggle despesa/receita, sparklines, desktop/mobile,
3 test assets criados na VM como side effect.
PRD: [PRD-008-gestao-de-ativos.md](prd/PRD-008-gestao-de-ativos.md).
Plano: [SPRINT-008-gestao-de-ativos-plan.md](sprints/SPRINT-008-gestao-de-ativos-plan.md).
Relatório: [SPRINT-008-gestao-de-ativos-report.md](sprints/SPRINT-008-gestao-de-ativos-report.md) — aprovado pelo CEO em 2026-08-15.

### Sprint 9 — Dashboard analítico: Ativos/Passivos e refinamentos (E6, parte 3) ✅ concluída em 2026-08-15

Cards "Ativos" e "Passivos" no Dashboard (soma via `Asset.valor_atual`/
`Liability.saldo_devedor`, já usados em `_calcula_patrimonio`, agora
expostos em `GET /dashboards/summary`); clicar em "Ativos" abre drilldown
de receita/despesa por ativo no mês filtrado (reaproveita `/dashboards/
por-ativo` da Sprint 8, com toggle despesa/receita); clicar em "Passivos"
abre drilldown de despesas por passivo (novo `/dashboards/por-passivo`,
sem toggle receita); clicar em "Saldo" abre drilldown de saldo por conta
**sempre no snapshot atual, ignora o filtro de período** (mesmo padrão
conceitual do card Patrimônio; sem histórico de saldo no schema, mesma
limitação já documentada nas Sprints 5/6); remoção do gráfico de barras
redundante acima de cada lista; remoção do nível "meio de pagamento" do
funil — meio de pagamento vira ícone SVG inline por linha, ao lado do
valor (reverte uma decisão até então tratada como fechada em
PRD-005/006, decisão explícita do CEO na sessão de planejamento);
ordenação por coluna (clique no cabeçalho, incluindo a coluna %) nas
tabelas de transação do Dashboard.

**Revisão pós-entrega (mesma sessão, feedback do CEO ao ver o resultado
real):** o funil de Despesa/Receita ganhou um nível de agrupamento que
não estava no plano original — Categoria (`CategoryGroup`) > Tipo
(`Subcategory`) > Transação, em vez de expandir direto de categoria pra
transação. Calculado inteiramente no frontend a partir do mesmo `GET
/dashboards/por-categoria` (sem endpoint novo) — soma por grupo é só
agregar os `subcategory_id` que compartilham `group_id`. Categoria e Tipo
ganharam cores distintas (paleta categórica de 8 matizes, validada via
skill `dataviz` contra a superfície real do app; Tipo deriva um tint
`color-mix()` da cor do grupo pai) — antes todas as linhas usavam a mesma
cor despesa/receita. Tooltip nos gráficos de tendência/sparkline
(`CardSparkline` ganhou um também) e eixo X do `TrendChart` passou a
rotular só os meses de início de trimestre (o ponto de dado continua
mensal). Saldo de cartão de crédito: investigação do payload real da
Pluggy confirmou que `balance` já representa a dívida (achado da Sprint
5, correto — a leitura inicial do CEO de que mostrava "limite" não batia
com o payload), mas o card "Saldo" passou a mostrar a soma dos itens não
pagos da fatura atual (janela auto-contida entre o vencimento anterior e
o próximo — a Pluggy não expõe fechamento de fatura nem endpoint de
bill) com o limite de crédito entre parênteses (migration `0010`:
`limite_credito`/`fatura_vencimento` em `pluggy_accounts`, lidos do
`creditData` do payload, antes descartado).

**Schema:** `liability_id`/`liability_sugerido_id`/
`liability_sugestao_confianca` novos em `pluggy_transactions` (migration
`0009`), espelhando `asset_id` (Sprint 4) — sugestão automática
(`suggest_liability`, heurística idêntica à de ativo), filtro
`liability_id` em `/pluggy/transactions`, `PUT
/categorization/transactions/{id}/liability`. `delete_liability` ganhou a
mesma desassociação que `delete_asset` ganhou na Sprint 8 (FK sem `ON
DELETE`, mesmo achado) — implementada junto da migration na mesma sprint,
não como correção posterior.

**Frontend:** `CardSparkline`/`TrendChart`/`useTableSort`/`AccountTipoIcon`
extraídos como componentes/hook compartilhados entre `DashboardsPage` e
`AssetsPage` (mesmo gatilho de duplicação que motivou a extração de
`PeriodFilter` na Sprint 8). `TrendChart` ganha tooltip (Recharts) e eixo
X com `interval="preserveStartEnd"`. `account_tipo` exposto em
`PluggyTransactionOut` via `@property` no model (lê `self.account.tipo`,
Pydantic v2 `from_attributes` trata como atributo comum), com eager-load
(`joinedload`) em `list_transactions` pra evitar N+1 — toda linha do
funil passou a acessar `tx.account`.

239 testes backend novos nesta sprint, incluindo a revisão (278 no total,
98% cobertura) + 22 testes frontend novos (77 no total, incluindo
`categoryColors.test.ts` novo). QA visual real
(`scripts/browser-check/check-sprint9.mjs`, novo, atualizado depois pra
cobrir os 3 níveis da revisão) contra dado real da VM de dev confirmou os
3 drilldowns novos, o funil Categoria>Tipo>Transação com cores distintas,
ícone ao lado do valor, ordenação (incl. %) e o limite de crédito entre
parênteses no card do cartão, tudo sem erros de console;
`check-sanfona.mjs` (Sprint 6) removido — testava exatamente o nível
"meio de pagamento" que esta sprint eliminou.

PRD: [PRD-009-dashboards-ativos-passivos.md](prd/PRD-009-dashboards-ativos-passivos.md).
Plano: [SPRINT-009-dashboards-ativos-passivos-plan.md](sprints/SPRINT-009-dashboards-ativos-passivos-plan.md).
Relatório: [SPRINT-009-dashboards-ativos-passivos-report.md](sprints/SPRINT-009-dashboards-ativos-passivos-report.md).

### Sprint 10 — Revisão de UX (Dashboard/Categorização) e Gestão de Passivos (cross-epic)

Inserida antes da sprint "tabela moderna" (que passa a ser Sprint 11) a
partir de uma lista de ajustes que o CEO levantou usando o app na prática
pós-Sprint 9. Cobre 8 frentes: investigação de transações "NuTag"
contando como receita — a causa raiz, descoberta só com dado real na
execução, não era isolada como o PRD original supunha: em conta de
cartão de crédito, `tipo=credito` é *sempre* pagamento de fatura ou
estorno (nunca receita), mas a agregação somava toda transação `credito`
como receita sem considerar o tipo de conta. Corrigido na agregação
(`_base_query`, sem mutar dado bruto), com o aval do CEO pra aplicar o
fix completo (não só nas linhas de NuTag) durante a própria execução;
fusão da aba "Início" (stub sem dado próprio) em "Dashboards"; fix do
tooltip dos gráficos (mostrava "v:" em vez de mês/ano, fonte grande);
drill-down do card "Patrimônio" com a composição do cálculo (ativos/
passivos/saldo de contas/saldo de cartões); edição inline de descrição/
categoria/ativo a partir do drill-down do Dashboard/Ativos/Passivos
(reaproveita os endpoints já usados na tela de Categorização); tela nova
de Gestão de Passivos (CRUD + quitação — o backend já existia completo
desde a Sprint 2, só nunca ganhou UI); filtros novos na tela de
Categorização (associado a ativo, categoria/grupo) e motor de sugestão de
ativo elevado ao mesmo padrão de 3 camadas (regra + histórico +
similaridade) já usado para categoria; reordenação do menu ("Gestão de
Contas" passa a ser o último item).

PRD: [PRD-010-revisao-ux-e-passivos.md](prd/PRD-010-revisao-ux-e-passivos.md).
Plano: [SPRINT-010-revisao-ux-e-passivos-plan.md](sprints/SPRINT-010-revisao-ux-e-passivos-plan.md).
Relatório: [SPRINT-010-revisao-ux-e-passivos-report.md](sprints/SPRINT-010-revisao-ux-e-passivos-report.md).

### Sprint 11 — Categorização: tabela moderna (E3, polish)

Planejada em sessão própria (2026-08-15). A lentidão (N+1 na busca de
sugestões, depois o recálculo da fila inteira a cada refetch) já foi
corrigida fora de sprint formal — ver nota "Correções pós-Sprint 6"
abaixo: `GET /categorization/pending` (renomeado para
`/categorization/transactions` na Sprint 7) pagina (page/page_size) e
filtra por ano/mês, com o mesmo seletor visual da `DashboardsPage`; a
Sprint 7 também adicionou filtro tipo/status e ações em lote. O que
restava era modernizar a tabela em si: ela já usava os tokens do design
system (`.dash-table`), mas essa classe é documentada no `DESIGN.md` como
"o nível mais plano do funil" (pensada para drill-downs de leitura
passiva) — descompasso para a superfície de trabalho primária que
Categorização é. Escopo definido: novo `CategoryCombobox` (buscável,
agrupado por categoria, teclado completo) substituindo o `<select>` nativo
de 51 subcategorias — reaproveitado também pelos drill-downs de
Dashboard/Ativos/Passivos via `CategorySelectCell`, sem mudar esses call
sites; badge de status (Pendente/Confirmada) com tokens já existentes, sem
reusar a cor de despesa; polish de linha (hover/espaçamento) só na tabela
de Categorização. Sem mudança de backend/API. Fora de escopo: combobox
para Ativo (lista pequena, não justifica), generalizar o padrão para
outros `<select>`s do app, e restilizar o chrome das tabelas de
drill-down.

Implementada em sessão própria (2026-08-15): `CategoryCombobox` novo,
`CategorySelectCell`/`CategorizationReviewPage` migrados, status vira
`StatusIcon` (SVG, não texto), colunas reordenadas
(Status/Data/Descrição/Categoria/Ativo/Valor), `.dash-page` sem teto de
largura (ocupa a tela toda, padronizado nas 5 telas) e
`cat-review-table` com `table-layout: fixed` (Descrição/Categoria
reivindicam sua fatia do espaço sempre, não só quando o conteúdo da
página é longo) — as 3 últimas vieram de feedback do CEO usando a tela
ao vivo na VM de dev, em 3 rodadas pós-implementação. 109 testes
frontend verdes (suíte completa, sem regressão). CEO validou tudo ao
vivo na própria VM de dev (não pelo script automatizado, que segue
pendente de token) e aprovou a sprint no mesmo dia.

PRD: [PRD-011-categorizacao-tabela-moderna.md](prd/PRD-011-categorizacao-tabela-moderna.md).
Plano: [SPRINT-011-categorizacao-tabela-moderna-plan.md](sprints/SPRINT-011-categorizacao-tabela-moderna-plan.md).
Relatório: [SPRINT-011-categorizacao-tabela-moderna-report.md](sprints/SPRINT-011-categorizacao-tabela-moderna-report.md).

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

### Sprint 12 — Natureza: classificação e dashboard de visibilidade (E9, novo)

Planejada em sessão própria (2026-08-15). CEO trouxe um pedido cobrindo 3
frentes grandes (natureza + tela de visibilidade, projeção de custos
futuros, tela de Configurações + regra de competência de salário) —
dividido em 3 sprints sequenciais nesta sessão de planejamento, mesmo
padrão da divisão 7/8/9: Sprint 12 (esta), Sprint 13 (projeção de custos,
E9) e Sprint 14 (Configurações + competência de salário, E7), ambas ainda
sem `/plan` própria. **Nota:** a Sprint 13 planejada aqui (projeção de
custos) foi empurrada para **Sprint 14**, e a Sprint 14 (Configurações)
para **Sprint 15** — ver Sprint 13 abaixo, que entrou na frente da fila
numa sessão de planejamento posterior (2026-08-16).

Escopo: reaproveita `Subcategory.natureza` (enum `fixa`/`variavel`/
`eventual`, dormente desde a Sprint 2 — sem UI, sem uso em dashboard, apesar
de `PRD-005` já ter registrado "quebra por natureza" como pendência de E6,
nunca entregue). Sem migration. Nova tela "Natureza" combina (a) dashboard
de visibilidade — 3 cards (Fixo recorrente/Variável recorrente/Custo
eventual, este último o default de exibição para subcategoria não
classificada) com drill-down até transação, mesmo padrão de
Dashboard/Ativos/Passivos — e (b) a primeira UI de edição de `natureza` do
projeto, tabela de subcategorias agrupada por categoria com seletor por
linha. Backend: `GET /dashboards/por-natureza` e `/tendencia`, espelhando
`por-categoria`.

PRD: [PRD-012-natureza-classificacao-dashboard.md](prd/PRD-012-natureza-classificacao-dashboard.md).
Plano: [SPRINT-012-natureza-classificacao-dashboard-plan.md](sprints/SPRINT-012-natureza-classificacao-dashboard-plan.md).
Relatório: [SPRINT-012-natureza-classificacao-dashboard-report.md](sprints/SPRINT-012-natureza-classificacao-dashboard-report.md).

Implementada em sessão própria (2026-08-16): `GET /dashboards/por-natureza`
e `.../tendencia` (sempre 3 buckets zero-preenchidos, diferente do padrão
dinâmico de `por-categoria`), nova tela `NaturezaPage.tsx` (cards +
drill-down + tabela de classificação, entre "Passivos" e "Gestão de
contas"), `updateSubcategory` novo em `api/categories.ts` (primeiro `PUT`
desse recurso no frontend), 3 tons de cor novos via skill `impeccable`
(`--nat-fixa`/`--nat-variavel`/`--nat-eventual`). 313 testes backend (100%
em `app/dashboards/`) + 122 testes frontend, suíte completa verde. Deploy
na VM de dev e validação ao vivo via `scripts/browser-check/check-sprint12.mjs`
(desktop+mobile, sem erros de console) — primeira sprint com
`FINANCEIRO_SESSION_TOKEN` disponível desde a pendência registrada na
Sprint 11, minerado via SSH na própria VM de dev.

### Sprint 13 — Natureza: rótulo, funil completo, e redesign de tabelas/botões (E9, cross-epic) ✅ concluída em 2026-08-16

Planejada em sessão própria (2026-08-16). CEO usou a tela "Natureza"
(Sprint 12) na prática e trouxe 3 pontos: (a) rótulo "Custo eventual"
implica despesa, mas natureza já se aplica igualmente a receita (toggle
despesa/receita já funciona ponta a ponta desde a Sprint 12) — vira só
"Eventual"; (b) o funil da tela (`Natureza → Subcategoria → Transação`)
não tem o nível Categoria (grupo) que o funil de Dashboards já tem — corte
de escopo explícito do PRD-012 (critério de aceite 2), não bug, corrigido
nesta sprint para `Natureza → Categoria → Subcategoria → Transação`; (c) a
tabela de classificação de Natureza, e praticamente toda tabela/lista do
app, está com tratamento visual inconsistente — achado confirmado nos
planos das Sprints 10→11→12, que registraram pelo menos 3 vezes a decisão
de adiar "restilizar chrome de drill-down" e "generalizar o combobox para
outros selects".

Decidido em sessão, via perguntas diretas ao CEO (não presumido pelo CTO):
sprint única cobrindo os 3 pontos juntos; redesign valendo para todas as
tabelas do app, inclusive drill-downs passivos, reabrindo a regra do
`DESIGN.md` de que a tabela é "o nível mais plano do funil por design"; e,
ao unificar as 3 implementações divergentes de tabela de transação
(Dashboard/Natureza, Ativos, Passivos) num componente compartilhado, o
drill-down de Ativos ganha colunas Categoria/Ativo editáveis que hoje não
tem — mudança de comportamento aceita explicitamente, não só visual. Maior
sprint do projeto até agora (estimativa comparável a Sprint 10 + Sprint 11
somadas) — empurra "projeção de custos futuros" (E9) para **Sprint 14** e
"Configurações + competência de salário" (E7) para **Sprint 15**.

Implementada em sessão própria (2026-08-16): rename completo (nenhuma
ocorrência de "Custo eventual" fora do log histórico de PRD-012/SPRINT-012);
funil de 4 níveis com `categoriaGrouping.ts` novo (aritmética de agrupamento
extraída de `GrupoAccordion`) e sanfona multi-nível na tela Natureza.
Redesign de tabela decidido via rodada `impeccable` (Artifact, 2 candidatas
de densidade/hover + 2 de hierarquia de botão) — o CEO pediu um híbrido
após ver as candidatas renderizadas (densidade compacta + hover de
preenchimento simples, sem o indicador de borda lateral testado, que criava
uma linha falsa entre colunas), e uma 3ª rodada introduziu `--danger`
(vinho, primeira cor destrutiva do app) só depois de ver a opção.
`TransactionsTable.tsx`/`SortableHeader.tsx` novos unificam as 3
implementações de tabela de transação — `AssetDrilldown` ganha Categoria
editável e sort que não tinha. `table-layout: fixed` + `<colgroup>` em toda
tabela do app; achado real via browser-check (select/combobox vazando por
cima da coluna Valor) corrigido antes de fechar. `.btn-ghost`/`.btn-danger`
novos, hierarquia de botão nos cards de Ativos/Passivos (só "Ver gasto no
período" fica Default). `.simple-list` em Gestão de Contas. `DESIGN.md`
reescrito (Table/Buttons/nova seção Simple lists). 313 testes backend
(zero mudança, confirma ausência de regressão) + 131 testes frontend (9
novos), suíte completa verde. Deploy na VM de dev e validação ao vivo via
`scripts/browser-check/check-sprint13.mjs` (novo, substitui
`check-sprint12.mjs` — mesmo padrão da remoção de `check-sanfona.mjs` na
Sprint 9), desktop+mobile, sem erros de console.

**Revisão pós-entrega (mesma sessão, 4 rodadas de feedback do CEO usando
as telas ao vivo na VM de dev):** `CategoryCombobox` fechava ao rolar a
própria lista (listener de scroll em `window`/`capture:true` também
disparava no scroll interno do popup — scroll não borbulha, só passa pela
captura); Categoria/Ativo ganharam sort (`assetLabel` extraída pra
`utils/transactionEdit.ts`); 4 ajustes de padronização visual (teto de
30% na coluna Descrição do funil de Dashboards, fonte das tabelas reduzida
mais um nível — `--text-2xs` novo —, texto de Descrição sempre à esquerda
— `<button>` centraliza por padrão do user-agent —, Categorização abrindo
em "Todas" por padrão); causa raiz de fonte/largura de campo não
padronizados entre tabelas/colunas identificada e corrigida na base de
`.dash-table` (`max-width:200px`/fonte própria por elemento, herdados da
Sprint 7 quando só `.cat-review-table` tinha colgroup, ficaram incoerentes
agora que todo `.dash-table` tem — resolveu de uma vez a fonte
inconsistente, a caixa de edição de Descrição encolhendo, e os
drill-downs do Dashboard não parecendo usar o mesmo "tema" de
Categorização); funcionalidade de sugestão de descrição removida (banner
quebrava o layout da coluna Descrição e não funcionava — decisão do CEO
de remover em vez de debugar agora, sem tocar o backend). 132 testes
frontend ao final. **Sprint aprovada pelo CEO em 2026-08-16.**

PRD: [PRD-013-natureza-funil-e-redesign-tabelas.md](prd/PRD-013-natureza-funil-e-redesign-tabelas.md).
Plano: [SPRINT-013-natureza-funil-e-redesign-tabelas-plan.md](sprints/SPRINT-013-natureza-funil-e-redesign-tabelas-plan.md).
Relatório: [SPRINT-013-natureza-funil-e-redesign-tabelas-report.md](sprints/SPRINT-013-natureza-funil-e-redesign-tabelas-report.md).

### Sprint 14 — Projeção de custos futuros com despesas hipotéticas (E9, fecha o épico) ✅ concluída em 2026-08-16

Planejada em sessão própria (2026-08-16), a partir de um título de roadmap
sem PRD (herdado da divisão Sprint 12/13/14 feita na sessão de planejamento
da Sprint 12). Decisões de produto resolvidas com o CEO nesta sessão, via
perguntas diretas (não presumidas pelo CTO): despesas/receitas hipotéticas
são uma **simulação efêmera** (sem persistência, sem CRUD, sem tabela nova
— somem ao recarregar a página); escopo cobre **despesa e receita**,
chegando a um saldo projetado (não só "custo" como o nome do épico sugere);
base do cálculo é a **média dos últimos 3 meses** de subcategorias `fixa`/
`variavel` (mesma janela default do seletor de tendência desde a Sprint 6);
fica em **tela nova "Projeção"**, não dentro de "Natureza" (que já acumula
2 propósitos desde a Sprint 12).

Escopo: `get_projecao()` em `app/dashboards/service.py` — projeta receita/
despesa/saldo como valor constante (média dos últimos 3 meses de
subcategorias fixo/variável recorrente, despesa e receita) repetido em cada
um dos N meses futuros (horizonte 3/6/12, mesmo padrão do seletor de
tendência); `eventual` e subcategoria sem `natureza`/sem categoria ficam
fora da base, por exclusão direta (`Subcategory.natureza.in_([fixa,
variavel])`), sem precisar de `COALESCE` como em `get_por_natureza`. Novo
endpoint `GET /dashboards/projecao`. Tela nova "Projeção": gráfico
combinando histórico real (linha sólida) e projeção (linha tracejada),
3 cards (Receita/Despesa/Saldo projetados), painel de simulação
"hipotéticas" (linhas ad-hoc única ou mensal, recalcula cards/gráfico no
cliente sem chamada de API). Sem migration.

Implementada em sessão própria (2026-08-16): `_future_month_range()` +
`get_projecao()` em `app/dashboards/service.py` (dataclass `PontoProjecao`),
endpoint `GET /dashboards/projecao?ano=&mes=&meses_futuros=&janela_media=`;
tela nova `ProjecaoPage.tsx` (entre "Natureza" e "Gestão de contas"),
`components/ProjectionChart.tsx` novo (primeiro gráfico do projeto a
combinar histórico real e projeção na mesma série visual — mês-base
compartilhado entre os dois campos do dado do gráfico conecta a linha
sólida à tracejada sem gap), `utils/projecao.ts` (`applyHipoteticas`, lógica
pura, 100% local). 114 testes backend novos (324 no total, 100% em
`app/dashboards/`) + 12 testes frontend novos (144 no total), suíte
completa verde. Deploy na VM de dev e validação ao vivo via
`scripts/browser-check/check-sprint14.mjs` (novo) — a primeira rodada
encontrou um bug real: `crypto.randomUUID()` não existe fora de secure
context, e a VM de dev serve por HTTP puro (porta 8080, sem TLS), então o
botão "Adicionar" hipotética quebrava em produção apesar de passar limpo
localmente (Vite dev server e Vitest/jsdom contam como secure context) —
corrigido com um gerador de id local sem dependência de Web Crypto,
revalidado com sucesso (desktop+mobile, sem erros de console, hipotética
única/mensal recalculando os cards sem chamada de rede nova, remover
restaurando os valores originais, troca de horizonte disparando query
nova).

PRD: [PRD-014-projecao-custos-hipoteticas.md](prd/PRD-014-projecao-custos-hipoteticas.md).
Plano: [SPRINT-014-projecao-custos-hipoteticas-plan.md](sprints/SPRINT-014-projecao-custos-hipoteticas-plan.md).
Relatório: [SPRINT-014-projecao-custos-hipoteticas-report.md](sprints/SPRINT-014-projecao-custos-hipoteticas-report.md) — aprovado pelo CEO em 2026-08-16.

### Sprint 15 — Configurações, competência de salário e Saldo Acumulado (E7, fecha o épico) ✅ concluída em 2026-08-17

Planejada em sessão própria (2026-08-16), a partir do título de roadmap
herdado da divisão Sprint 12/13/14/15 (ver notas das Sprints 12/13/14
acima). **Escopo cresceu além da linha original do roadmap durante esta
sessão de planejamento**, por pedido explícito do CEO: a regra de
competência de salário sozinha não bastava, porque o corte de sincronização
Pluggy (`2026-01-01`) nunca trouxe o salário real de dez/2025 (cuja
competência passa a ser jan/2026) nem o saldo real das contas até aquela
data — sem os dois informados manualmente, jan/2026 ficaria com receita
subestimada e não haveria como auditar saldo de conta contra extrato
bancário real. Decisões resolvidas com o CEO via perguntas diretas (não
presumidas pelo CTO), mesmo padrão das Sprints 12/13: dia de corte de
competência de salário configurável por usuário (default 25, identificação
por subcategoria "Salário", não por texto); salário de dez/2025 informado
como uma **transação real** (não um número solto) pra aparecer no
drill-down normal de jan/2026 — correção do CEO a meio da sessão, depois de
um primeiro desenho que somava o valor "escondido" em 3 funções de
agregação; saldo inicial por conta (31/12/2025), não um valor agregado
único, alimentando uma ferramenta de auditoria mensal por conta (data real
da transação, pra bater com extrato bancário) que fica só em
Configurações, sem virar card de Dashboard; e uma métrica agregada nova,
"Saldo Acumulado" (por competência, ancorada em saldo inicial somado menos
o salário de dez/2025), com dois cards novos no Dashboard — "Saldo
Acumulado" (mês filtrado) e "Saldo Anterior" (primeiro card da grid, mês
anterior, navega o filtro da tela ao ser clicado, com alerta em vez de
navegação no caso especial de jan/2026, cujo "mês anterior" não é
navegável). "Multiusuário" (item 11 do escopo original de E7) fica fora
desta sprint por decisão do CEO — já coberto arquiteturalmente, sem
trabalho novo necessário.

Implementada em sessão própria (2026-08-16/17): `app/categorization/competencia.py`
novo (`shift_to_next_month`/`competencia_salario`), hook em `set_category`/
`bulk_confirm` recalculando `data_competencia` a cada confirmação (shift pra
Salário, reset ao sair); migration `0012` (`users.salario_competencia_cutoff_dia`,
`pluggy_accounts.saldo_inicial`, backfill de `data_competencia`);
`upsert_salario_ajuste_dez_2025` (transação sentinela idempotente, flui por
`get_summary`/`get_tendencia`/`get_por_categoria` sem nenhum código especial —
testado como regressão explícita); `get_evolucao_saldo_por_conta` (auditoria por
conta, `data` real) e `get_saldo_acumulado` (agregado por competência, âncora
saldo_inicial−sentinela) novos em `app/dashboards/service.py`, com
`_receita_despesa_por_periodo` extraído de `get_tendencia` pra reuso. Frontend:
`ConfiguracoesPage.tsx` novo (3 seções — Perfil+logout, Competência de Salário,
Gestão de Contas reaproveitada), `ProtectedPage.tsx` troca "Gestão de contas" por
"Configurações"; `AccountManagementPage.tsx` ganha saldo inicial editável +
tabela de auditoria mensal; `DashboardsPage.tsx` ganha cards "Saldo Acumulado"
(drill-down com `TrendChart`) e "Saldo Anterior" (primeiro card, navega o filtro
ao clicar exceto em jan/2026, que alerta). 379 testes backend (98% cobertura) +
155 testes frontend, suíte completa verde. CI pegou um bug real de teste (não da
aplicação): `id(object())` usado como gerador de id "único" em
`test_dashboards_endpoints.py` colidia sob CPython/Linux (endereço de memória
reciclado), violando unique constraint — não reproduzia em Windows/Python 3.14;
corrigido com contador `itertools`. Deploy na VM de dev e validação ao vivo via
`scripts/browser-check/check-sprint15.mjs` (novo): logout, 3 seções, edição de
dia de corte/ajuste de salário/saldo inicial (todas revertidas ao valor real
original, confirmado por leitura direta da API pós-script — nenhum dado do CEO
alterado permanentemente), tabela de auditoria, os dois cards novos incluindo o
caso especial de "Saldo Anterior" em jan/2026 (alerta) vs. outro mês (navega),
desktop+mobile, sem erros de console reais. Único achado foi no próprio script
(ambiguidade de `getByRole` entre o `<h3>` novo "Gestão de Contas" e o `<h2>`
"Gestão de contas" já existente dentro do componente reaproveitado), não na
aplicação. Achado de infra à parte: `scripts/ssh-vm.ps1` tinha
`$ErrorActionPreference = "Stop"` global, que derrubava o script sempre que o
comando remoto (`git pull`) escrevia em stderr (progresso do git, convenção
normal) — corrigido para `"Continue"`, já que a propagação de erro real sempre
foi via `exit $LASTEXITCODE`.

PRD: [PRD-015-configuracoes-competencia-salario-saldo-acumulado.md](prd/PRD-015-configuracoes-competencia-salario-saldo-acumulado.md).
Plano: [SPRINT-015-configuracoes-competencia-salario-plan.md](sprints/SPRINT-015-configuracoes-competencia-salario-plan.md).
Relatório: [SPRINT-015-configuracoes-competencia-salario-report.md](sprints/SPRINT-015-configuracoes-competencia-salario-report.md).

### Sprint 16 — Regime de competência/caixa e Patrimônio por Saldo Acumulado (cross-epic, sem épico prévio) ✅ concluída em 2026-08-17

Planejada em sessão própria (2026-08-17). CEO trouxe uma planilha de
referência (fórmulas inspecionadas célula a célula) para validar sua
leitura de somas/saldos e formalizar a lógica de competência — revelou duas
lacunas reais: competência de cartão de crédito nunca foi implementada
(hoje `data_competencia = data`, sem shift, para qualquer tipo de conta
exceto Salário), e não existe uma "visão caixa" separada de competência.
Decisões confirmadas com o CEO via perguntas diretas nesta sessão: a
visão caixa vira um toggle visível em todo o Dashboard (não só correção
interna); Patrimônio deixa de ser snapshot ao vivo da Pluggy e passa a ser
Saldo Acumulado (líquido, no regime selecionado) + saldo ao vivo de
investimentos + Ativos − Passivos; investimento fica fora do Saldo
Acumulado (variação de mercado não é uma transação). Durante a
investigação, um bug real de fuso horário foi encontrado e confirmado
contra o payload bruto da Pluggy (`_parse_date` extrai a data do timestamp
UTC sem converter para horário de Brasília) — entra nesta sprint. Um lag
observado entre a data do evento (Pluggy) e a data de liquidação do Itaú
para transações de fim de semana foi investigado mas **não** vira
correção — decisão explícita do CEO, sem outro campo no payload para
corrigir automaticamente, risco de heurística errada sem tratar feriados.

Implementada em sessão própria (2026-08-17): `competencia_padrao`/`caixa`
novos em `app/categorization/competencia.py` (cartão sempre desloca, sem
dia de corte; demais tipos sem defasagem), aplicados nos 3 pontos de
escrita (sync, `set_category`/`bulk_confirm` — cartão tem prioridade sobre
Salário, ajuste de salário de dez/2025); `pluggy_transactions.data_caixa`
novo (migration `0013`, backfill de `data_competencia` de cartão +
`data_caixa` de toda transação); parâmetro `regime` threaded em 10 funções
de `app/dashboards/service.py` via `_competencia_column`; `_base_query`
ganha `excluir_investimento`; `PatrimonioBreakdown` redesenhado — de
snapshot bancário (`saldo_contas`/`saldo_cartoes`) para
`saldo_liquido_acumulado` (via `get_saldo_acumulado`) + `saldo_investimentos`
(snapshot ao vivo), com fallback de conta sem `saldo_inicial` mantendo a
convenção de sinal de `_base_query`. Bug de fuso corrigido com
`.astimezone(ZoneInfo("America/Sao_Paulo"))` em `_parse_date`. Frontend:
`RegimeToggle.tsx` novo, `regime` levantado em `DashboardsPage`/
`AssetsPage`/`LiabilitiesPage`, threaded por 9 hooks (`regime` na
`queryKey`), `PatrimonioBreakdownPanel` atualizado. 418 testes backend (98%
cobertura, +39) + 162 testes frontend (+7), suíte completa verde — migration
`0013` testada via `_backfill` extraída como função plana, carregada por
`importlib` contra o schema de teste (precedente novo). Deploy na VM de dev
(CI verde → `git pull` + `docker compose pull` + `docker compose up -d`,
`alembic upgrade head` automático no entrypoint) + `POST /pluggy/sync`
re-sincronizando as 2 contas reais — confirmado contra dado real: a
transação "BRASA E DRINKS" (caso de verificação do PRD) foi de
`data=2026-01-23` para `2026-01-22`, e uma segunda transação do mesmo
comerciante teve o mesmo tipo de correção (achado não previsto no PRD,
evidência de que o bug era mais amplo que o único caso documentado);
transações de cartão confirmadas com `data_competencia` sempre 1 mês após
`data`; toggle confirmado mudando o valor exibido (Despesa competência
R$ 8.309,59 vs. caixa R$ 8.066,41 no mesmo período, dado real). QA visual
via `scripts/browser-check/check-sprint16.mjs` (novo, só leitura),
desktop+mobile, sem erros de console reais (só o 401 de logout já
documentado na Sprint 15, confirmado benigno via script de diagnóstico
dedicado). **Achado pendente de ação do CEO:** a conta "NuBank - Cartão de
Crédito" não tem `saldo_inicial` preenchido — cai no fallback (não quebra o
cálculo, mas o Patrimônio só reflete o saldo acumulado real dessa conta
depois de preenchido em Configurações).

PRD: [PRD-016-regime-competencia-caixa-patrimonio.md](prd/PRD-016-regime-competencia-caixa-patrimonio.md).
Plano: [SPRINT-016-regime-competencia-caixa-plan.md](sprints/SPRINT-016-regime-competencia-caixa-plan.md).
Relatório: [SPRINT-016-regime-competencia-caixa-report.md](sprints/SPRINT-016-regime-competencia-caixa-report.md).

### Sprint 17 — Filtro de conta em Categorizar e validação de dados/cálculos contra extrato real (cross-epic, sem épico prévio) ✅ concluída em 2026-08-17

Planejada em sessão própria (2026-08-17). CEO trouxe o extrato do Itaú do 1º
semestre de 2026 (PDF) para validar sistematicamente, gasto a gasto e saldo a
saldo, se o sistema faz as contas certas — nunca houve, até aqui, uma
reconciliação linha a linha contra dado bancário real cobrindo todo o período
sincronizado. **Decisão explícita do CEO:** sem que as contas estejam
corretas, não há razão para desenvolver ou refinar qualquer outra
funcionalidade — esta sprint pausa evolução de feature nova até a
reconciliação fechar.

Dois blocos: (1) filtro de conta específica (`account_id`, não tipo de conta)
na tela Categorizar — pré-requisito pedido explicitamente para isolar uma
conta (ex. "Itaú - Conta Corrente") na revisão gasto a gasto; (2) processo de
validação mês a mês (janeiro a junho/2026, janela coberta pelo PDF),
reaproveitando a tabela de auditoria por conta (`get_evolucao_saldo_por_conta`,
Sprint 15) e o toggle Competência/Caixa (Sprint 16) — nenhuma ferramenta nova
além do filtro. Julho/agosto ficam fora do escopo desta reconciliação
orientada a arquivo (revisão "no olho" numa sessão futura, sem extrato
formal). Escopo de correções não é pré-especificável — depende do que a
comparação contra o extrato revelar; heurística de lag de dia útil Pluggy vs.
Itaú segue fora de escopo (decisão já fechada na Sprint 16).

Implementada em sessão própria (2026-08-17): Bloco 1 sem desvio — `account_id`
em `GET /categorization/transactions`/`list_transactions` (filtro condicional,
mesmo padrão de `group_id`), `<select>` "Conta" novo em
`CategorizationReviewPage.tsx`. Bloco 2 concluído **sem nenhum bug real de
data/cálculo encontrado**: saldo mensal da conta "Itaú - Conta Corrente"
bateu exato ao centavo em março–junho/2026; as diferenças de janeiro
(R$395,42) e fevereiro (R$159,68) foram confirmadas transação a transação
como o mesmo lag de liquidação de fim de semana já decidido como fora de
escopo na Sprint 16 (transações de sábado/domingo lançadas pelo Itaú só no
próximo dia útil) — 78 transações de janeiro conferidas uma a uma contra o
extrato, 100% de correspondência. **Achado real, mas de produto:** o CEO,
lendo o resultado, identificou que transferências para investimento (ex. PIX
de R$5.000 em 03/01/2026, Itaú→NuBank→Investimento) não têm categoria própria
de Aporte/Resgate — uma delas está miscategorizada como "Impostos e taxas",
inflando a despesa de janeiro; não corrigida nesta sprint por decisão do CEO,
vira pauta de sprint nova (ver "Registro de reavaliações futuras"). 425 testes
backend (+7) + 163 testes frontend (+8), suíte completa verde. Deploy na VM de
dev (CI verde → `git pull` + `docker compose pull` + `up -d`) e validação ao
vivo do filtro de conta contra dado real via `check-categorizacao.mjs`
estendido. `.gitignore` ganhou `itau_extrato_*.pdf` antes de o PDF do CEO
(deixado na raiz do repo, untracked) ser lido — risco real de commit
acidental de dado financeiro sensível, corrigido antes de prosseguir.

PRD: [PRD-017-filtro-conta-validacao-extrato.md](prd/PRD-017-filtro-conta-validacao-extrato.md).
Plano: [SPRINT-017-filtro-conta-validacao-extrato-plan.md](sprints/SPRINT-017-filtro-conta-validacao-extrato-plan.md).
Relatório: [SPRINT-017-filtro-conta-validacao-extrato-report.md](sprints/SPRINT-017-filtro-conta-validacao-extrato-report.md).

### Sprint 18 — Edição manual de data em Categorizar, investigação de Saldo Acumulado, guia dos cards (cross-epic, sem épico prévio) ✅ concluída em 2026-08-17

Planejada em sessão própria (2026-08-17). Três pedidos do CEO conectados pelo
mesmo fio da Sprint 17 (confiança na conferência do saldo mensal contra dado
real). Bloco 1 — edição manual de `data` de transação na tela Categorizar,
com trava (`data_editada_manualmente`) contra sobrescrita em resyncs futuros
da Pluggy, sobrevivendo tanto em conta corrente quanto em cartão de crédito.
Bloco 2 — investigação com dado real do card "Saldo Acumulado", que o CEO
reportou não bater com Itaú+NuBank em 31/01/2026, virou uma reconciliação de
3 meses (jan/fev/mar) feita ao vivo: janeiro fechou sem bug de fórmula (gap
de R$7.830,82 explicado por competência de salário + uma miscategorização
pontual da fronteira dez/2025↔jan/2026, corrigida via categorização);
fevereiro revelou um **bug real** no regime caixa (deslocamento fixo de
cartão de crédito e pagamento real de fatura contando a mesma compra 2
vezes) — corrigido com mudança de código em `_base_query`
(`app/dashboards/service.py`), confirmada com o CEO antes de implementar por
tocar o PRD-016; março revalidou o fix (bate exato) e expôs, de novo, o
padrão de transferência de investimento sem categoria própria (R$10.000,
mesmo achado da Sprint 17), tratado como pauta futura, não corrigido aqui.
UI ganhou nota explicando que o card é uma projeção por competência, não um
snapshot bancário. Bloco 3 — guia não técnico dos cards do Dashboard
(`docs/dashboards-guia-cards.md`), escrito só depois dos Blocos 1/2
fecharem. 443 testes backend (+18) + 166 testes frontend (+3), suíte
completa verde. Deploy em 2 rodadas na VM de dev (Bloco 1, depois o fix de
regime caixa) — CI verde → `git pull` + `docker compose pull` + `up -d` em
cada uma.

PRD: [PRD-018-edicao-data-saldo-acumulado-guia-cards.md](prd/PRD-018-edicao-data-saldo-acumulado-guia-cards.md).
Plano: [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md](sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md).
Relatório: [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md](sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md).

### Sprint 19 — Gestão de Investimentos, Blocos 1+2 (cross-epic, sem épico prévio) ✅ concluída em 2026-08-17

Planejada em sessão própria (2026-08-17), formalizando o item já registrado em
"Registro de reavaliações futuras" desde a Sprint 17 (reconfirmado na Sprint
18). Três blocos: (1) modelo `Investimento` — agrupamento lógico definido
pelo usuário, `nome` só, com vínculo 1:N a carteiras (`PluggyAccount`
`tipo=investimento`, `investimento_id` novo); (2) Aporte/Resgate como
subcategorias normais do grupo novo "Investimentos" (`excluir_de_totais=
false`, decisão do CEO — contam nos totais de Despesa/Receita como qualquer
transação), com sugestão automática (mesma cascata regra→histórico→fuzzy já
usada pra Ativo, clonada 1:1) e tela nova `InvestimentosPage.tsx`
(cards+drilldown, mesmo padrão de `AssetsPage`); (3) bloco de investigação
com dado real — CEO conectou/sincronizou Nubank Investimentos e XP na VM de
dev pra usar como evidência.

Implementada em sessão própria (2026-08-17): migration `0015` (tabelas
`investimentos`/`investimento_categorization_rules`, colunas
`investimento_id`/`investimento_sugerido_id`/`investimento_sugestao_confianca`
em `pluggy_accounts`/`pluggy_transactions`, seed do grupo "Investimentos" +
subcategorias "Aporte"/"Resgate"); `app/investimentos/` novo (CRUD +
`get_evolucao` — `saldo_base`/`saldo_atual`/`total_aportes`/`total_resgates`/
`rendimento_estimado`, este último rotulado como estimativa em toda
superfície); `suggest_investimento`/índices espelhando `suggest_asset` em
`categorization/engine.py`; `GET /dashboards/por-investimento`(`/tendencia`),
clones de `por-ativo`, **sem nenhuma mudança** em `_base_query`/
`_patrimonio_breakdown`/`get_saldo_acumulado` (aporte/resgate acontecem na
conta corrente de origem/destino, já fluem pelos totais existentes) — testado
como regressão explícita. Frontend: `InvestimentosPage.tsx`,
`InvestimentoSelectCell` em `TransactionEditCells.tsx`, coluna Investimento
em `TransactionsTable`/`CategorizationReviewPage`, `<select>` de vínculo
carteira→investimento em `AccountManagementPage` (só pra contas
`tipo=investimento`). 497 testes backend (+54, 100% em `app/investimentos/`)
+ 176 testes frontend (+10), suíte completa verde. Deploy na VM de dev (CI
verde → `git pull` + `docker compose pull` + `up -d`, `alembic upgrade head`
automático).

**Bloco 3 (investigação com dado real) — achado real, mas escopo maior que o
previsto:** com as contas Nubank Investimentos e XP sincronizadas na VM de
dev, a inspeção read-only revelou duas coisas. Primeiro, o item Nubank
Investimentos sincronizou sem erro (`status=updated`) mas retornou **zero
contas** do endpoint genérico `GET /accounts` da Pluggy — nada capturável por
aí. Segundo, o item XP trouxe 3 contas, nenhuma classificada
`tipo=investimento` pelo `_map_account_tipo` existente (2 `corrente` + 1
`cartao_credito`) — mas uma dessas contas "corrente" carrega dezenas de
transações reais de dividendos/JCP desde jan/2026, com `categoria_pluggy`
`"Proceeds interests and dividends"`/`"Taxes on investments"` e tickers reais
(TAEE11, BBSE3, VALE3, HAPV3). Ou seja: rendimento *incidental* já flui pelo
endpoint genérico já integrado, mas a visão completa de posições/holdings que
o CEO tinha no v1 (CDBs via "Caixinha Nubank", posições em ações) exige as
rotas dedicadas de Investments da Pluggy (`/investments`,
`/investments/transactions`), nunca chamadas neste projeto — escopo maior que
uma subcategoria nova. **Decisão do CEO ao ver o achado:** não implementar a
subcategoria "Rendimento" nem soltar o filtro de tipo de conta agora — fecha
Sprint 19 só com Blocos 1+2; a integração completa de Investments (holdings)
vira a **próxima sprint**, já confirmada pelo CEO (ver "Registro de
reavaliações futuras").

PRD: [PRD-019-gestao-de-investimentos.md](prd/PRD-019-gestao-de-investimentos.md).
Plano: [SPRINT-019-gestao-de-investimentos-plan.md](sprints/SPRINT-019-gestao-de-investimentos-plan.md).
Relatório: [SPRINT-019-gestao-de-investimentos-report.md](sprints/SPRINT-019-gestao-de-investimentos-report.md).

### ✅ Sprint 20 — Integração completa de Investments da Pluggy (cross-epic, sem épico prévio) concluída em 2026-08-18

Planejada em sessão própria (2026-08-17), formalizando o achado real da investigação do Bloco 3 da Sprint 19. Quatro blocos de execução: (1) investigação read-only dos dados reais de Nubank Investimentos e XP na VM de dev, confirmando taxonomia, paginação por página (diferente de `/v2/transactions`), e precisão decimal de holdings; (2) schema novo (migration `0016`, tabelas `pluggy_investments`/`pluggy_investment_transactions`), ajustado pelo achado real do Bloco 1; (3) sync/CRUD/rotas novas, `PluggyClient.get_investments`/`get_investment_transactions` com loop de paginação; (4) integração com Investimento/Patrimônio, `get_evolucao` somando holdings, `_patrimonio_breakdown` somando holdings sem dobrar com contas `tipo=investimento`.

532 testes backend (+35, 98% cobertura) + 181 testes frontend (+5) — novos testes de paginação, sync de holdings, CRUD, rotas, Patrimônio sem dobra, isolamento. Dois bugs reais encontrados e corrigidos durante o deploy: (1) limite Postgres de 63 caracteres em identificador de índice unique (`ix_pluggy_investment_transactions_pluggy_investment_transaction_id`, 66 caracteres, SQLite não tem esse limite — passou limpo em testes locais); corrigido renomeando índice (`ix_pluggy_investment_tx_ext_id`, 25 caracteres); (2) Caddyfile nunca roteava `/investimentos*` pra API, bug da Sprint 19 descoberto agora durante validação ao vivo (browser-check tentando acessar /investimentos retornou 405 do nginx); corrigido adicionando `/investimentos*` ao matcher `@api`.

Deploy em 2 rodadas (por causa do fix de índice) + fix de infra (Caddyfile). Sync real via API populou 22 holdings de Nubank Investimentos e XP, confirmado via query Postgres. Patrimônio somou corretamente (R$ 91.196,07), exatamente com soma manual das holdings. Validação via `scripts/browser-check/check-sprint20.mjs` (novo): desktop + mobile, sem erros de console. Script cria 1 Investimento de teste, vincula ação real TAEE11, valida tag "Posições", drilldown com view "Posições", expande histórico, reverte tudo (desvincula, exclui); estado final confirmado limpo via query Postgres.

PRD: [PRD-020-integracao-completa-investments-pluggy.md](prd/PRD-020-integracao-completa-investments-pluggy.md).
Plano: [SPRINT-020-integracao-completa-investments-pluggy-plan.md](sprints/SPRINT-020-integracao-completa-investments-pluggy-plan.md).
Relatório: [SPRINT-020-integracao-completa-investments-pluggy-report.md](sprints/SPRINT-020-integracao-completa-investments-pluggy-report.md).

### ✅ Sprint 21 — Vínculo automático holdings↔Investimento + série histórica mensal (cross-epic, sem épico prévio) concluída em 2026-08-18

Pedido direto do CEO na aprovação da Sprint 20. Bloco 0 (investigação read-only, rodou na VM de dev — achado que corrigiu a premissa de duas VMs prod/dev registrada até então: **não existe ambiente de produção**; a VM de dev é o único ambiente com dados reais da Pluggy hoje, ver correção em [docs/infra/ssh-workflow.md](infra/ssh-workflow.md) e no CLAUDE.md) confirmou os campos reais de holdings `FIXED_INCOME` (`purchaseDate`/`rate`/`rateType`/`fixedAnnualRate`) e `EQUITY` (zero transações observadas, sem `type` de dividendo identificável).

Motor de sugestão holding→Investimento (`categorization/engine.py`, cascata código-exato→similaridade de nome), aplicado dentro de `sync_item`. Algoritmo de baseline dez/2025 fechado com um refinamento em relação ao PRD: taxa CDI/IPCA não é fixa (depende de índice histórico não integrado — mesma fronteira de "cotação de mercado" já fora de escopo pra ações), então só três casos têm confiança "alta": posição comprada depois do baseline (saldo=0, fato) e taxa verdadeiramente fixa (`fixedAnnualRate`, juros compostos); o resto cai em fórmula reversa de fluxo, confiança "estimada". Migration `0017` (colunas de sugestão + tabela `pluggy_investment_snapshots`), reconstrução retroativa jan-ago/2026, job de snapshot mensal idempotente. Novo endpoint `GET /investimentos/{id}/evolucao-mensal`, sem alterar `get_evolucao` (regressão testada explicitamente).

**Achado real na validação ao vivo:** o motor de sugestão não resolve holdings de CDB com nome idêntico e `code`/`isin` nulos (as 18 posições Nubank aparecem todas como "CDB - NU FINANCEIRA S.A. ..." — Pluggy não expõe qual "caixinha" cada uma pertence). Vínculo das 18 posições (14 caixinha "Quitar o AP", 1 "Turbo Ultravioleta 120% CDI", 1 "Reserva de Emergência", 2 "Tesouro Direto Nubank") reconstruído manualmente por correspondência exata de valor de aporte contra o extrato real do CEO, não pelo motor automático — registrado como limitação conhecida, candidata a melhoria futura (ver "Registro de reavaliações futuras").

563 testes backend (+31, 98% cobertura nos módulos tocados) + 186 testes frontend (+5), suíte completa verde, lint/prettier limpos. Um bug real de layout encontrado e corrigido na validação ao vivo: tabelas novas (revisão de baseline, série histórica) sem `<colgroup>` (convenção obrigatória de toda `.dash-table` desde a Sprint 13) causavam texto vazando entre colunas com nome de holding longo — corrigido com colgroup + largura de coluna dedicada. Baseline real aprovado pelo CEO linha a linha e confirmado; validado ao vivo em Investimentos (cards, drilldown Posições/Série histórica) e Patrimônio ("Saldo em investimentos" bateu exato com a soma das 22 holdings).

PRD: [PRD-021-vinculo-holdings-serie-historica.md](prd/PRD-021-vinculo-holdings-serie-historica.md).
Plano: [SPRINT-021-vinculo-holdings-serie-historica-plan.md](sprints/SPRINT-021-vinculo-holdings-serie-historica-plan.md).
Progresso/achados detalhados: [SPRINT-021-progress.md](sprints/SPRINT-021-progress.md).

### ✅ Sprint 22 — Manutenção de Investimentos + drilldown de Ativos/Patrimônio (cross-epic, sem épico prévio) concluída em 2026-08-18

Planejada em sessão própria (2026-08-18), a partir de 4 pontos que o CEO levantou usando o app
na prática pós-Sprint 21: (1) transações internas de conta `tipo=investimento` continuam
poluindo a fila de Categorização — formaliza o item de backlog registrado na Sprint 21
("Microtransações de investimento na fila de Categorização"); (2) dado morto de contas XP que
o CEO desativou (`sync_enabled=false`) segue no banco, sem forma de removê-lo pela UI; (3) a
série histórica do Investimento "Quitar o AP" mostra um pico artificial de R$22.674,22 de
rendimento em agosto/2026, causado pelo próprio desenho de reconstrução retroativa da Sprint 21
(meses jan-jul zerados por construção, todo o crescimento acumulado cai no primeiro snapshot
real), possivelmente amplificado por baseline subestimado em 4 das 14 holdings vinculadas; (4)
os cards Ativos/Patrimônio do Dashboard não refletem o modelo mental do CEO de que Investimentos
e Saldo Acumulado também são "Ativos" — drilldowns de ambos os cards levam a telas de gasto do
período em vez de valor atual itemizado.

Decisões confirmadas com o CEO via perguntas diretas nesta sessão: microtransações de
investimento saem da fila **e** dos totais de Receita/Despesa (mesmo tratamento de
"Transferência interna"); remoção de dado de conta vira funcionalidade reutilizável (botão
"Excluir conta" em Gestão de Contas), não script pontual; o fix do rendimento de "Quitar o AP"
reaudita o baseline das holdings suspeitas **e** redistribui o crescimento reconstruído mês a
mês, não só ajusta a UI. Investigação confirmou que os drilldowns de Ativos/Patrimônio podem
mudar sem alterar a fórmula somada de `Summary.ativos`/`patrimonio` (mudança aditiva na UI).

**Bloco 0 (investigação real na VM de dev) derrubou a premissa do ponto 1:** não existe
`pluggy_account` com `tipo=investimento` no dado real — a fila de Categorização era 100%
dividendo/JCP/taxa legítima de investimentos administrados (XP), identificável pela própria
`categoria_pluggy` da Pluggy. O CEO confirmou (perguntado direto) que quer esse fluxo fora da
fila e dos totais mesmo assim — exclusão implementada por `categoria_pluggy`, não por tipo de
conta (que ficou como salvaguarda defensiva, hoje um no-op). A investigação do ponto 3 também
achou a causa raiz real: um bug em `_net_aportes_desde_cutoff` (sem filtro de data) subestimava
o baseline de 3 holdings do investimento "Quitar o AP" em ~R$22.000 — quase todo o pico
reportado. Corrigido, mais o algoritmo de redistribuição pró-rata do rendimento reconstruído;
baseline reauditado e correção aplicada contra dado real, validados linha a linha com o CEO.
Exclusão das 2 contas XP reais desativadas (ambas vazias) aplicada com aprovação explícita do
CEO por comando. Drilldowns de Ativos/Patrimônio redesenhados (valor atual itemizado), sem
alterar a fórmula somada de nenhum card. 586 testes backend (+23, 98% cobertura) + 192 frontend
(+6), suíte completa verde. Deploy na VM de dev e validação ao vivo via
`scripts/browser-check/check-sprint22.mjs` (novo), sem erros de console.
**Sprint aprovada pelo CEO em 2026-08-18.**

PRD: [PRD-022-manutencao-investimentos-e-drilldown-patrimonio.md](prd/PRD-022-manutencao-investimentos-e-drilldown-patrimonio.md).
Plano: [SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-plan.md](sprints/SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-plan.md).
Relatório: [SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-report.md](sprints/SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-report.md).

### ✅ Sprint 23 — Investimentos: drilldown de posições e extrato unificado (cross-epic, sem épico prévio) concluída em 2026-08-19

Planejada em sessão própria (2026-08-19), a partir de 2 pontos que o CEO levantou usando
`InvestimentosPage` na prática pós-Sprint 22: (1) os cards de Investimento exibem carteiras/posições
como texto corrido, poluindo o card — o botão "Posições" já cobre esse propósito como uma das 3 abas
do drilldown, mas só é alcançado depois de abrir a aba "Extrato" (default), não é o ponto de
entrada; as tabelas dessa aba (`InvestimentoPosicoes`/`PosicaoHistorico`) também são as únicas
`.dash-table` do projeto sem `<colgroup>`, causando overlap visual de coluna com nome de holding
longo; (2) o botão "Extrato" não mostra nenhum movimento para investimentos só-holdings (ex.
"Quitar o AP", 14 CDBs Nubank) — hoje só lê `PluggyTransaction.investimento_id` (transação
bancária), nunca `PluggyInvestmentTransaction` (movimento por holding).

Escopo: Bloco 0 de investigação real na VM de dev (campos/volume/intervalo de
`PluggyInvestmentTransaction` de "Quitar o AP") antes de fechar o schema; endpoint novo
`GET /investimentos/{id}/transacoes?ano=&mes=` unindo as duas fontes (conta + holdings); card de
Investimento sem texto solto de posições, abrindo direto na view "Posições"; `<colgroup>` nas
tabelas de posições/histórico. Sem migration prevista.

**Bloco 0 confirmou o dado real:** "Quitar o AP" (`investimento_id=5`) tem 14 holdings e 15
transações, intervalo 2025-10-06 a 2026-04-30, `tipo` é `BUY`/`SELL` (não `Aporte`/`Resgate`) e
`descricao` é sempre `None` nas 15 linhas — o frontend usa `holding_nome` como fallback quando
`descricao` é nulo. Volume baixo confirmou que paginação não se justificava. 598 testes backend
(+13, 98% cobertura, 100% nos módulos tocados) + 192 testes frontend, suíte completa verde. Deploy
na VM de dev e validação ao vivo via `scripts/browser-check/check-sprint23.mjs` (novo) contra dado
real — card sem tags soltas, drilldown abrindo em Posições, extrato de abril/2026 mostrando as 2
transações reais do Bloco 0, sem overlap de coluna, sem erros de console.
**Sprint aprovada pelo CEO em 2026-08-19.**

PRD: [PRD-023-investimentos-drilldown-extrato-unificado.md](prd/PRD-023-investimentos-drilldown-extrato-unificado.md).
Plano: [SPRINT-023-investimentos-drilldown-extrato-unificado-plan.md](sprints/SPRINT-023-investimentos-drilldown-extrato-unificado-plan.md).
Relatório: [SPRINT-023-investimentos-drilldown-extrato-unificado-report.md](sprints/SPRINT-023-investimentos-drilldown-extrato-unificado-report.md).

### ✅ Sprint 24 — Dashboard: layout, cards, navegação e cores (cross-epic, sem épico prévio) concluída em 2026-08-19

Planejada em sessão própria (2026-08-19), no mesmo pedido do CEO que originou a Sprint 23 —
dividida em duas sprints separadas por área (Investimentos vs. Dashboard), decisão explícita do
CEO na sessão de planejamento, mesmo padrão das divisões 7/8/9 e 12/13/14/15. Onze pontos levantados
usando `DashboardsPage`/`CategorizationReviewPage` na prática: disclaimers redundantes em Saldo
Acumulado/Patrimônio; grid de 8 cards sem hierarquia (Ativos/Passivos/Patrimônio deveriam ficar
juntos numa primeira linha); navegação de mês por clique no card já existe (Sprint 15) mas sem seta
visível, e "Saldo Acumulado" não navega pro mês seguinte; colisão real de cor entre "Empréstimos" e
"Transferência Interna" no funil de despesas (`i % 8` com 15 grupos, só 8 cores); card "Saldo" abre
uma lista de contas desalinhada do que o card representa (fluxo do período, não snapshot); "Saldo
Acumulado" falta memória de cálculo; card "Ativos" falta drilldown Investimento→Holding; card
"Passivos" falta lista de todos os passivos (Ativos já tem o equivalente desde a Sprint 22); card
"Patrimônio" é tabela com "Ver detalhe" em vez de accordion; drilldown de Ativos usa cor fixa por
tipo de transação, não por ativo; Categorização não tem botão de sincronizar.

Decisões confirmadas com o CEO via perguntas diretas nesta sessão: card Patrimônio vira accordion
expansível in-place (não mantém navegação nem só restiliza a tabela); botão "Sincronizar contas" em
Categorização sincroniza tudo direto num clique, sem diálogo de seleção de contas (diferente do
padrão de Gestão de Contas). Escopo: reagrupamento de grid em 2 linhas; ícone de seta em Saldo
Anterior (cosmético, comportamento já existe) e seta funcional de mês seguinte em Saldo Acumulado;
paleta categórica expandida de 8 para 16 cores (`categoryColors.ts` generalizado, reaproveitado
também para cor por ativo); memórias de cálculo em Saldo/Saldo Acumulado a partir de dados já
carregados (sem endpoint novo previsto); accordions novos em Ativos→Investimentos, Passivos e
Patrimônio, reaproveitando componentes já existentes (`AssetsValorAtualList`,
`LiabilitiesValorAtualList`, `InvestimentosValorAtualList`); botão de sync em Categorização
reaproveitando `useSyncPluggyItems` já usado em Gestão de Contas. Sem mudança na fórmula de
`Summary.ativos`/`patrimonio`/`saldo` — tudo aditivo em apresentação/drilldown. Sem migration
prevista.

**Entregue 100% frontend, sem endpoint novo nem migration** — âncora do Saldo Acumulado reaproveita
`useEvolucaoSaldoPorConta` (já existente), accordion Investimento→Holding reaproveita
`usePluggyInvestments`. 598 testes backend (inalterado) + 207 testes frontend (+15), suíte completa
verde. QA visual ao vivo na VM de dev (`check-sprint24.mjs`, desktop+mobile × claro+escuro) rodou em
3 rodadas — a 1ª e a 2ª acharam 4 bugs reais (disclaimer de Patrimônio esquecido, nome acessível
poluído no tile de Saldo Acumulado, sinal duplicado no accordion de Patrimônio quando Saldo líquido
acumulado é negativo, overlap de coluna na tabela de holdings — mesma classe de bug já corrigida em
`InvestimentoPosicoes` na Sprint 23), todos corrigidos antes do fechamento; a 3ª rodada fechou sem
nenhuma falha.

PRD: [PRD-024-dashboard-layout-cards-navegacao.md](prd/PRD-024-dashboard-layout-cards-navegacao.md).
Plano: [SPRINT-024-dashboard-layout-cards-navegacao-plan.md](sprints/SPRINT-024-dashboard-layout-cards-navegacao-plan.md).
Relatório: [SPRINT-024-dashboard-layout-cards-navegacao-report.md](sprints/SPRINT-024-dashboard-layout-cards-navegacao-report.md).

### Sprint 25 — Escala visual, tela Ativos e cards Ativos/Passivos/Patrimônio/Saldo Acumulado (cross-epic, sem épico prévio)

Planejada em sessão própria (2026-08-19), a partir de 13 pontos que o CEO levantou usando o app na
prática pós-Sprint 24 — dividido em 3 sprints temáticas nesta sessão de planejamento (Sprint 25,
26, 27), mesmo padrão das divisões 7/8/9, 12/13/14/15, 23/24. Escopo: reduzir os tokens
`--text-*`/`--space-*` de `index.css` em ~20% (equivalente visual a "zoom 80%"); tela Ativos perde
o toggle Competência/Caixa e o extrato do drilldown por ativo vira accordion
Categoria→Subcategoria→Transação; investigação (Bloco 0) do caso "Receitas/Estornos" aparecendo no
drilldown de despesa antes de decidir o fix; card "Ativos" do Dashboard ganha a seção "Valor atual
por Ativo" (1ª), mantém "Valor atual por Investimento" (2ª, corrigindo cor única) e renomeia o
accordion de gasto pra "Despesas por Ativo" (última), removendo "Saldo por conta"; card "Passivos"
troca a lista "Passivos — saldo devedor" por estilo drilldown (barra+%); percentual do total vira
padrão obrigatório em todo drilldown de valor atual; validação de que o disclaimer de Patrimônio
(já corrigido no QA pós-Sprint 24) segue ausente; card "Saldo Acumulado" ganha a fórmula visível
(Saldo do mês anterior + Receita − Despesa). Bloco 0 investigado ao vivo na VM de dev, sem fix
aplicado (decisão do CEO); achado do QA do CEO pós-sprint — "Valor atual por Ativo" ainda é tabela,
deveria ser drilldown como os demais itens do card — movido para a Sprint 26.
**Sprint aprovada pelo CEO em 2026-08-19.**

PRD: [PRD-025-escala-visual-tela-ativos-cards-dashboard.md](prd/PRD-025-escala-visual-tela-ativos-cards-dashboard.md).
Plano: [SPRINT-025-escala-visual-tela-ativos-cards-dashboard-plan.md](sprints/SPRINT-025-escala-visual-tela-ativos-cards-dashboard-plan.md).
Relatório: [SPRINT-025-escala-visual-tela-ativos-cards-dashboard-report.md](sprints/SPRINT-025-escala-visual-tela-ativos-cards-dashboard-report.md).

### Sprint 26 — Interatividade de gráficos (ampliar + hover + clique = filtro), sistema inteiro (cross-epic, sem épico prévio)

Planejada na mesma sessão (2026-08-19), 2ª das 3 sprints temáticas. Escopo: o "mini gráfico" por
linha do funil de Despesa/Receita (`RowTrend`, SVG manual sem interação) migra pra base Recharts, 3x
mais largo, com tooltip mês/ano+valor; `RowTrend`/`CardSparkline`/`TrendChart` ganham clique num
ponto de dado que filtra a tela pelo mês daquele ponto (destaque no hover) — replicado em toda tela
que usa esses componentes (Dashboard, Ativos, Passivos, Investimentos, Natureza, Projeção).
Consolidar os 3 componentes de gráfico de linha num só, parametrizado, é decisão de design deixada
para a sessão de execução (evitar abstração prematura antes de ver os 3 casos lado a lado).

Implementada em sessão própria (2026-08-19): `CardSparkline`/`TrendChart`/`RowTrend` (SVG manual)
consolidados num único `TrendLineChart.tsx` novo, parametrizado por `variant` ("spark" — cards de
resumo, "row" — mini gráfico do funil (48px → 144px, 3x mais largo), "card" — painel de tendência de
drilldown), com tooltip mês/ano+valor no hover (destaque automático do ponto ativo via `activeDot`
do Recharts) e clique-para-filtrar (`onSelecionarMes`, resolvido pelo helper puro novo
`utils/resolveClickedPonto.ts`, compartilhado com `ProjectionChart.tsx`) conectado ao estado
ano/mês de `DashboardsPage`/`AssetsPage`/`LiabilitiesPage`/`InvestimentosPage`/`NaturezaPage`/
`ProjecaoPage` — nesta última, só pontos de histórico real são clicáveis (ponto projetado é média
repetida, não "um mês"). `AssetsValorAtualList` (card Ativos) trocou `<table>` por
`dash-accordion`/`Row`, mesmo padrão de "Valor atual por Investimento" — expande mostrando Tipo +
Adquirido em, fechando o achado do CEO na validação da Sprint 25. 212 testes frontend (suíte
completa verde, zero mudança de backend), lint/typecheck/prettier limpos. QA visual real
(`scripts/browser-check/check-sprint26.mjs`, novo) contra a VM de dev — 2 rodadas encontraram
achados reais, ambos no próprio script de QA (não no produto): `locator.click()` do Playwright não
dava tempo do Recharts resolver o ponto ativo antes do clique, corrigido com `mouse.move`+wait+
`down/up` explícitos; tooltip do card "Saldo" não aparecia no viewport mobile porque o card ficava
abaixo da dobra, corrigido com `scrollIntoViewIfNeeded()`. Rodada final: 0 falhas, 0 erros de
console, desktop+mobile, claro+escuro.

PRD: [PRD-026-interatividade-graficos-dashboard.md](prd/PRD-026-interatividade-graficos-dashboard.md).
Plano: [SPRINT-026-interatividade-graficos-dashboard-plan.md](sprints/SPRINT-026-interatividade-graficos-dashboard-plan.md).
Relatório: [SPRINT-026-interatividade-graficos-dashboard-report.md](sprints/SPRINT-026-interatividade-graficos-dashboard-report.md).
**Sprint aprovada pelo CEO em 2026-08-19.**

### Sprint 27 — "Ocultar gasto" (binóculo) e gráfico comparativo de categorias (cross-epic, sem épico prévio)

Planejada na mesma sessão (2026-08-19), 3ª das 3 sprints temáticas — a mais nova em decisões de
produto, resolvidas com o CEO por perguntas diretas: "ocultar gasto" (toggle de binóculo por linha
de transação dentro do funil Despesa/Receita aberto) recalcula o total/gráfico daquele funil; estado
100% local/efêmero, mesmo padrão de `applyHipoteticas` da tela Projeção (Sprint 14) — sem
persistência, reseta ao fechar o funil, trocar de card ou trocar o filtro de ano/mês. Gráfico
comparativo de composição de gasto por categoria ao longo dos últimos meses aparece dentro do
próprio funil Despesa/Receita ao ser aberto, não em seção fixa separada — reaproveita o dado de
tendência por subcategoria já buscado pelo funil, sem endpoint novo.

**Substituída pelo CEO mais cedo em 2026-08-19 (mesmo dia da aprovação da Sprint 26), antes da
execução — revertido pelo próprio CEO no mesmo dia**, pedindo a execução do escopo original acima.
Durante a execução, o CEO também revisou ao vivo a decisão de escopo do "ocultar gasto": os cards
**Receita/Despesa/Saldo** do topo do Dashboard também recalculam com o item oculto (não só o total
do funil) — Patrimônio e Saldo Acumulado continuam intocados, por não terem relação direta com
"ocultar uma linha de gasto do mês". QA visual ao vivo na VM de dev encontrou e corrigiu, na mesma
sessão, um bug real de layout na legenda do gráfico comparativo (só aparecia com volume de
categorias reais suficiente — não coberto pela fixture de teste local).

PRD: [PRD-027-ocultar-gasto-comparativo-categorias.md](prd/PRD-027-ocultar-gasto-comparativo-categorias.md).
Plano: [SPRINT-027-ocultar-gasto-comparativo-categorias-plan.md](sprints/SPRINT-027-ocultar-gasto-comparativo-categorias-plan.md).
Relatório: [SPRINT-027-ocultar-gasto-comparativo-categorias-report.md](sprints/SPRINT-027-ocultar-gasto-comparativo-categorias-report.md).
**Sprint aprovada pelo CEO em 2026-08-19.**

### Sprint 28 — Card Ativos (saldo de conta corrente + total completo) e Patrimônio redesenhado (cross-epic, sem épico prévio)

Planejada em sessão própria (2026-08-19), a partir de 3 pontos que o CEO levantou usando o app na
prática pós-Sprint 26: o drilldown "Despesas por Ativo" sai do card "Ativos" (gasto do período não
pertence a composição de patrimônio), dando lugar a um novo drilldown "Saldo por Conta Corrente";
o total do card "Ativos" (hoje só soma Gestão de Ativos) passa a somar também Investimentos e o
saldo ao vivo das contas correntes — mesmo modelo mental do CEO já registrado no PRD-022; e a
parcela "Saldo líquido acumulado" do card Patrimônio, que não batia com o card "Saldo Acumulado" do
Dashboard no mesmo dia, tem a causa raiz confirmada por leitura de código nesta sessão de
planejamento (`_saldo_liquido_fallback`, termo extra somado só dentro de Patrimônio, nunca exposto
pelo card) — corrigida via redesenho completo da fórmula de Patrimônio, decidido pelo CEO:
`Patrimônio = Ativos − Passivos + Saldo Acumulado do Mês` (3 partes em vez de 4, Investimentos passa
a viver dentro de "Ativos", Patrimônio deixa de olhar conta corrente diretamente). Card "Saldo
Acumulado" do Dashboard não muda, só sai de dentro da fórmula de Patrimônio.

PRD: [PRD-028-ativos-saldo-conta-corrente-patrimonio-redesenhado.md](prd/PRD-028-ativos-saldo-conta-corrente-patrimonio-redesenhado.md).
Plano: [SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-plan.md](sprints/SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-plan.md).
Relatório: [SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-report.md](sprints/SPRINT-028-ativos-saldo-conta-corrente-patrimonio-redesenhado-report.md).
**Sprint aprovada pelo CEO em 2026-08-19.**

### Sprint 29 — Coerência de design no planejamento + auditoria estrutural recorrente (cross-epic, sem épico prévio)

Planejada em sessão própria (2026-08-19), a partir do pedido do CEO para automatizar dois pontos que
vinham sendo repetitivos: (1) checar planos de UI contra `DESIGN.md` antes da implementação, para que
a primeira versão de cada funcionalidade já nasça alinhada aos padrões vigentes — reduzindo o ciclo de
feedback de ajuste visual que gerou retrabalho real nas Sprints 13 (3 dialetos de tabela) e 26 (3
componentes de gráfico de linha); e (2) uma auditoria estrutural periódica (dívida técnica, docs,
segurança, cobertura de testes) que gere sprint de débito técnico quando aprovada. `DESIGN.md`,
já maduro e ativamente mantido, foi reutilizado como fonte única de padrões em vez de um novo
documento. A checagem de coerência de design foi embutida em `planner.md` (não um agente dedicado,
já que `planner`/`architect` não têm a tool `Task` para delegar). A auditoria estrutural ganhou um
agente novo, só-leitura (`structural-auditor`), com cadência proposta pelo CTO a cada 5 sprints
aprovadas (ver seção "Auditoria estrutural (cadência)" acima) — nunca automática, sempre com
aprovação explícita do CEO por execução. Sugestão de feature sob demanda também ficou embutida em
`planner.md`, disparada só quando pedida explicitamente.

PRD: [PRD-029-agentes-coerencia-design-auditoria-estrutural.md](prd/PRD-029-agentes-coerencia-design-auditoria-estrutural.md).
Plano: [SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md](sprints/SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md).
Relatório: [SPRINT-029-agentes-coerencia-design-auditoria-estrutural-report.md](sprints/SPRINT-029-agentes-coerencia-design-auditoria-estrutural-report.md).
**Sprint aprovada pelo CEO em 2026-08-19.**

### ✅ Sprint 30 — Categorias por usuário, Orçamento, Gestão de Categorias/Subcategorias e remoção da Projeção (cross-epic, sem épico prévio) concluída em 2026-08-20

Planejada em sessão própria (2026-08-20), a partir de uma sugestão de funcionalidade do CTO
("Orçamento mensal por categoria", pedida sob demanda pelo CEO) que o CEO aprovou e ampliou na
mesma sessão: (1) tela de gestão de Categorias/Subcategorias (hoje só CRUD via API); (2)
eliminação completa da Projeção (Sprint 14) — "não serviu ao propósito, e orçamento me parece
melhor pra isso"; (3) revamp visual da tabela de classificação de Natureza. No meio da sessão o
CEO corrigiu duas premissas do primeiro rascunho do plano — **Orçamento deve ser por usuário**
(não global) e **Categoria/Subcategoria também precisam de tabela por usuário** (catálogo hoje
global vira só o ponto de partida/seed de cada usuário) — e uma terceira: **Orçamento vale para
Despesa e Receita**, não só Despesa.

A migração de Categoria/Subcategoria de global para por-usuário virou a fase de maior risco da
sprint — toda tabela que referencia `subcategory_id` depende dela, e ela rodou contra dado real da
VM de dev, o único ambiente real hoje. Investigação de código também confirmou um achado de
segurança pré-existente: `app/categories/service.py` nunca filtrou por usuário (fazia sentido
enquanto a tabela era global) e `delete_subcategory`/`delete_group` excluíam sem checar uso —
mesma classe de bug de FK sem `ondelete` já corrigida duas vezes antes no projeto para `asset_id`/
`liability_id` (Sprints 8 e 9), agora pré-requisito de segurança antes de expor "Excluir" na UI.

**Deploy na VM de dev realizado dentro desta sessão de execução** (pedido do CEO), antes da aprovação
formal do relatório. A migration `0018` falhou 2 vezes contra o banco real antes de ser corrigida —
ambas as falhas foram isoladas por transação de DDL automática do Postgres e nenhum dado foi
perdido. Após a 2ª falha, adotado o procedimento de testar contra uma cópia descartável do banco em
vez de direto em produção (precedente já existia na Sprint 2, não seguido até aqui). Achado real
pós-migration: Caddyfile nunca roteava `/orcamentos*` pra API — gotcha já documentado no projeto
(`docs/architecture/OVERVIEW.md`), corrigido com uma linha no matcher `@api`. Todas as 4 falhas +
fix foram commitadas com causa raiz documentada (commits `581db5c`, `abda5d1`, `589a853`, `2a97c18`).

Implementadas as Fases 0–7 do plano: remoção completa da Projeção (código/testes/rotas/nav/scripts);
migração de Categoria/Subcategoria de catálogo global para nível de usuário (migration `0018`,
`seed.py`, threading de `user_id` em `app/categories/`); mecanismo completo de Orçamento (modelo,
migration `0019`, CRUD, vigência em tempo constante, agregação orçado-vs-realizado); fix de
segurança bloqueando exclusão de categoria/subcategoria em uso; telas `OrcamentoPage` e
`CategoriasPage`; componente `SubcategoryGroupTable` extraído de `NaturezaPage` (revisão de design
via Artifact — CEO escolheu Candidata B em ambas as decisões: barra orçado-vs-realizado sem cor
semântica nova em vez de âmbar, grupo demarcado com borda superior mais forte); barra
orçado-vs-realizado integrada aos funis de Despesa e Receita do Dashboard.

661 testes backend (99% cobertura, 100% em módulos novos `app/orcamentos/`, `app/categories/seed.py`,
`app/schemas/orcamento.py`) + 222 testes frontend, suíte 100% verde. Lint/formatter limpos. Maior
sprint do projeto até agora, comparável à Sprint 13 — 74 arquivos tocados (31 novos, 12 excluídos,
31 modificados), uma única sessão de execução.

PRD: [PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md](prd/PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md).
Plano: [SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-plan.md](sprints/SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-plan.md).
Relatório: [SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-report.md](sprints/SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-report.md).
**Sprint aprovada pelo CEO em 2026-08-20.**

### ✅ Sprint 31 — Fix: desassociação de transação presa por sugestão automática (cross-epic, sem épico prévio) concluída em 2026-08-20

Sem sessão de `/plan` prévia — CEO reportou ao vivo, usando a tela de Categorização, que não
conseguia desassociar um Pix recebido do investimento "Tesouro Direto Nubank". Investigação
(subagente Explore) confirmou: sem bug de persistência — o backend gravava `investimento_id = NULL`
corretamente. Causa raiz era o motor de sugestão (`_apply_suggestions`) recalculando
`investimento_sugerido_id`/`asset_sugerido_id`/`liability_sugerido_id` a cada `list_transactions`
para toda transação pendente, sem saber que o usuário já tinha decidido manualmente (inclusive
decidido "nenhum"), somado à UI priorizar o campo de sugestão sobre o valor real ao exibir o
`<select>`. O mesmo padrão, mais brando, também afetava Categoria (pedido explícito do CEO para
avaliar) — mitigado mas não eliminado pelo `categorizacao_status` já existente.

CEO escolheu, via pergunta direta, o fix definitivo em vez de um paliativo (que resolveria a tela na
hora mas o bug voltaria após a próxima recarga da lista): migration `0020` (3 flags booleanas de
confirmação manual — `asset_confirmado_manualmente`, `liability_confirmado_manualmente`,
`investimento_confirmado_manualmente` — em `pluggy_transactions`), motor de sugestão passa a
respeitá-las, e os 3 setters (`set_transaction_asset`/`liability`/`investimento`) marcam a flag e
limpam a sugestão correspondente ao gravar a escolha manual do usuário. Categoria corrigida sem
coluna nova (`set_category`/`bulk_confirm` limpam `subcategoria_sugerida_id` ao confirmar,
aproveitando o `categorizacao_status` já existente). 4 testes de regressão novos, reproduzindo o
cenário exato do bug relatado para cada campo. 665 testes backend (99% cobertura), lint/format
limpos.

**Deploy na mesma sessão** (pedido explícito do CEO, dado que o app real estava com o vínculo
travado): commit `1baee65`, CI confirmado verde (`conclusion: success`) para o commit exato antes
de tocar a VM, `git pull` + `docker compose pull` + `docker compose up -d` na VM de dev — migration
`0020` aplicada automaticamente pelo entrypoint do container `api` (nunca executada manualmente,
evitando a corrida de processos já documentada em `docs/architecture/OVERVIEW.md`), container
`healthy` confirmado via `docker compose ps`/`logs`.

PRD: [PRD-031-fix-desassociacao-vinculo-transacao.md](prd/PRD-031-fix-desassociacao-vinculo-transacao.md).
Plano: [SPRINT-031-fix-desassociacao-vinculo-transacao-plan.md](sprints/SPRINT-031-fix-desassociacao-vinculo-transacao-plan.md).
Relatório: [SPRINT-031-fix-desassociacao-vinculo-transacao-report.md](sprints/SPRINT-031-fix-desassociacao-vinculo-transacao-report.md).
**Sprint aprovada pelo CEO em 2026-08-20**, com validação real no app ("Deu certo a alteração, ja testei!").

## Registro de reavaliações futuras

- **Understand Anything:** reavaliar instalação quando o codebase ultrapassar ~100 arquivos (ver ADR-002-plugins).
- **Sync Pluggy agendada:** só entra no roadmap se o CEO priorizar explicitamente.
- **Ativo como nova camada do funil Categoria>Tipo>Transação (Dashboard):** ideia levantada pelo CEO na revisão pós-Sprint 10 (2026-08-15) — quando uma subcategoria (Tipo) tem transações vinculadas a um ativo, o drill-down ganharia um nível "Ativo" entre Tipo e Transação, agrupando por ativo antes de chegar na lista de transações. Registrada como candidata; requer sessão de `/plan` própria (decisões em aberto: só aparece quando há ≥1 transação com asset_id na subcategoria? bucket "sem ativo" pras demais? mesmo padrão pro funil de Passivos?) — sem PRD/plano ainda.
- **Multiusuário — UI de gestão de usuários (item 11 do escopo original de E7):** decisão explícita do CEO na sessão de planejamento da Sprint 15 (2026-08-16) — já coberto arquiteturalmente (isolamento por `user_id` em toda tabela, login individual Google, suporta ~10 usuários sem retrabalho), mas não há UI pra ver/convidar/remover outros usuários. Sem PRD/plano ainda; entra no roadmap quando o CEO priorizar.
- **Persistir despesas/receitas hipotéticas como cenários salvos:** decisão explícita do CEO na sessão de planejamento da Sprint 14 (2026-08-16) — a simulação da tela "Projeção" fica efêmera (sem CRUD, sem tabela) por ora. Se o CEO quiser voltar a um cenário entre sessões (ex.: comparar "com reforma" vs. "sem reforma" ao longo de semanas), viraria candidata a sprint futura com tabela nova + CRUD — sem PRD/plano ainda.
- **Heurística de dia útil para o lag Pluggy vs. extrato bancário real:** decisão explícita do CEO na sessão de planejamento da Sprint 16 (2026-08-17) — transações de fim de semana às vezes aparecem no extrato do Itaú só no próximo dia útil (até 2 dias depois da data bruta que a Pluggy reporta), sem outro campo no payload (`postDate`/`settlementDate`) para corrigir automaticamente. Não implementado por ora (risco de heurística errada, sem tratar feriados); candidata a revisão futura se a Pluggy passar a expor um campo de liquidação, ou se o CEO priorizar uma heurística mesmo com o risco.
- **Toggle competência/caixa nas telas "Natureza"/"Projeção":** fora de escopo da Sprint 16 (toggle só no Dashboard) — candidata a extensão futura se o CEO quiser o mesmo regime nessas telas.
- **Sugestão automática pra holdings CDB com nome idêntico/código nulo:** achado real da Sprint 21 — a cascata código-exato→similaridade de nome não resolve as 18 posições de CDB da Nubank (nome genérico igual, sem ticker/ISIN). Vínculo dessa sprint foi reconstruído manualmente por correspondência de valor de aporte contra o extrato real do CEO. Sem PRD/plano ainda; candidata a sprint futura se o CEO priorizar automatizar (possível caminho: correspondência por data+valor de aporte, mas exige mais investigação de payload).
