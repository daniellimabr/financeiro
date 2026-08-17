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
| E6 | Dashboards analíticos ✅ | Tendência histórica, percentual de representatividade, despesas por ativo (itens 4, 5, 6) — parte 1 (tendência/percentual/design system) ✅ Sprint 6; parte 2 (Gestão de Ativos) ✅ Sprint 8; parte 3 (cards Ativos/Passivos, drilldowns, refinamentos de Dashboard) ✅ Sprint 9 — épico fechado. Patrimônio/evolução de investimentos segue adiado por falta de série histórica no schema |
| E7 | Conta e perfil ✅ | Perfil de usuário, logout; tela de Configurações (absorve Gestão de Contas) + regra de competência de salário + saldo inicial por conta/Saldo Acumulado — ✅ Sprint 15 (2026-08-17). Multiusuário/item 11 (UI de convidar/remover) adiado pra sprint futura, decisão do CEO — arquitetura já suporta |
| E8 | Migração de dados legados ✅ | Import de categorias (Sprint 2) + memória de classificação do v1 (Sprint 4) — concluído em 2026-08-14 |
| E9 | Natureza e projeção de custos ✅ | Classificação de subcategoria por natureza (fixo recorrente/variável recorrente/eventual) + dashboard de visibilidade — ✅ Sprint 12 (2026-08-16); rótulo "Eventual", funil Natureza>Categoria>Subcategoria>Transação e redesign de tabelas/botões do app — ✅ Sprint 13 (2026-08-16); projeção de custos futuros (receita/despesa/saldo) com simulação efêmera de hipotéticas — ✅ Sprint 14 (2026-08-16) — épico fechado |

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

## Registro de reavaliações futuras

- **Understand Anything:** reavaliar instalação quando o codebase ultrapassar ~100 arquivos (ver ADR-002-plugins).
- **Sync Pluggy agendada:** só entra no roadmap se o CEO priorizar explicitamente.
- **Ativo como nova camada do funil Categoria>Tipo>Transação (Dashboard):** ideia levantada pelo CEO na revisão pós-Sprint 10 (2026-08-15) — quando uma subcategoria (Tipo) tem transações vinculadas a um ativo, o drill-down ganharia um nível "Ativo" entre Tipo e Transação, agrupando por ativo antes de chegar na lista de transações. Registrada como candidata; requer sessão de `/plan` própria (decisões em aberto: só aparece quando há ≥1 transação com asset_id na subcategoria? bucket "sem ativo" pras demais? mesmo padrão pro funil de Passivos?) — sem PRD/plano ainda.
- **Multiusuário — UI de gestão de usuários (item 11 do escopo original de E7):** decisão explícita do CEO na sessão de planejamento da Sprint 15 (2026-08-16) — já coberto arquiteturalmente (isolamento por `user_id` em toda tabela, login individual Google, suporta ~10 usuários sem retrabalho), mas não há UI pra ver/convidar/remover outros usuários. Sem PRD/plano ainda; entra no roadmap quando o CEO priorizar.
- **Persistir despesas/receitas hipotéticas como cenários salvos:** decisão explícita do CEO na sessão de planejamento da Sprint 14 (2026-08-16) — a simulação da tela "Projeção" fica efêmera (sem CRUD, sem tabela) por ora. Se o CEO quiser voltar a um cenário entre sessões (ex.: comparar "com reforma" vs. "sem reforma" ao longo de semanas), viraria candidata a sprint futura com tabela nova + CRUD — sem PRD/plano ainda.
- **Heurística de dia útil para o lag Pluggy vs. extrato bancário real:** decisão explícita do CEO na sessão de planejamento da Sprint 16 (2026-08-17) — transações de fim de semana às vezes aparecem no extrato do Itaú só no próximo dia útil (até 2 dias depois da data bruta que a Pluggy reporta), sem outro campo no payload (`postDate`/`settlementDate`) para corrigir automaticamente. Não implementado por ora (risco de heurística errada, sem tratar feriados); candidata a revisão futura se a Pluggy passar a expor um campo de liquidação, ou se o CEO priorizar uma heurística mesmo com o risco.
- **Toggle competência/caixa nas telas "Natureza"/"Projeção":** fora de escopo da Sprint 16 (toggle só no Dashboard) — candidata a extensão futura se o CEO quiser o mesmo regime nessas telas.
