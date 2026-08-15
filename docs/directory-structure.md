# Estrutura de diretórios

Atualizado a cada mudança estrutural. Estado atual (fim da Sprint 10 — revisão de UX e Gestão de Passivos):

```
Financeiro v3/
├── CLAUDE.md                       # doc viva raiz — ponto de entrada (atualizado em Sprint 1)
├── PRODUCT.md                      # fatos de produto (gerado pelo Impeccable /impeccable init)
├── DESIGN.md                       # sistema de design (gerado pelo fluxo new-work do Impeccable, Sprint 5; tipografia/layout estendidos na Sprint 6)
├── .gitignore
├── .pre-commit-config.yaml         # hooks pre-commit: ruff, eslint, detect-secrets (Sprint 1)
├── .secrets.baseline               # baseline para detect-secrets, evita falsos positivos (Sprint 1)
├── .env.example                    # template de variáveis de ambiente (Sprint 1)
├── docker-compose.yml              # orquestração: postgres, api, frontend, caddy (Sprint 1)
├── Caddyfile                       # configuração Caddy reverse-proxy (Sprint 1)
├── .claude/
│   ├── settings.json               # plugins habilitados no projeto (Ponytail)
│   ├── agents/                     # 5 agentes do ECC copiados seletivamente (ver ADR-002)
│   └── skills/
│       ├── tdd-workflow/           # skill do ECC copiada seletivamente
│       └── impeccable/             # skill completa do plugin Impeccable
├── docs/
│   ├── architecture/
│   │   ├── OVERVIEW.md             # arquitetura/infra/lógica — atualizado com VM de dev e Docker Compose (Sprint 1)
│   │   └── adr/
│   │       ├── ADR-001-stack.md    # stack aprovada em 2026-08-03
│   │       └── ADR-002-plugins.md  # plugins ativados/desativados e por quê
│   ├── prd/
│   │   ├── PRD-001-fundacao-tecnica.md  # Sprint 1 — VM de dev, auth Google, testes e CI
│   │   ├── PRD-002-dados-mestres-migracao-legado.md  # Sprint 2 — categorias/ativos/passivos + import
│   │   ├── PRD-003-integracao-pluggy.md  # Sprint 3 — contas/transações via Pluggy (E2)
│   │   ├── PRD-004-categorizacao-automatica.md  # Sprint 4 — categorização + associação despesa↔ativo (E3)
│   │   ├── PRD-005-dashboards-core.md    # Sprint 5 — dashboards core, drill-down (E5)
│   │   ├── PRD-006-dashboards-analiticos.md  # Sprint 6 — tendência, percentual, design system (E6)
│   │   ├── PRD-007-categorizacao-gestao-contas.md  # Sprint 7 — rework categorização, Gestão de Contas (E3, E2)
│   │   ├── PRD-008-gestao-de-ativos.md  # Sprint 8 — tela de Gestão de Ativos (E6 parte 2)
│   │   ├── PRD-009-dashboards-ativos-passivos.md  # Sprint 9 — cards Ativos/Passivos, liability_id, refinamentos de funil (E6 parte 3)
│   │   └── PRD-010-revisao-ux-e-passivos.md  # Sprint 10 — fix NuTag/cartão, tooltip, breakdown de Patrimônio, edição inline, Gestão de Passivos, filtros de Categorização (cross-epic)
│   ├── sprints/
│   │   ├── SPRINT-001-fundacao-tecnica-plan.md       # Plano Sprint 1 (2026-08-04)
│   │   ├── SPRINT-001-fundacao-tecnica-report.md     # Relatório Sprint 1 (2026-08-04)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-plan.md    # Plano Sprint 2 (2026-08-05)
│   │   ├── SPRINT-002-dados-mestres-migracao-legado-report.md  # Relatório Sprint 2 (2026-08-06)
│   │   ├── SPRINT-003-integracao-pluggy-plan.md      # Plano Sprint 3 (2026-08-07)
│   │   ├── SPRINT-004-categorizacao-automatica-plan.md    # Plano Sprint 4 (2026-08-14)
│   │   ├── SPRINT-004-categorizacao-automatica-report.md  # Relatório Sprint 4 (2026-08-14)
│   │   ├── SPRINT-005-dashboards-core-plan.md        # Plano Sprint 5 (2026-08-14)
│   │   ├── SPRINT-005-dashboards-core-report.md      # Relatório Sprint 5 (2026-08-14)
│   │   ├── SPRINT-006-dashboards-analiticos-plan.md  # Plano Sprint 6 (2026-08-14)
│   │   ├── SPRINT-006-dashboards-analiticos-report.md  # Relatório Sprint 6 (2026-08-15)
│   │   ├── SPRINT-007-categorizacao-gestao-contas-plan.md  # Plano Sprint 7 (2026-08-15)
│   │   ├── SPRINT-007-categorizacao-gestao-contas-report.md  # Relatório Sprint 7 (2026-08-15)
│   │   ├── SPRINT-008-gestao-de-ativos-plan.md  # Plano Sprint 8 (2026-08-15)
│   │   ├── SPRINT-008-gestao-de-ativos-report.md  # Relatório Sprint 8 (2026-08-15)
│   │   ├── SPRINT-009-dashboards-ativos-passivos-plan.md  # Plano Sprint 9 (2026-08-15)
│   │   ├── SPRINT-009-dashboards-ativos-passivos-report.md  # Relatório Sprint 9 (2026-08-15)
│   │   ├── SPRINT-010-revisao-ux-e-passivos-plan.md  # Plano Sprint 10 (2026-08-15)
│   │   └── SPRINT-010-revisao-ux-e-passivos-report.md  # Relatório Sprint 10 (2026-08-15)
│   ├── roadmap.md                  # épicos + sprints
│   ├── directory-structure.md      # este arquivo — atualizado em Sprint 9
│   ├── infra/
│   │   └── ssh-workflow.md         # procedimento SSH obrigatório via venv (atualizado em Sprint 1)
│   └── migration/
│       └── legacy-data.md          # formato de import de categorias + memória do v1
├── templates/
│   ├── PRD-template.md
│   ├── ADR-template.md
│   ├── SPRINT-plan-template.md
│   └── SPRINT-report-template.md
├── backend/                        # FastAPI + SQLAlchemy 2.0 + Alembic (Sprint 1)
│   ├── pyproject.toml              # dependências backend (FastAPI, SQLAlchemy, pytest, etc)
│   ├── app/
│   │   ├── main.py                 # entry point FastAPI, health-check, registra routers
│   │   ├── config.py               # pydantic-settings, vars de env
│   │   ├── db.py                   # session factory SQLAlchemy
│   │   ├── exceptions.py           # DuplicateNameError/NotFoundError/InvalidStateError (Sprint 2)
│   │   ├── models/
│   │   │   ├── user.py             # modelo User (google_sub, email, name, created_at, updated_at)
│   │   │   ├── category.py         # CategoryGroup (+excluir_de_totais na Sprint 5), Subcategory, enum Natureza, SEM_CATEGORIA_ID (Sprint 2)
│   │   │   ├── asset.py            # Asset, enums AssetTipo/AssetStatus (Sprint 2)
│   │   │   ├── liability.py        # Liability, enums LiabilityTipo/LiabilityStatus (Sprint 2)
│   │   │   ├── pluggy.py           # PluggyItem/Account/Transaction + enums (Sprint 3; +9 colunas de categorização/ativo na Sprint 4; +apelido/sync_enabled em Account, +descricao_usuario/sugerida/origem_id em Transaction na Sprint 7; +liability_id/liability_sugerido_id/liability_sugestao_confianca, +@property account_tipo na Sprint 9; +limite_credito/fatura_vencimento em Account na revisão pós-entrega da Sprint 9)
│   │   │   └── categorization.py   # CategorizationRule — memória de mapeamento padrão→subcategoria (Sprint 4); AssetCategorizationRule — mirror pra ativo, trocando subcategory_id por asset_id (Sprint 10)
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── category.py         # CategoryGroupIn/Out, SubcategoryIn/Out (Sprint 2)
│   │   │   ├── asset.py            # AssetIn/Out, AssetSellIn (Sprint 2)
│   │   │   ├── liability.py        # LiabilityIn/Out (Sprint 2)
│   │   │   ├── pluggy.py           # ConnectToken*, PluggyItem/Account/TransactionOut (Sprint 3); PluggyAccountUpdateIn, SyncItemsIn/Out (Sprint 7); PluggyTransactionOut +account_tipo (Sprint 9); PluggyTransactionOut +descricao_usuario/descricao_sugerida/subcategoria_sugerida_id/asset_id/asset_sugerido_id — alimenta a edição inline no drill-down do Dashboard/Ativos/Passivos (Sprint 10)
│   │   │   ├── categorization.py   # TransactionOut/TransactionsPageOut, CategoryIn, AssetAssociationIn, BulkConfirmIn/Out, DescriptionUpdateIn/Out (Sprint 4, renomeado/estendido na Sprint 7); +liability_id/liability_sugerido_id/liability_sugestao_confianca, LiabilityAssociationIn (Sprint 9)
│   │   │   └── dashboards.py       # SummaryOut, CategoriaTotalOut/MeioPagamentoTotalOut+percentual (Sprint 5), TendenciaMesOut/TendenciaCategoriaOut (Sprint 6); AtivoTotalOut/TendenciaAtivoOut (Sprint 8); SummaryOut +ativos/passivos, PassivoTotalOut/TendenciaPassivoOut/SaldoContaOut (Sprint 9); SaldoContaOut +limite_credito (revisão pós-entrega da Sprint 9); PatrimonioBreakdownOut — ativos/passivos/saldo_contas/saldo_cartoes/total (Sprint 10)
│   │   ├── auth/
│   │   │   ├── jwt.py              # geração/validação JWT via PyJWT
│   │   │   ├── google.py           # integração Authlib com Google OAuth
│   │   │   ├── service.py          # lógica upsert de usuário
│   │   │   ├── router.py           # rotas /auth/google/login, /auth/google/callback, /auth/me
│   │   │   └── deps.py             # dependency get_current_user (validação JWT)
│   │   ├── categories/             # CRUD category_groups/subcategories (Sprint 2, dado global)
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── assets/                 # CRUD assets + sell, isolado por user_id (Sprint 2)
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── liabilities/            # CRUD liabilities + settle, isolado por user_id (Sprint 2)
│   │   │   ├── service.py          # delete_liability desassocia transações (liability_id/liability_sugerido_id → NULL) em vez de falhar (Sprint 9, mesmo achado de FK sem ON DELETE de delete_asset na Sprint 8)
│   │   │   └── router.py
│   │   ├── pluggy_integration/     # integração Pluggy — connect token, sync manual (Sprint 3)
│   │   │   ├── client.py           # PluggyClient — auth por API key cacheada, get_item/accounts/transactions
│   │   │   ├── service.py          # register_item, sync_item, list_items/accounts/transactions; update_account, sync_items (Sprint 7); filtro liability_id, joinedload(account) em list_transactions p/ account_tipo sem N+1 (Sprint 9); _upsert_account persiste limite_credito/fatura_vencimento de creditData (revisão pós-entrega da Sprint 9)
│   │   │   └── router.py           # rotas /pluggy/*; PUT /pluggy/accounts/{id}, POST /pluggy/sync (Sprint 7); filtro liability_id (Sprint 9)
│   │   ├── categorization/         # motor de categorização por regras+memória, sem LLM (Sprint 4)
│   │   │   ├── normalize.py        # normalize_description — NFKD/ASCII/minúsculas, prefixo de canal, números isolados
│   │   │   ├── engine.py           # suggest_category (regra > histórico exato > similaridade ≥0.86), suggest_asset; suggest_liability (mesma heurística de substring, Sprint 9); suggest_asset reescrito pro mesmo padrão de 3 camadas de suggest_category (regra > histórico exato > similaridade ≥0.86), via asset_categorization_rules — antes era só substring (Sprint 10)
│   │   │   ├── service.py          # list_transactions (status/tipo/ano/mes/paginado, renomeado de list_pending_transactions na Sprint 7), set_category, bulk_confirm, set_transaction_asset, update_description/confirm_description_suggestion/dismiss_description_suggestion (Sprint 7); set_transaction_liability, sugestão de passivo em _apply_suggestions (Sprint 9); list_transactions +has_asset/group_id (Sprint 10)
│   │   │   └── router.py           # rotas /categorization/transactions/* (renomeadas de /pending/* na Sprint 7); PUT .../liability (Sprint 9); GET /transactions +has_asset/group_id (Sprint 10)
│   │   └── dashboards/             # agregação para dashboards — sem LLM, sem cache (Sprint 5)
│   │       ├── service.py          # get_summary, get_por_categoria/get_por_meio_pagamento (+percentual), get_tendencia/get_tendencia_por_categoria (Sprint 6); get_por_ativo/get_tendencia_por_ativo (Sprint 8); _calcula_patrimonio refatorado com helper _ativos_e_passivos (reuso), get_summary +ativos/passivos, get_por_passivo/get_tendencia_por_passivo (mirror de ativo, sempre débito), get_saldo_por_conta (snapshot atual, sem período) (Sprint 9); get_saldo_por_conta de cartão de crédito passa a somar a fatura atual (_fatura_atual/_subtract_month, janela vencimento anterior→próximo) em vez do saldo bruto (revisão pós-entrega da Sprint 9); _base_query exclui cartao_credito+credito da receita (achado NuTag — pagamento de fatura/estorno, nunca receita real); _calcula_patrimonio refatorado com helper _patrimonio_breakdown (reuso), get_patrimonio_breakdown novo (Sprint 10)
│   │       └── router.py           # rotas /dashboards/* (+tendencia, por-categoria/tendencia na Sprint 6; +por-ativo/tendencia na Sprint 8; +por-passivo/tendencia, saldo-por-conta na Sprint 9; +patrimonio/breakdown na Sprint 10)
│   ├── scripts/
│   │   ├── import_legacy_categories.py  # import CSV grupo,subcategoria — upsert, loga conflito (Sprint 2)
│   │   ├── import_legacy_categorization_rules.py  # import semente-classificacao.json (328 regras) — upsert por usuário (Sprint 4)
│   │   ├── pluggy_sandbox_smoke.py      # validação manual do sandbox Pluggy — não roda em CI (Sprint 3)
│   │   └── data/
│   │       ├── legacy_categories.csv        # 15 grupos / 51 pares confirmados pelo CEO (Sprint 2)
│   │       └── semente-classificacao.json   # 328 regras de classificação do v1, entregues pelo CEO (Sprint 4)
│   ├── tests/
│   │   ├── test_health.py
│   │   ├── test_jwt.py             # testes de validade, expiração, assinatura
│   │   ├── test_auth_service.py    # testes upsert usuário
│   │   ├── test_auth_endpoints.py  # testes endpoints OAuth e /auth/me
│   │   ├── test_category_service.py     # nome único (grupo/subcategoria), natureza (Sprint 2)
│   │   ├── test_category_endpoints.py   # CRUD, 401/404/400 (Sprint 2)
│   │   ├── test_asset_service.py        # sell idempotente (Sprint 2)
│   │   ├── test_asset_endpoints.py      # CRUD, isolamento user_id, sell (Sprint 2)
│   │   ├── test_liability_service.py    # settle idempotente (Sprint 2); delete_liability desassocia transações vinculadas (Sprint 9)
│   │   ├── test_liability_endpoints.py  # CRUD, isolamento user_id, settle (Sprint 2)
│   │   ├── test_import_legacy_categories.py  # merge de duplicata, log de conflito (Sprint 2)
│   │   ├── test_pluggy_client.py        # cache/refetch de API key, paginação, erro propagado (Sprint 3)
│   │   ├── test_pluggy_service.py       # upsert idempotente, cutoff_date, status não-sincronizável (Sprint 3); apelido preservado em resync, sync_enabled pulando conta, update_account/sync_items (Sprint 7); creditData persistido/ausente (revisão pós-entrega da Sprint 9)
│   │   ├── test_pluggy_endpoints.py     # 401/404/400, isolamento user_id (Sprint 3); PUT /accounts/{id}, POST /sync (Sprint 7); filtro asset_id (Sprint 8); filtro liability_id, account_tipo na resposta (Sprint 9)
│   │   ├── test_categorization_normalize.py    # acentos, prefixos de canal, token numérico vs. alfanumérico (Sprint 4)
│   │   ├── test_categorization_engine.py       # precedência de camadas, fronteira 0.86, isolamento por usuário (Sprint 4); suggest_liability — substring, isolamento, sem match (Sprint 9); suggest_asset mirror completo dos testes de categoria (regra/histórico exato/similaridade/isolamento) (Sprint 10)
│   │   ├── test_categorization_service.py      # invariante "nunca auto-confirma", reedição, 404 cross-user (Sprint 4); paginação, filtro ano/mes (pós-Sprint 6); filtro status/tipo, bulk_confirm parcial, propagação de descrição (Sprint 7); set_transaction_liability — sets/clears, 404 cross-user (Sprint 9); has_asset/group_id isolados e combinados (Sprint 10)
│   │   ├── test_categorization_endpoints.py    # 401, isolamento, confirmar/editar via API (Sprint 4); paginação, filtro ano/mes (pós-Sprint 6); rotas /transactions/*, bulk-confirm, descrição (Sprint 7); PUT .../liability (Sprint 9); has_asset/group_id via API (Sprint 10)
│   │   ├── test_import_legacy_categorization_rules.py  # conflito, idempotência, categoria não resolvida, abort sem usuário (Sprint 4)
│   │   ├── test_dashboards_service.py   # período vazio, só-transferência, misto, sinal do cartão, borda de mês (Sprint 5); tendência terminando no mês filtrado, percentual somando 100%/denominador zero (Sprint 6); get_por_ativo/get_tendencia_por_ativo (Sprint 8); summary ativos/passivos batendo com patrimonio, get_por_passivo/get_tendencia_por_passivo (nunca soma crédito), get_saldo_por_conta (apelido→nome, isolamento) (Sprint 9); get_saldo_por_conta de cartão somando a fatura da janela/caindo pro saldo bruto sem fatura_vencimento, _subtract_month (rollover de ano, overflow de dia) (revisão pós-entrega da Sprint 9); cartao_credito+credito excluído da receita (achado NuTag), corrente+credito continua contando, get_patrimonio_breakdown batendo com summary.patrimonio (Sprint 10)
│   │   ├── test_dashboards_endpoints.py # 401, isolamento entre usuários nos 5 endpoints (Sprint 5+6); por-ativo/tendencia (Sprint 8); por-passivo/tendencia, saldo-por-conta (Sprint 9); patrimonio/breakdown (Sprint 10)
│   │   └── fixtures/
│   │       ├── legacy_categories_sample.csv           # fixture pequena p/ teste de import (Sprint 2)
│   │       └── semente_classificacao_sample.json      # fixture pequena p/ teste de import de regras (Sprint 4)
│   └── alembic/
│       └── versions/
│           ├── 0001_create_users.py       # migration inicial — tabela users
│           ├── 0002_create_categories.py  # category_groups + subcategories (Sprint 2)
│           ├── 0003_create_assets_liabilities.py  # assets + liabilities (Sprint 2)
│           ├── 0004_create_pluggy_tables.py  # pluggy_items/accounts/transactions (Sprint 3)
│           ├── 0005_create_categorization_rules.py  # categorization_rules (Sprint 4)
│           ├── 0006_add_categorization_and_asset_fields_to_pluggy_transactions.py  # 9 colunas novas (Sprint 4)
│           ├── 0007_dashboards_transferencia_flag_e_competencia.py  # excluir_de_totais + backfill data_competencia + índice (Sprint 5)
│           ├── 0008_categorizacao_gestao_contas.py  # apelido/sync_enabled em pluggy_accounts, descricao_usuario/sugerida/origem_id em pluggy_transactions, seed subcategoria Aluguel (Sprint 7)
│           ├── 0009_add_liability_fields_to_pluggy_transactions.py  # liability_id/liability_sugerido_id/liability_sugestao_confianca em pluggy_transactions, mirror de asset_id (Sprint 9)
│           ├── 0010_add_credit_data_to_pluggy_accounts.py  # limite_credito/fatura_vencimento em pluggy_accounts, lidos de creditData (Sprint 9, revisão pós-entrega)
│           └── 0011_create_asset_categorization_rules.py  # asset_categorization_rules, mirror de categorization_rules trocando subcategory_id por asset_id (Sprint 10)
├── frontend/                       # React 19 + Vite + TypeScript (Sprint 1)
│   ├── package.json                # dependências frontend (React, TanStack Query, ESLint, Prettier, Vitest)
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html                  # entry point, lang="pt-BR" (auditado via /impeccable audit)
│   ├── public/
│   │   └── fonts/                  # Archivo (600/700) + Public Sans (400/600), .woff2 auto-hospedado, licença OFL (Sprint 6)
│   ├── src/
│   │   ├── App.tsx                 # componente raiz (renderização condicional login/protected/loading)
│   │   ├── main.tsx
│   │   ├── utils/
│   │   │   ├── format.ts           # formatCurrency, extraído de DashboardsPage.tsx (Sprint 7)
│   │   │   ├── categoryColors.ts   # paleta categórica p/ Categoria (grupo) e Tipo (subcategoria) no funil — atribuição por id estável, nunca por ranking; Tipo deriva um color-mix() do grupo pai (Sprint 9, revisão pós-entrega)
│   │   │   └── transactionEdit.ts  # EditableTransaction (forma mínima compartilhada entre CategorizedTransaction/PluggyTransaction) + descricaoExibida (Sprint 10); +subcategoryLabel, extraída de TransactionEditCells/CategorizationReviewPage (Sprint 11)
│   │   ├── api/
│   │   │   ├── client.ts           # fetch wrapper com credentials:"include"
│   │   │   ├── auth.ts             # chamadas /auth/me
│   │   │   ├── pluggy.ts           # chamadas /pluggy/* (Sprint 3); apelido/sync_enabled em PluggyAccount, updatePluggyAccount, syncPluggyItems (Sprint 7); liabilityId em filtros, account_tipo em PluggyTransaction (Sprint 9)
│   │   │   ├── categories.ts       # chamadas /category-groups, /subcategories (Sprint 4, pré-requisito antes inexistente)
│   │   │   ├── assets.ts           # chamadas /assets (Sprint 4, pré-requisito antes inexistente)
│   │   │   ├── categorization.ts   # chamadas /categorization/transactions/* — renomeado de /pending/*, +status/tipo, bulkConfirm, updateDescription/confirm/dismissDescriptionSuggestion (Sprint 7, era Sprint 4); +liability_id/liability_sugerido_id/liability_sugestao_confianca, setTransactionLiability (Sprint 9); TransactionsFilter +hasAsset/groupId (Sprint 10)
│   │   │   ├── dashboards.ts       # chamadas /dashboards/*, SEM_CATEGORIA_ID (Sprint 5); +tendencia/por-categoria/tendencia, +percentual (Sprint 6); AtivoTotal/TendenciaAtivo, fetchDashboardPorAtivo(Tendencia) (Sprint 8); DashboardSummary +ativos/passivos, PassivoTotal/TendenciaPassivo/SaldoConta, fetchDashboardPorPassivo(Tendencia)/fetchSaldoPorConta (Sprint 9); PatrimonioBreakdown, fetchPatrimonioBreakdown (Sprint 10)
│   │   │   └── liabilities.ts      # chamadas /liabilities/* — fetch/create/update/settle/deleteLiability, mirror de assets.ts (Sprint 10, backend já existia desde a Sprint 2)
│   │   ├── pluggy/
│   │   │   └── loadPluggyConnect.ts  # injeta o script do widget Pluggy Connect sob demanda (Sprint 3)
│   │   ├── components/
│   │   │   ├── PeriodFilter.tsx      # seletor ano/mês reutilizável (Sprint 8, extraído de DashboardsPage/CategorizationReviewPage)
│   │   │   ├── CardSparkline.tsx     # sparkline de card (Sprint 9, extraído de DashboardsPage/AssetsPage — duplicavam); ganha tooltip (revisão pós-entrega); prop values→pontos ({ano,mes,total}), tooltip mostra MM/AAAA em vez de "v:" (Sprint 10)
│   │   │   ├── TrendChart.tsx        # gráfico de tendência com tooltip + eixo X reduzido (Sprint 9, extraído de AssetTrendChart em AssetsPage); eixo X rotulado só nos meses de início de trimestre (revisão pós-entrega)
│   │   │   ├── AccountTipoIcon.tsx   # ícone SVG inline por tipo de conta, decorativo (Sprint 9, substitui o nível "meio de pagamento" do funil)
│   │   │   ├── TransactionTipoIcon.tsx  # ícone SVG inline débito/crédito, decorativo, mesmo padrão de AccountTipoIcon — indicador visual de entrada/saída na tela de Categorização (Sprint 10, achado NuTag)
│   │   │   ├── TransactionEditCells.tsx  # DescriptionCell/CategorySelectCell/AssetSelectCell — extraídos de CategorizationReviewPage, reaproveitados em TransacoesPanel (Dashboard) e nos drill-downs de Ativos/Passivos (Sprint 10); CategorySelectCell passa a usar CategoryCombobox por dentro (Sprint 11)
│   │   │   └── CategoryCombobox.tsx  # combobox buscável/agrupado por categoria, substitui o <select> nativo de 51 subcategorias em CategorySelectCell e CategorizationReviewPage; popup via portal+position:fixed (escapa do overflow-x:auto de .dash-table-wrap); ARIA combobox+listbox completo (Sprint 11, sem precedente no design system)
│   │   ├── hooks/
│   │   │   ├── useCurrentUser.ts   # TanStack Query hook para sessão do usuário
│   │   │   ├── usePluggyItems.ts   # lista items conectados (Sprint 3)
│   │   │   ├── usePluggyAccounts.ts      # lista contas sincronizadas (Sprint 3)
│   │   │   ├── usePluggyTransactions.ts  # lista transações sincronizadas (Sprint 3) — ainda usada pelo drill-down do Dashboard
│   │   │   ├── useRegisterPluggyItem.ts  # mutation POST /pluggy/items (Sprint 3)
│   │   │   ├── useUpdatePluggyAccount.ts # mutation PUT /pluggy/accounts/{id} — apelido/sync_enabled (Sprint 7)
│   │   │   ├── useSyncPluggyItems.ts     # mutation POST /pluggy/sync, em lote (Sprint 7)
│   │   │   ├── useCategoryGroups.ts      # lista category_groups (Sprint 4)
│   │   │   ├── useSubcategories.ts       # lista subcategories (Sprint 4)
│   │   │   ├── useAssets.ts              # lista assets do usuário (Sprint 4)
│   │   │   ├── useCategorizationTransactions.ts  # lista transações filtrada por status/tipo/ano/mes, paginada (Sprint 7, renomeado de usePendingCategorizations); +hasAsset/groupId na queryKey (Sprint 10)
│   │   │   ├── useSetCategory.ts         # mutation PUT /categorization/transactions/{id}/category (Sprint 7, renomeado de useConfirmCategorization); invalida também dashboard/pluggyTransactions via invalidateAfterTransactionEdit (Sprint 10)
│   │   │   ├── useBulkConfirmCategorization.ts   # mutation POST .../bulk-confirm (Sprint 7)
│   │   │   ├── useSetTransactionAsset.ts # mutation PUT /categorization/transactions/{id}/asset (Sprint 4); invalida também dashboard/pluggyTransactions (Sprint 10)
│   │   │   ├── useUpdateDescription.ts   # mutation PUT .../description (Sprint 7); invalida também dashboard/pluggyTransactions (Sprint 10)
│   │   │   ├── invalidateDashboardQueries.ts  # invalidateAfterTransactionEdit — invalida categorizationTransactions/pluggyTransactions + todo query "dashboard*"/"saldoPorConta" por predicate; usado pelas 4 mutations de edição de transação (Sprint 10)
│   │   │   ├── useConfirmDescriptionSuggestion.ts  # mutation POST .../description/confirm (Sprint 7)
│   │   │   ├── useDismissDescriptionSuggestion.ts  # mutation POST .../description/dismiss (Sprint 7)
│   │   │   ├── useDashboardSummary.ts        # GET /dashboards/summary (Sprint 5)
│   │   │   ├── useDashboardByCategoria.ts    # GET /dashboards/por-categoria (Sprint 5)
│   │   │   ├── useDashboardTendencia.ts      # GET /dashboards/tendencia (Sprint 6)
│   │   │   ├── useDashboardCategoriaTendencia.ts  # GET /dashboards/por-categoria/tendencia, enabled só com categoria expandida (Sprint 6)
│   │   │   ├── useCreateAsset.ts             # mutation POST /assets (Sprint 8)
│   │   │   ├── useUpdateAsset.ts             # mutation PUT /assets/{id} (Sprint 8)
│   │   │   ├── useSellAsset.ts               # mutation POST /assets/{id}/sell (Sprint 8)
│   │   │   ├── useDeleteAsset.ts             # mutation DELETE /assets/{id} (Sprint 8)
│   │   │   ├── useAssetGastos.ts             # GET /dashboards/por-ativo, com período+tipo (Sprint 8, reaproveitado pelo drill-down de Ativos do Dashboard na Sprint 9)
│   │   │   ├── useAssetGastosTendencia.ts    # GET /dashboards/por-ativo/tendencia, série por ativo (Sprint 8)
│   │   │   ├── useLiabilityGastos.ts         # GET /dashboards/por-passivo, com período (Sprint 9)
│   │   │   ├── useLiabilityGastosTendencia.ts  # GET /dashboards/por-passivo/tendencia, série por passivo (Sprint 9)
│   │   │   ├── useSaldoPorConta.ts           # GET /dashboards/saldo-por-conta, sem parâmetros (Sprint 9)
│   │   │   ├── useSetTransactionLiability.ts # mutation PUT /categorization/transactions/{id}/liability (Sprint 9); invalida também dashboard/pluggyTransactions (Sprint 10)
│   │   │   ├── useTableSort.ts               # hook genérico de ordenação por coluna (Sprint 9, sem precedente — novo)
│   │   │   ├── usePatrimonioBreakdown.ts     # GET /dashboards/patrimonio/breakdown (Sprint 10)
│   │   │   ├── useLiabilities.ts             # lista liabilities do usuário (Sprint 10, mirror de useAssets)
│   │   │   ├── useCreateLiability.ts         # mutation POST /liabilities (Sprint 10)
│   │   │   ├── useUpdateLiability.ts         # mutation PUT /liabilities/{id} (Sprint 10)
│   │   │   ├── useSettleLiability.ts         # mutation POST /liabilities/{id}/settle (Sprint 10)
│   │   │   └── useDeleteLiability.ts         # mutation DELETE /liabilities/{id} — invalida liabilities/pluggyTransactions/dashboardPorPassivo*/categorizationTransactions (Sprint 10, mirror de useDeleteAsset)
│   │   └── pages/
│   │       ├── LoginPage.tsx       # botão "Entrar com Google" (link para /auth/google/login)
│   │       ├── ProtectedPage.tsx   # nome/e-mail do usuário + abas Início/Dashboards/Categorizar/Gestão de contas/Ativos (Sprint 5; aba Transações removida e Conectar conta renomeada na Sprint 7; aba Ativos na Sprint 8); aba Início removida (Dashboards vira a aba inicial), aba Passivos nova, Gestão de Contas move pro final — ordem: Dashboards/Categorizar/Ativos/Passivos/Gestão de Contas (Sprint 10)
│   │       ├── DashboardsPage.tsx  # filtro ano/mês, cards com sparkline, funil de drill-down em sanfona + Recharts (Sprint 5, sanfona/tendência/percentual na Sprint 6); cards Ativos/Passivos/Saldo clicáveis, funil de categoria expande direto pra transações (nível "meio de pagamento" removido, vira AccountTipoIcon por linha), tabelas ordenáveis por coluna (Sprint 9); funil de Despesa/Receita ganha um nível — Categoria (`GrupoAccordion`) > Tipo (`SubcategoriaAccordion`) > Transação — com cores via `categoryColors.ts`, ícone dentro da célula Valor, coluna % ordenável (revisão pós-entrega da Sprint 9); card Patrimônio clicável com `PatrimonioBreakdownPanel` (4 partes + total, link pros drill-downs de Ativos/Passivos/Saldo); `TransacoesPanel` ganha colunas Categoria/Ativo editáveis inline via `TransactionEditCells` (Sprint 10)
│   │       ├── AccountManagementPage.tsx  # Gestão de Contas — lista contas conectadas, apelido/sync_enabled editáveis, diálogo "Sincronizar MeuPluggy" com pré-seleção (Sprint 7, renomeado de ConnectAccountPage.tsx)
│   │       ├── CategorizationReviewPage.tsx  # listagem única de transações (substitui TransactionsPage) — filtro tipo/status, lote, categoria editável em confirmada, descrição inline + propagação (Sprint 4; paginação pós-Sprint 6; rework completo na Sprint 7); filtros novos "associado a ativo"/"categoria" (grupo), indicador visual débito/crédito (`TransactionTipoIcon`) por linha, descrição/ativo passam a usar `TransactionEditCells` compartilhado (categoria continua bespoke — fila de pendentes tem workflow de confirmação em lote que não se aplica ao auto-save do componente compartilhado) (Sprint 10); `<select>` de categoria trocado por `CategoryCombobox` (mesmo estado local bufferizado até confirmação), status vira badge visual (`.status-badge`), tabela ganha classe aditiva `cat-review-table` (hover/alinhamento, só nesta tela) (Sprint 11)
│   │       ├── AssetsPage.tsx      # Gestão de Ativos — grid de cards ativos/baixados, CRUD (criar/editar/vender/deletar), toggle despesa/receita, sparkline por card, drill-down (painel fora do card, gráfico de histórico + transações) por ativo, filtro período (Sprint 8; refatorada na Sprint 9 pra reaproveitar CardSparkline/TrendChart compartilhados, sem mudança de comportamento)
│   │       └── LiabilitiesPage.tsx  # Gestão de Passivos — mirror 1:1 de AssetsPage, sem toggle despesa/receita (passivo é sempre débito) e sem data_aquisicao; ação "Quitar" (confirmação, sem form, ao contrário de "Vender") no lugar de vender; drill-down com edição inline (Sprint 10 — backend já existia completo desde a Sprint 2, só nunca tinha ganhado UI)
│   │   └── App.test.tsx            # testes Vitest + Testing Library (401, 200); verifica Dashboards como aba inicial em vez do antigo texto "Bem-vindo" (Sprint 10)
│   └── test/
│       └── setup.ts                # setup do Vitest (jest-dom matchers)
├── scripts/
│   ├── ssh-vm.ps1                  # wrapper PowerShell: venv + paramiko, alvo dev|prod
│   ├── ssh_vm.py                   # cliente SSH paramiko (dev: livre; prod: aprovação)
│   ├── requirements-ssh.txt        # dependências do venv de SSH (paramiko)
│   └── browser-check/              # QA visual do CTO — Playwright/Chromium headless (Sprint 5)
│       ├── check.mjs               # genérico: navega, screenshot, erros de console
│       ├── check-dashboard.mjs     # fluxo autenticado: início → dashboards → drill-down
│       ├── check-categorizacao.mjs # filtro + paginação + tempo real do fluxo de confirmar (pós-Sprint 6)
│       ├── check-sprint7.mjs       # filtro tipo/status, seleção em lote, descrição editável, Gestão de Contas — apelido, diálogo de sync (Sprint 7; achou bug real de overflow desktop)
│       ├── check-ativos.mjs        # grid de cards, criar ativo, drill-down fora do card, toggle despesa/receita, desktop+mobile screenshots (Sprint 8)
│       ├── check-sprint9.mjs       # cards Ativos (toggle)/Passivos (sem toggle)/Saldo (limite entre parênteses), funil Categoria>Tipo>Transação com ícone ao lado do valor + ordenação (incl. %), só leitura (Sprint 9; substitui check-sanfona.mjs, removido — testava o nível "meio de pagamento" eliminado; atualizado na revisão pós-entrega pro funil de 3 níveis)
│       └── check-sprint10.mjs      # nav sem Início/com Passivos/ordem final, tooltip do sparkline sem "v:" (mês/ano via hover), drill-down de Patrimônio (4 partes+total, link pros drill-downs existentes), presença dos controles de edição inline no Dashboard (sem disparar onChange — salvam sem confirmação), filtros novos de Categorização, CRUD+drill-down de Passivos (única mutação real, desfeita no final) (Sprint 10)
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions: pytest+ruff (backend), vitest+eslint+tsc (frontend) (Sprint 1)
└── .claude/                        # config local do Claude Code (agentes/hooks do projeto)
```

## O que ainda não existe

- Frontend de gestão de categorias/passivos (CRUD completo) — fora de escopo; `api/categories.ts` só cobre leitura (`GET`), suficiente para alimentar os selects da fila de revisão. CRUD de ativos (`createAsset`/`updateAsset`/`sellAsset`/`deleteAsset`) implementado na Sprint 8 via `AssetsPage.tsx`.
- Frontend de gestão de `categorization_rules` (editar/remover regra manualmente) — fora de escopo, só o import e o motor automático (ver PRD-004).
- UI de gestão de `category_groups.excluir_de_totais` — só setado via migration na Sprint 5; se surgir necessidade de mais grupos excluídos, é ajuste de dado, não de mecanismo (ver PRD-005).
- Override manual de `data_competencia` por transação — schema já suporta (coluna gravada, não computada), endpoint/UI adiados (ver PRD-005).
- Evolução de patrimônio/investimentos ao longo do tempo — segue sem série histórica no schema (precisaria de snapshot periódico, job novo); cards Ativos/Passivos com drilldown e card Saldo por conta entregues na Sprint 9 (E6 parte 3, épico fechado), mas sempre snapshot atual, nunca série histórica.
- Estado "pular/ignorar" na fila de Categorização; reconciliação de descrição quando a Pluggy reenvia uma transação já editada pelo usuário (`descricao_usuario` nunca é sobrescrito por sync, não há merge/conflito a resolver) — ambos fora de escopo desde o PRD-004/PRD-007.
- Endpoint/UI de override manual de débito/crédito por transação — decisão explícita do CEO na Sprint 10 (a correção do NuTag foi pontual, na lógica de agregação, não uma feature nova); motor de sugestão de 3 camadas para passivo (`suggest_liability` continua heurística substring, só `suggest_asset` foi elevado na Sprint 10); paridade de payload entre `sell` (ativo) e `settle` (passivo) — nenhum dos três tem pedido do CEO para mudar ainda.
- `CategoryCombobox` para `AssetSelectCell` (seletor de Ativo continua `<select>` nativo — lista pequena por usuário, não justifica o mesmo investimento); generalização do padrão de combobox para os outros `<select>` do app (filtros de período/tipo/status/ativo/categoria — listas curtas e fixas) — ambos adiados explicitamente no PRD-011 (Sprint 11), não comprometidos para sprint futura.
- Herança de regras entre usuários (memória compartilhada opt-in) — schema de `categorization_rules` já preparado (`origem` extensível), mecanismo de opt-in/onboarding fica para sprint futura.
- Camadas de token distintivo/IDF e léxico estático PT-BR no motor de categorização — adiadas até haver volume real suficiente para calibrar (ver PRD-004).
- Perfil de usuário, logout, multiusuário — E7.
- Sync agendado/webhooks Pluggy e UI dedicada de reconexão — fora do roadmap a menos que o CEO priorize (decisão fixa do projeto é sync manual).
- Tabelas pré-calculadas ou cache de agregação para dashboards — decisão fixa do projeto (leitura direta/agregação simples).
- VM de produção — adiada para sprint futura sob aprovação do CEO.

## Convenção

- Toda pasta nova de código de produto (`backend/`, `frontend/`) deve ser refletida aqui na sprint que a criar.
- PRDs numerados sequencialmente (`PRD-001-...`), ADRs idem (`ADR-NNN-...`), sprints idem (`SPRINT-NNN-...`).
