# Estrutura de diretórios

Atualizado a cada mudança estrutural. Estado atual (fim da Sprint 18 — edição manual de data em Categorizar, investigação de Saldo Acumulado, guia dos cards):

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
│   │   ├── PRD-010-revisao-ux-e-passivos.md  # Sprint 10 — fix NuTag/cartão, tooltip, breakdown de Patrimônio, edição inline, Gestão de Passivos, filtros de Categorização (cross-epic)
│   │   ├── PRD-011-categorizacao-tabela-moderna.md  # Sprint 11 — CategoryCombobox, badge de status, polish de linha (E3, polish)
│   │   ├── PRD-012-natureza-classificacao-dashboard.md  # Sprint 12 — natureza (fixa/variável/eventual) + dashboard de visibilidade (E9, novo)
│   │   ├── PRD-013-natureza-funil-e-redesign-tabelas.md  # Sprint 13 — rótulo "Eventual", funil de 4 níveis, redesign de tabelas/botões (E9, cross-epic)
│   │   ├── PRD-014-projecao-custos-hipoteticas.md  # Sprint 14 — projeção de custos futuros + simulação de hipotéticas (E9, fecha o épico)
│   │   ├── PRD-015-configuracoes-competencia-salario-saldo-acumulado.md  # Sprint 15 — tela Configurações, competência de salário, saldo inicial/Saldo Acumulado (E7, fecha o épico)
│   │   ├── PRD-016-regime-competencia-caixa-patrimonio.md  # Sprint 16 — toggle Competência/Caixa, data_caixa, Patrimônio via Saldo Acumulado (cross-epic, sem épico prévio)
│   │   ├── PRD-017-filtro-conta-validacao-extrato.md  # Sprint 17 — filtro de conta em Categorizar + reconciliação contra extrato real (cross-epic, sem épico prévio)
│   │   └── PRD-018-edicao-data-saldo-acumulado-guia-cards.md  # Sprint 18 — edição manual de data em Categorizar, investigação de Saldo Acumulado, guia dos cards (cross-epic, sem épico prévio)
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
│   │   ├── SPRINT-010-revisao-ux-e-passivos-report.md  # Relatório Sprint 10 (2026-08-15)
│   │   ├── SPRINT-011-categorizacao-tabela-moderna-plan.md  # Plano Sprint 11 (2026-08-15)
│   │   ├── SPRINT-011-categorizacao-tabela-moderna-report.md  # Relatório Sprint 11 (2026-08-15)
│   │   ├── SPRINT-012-natureza-classificacao-dashboard-plan.md  # Plano Sprint 12 (2026-08-15)
│   │   ├── SPRINT-012-natureza-classificacao-dashboard-report.md  # Relatório Sprint 12 (2026-08-16)
│   │   ├── SPRINT-013-natureza-funil-e-redesign-tabelas-plan.md  # Plano Sprint 13 (2026-08-16)
│   │   ├── SPRINT-013-natureza-funil-e-redesign-tabelas-report.md  # Relatório Sprint 13 (2026-08-16)
│   │   ├── SPRINT-014-projecao-custos-hipoteticas-plan.md  # Plano Sprint 14 (2026-08-16)
│   │   ├── SPRINT-014-projecao-custos-hipoteticas-report.md  # Relatório Sprint 14 (2026-08-16)
│   │   ├── SPRINT-015-configuracoes-competencia-salario-plan.md  # Plano Sprint 15 (2026-08-16)
│   │   ├── SPRINT-015-configuracoes-competencia-salario-report.md  # Relatório Sprint 15 (2026-08-16)
│   │   ├── SPRINT-016-regime-competencia-caixa-plan.md  # Plano Sprint 16 (2026-08-17)
│   │   ├── SPRINT-016-regime-competencia-caixa-report.md  # Relatório Sprint 16 (2026-08-17)
│   │   ├── SPRINT-017-filtro-conta-validacao-extrato-plan.md  # Plano Sprint 17 (2026-08-17)
│   │   ├── SPRINT-017-filtro-conta-validacao-extrato-report.md  # Relatório Sprint 17 (2026-08-17)
│   │   ├── SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md  # Plano Sprint 18 (2026-08-17)
│   │   └── SPRINT-018-edicao-data-saldo-acumulado-guia-cards-report.md  # Relatório Sprint 18 (2026-08-17)
│   ├── roadmap.md                  # épicos + sprints
│   ├── directory-structure.md      # este arquivo — atualizado em Sprint 9
│   ├── infra/
│   │   └── ssh-workflow.md         # procedimento SSH obrigatório via venv (atualizado em Sprint 1)
│   ├── migration/
│   │   └── legacy-data.md          # formato de import de categorias + memória do v1
│   └── dashboards-guia-cards.md    # guia não técnico dos cards do Dashboard + efeito do toggle Competência/Caixa (Sprint 18)
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
│   │   │   ├── user.py             # modelo User (google_sub, email, name, created_at, updated_at); +salario_competencia_cutoff_dia (Sprint 15)
│   │   │   ├── category.py         # CategoryGroup (+excluir_de_totais na Sprint 5), Subcategory, enum Natureza, SEM_CATEGORIA_ID (Sprint 2)
│   │   │   ├── asset.py            # Asset, enums AssetTipo/AssetStatus (Sprint 2)
│   │   │   ├── liability.py        # Liability, enums LiabilityTipo/LiabilityStatus (Sprint 2)
│   │   │   ├── pluggy.py           # PluggyItem/Account/Transaction + enums (Sprint 3; +9 colunas de categorização/ativo na Sprint 4; +apelido/sync_enabled em Account, +descricao_usuario/sugerida/origem_id em Transaction na Sprint 7; +liability_id/liability_sugerido_id/liability_sugestao_confianca, +@property account_tipo na Sprint 9; +limite_credito/fatura_vencimento em Account na revisão pós-entrega da Sprint 9; +saldo_inicial em Account na Sprint 15; +data_editada_manualmente em Transaction — trava contra sobrescrita em resync (Sprint 18))
│   │   │   └── categorization.py   # CategorizationRule — memória de mapeamento padrão→subcategoria (Sprint 4); AssetCategorizationRule — mirror pra ativo, trocando subcategory_id por asset_id (Sprint 10)
│   │   ├── schemas/
│   │   │   ├── user.py             # UserOut, UserSettingsIn +cutoff_dia (Sprint 15)
│   │   │   ├── category.py         # CategoryGroupIn/Out, SubcategoryIn/Out (Sprint 2)
│   │   │   ├── asset.py            # AssetIn/Out, AssetSellIn (Sprint 2)
│   │   │   ├── liability.py        # LiabilityIn/Out (Sprint 2)
│   │   │   ├── pluggy.py           # ConnectToken*, PluggyItem/Account/TransactionOut (Sprint 3); PluggyAccountUpdateIn, SyncItemsIn/Out (Sprint 7); PluggyTransactionOut +account_tipo (Sprint 9); PluggyTransactionOut +descricao_usuario/descricao_sugerida/subcategoria_sugerida_id/asset_id/asset_sugerido_id — alimenta a edição inline no drill-down do Dashboard/Ativos/Passivos (Sprint 10); PluggyAccountOut +saldo_inicial, PluggyAccountSaldoInicialIn, SalarioAjusteDezembroIn/Out (Sprint 15); PluggyTransactionOut +data_editada_manualmente (Sprint 18)
│   │   │   ├── categorization.py   # TransactionOut/TransactionsPageOut, CategoryIn, AssetAssociationIn, BulkConfirmIn/Out, DescriptionUpdateIn/Out (Sprint 4, renomeado/estendido na Sprint 7); +liability_id/liability_sugerido_id/liability_sugestao_confianca, LiabilityAssociationIn (Sprint 9); TransactionOut +data_editada_manualmente, DateUpdateIn novo (Sprint 18)
│   │   │   └── dashboards.py       # SummaryOut, CategoriaTotalOut/MeioPagamentoTotalOut+percentual (Sprint 5), TendenciaMesOut/TendenciaCategoriaOut (Sprint 6); AtivoTotalOut/TendenciaAtivoOut (Sprint 8); SummaryOut +ativos/passivos, PassivoTotalOut/TendenciaPassivoOut/SaldoContaOut (Sprint 9); SaldoContaOut +limite_credito (revisão pós-entrega da Sprint 9); PatrimonioBreakdownOut — ativos/passivos/saldo_contas/saldo_cartoes/total (Sprint 10); NaturezaTotalOut/TendenciaNaturezaOut (Sprint 12); PontoProjecaoOut (Sprint 14); EvolucaoSaldoContaOut (Sprint 15)
│   │   ├── auth/
│   │   │   ├── jwt.py              # geração/validação JWT via PyJWT
│   │   │   ├── google.py           # integração Authlib com Google OAuth
│   │   │   ├── service.py          # lógica upsert de usuário; update_settings (cutoff_dia) (Sprint 15)
│   │   │   ├── router.py           # rotas /auth/google/login, /auth/google/callback, /auth/me; +POST /logout, PUT /me/settings (Sprint 15)
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
│   │   │   ├── service.py          # register_item, sync_item, list_items/accounts/transactions; update_account, sync_items (Sprint 7); filtro liability_id, joinedload(account) em list_transactions p/ account_tipo sem N+1 (Sprint 9); _upsert_account persiste limite_credito/fatura_vencimento de creditData (revisão pós-entrega da Sprint 9); update_saldo_inicial, upsert_salario_ajuste_dez_2025/get_salario_ajuste_dez_2025 (transação sentinela) (Sprint 15); _parse_date converte UTC→America/Sao_Paulo antes de .date() (bug de fuso corrigido); _upsert_transaction/upsert_salario_ajuste_dez_2025 gravam data_competencia via competencia_padrao + data_caixa via caixa (Sprint 16); _upsert_transaction pula data/data_competencia/data_caixa quando data_editada_manualmente=True (Sprint 18)
│   │   │   └── router.py           # rotas /pluggy/*; PUT /pluggy/accounts/{id}, POST /pluggy/sync (Sprint 7); filtro liability_id (Sprint 9); PUT /accounts/{id}/saldo-inicial, GET/PUT /ajuste-salario-dezembro (Sprint 15)
│   │   ├── categorization/         # motor de categorização por regras+memória, sem LLM (Sprint 4)
│   │   │   ├── normalize.py        # normalize_description — NFKD/ASCII/minúsculas, prefixo de canal, números isolados
│   │   │   ├── competencia.py      # shift_to_next_month/competencia_salario — regra de competência de salário por dia de corte (Sprint 15, novo); competencia_padrao/caixa — cartão de crédito sempre desloca 1 mês (competência) + mais 1 (caixa), sem dia de corte (Sprint 16)
│   │   │   ├── engine.py           # suggest_category (regra > histórico exato > similaridade ≥0.86), suggest_asset; suggest_liability (mesma heurística de substring, Sprint 9); suggest_asset reescrito pro mesmo padrão de 3 camadas de suggest_category (regra > histórico exato > similaridade ≥0.86), via asset_categorization_rules — antes era só substring (Sprint 10)
│   │   │   ├── service.py          # list_transactions (status/tipo/ano/mes/paginado, renomeado de list_pending_transactions na Sprint 7), set_category, bulk_confirm, set_transaction_asset, update_description/confirm_description_suggestion/dismiss_description_suggestion (Sprint 7); set_transaction_liability, sugestão de passivo em _apply_suggestions (Sprint 9); list_transactions +has_asset/group_id (Sprint 10); salario_subcategory_id + recomputação de data_competencia em set_category/bulk_confirm (Sprint 15); _recompute_data_competencia — cartão tem prioridade sobre Salário, também recomputa data_caixa (Sprint 16); update_data novo — seta data+data_editada_manualmente, reaproveita _recompute_data_competencia, rejeita data futura (Sprint 18)
│   │   │   └── router.py           # rotas /categorization/transactions/* (renomeadas de /pending/* na Sprint 7); PUT .../liability (Sprint 9); GET /transactions +has_asset/group_id (Sprint 10); PUT .../data novo (Sprint 18)
│   │   └── dashboards/             # agregação para dashboards — sem LLM, sem cache (Sprint 5)
│   │       ├── service.py          # get_summary, get_por_categoria/get_por_meio_pagamento (+percentual), get_tendencia/get_tendencia_por_categoria (Sprint 6); get_por_ativo/get_tendencia_por_ativo (Sprint 8); _calcula_patrimonio refatorado com helper _ativos_e_passivos (reuso), get_summary +ativos/passivos, get_por_passivo/get_tendencia_por_passivo (mirror de ativo, sempre débito), get_saldo_por_conta (snapshot atual, sem período) (Sprint 9); get_saldo_por_conta de cartão de crédito passa a somar a fatura atual (_fatura_atual/_subtract_month, janela vencimento anterior→próximo) em vez do saldo bruto (revisão pós-entrega da Sprint 9); _base_query exclui cartao_credito+credito da receita (achado NuTag — pagamento de fatura/estorno, nunca receita real); _calcula_patrimonio refatorado com helper _patrimonio_breakdown (reuso), get_patrimonio_breakdown novo (Sprint 10); get_por_natureza/get_tendencia_por_natureza — agrupam por func.coalesce(Subcategory.natureza, eventual), sempre 3 buckets zero-preenchidos (Sprint 12); _future_month_range (inverso de _month_range) + get_projecao — média dos últimos janela_media meses de subcategorias fixa/variavel, repetida em cada um dos meses_futuros seguintes (Sprint 14); _receita_despesa_por_periodo extraído de get_tendencia (reuso), get_evolucao_saldo_por_conta (auditoria por conta, data real) e get_saldo_acumulado (agregado por competência, âncora saldo_inicial−sentinela de salário) novos (Sprint 15); parâmetro regime (competencia/caixa) via _competencia_column threaded em get_summary/get_por_categoria/get_tendencia(_por_categoria)/get_por_ativo/get_tendencia_por_ativo/get_por_passivo/get_tendencia_por_passivo/get_saldo_acumulado/get_patrimonio_breakdown; _base_query +excluir_investimento; PatrimonioBreakdown redesenhado (saldo_liquido_acumulado + saldo_investimentos via get_saldo_acumulado, _saldo_liquido_fallback pra conta sem saldo_inicial) (Sprint 16); _base_query ganha parâmetro regime — sob caixa, exclui toda transação de conta de cartão de crédito (deslocamento modelado compra+1/2 meses deixa de valer) e deixa de excluir a subcategoria "Pagamento de Fatura" (normalmente dentro de "Transferência interna"), que passa a contar como despesa normal na data real; _pagamento_fatura_subcategory_id novo (mesmo padrão de salario_subcategory_id); regime threaded em todo caller que já suportava regime (Sprint 18, bug real achado na investigação de Saldo Acumulado — cartão sob caixa dobrava a mesma compra entre o modelo e o pagamento real da fatura)
│   │       └── router.py           # rotas /dashboards/* (+tendencia, por-categoria/tendencia na Sprint 6; +por-ativo/tendencia na Sprint 8; +por-passivo/tendencia, saldo-por-conta na Sprint 9; +patrimonio/breakdown na Sprint 10; +por-natureza(/tendencia) na Sprint 12; +projecao na Sprint 14; +evolucao-saldo-por-conta, saldo-acumulado na Sprint 15; query param regime nos endpoints agregados na Sprint 16; sem mudança de rota na Sprint 18 — fix de regime caixa é só em service.py)
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
│   │   ├── test_auth_endpoints.py  # testes endpoints OAuth e /auth/me; +logout, update_settings/cutoff_dia (Sprint 15)
│   │   ├── test_category_service.py     # nome único (grupo/subcategoria), natureza (Sprint 2)
│   │   ├── test_category_endpoints.py   # CRUD, 401/404/400 (Sprint 2)
│   │   ├── test_asset_service.py        # sell idempotente (Sprint 2)
│   │   ├── test_asset_endpoints.py      # CRUD, isolamento user_id, sell (Sprint 2)
│   │   ├── test_liability_service.py    # settle idempotente (Sprint 2); delete_liability desassocia transações vinculadas (Sprint 9)
│   │   ├── test_liability_endpoints.py  # CRUD, isolamento user_id, settle (Sprint 2)
│   │   ├── test_import_legacy_categories.py  # merge de duplicata, log de conflito (Sprint 2)
│   │   ├── test_pluggy_client.py        # cache/refetch de API key, paginação, erro propagado (Sprint 3)
│   │   ├── test_pluggy_service.py       # upsert idempotente, cutoff_date, status não-sincronizável (Sprint 3); apelido preservado em resync, sync_enabled pulando conta, update_account/sync_items (Sprint 7); creditData persistido/ausente (revisão pós-entrega da Sprint 9); update_saldo_inicial, upsert_salario_ajuste_dez_2025 (idempotente, delete, isolamento), regressão de agregação sem código especial (Sprint 15); _parse_date (fronteira BRT, fixture "BRASA E DRINKS"), sync gravando competência+caixa de cartão (Sprint 16)
│   │   ├── test_pluggy_endpoints.py     # 401/404/400, isolamento user_id (Sprint 3); PUT /accounts/{id}, POST /sync (Sprint 7); filtro asset_id (Sprint 8); filtro liability_id, account_tipo na resposta (Sprint 9); saldo-inicial, ajuste-salario-dezembro (Sprint 15)
│   │   ├── test_categorization_normalize.py    # acentos, prefixos de canal, token numérico vs. alfanumérico (Sprint 4)
│   │   ├── test_categorization_engine.py       # precedência de camadas, fronteira 0.86, isolamento por usuário (Sprint 4); suggest_liability — substring, isolamento, sem match (Sprint 9); suggest_asset mirror completo dos testes de categoria (regra/histórico exato/similaridade/isolamento) (Sprint 10)
│   │   ├── test_categorization_service.py      # invariante "nunca auto-confirma", reedição, 404 cross-user (Sprint 4); paginação, filtro ano/mes (pós-Sprint 6); filtro status/tipo, bulk_confirm parcial, propagação de descrição (Sprint 7); set_transaction_liability — sets/clears, 404 cross-user (Sprint 9); has_asset/group_id isolados e combinados (Sprint 10); shift pra Salário/reset ao sair, cutoff por usuário (set_category/bulk_confirm) (Sprint 15); cartão de crédito ignora cutoff de Salário, data_caixa (Sprint 16)
│   │   ├── test_categorization_endpoints.py    # 401, isolamento, confirmar/editar via API (Sprint 4); paginação, filtro ano/mes (pós-Sprint 6); rotas /transactions/*, bulk-confirm, descrição (Sprint 7); PUT .../liability (Sprint 9); has_asset/group_id via API (Sprint 10)
│   │   ├── test_import_legacy_categorization_rules.py  # conflito, idempotência, categoria não resolvida, abort sem usuário (Sprint 4)
│   │   ├── test_dashboards_service.py   # período vazio, só-transferência, misto, sinal do cartão, borda de mês (Sprint 5); tendência terminando no mês filtrado, percentual somando 100%/denominador zero (Sprint 6); get_por_ativo/get_tendencia_por_ativo (Sprint 8); summary ativos/passivos batendo com patrimonio, get_por_passivo/get_tendencia_por_passivo (nunca soma crédito), get_saldo_por_conta (apelido→nome, isolamento) (Sprint 9); get_saldo_por_conta de cartão somando a fatura da janela/caindo pro saldo bruto sem fatura_vencimento, _subtract_month (rollover de ano, overflow de dia) (revisão pós-entrega da Sprint 9); cartao_credito+credito excluído da receita (achado NuTag), corrente+credito continua contando, get_patrimonio_breakdown batendo com summary.patrimonio (Sprint 10); get_por_natureza/get_tendencia_por_natureza — 3 buckets sempre, fallback null→eventual (Sprint 12); _future_month_range, get_projecao — média sobre a janela, exclusão eventual/null/cartao_credito+credito/excluir_de_totais, valor constante repetido, isolamento (Sprint 14); get_evolucao_saldo_por_conta (data real, conta sem saldo_inicial excluída), get_saldo_acumulado (âncora com/sem sentinela, acumulação, isolamento) (Sprint 15); regime="caixa" em cada função agregada, get_saldo_acumulado excluindo investimento, Patrimônio — saldo_investimentos separado, fallback de conta sem saldo_inicial (sinal por tipo), regime="caixa" deslocando a acumulação (monkeypatch de date.today) (Sprint 16); regime caixa excluindo cartão de crédito inteiramente e contando "Pagamento de Fatura" como despesa normal na data real (sem dobrar com o modelo de compra+1/2 meses), `_transacao_com_caixa_deslocado` (renomeado de `_cartao_com_competencia_deslocada` — passa a usar conta corrente, já que cartão não entra mais em caixa) (Sprint 18, achado real durante a investigação de Saldo Acumulado)
│   │   ├── test_dashboards_endpoints.py # 401, isolamento entre usuários nos 5 endpoints (Sprint 5+6); por-ativo/tendencia (Sprint 8); por-passivo/tendencia, saldo-por-conta (Sprint 9); patrimonio/breakdown (Sprint 10); por-natureza(/tendencia) (Sprint 12); projecao — 401, filtros, isolamento (Sprint 14); evolucao-saldo-por-conta, saldo-acumulado — 401, isolamento (Sprint 15)
│   │   ├── test_categorization_competencia.py  # shift_to_next_month/competencia_salario — fronteira do corte, rollover, clamp de dia (Sprint 15, novo); competencia_padrao/caixa — cartão incondicional, demais tipos sem defasagem (Sprint 16)
│   │   ├── test_migration_0013_data_caixa.py   # _backfill da migration 0013 carregada via importlib contra o schema de teste — cartão desloca, demais mantêm, fallback pra data quando competência ausente, isolamento por transação (Sprint 16, novo)
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
│           ├── 0011_create_asset_categorization_rules.py  # asset_categorization_rules, mirror de categorization_rules trocando subcategory_id por asset_id (Sprint 10)
│           ├── 0012_configuracoes_e_competencia_salario.py  # users.salario_competencia_cutoff_dia, pluggy_accounts.saldo_inicial, backfill de data_competencia p/ transações já-Salário (Sprint 15)
│           ├── 0013_data_caixa_e_competencia_cartao.py  # pluggy_transactions.data_caixa; backfill: cartão sempre desloca data_competencia +1 mês, data_caixa populado p/ toda transação (_backfill extraída como função plana, testável fora do contexto op do alembic) (Sprint 16)
│           └── 0014_data_editada_manualmente.py  # pluggy_transactions.data_editada_manualmente (Boolean, not null, default False) — sem backfill (Sprint 18)
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
│   │   │   ├── transactionEdit.ts  # EditableTransaction (forma mínima compartilhada entre CategorizedTransaction/PluggyTransaction) + descricaoExibida (Sprint 10); +subcategoryLabel, extraída de TransactionEditCells/CategorizationReviewPage (Sprint 11); EditableTransaction +data/data_editada_manualmente (Sprint 18)
│   │   │   ├── naturezaLabels.ts   # única fonte dos 3 rótulos de natureza + var CSS de cor por natureza (Sprint 12; eventual→"Custo eventual" renomeado pra "Eventual" na Sprint 13, cosmético)
│   │   │   ├── categoriaGrouping.ts  # groupCategoriaTotalsByGrupo — aritmética pura de agrupamento por group_id (soma/percentual/ordenação), extraída de GrupoAccordion (DashboardsPage) pra reuso em NaturezaPage (Sprint 13)
│   │   │   └── projecao.ts         # tipo Hipotetica + applyHipoteticas(pontos, hipoteticas) — lógica pura, aplica hipotética única (só o mês-alvo) ou mensal (todos os meses do horizonte) sobre os pontos de PontoProjecao; estado só local, nunca trafega pro backend (Sprint 14)
│   │   ├── api/
│   │   │   ├── client.ts           # fetch wrapper com credentials:"include"
│   │   │   ├── auth.ts             # chamadas /auth/me; +CurrentUser.salario_competencia_cutoff_dia, logout, updateUserSettings (Sprint 15)
│   │   │   ├── pluggy.ts           # chamadas /pluggy/* (Sprint 3); apelido/sync_enabled em PluggyAccount, updatePluggyAccount, syncPluggyItems (Sprint 7); liabilityId em filtros, account_tipo em PluggyTransaction (Sprint 9); PluggyAccount +saldo_inicial, updatePluggyAccountSaldoInicial, fetch/updateSalarioAjusteDezembro (Sprint 15); PluggyTransaction +data_editada_manualmente (Sprint 18)
│   │   │   ├── categories.ts       # chamadas /category-groups, /subcategories (Sprint 4, pré-requisito antes inexistente); +updateSubcategory (PUT /subcategories/{id}, primeiro PUT desse recurso no frontend — Sprint 12, usado só pra editar natureza)
│   │   │   ├── assets.ts           # chamadas /assets (Sprint 4, pré-requisito antes inexistente)
│   │   │   ├── categorization.ts   # chamadas /categorization/transactions/* — renomeado de /pending/*, +status/tipo, bulkConfirm, updateDescription/confirm/dismissDescriptionSuggestion (Sprint 7, era Sprint 4); +liability_id/liability_sugerido_id/liability_sugestao_confianca, setTransactionLiability (Sprint 9); TransactionsFilter +hasAsset/groupId (Sprint 10); CategorizedTransaction +data_editada_manualmente, updateData novo (Sprint 18)
│   │   │   ├── dashboards.ts       # chamadas /dashboards/*, SEM_CATEGORIA_ID (Sprint 5); +tendencia/por-categoria/tendencia, +percentual (Sprint 6); AtivoTotal/TendenciaAtivo, fetchDashboardPorAtivo(Tendencia) (Sprint 8); DashboardSummary +ativos/passivos, PassivoTotal/TendenciaPassivo/SaldoConta, fetchDashboardPorPassivo(Tendencia)/fetchSaldoPorConta (Sprint 9); PatrimonioBreakdown, fetchPatrimonioBreakdown (Sprint 10); NaturezaTotal/TendenciaNatureza, fetchDashboardPorNatureza(Tendencia) (Sprint 12); PontoProjecao, fetchDashboardProjecao (Sprint 14); EvolucaoSaldoConta, fetchEvolucaoSaldoPorConta/fetchSaldoAcumulado (Sprint 15); tipo Regime ("competencia"|"caixa") + RegimeFilter, threaded em fetchDashboardSummary/PorCategoria(Tendencia)/PorAtivo(Tendencia)/PorPassivo(Tendencia)/SaldoAcumulado/PatrimonioBreakdown; PatrimonioBreakdown troca saldo_contas/saldo_cartoes por saldo_liquido_acumulado/saldo_investimentos (Sprint 16)
│   │   │   └── liabilities.ts      # chamadas /liabilities/* — fetch/create/update/settle/deleteLiability, mirror de assets.ts (Sprint 10, backend já existia desde a Sprint 2)
│   │   ├── pluggy/
│   │   │   └── loadPluggyConnect.ts  # injeta o script do widget Pluggy Connect sob demanda (Sprint 3)
│   │   ├── components/
│   │   │   ├── PeriodFilter.tsx      # seletor ano/mês reutilizável (Sprint 8, extraído de DashboardsPage/CategorizationReviewPage)
│   │   │   ├── CardSparkline.tsx     # sparkline de card (Sprint 9, extraído de DashboardsPage/AssetsPage — duplicavam); ganha tooltip (revisão pós-entrega); prop values→pontos ({ano,mes,total}), tooltip mostra MM/AAAA em vez de "v:" (Sprint 10)
│   │   │   ├── TrendChart.tsx        # gráfico de tendência com tooltip + eixo X reduzido (Sprint 9, extraído de AssetTrendChart em AssetsPage); eixo X rotulado só nos meses de início de trimestre (revisão pós-entrega)
│   │   │   ├── AccountTipoIcon.tsx   # ícone SVG inline por tipo de conta, decorativo (Sprint 9, substitui o nível "meio de pagamento" do funil)
│   │   │   ├── TransactionTipoIcon.tsx  # ícone SVG inline débito/crédito, decorativo, mesmo padrão de AccountTipoIcon — indicador visual de entrada/saída na tela de Categorização (Sprint 10, achado NuTag)
│   │   │   ├── TransactionEditCells.tsx  # DescriptionCell/CategorySelectCell/AssetSelectCell — extraídos de CategorizationReviewPage, reaproveitados em TransacoesPanel (Dashboard) e nos drill-downs de Ativos/Passivos (Sprint 10); CategorySelectCell passa a usar CategoryCombobox por dentro (Sprint 11); DateCell novo — mesmo padrão de DescriptionCell, input type=date, indicador visual (✎) quando data_editada_manualmente (Sprint 18)
│   │   │   ├── CategoryCombobox.tsx  # combobox buscável/agrupado por categoria, substitui o <select> nativo de 51 subcategorias em CategorySelectCell e CategorizationReviewPage; popup via portal+position:fixed (escapa do overflow-x:auto de .dash-table-wrap); ARIA combobox+listbox completo (Sprint 11, sem precedente no design system)
│   │   │   ├── StatusIcon.tsx        # ícone SVG inline de status (Pendente=relógio/Confirmada=check), único conteúdo da célula — role="img"+aria-label em vez de aria-hidden, forma (não só cor) distingue os dois estados; substitui o badge de texto inicial da Sprint 11 (revisão pós-implementação, mesmo dia — coluna mais estreita)
│   │   │   ├── TransactionsTable.tsx  # tabela de transação unificada (Sprint 13) — substitui TransacoesPanel (DashboardsPage), o <table> hand-rolled de AssetDrilldown e o de LiabilityDrilldown; flags showCategoria/showAtivo (default true), colgroup .txn-table
│   │   │   ├── SortableHeader.tsx    # cabeçalho de coluna ordenável, extraído de TransacoesPanel e generalizado (genérico sobre a união de chaves de sort de cada tabela); reaproveitado por TransactionsTable/CategorizationReviewPage/NaturezaPage (Sprint 13)
│   │   │   ├── ProjectionChart.tsx   # gráfico de Projeção — combina histórico real (linha sólida, GET /dashboards/tendencia) e projeção (linha tracejada via strokeDasharray, GET /dashboards/projecao) nas 3 séries receita/despesa/saldo; mês-base entra em ambos os campos Real/Projetada no dado do gráfico pra as duas linhas aparecerem conectadas, sem gap — primeiro gráfico do projeto a combinar 2 fontes na mesma série visual (Sprint 14)
│   │   │   └── RegimeToggle.tsx      # toggle Competência (default)/Caixa, mesmo padrão aria-pressed do toggle despesa/receita de AssetsPage (Sprint 16, novo)
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
│   │   │   ├── useUpdateDate.ts          # mutation PUT .../data — mesmo padrão de useUpdateDescription (Sprint 18, novo)
│   │   │   ├── invalidateDashboardQueries.ts  # invalidateAfterTransactionEdit — invalida categorizationTransactions/pluggyTransactions + todo query "dashboard*"/"saldoPorConta" por predicate; usado pelas 4 mutations de edição de transação (Sprint 10); predicate extraído em invalidateAllDashboardQueries, reaproveitado por invalidateAfterSubcategoryEdit (Sprint 12)
│   │   │   ├── useConfirmDescriptionSuggestion.ts  # mutation POST .../description/confirm (Sprint 7)
│   │   │   ├── useDismissDescriptionSuggestion.ts  # mutation POST .../description/dismiss (Sprint 7)
│   │   │   ├── useDashboardSummary.ts        # GET /dashboards/summary (Sprint 5); +regime na queryKey (Sprint 16)
│   │   │   ├── useDashboardByCategoria.ts    # GET /dashboards/por-categoria (Sprint 5); +regime na queryKey (Sprint 16)
│   │   │   ├── useDashboardTendencia.ts      # GET /dashboards/tendencia (Sprint 6); +regime na queryKey (Sprint 16)
│   │   │   ├── useDashboardCategoriaTendencia.ts  # GET /dashboards/por-categoria/tendencia, enabled só com categoria expandida (Sprint 6); +regime na queryKey (Sprint 16)
│   │   │   ├── useCreateAsset.ts             # mutation POST /assets (Sprint 8)
│   │   │   ├── useUpdateAsset.ts             # mutation PUT /assets/{id} (Sprint 8)
│   │   │   ├── useSellAsset.ts               # mutation POST /assets/{id}/sell (Sprint 8)
│   │   │   ├── useDeleteAsset.ts             # mutation DELETE /assets/{id} (Sprint 8)
│   │   │   ├── useAssetGastos.ts             # GET /dashboards/por-ativo, com período+tipo (Sprint 8, reaproveitado pelo drill-down de Ativos do Dashboard na Sprint 9); +regime na queryKey (Sprint 16)
│   │   │   ├── useAssetGastosTendencia.ts    # GET /dashboards/por-ativo/tendencia, série por ativo (Sprint 8); +regime na queryKey (Sprint 16)
│   │   │   ├── useLiabilityGastos.ts         # GET /dashboards/por-passivo, com período (Sprint 9); +regime na queryKey (Sprint 16)
│   │   │   ├── useLiabilityGastosTendencia.ts  # GET /dashboards/por-passivo/tendencia, série por passivo (Sprint 9); +regime na queryKey (Sprint 16)
│   │   │   ├── useSaldoPorConta.ts           # GET /dashboards/saldo-por-conta, sem parâmetros (Sprint 9)
│   │   │   ├── useSetTransactionLiability.ts # mutation PUT /categorization/transactions/{id}/liability (Sprint 9); invalida também dashboard/pluggyTransactions (Sprint 10)
│   │   │   ├── useTableSort.ts               # hook genérico de ordenação por coluna (Sprint 9, sem precedente — novo)
│   │   │   ├── usePatrimonioBreakdown.ts     # GET /dashboards/patrimonio/breakdown (Sprint 10); parâmetro regime (default "competencia"), na queryKey (Sprint 16)
│   │   │   ├── useLiabilities.ts             # lista liabilities do usuário (Sprint 10, mirror de useAssets)
│   │   │   ├── useCreateLiability.ts         # mutation POST /liabilities (Sprint 10)
│   │   │   ├── useUpdateLiability.ts         # mutation PUT /liabilities/{id} (Sprint 10)
│   │   │   ├── useSettleLiability.ts         # mutation POST /liabilities/{id}/settle (Sprint 10)
│   │   │   ├── useDeleteLiability.ts         # mutation DELETE /liabilities/{id} — invalida liabilities/pluggyTransactions/dashboardPorPassivo*/categorizationTransactions (Sprint 10, mirror de useDeleteAsset)
│   │   │   ├── useDashboardByNatureza.ts     # GET /dashboards/por-natureza (Sprint 12)
│   │   │   ├── useDashboardNaturezaTendencia.ts  # GET /dashboards/por-natureza/tendencia (Sprint 12)
│   │   │   ├── useUpdateSubcategoryNatureza.ts   # mutation PUT /subcategories/{id} (só natureza) — invalida subcategories + dashboard* via invalidateAfterSubcategoryEdit (Sprint 12)
│   │   │   ├── useDashboardProjecao.ts       # GET /dashboards/projecao, com ano/mes/mesesFuturos (Sprint 14)
│   │   │   ├── useLogout.ts                  # mutation POST /auth/logout, invalida currentUser (Sprint 15)
│   │   │   ├── useUpdateUserSettings.ts      # mutation PUT /auth/me/settings (cutoff_dia) (Sprint 15)
│   │   │   ├── useUpdateSaldoInicial.ts      # mutation PUT /pluggy/accounts/{id}/saldo-inicial (Sprint 15)
│   │   │   ├── useSalarioAjusteDezembro.ts   # GET /pluggy/ajuste-salario-dezembro (Sprint 15)
│   │   │   ├── useUpdateSalarioAjusteDezembro.ts  # mutation PUT /pluggy/ajuste-salario-dezembro (Sprint 15)
│   │   │   ├── useEvolucaoSaldoPorConta.ts   # GET /dashboards/evolucao-saldo-por-conta (Sprint 15)
│   │   │   └── useDashboardSaldoAcumulado.ts # GET /dashboards/saldo-acumulado, pede periodoHistorico+1 (ponto extra pro card "Saldo Anterior") (Sprint 15); parâmetro regime, na queryKey (Sprint 16)
│   │   └── pages/
│   │       ├── LoginPage.tsx       # botão "Entrar com Google" (link para /auth/google/login)
│   │       ├── ProtectedPage.tsx   # nome/e-mail do usuário + abas Início/Dashboards/Categorizar/Gestão de contas/Ativos (Sprint 5; aba Transações removida e Conectar conta renomeada na Sprint 7; aba Ativos na Sprint 8); aba Início removida (Dashboards vira a aba inicial), aba Passivos nova, Gestão de Contas move pro final — ordem: Dashboards/Categorizar/Ativos/Passivos/Gestão de Contas (Sprint 10); aba Natureza nova, entre Passivos e Gestão de Contas (Sprint 12); aba Projeção nova, entre Natureza e Gestão de Contas (Sprint 14); aba "Gestão de contas" vira "Configurações" (renderiza ConfiguracoesPage), última do menu (Sprint 15)
│   │       ├── DashboardsPage.tsx  # filtro ano/mês, cards com sparkline, funil de drill-down em sanfona + Recharts (Sprint 5, sanfona/tendência/percentual na Sprint 6); cards Ativos/Passivos/Saldo clicáveis, funil de categoria expande direto pra transações (nível "meio de pagamento" removido, vira AccountTipoIcon por linha), tabelas ordenáveis por coluna (Sprint 9); funil de Despesa/Receita ganha um nível — Categoria (`GrupoAccordion`) > Tipo (`SubcategoriaAccordion`) > Transação — com cores via `categoryColors.ts`, ícone dentro da célula Valor, coluna % ordenável (revisão pós-entrega da Sprint 9); card Patrimônio clicável com `PatrimonioBreakdownPanel` (4 partes + total, link pros drill-downs de Ativos/Passivos/Saldo); `TransacoesPanel` ganha colunas Categoria/Ativo editáveis inline via `TransactionEditCells` (Sprint 10); `TransacoesPanel` exportada (antes privada) e reaproveitada como nível "transação" do funil de `NaturezaPage` (Sprint 12); `TransacoesPanel`/`SortableHeader` extraídos pra `components/TransactionsTable.tsx`/`SortableHeader.tsx` (unificação da tabela de transação), `Row` exportada pra reuso em `NaturezaPage`, `PatrimonioBreakdownPanel` ganha colgroup (Sprint 13); cards "Saldo Acumulado" (drill-down com `TrendChart`) e "Saldo Anterior" (primeiro card da grid, navega `ano`/`mes` ao clicar exceto em jan/2026, que alerta) — `useDashboardSaldoAcumulado` pede um mês a mais que o histórico selecionado, ponto extra alimenta "Saldo Anterior" sem chamada nova (Sprint 15); state `regime` levantado + `<RegimeToggle>` no filtro, propagado pra `GrupoAccordion`/`AtivosAccordion`/`PassivosAccordion`/`PatrimonioBreakdownPanel`; `PatrimonioBreakdownPanel` atualizado pros campos novos (`saldo_liquido_acumulado`/`saldo_investimentos`), "Ver detalhe" de Saldo líquido acumulado abre o drill-down de Saldo Acumulado (Sprint 16); card "Saldo Acumulado" ganha `.tag` + drill-down ganha nota explicando que é projeção por competência (não snapshot bancário) — Bloco 2 da Sprint 18, investigação com dado real confirmou diferença conceitual (salário no fim do mês deferido pra competência do mês seguinte), não bug (Sprint 18)
│   │       ├── AccountManagementPage.tsx  # Gestão de Contas — lista contas conectadas, apelido/sync_enabled editáveis, diálogo "Sincronizar MeuPluggy" com pré-seleção (Sprint 7, renomeado de ConnectAccountPage.tsx); listas ganham classe `.simple-list` (espaçamento/hover, sem virar accordion) (Sprint 13); campo "Saldo inicial (31/12/2025)" editável inline por conta + tabela de auditoria mensal (`.dash-table`), reaproveitada dentro de ConfiguracoesPage (Sprint 15)
│   │       ├── CategorizationReviewPage.tsx  # listagem única de transações (substitui TransactionsPage) — filtro tipo/status, lote, categoria editável em confirmada, descrição inline + propagação (Sprint 4; paginação pós-Sprint 6; rework completo na Sprint 7); filtros novos "associado a ativo"/"categoria" (grupo), indicador visual débito/crédito (`TransactionTipoIcon`) por linha, descrição/ativo passam a usar `TransactionEditCells` compartilhado (categoria continua bespoke — fila de pendentes tem workflow de confirmação em lote que não se aplica ao auto-save do componente compartilhado) (Sprint 10); `<select>` de categoria trocado por `CategoryCombobox` (mesmo estado local bufferizado até confirmação), status vira `StatusIcon` (ícone, revisão pós-implementação — era badge de texto na primeira versão), colunas reordenadas (Status/Data/Descrição/Categoria/Ativo/Valor), `cat-review-table` ganha densidade maior (padding reduzido) e larguras por coluna (mais espaço pra Descrição/Categoria, menos pro resto) (Sprint 11); ganha sort (Data/Descrição/Valor) via `SortableHeader` compartilhado — a tabela "flagship" da Sprint 11 nunca tinha tido (Sprint 13); coluna Data estática vira `<DateCell />` editável (Sprint 18)
│   │       ├── AssetsPage.tsx      # Gestão de Ativos — grid de cards ativos/baixados, CRUD (criar/editar/vender/deletar), toggle despesa/receita, sparkline por card, drill-down (painel fora do card, gráfico de histórico + transações) por ativo, filtro período (Sprint 8; refatorada na Sprint 9 pra reaproveitar CardSparkline/TrendChart compartilhados, sem mudança de comportamento); `AssetDrilldown` migrado pra `TransactionsTable` (`showAtivo={false}`) — ganha Categoria editável + sort, que não tinha antes; botões Editar/Vender viram `.btn-ghost`, Excluir vira `.btn-ghost.btn-quiet.btn-danger` — só "Ver gasto no período" fica Default (Sprint 13); state `regime` + `<RegimeToggle>` ao lado do toggle despesa/receita (Sprint 16)
│   │       ├── LiabilitiesPage.tsx  # Gestão de Passivos — mirror 1:1 de AssetsPage, sem toggle despesa/receita (passivo é sempre débito) e sem data_aquisicao; ação "Quitar" (confirmação, sem form, ao contrário de "Vender") no lugar de vender; drill-down com edição inline (Sprint 10 — backend já existia completo desde a Sprint 2, só nunca tinha ganhado UI); `LiabilityDrilldown` migrado pra `TransactionsTable` — ganha sort; mesma hierarquia de botão de AssetsPage (Sprint 13); state `regime` + `<RegimeToggle>` no filtro (Sprint 16)
│   │       ├── NaturezaPage.tsx    # tela "Natureza" — dashboard de visibilidade (3 cards Fixo recorrente/Variável recorrente/Eventual, drill-down reaproveitando /por-categoria+useSubcategories) + tabela de classificação de subcategorias agrupada por CategoryGroup (rowSpan, table-layout:fixed), <select> de 3 opções salvando via PUT /subcategories/{id} (Sprint 12 — reaproveita Subcategory.natureza dormente desde a Sprint 2, sem migration); rótulo "Custo eventual"→"Eventual", funil ganha o nível Categoria (`Natureza → Categoria → Subcategoria → Transação`, sanfona multi-nível via `categoriaGrouping.ts`), tabela de classificação ganha sort de Categoria/Subcategoria (Sprint 13)
│   │       ├── ProjecaoPage.tsx    # tela nova "Projeção" — filtro mês-base (PeriodFilter) + seletor de horizonte 3/6/12 futuro (reaproveita PeriodoHistorico), 3 cards (Receita/Despesa/Saldo projetados, média mensal do horizonte), `ProjectionChart` (histórico real + projeção), painel de simulação "hipotéticas" (form nome/valor/tipo/frequência/mês-alvo, lista `.simple-list` com remover) — estado 100% local via `applyHipoteticas` (`utils/projecao.ts`), nenhuma chamada de rede nova ao adicionar/remover hipotética (Sprint 14, sem migration, sem persistência — decisão explícita do CEO)
│   │       └── ConfiguracoesPage.tsx  # tela nova "Configurações" (substitui a aba "Gestão de contas") — 3 seções: Perfil (nome/e-mail + botão Sair), Competência de Salário (dia de corte + form "Salário de dezembro/2025"), Gestão de Contas (reaproveita AccountManagementPage como está); campos do form de ajuste de salário usam padrão "draft não tocado até editar" (não useEffect) pra evitar cascading render ao sincronizar com a query (Sprint 15, novo)
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
│       ├── check-sprint10.mjs      # nav sem Início/com Passivos/ordem final, tooltip do sparkline sem "v:" (mês/ano via hover), drill-down de Patrimônio (4 partes+total, link pros drill-downs existentes), presença dos controles de edição inline no Dashboard (sem disparar onChange — salvam sem confirmação), filtros novos de Categorização, CRUD+drill-down de Passivos (única mutação real, desfeita no final) (Sprint 10)
│       ├── check-sprint13.mjs      # rótulo "Eventual", funil de 4 níveis (Natureza>Categoria>Subcategoria>Transação, percentual em cada nível, múltiplas categorias expandidas), hover+sort em Categorização/Natureza-classificação/drill-down de Dashboard, colgroup no breakdown de Patrimônio, hierarquia de botão nos cards de Ativos/Passivos (cor computada via getComputedStyle), .simple-list em Gestão de Contas; só leitura (Sprint 13; substitui check-sprint12.mjs, removido — testava o funil de 1 nível que esta sprint substituiu)
│       ├── check-sprint14.mjs      # tela Projeção — 3 cards carregam, hipotética mensal/única recalcula os cards sem disparar chamada de rede nova a /dashboards/projecao ou /tendencia (contagem de request via Playwright), remover restaura os valores originais, trocar horizonte dispara chamada nova; só leitura + interação local, nenhuma mutação persistida (Sprint 14)
│       ├── check-sprint15.mjs      # logout, 3 seções de Configurações, edição de dia de corte/ajuste de salário de dez-25/saldo inicial por conta (todas revertidas ao valor original ao final), tabela de auditoria, cards "Saldo Acumulado"/"Saldo Anterior" (alerta em jan/2026 vs. navegação em outro mês), desktop+mobile (Sprint 15)
│       └── check-sprint16.mjs      # toggle Competência/Caixa no Dashboard/Ativos/Passivos, drill-down de Patrimônio com rótulos novos + link pro drill-down de Saldo Acumulado; só leitura, nenhuma mutação; desktop+mobile (Sprint 16)
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions: pytest+ruff (backend), vitest+eslint+tsc (frontend) (Sprint 1)
└── .claude/                        # config local do Claude Code (agentes/hooks do projeto)
```

## O que ainda não existe

- Frontend de gestão de categorias/passivos (CRUD completo: criar/renomear/excluir grupo ou subcategoria) — fora de escopo; `api/categories.ts` ganhou `updateSubcategory` na Sprint 12, mas só pra editar `natureza` a partir da tela "Natureza" — não é um CRUD completo, e não existe UI de criação/exclusão. CRUD de ativos (`createAsset`/`updateAsset`/`sellAsset`/`deleteAsset`) implementado na Sprint 8 via `AssetsPage.tsx`.
- Frontend de gestão de `categorization_rules` (editar/remover regra manualmente) — fora de escopo, só o import e o motor automático (ver PRD-004).
- UI de gestão de `category_groups.excluir_de_totais` — só setado via migration na Sprint 5; se surgir necessidade de mais grupos excluídos, é ajuste de dado, não de mecanismo (ver PRD-005).
- Override manual de `data_competencia` por transação — schema já suporta (coluna gravada, não computada), endpoint/UI adiados (ver PRD-005).
- Evolução de patrimônio/investimentos ao longo do tempo — segue sem série histórica no schema (precisaria de snapshot periódico, job novo); cards Ativos/Passivos com drilldown e card Saldo por conta entregues na Sprint 9 (E6 parte 3, épico fechado), mas sempre snapshot atual, nunca série histórica.
- Estado "pular/ignorar" na fila de Categorização; reconciliação de descrição quando a Pluggy reenvia uma transação já editada pelo usuário (`descricao_usuario` nunca é sobrescrito por sync, não há merge/conflito a resolver) — ambos fora de escopo desde o PRD-004/PRD-007.
- Endpoint/UI de override manual de débito/crédito por transação — decisão explícita do CEO na Sprint 10 (a correção do NuTag foi pontual, na lógica de agregação, não uma feature nova); motor de sugestão de 3 camadas para passivo (`suggest_liability` continua heurística substring, só `suggest_asset` foi elevado na Sprint 10); paridade de payload entre `sell` (ativo) e `settle` (passivo) — nenhum dos três tem pedido do CEO para mudar ainda.
- `CategoryCombobox` para `AssetSelectCell` (seletor de Ativo continua `<select>` nativo — lista pequena por usuário, não justifica o mesmo investimento); generalização do padrão de combobox para os outros `<select>` do app (filtros de período/tipo/status/ativo/categoria — listas curtas e fixas) — ambos adiados explicitamente no PRD-011 (Sprint 11), não comprometidos para sprint futura.
- Herança de regras entre usuários (memória compartilhada opt-in) — schema de `categorization_rules` já preparado (`origem` extensível), mecanismo de opt-in/onboarding fica para sprint futura.
- Camadas de token distintivo/IDF e léxico estático PT-BR no motor de categorização — adiadas até haver volume real suficiente para calibrar (ver PRD-004).
- UI de gestão de usuários (multiusuário — convidar/remover) — item 11 do escopo original de E7, adiado explicitamente pelo CEO na Sprint 15; arquitetura já suporta (isolamento por `user_id`, ~10 usuários sem retrabalho). Perfil/logout/tela de Configurações entregues na Sprint 15 (E7 fechado).
- Persistir despesas/receitas hipotéticas como cenários salvos (tela Projeção) — decisão explícita do CEO na Sprint 14, simulação fica efêmera por ora.
- Sync agendado/webhooks Pluggy e UI dedicada de reconexão — fora do roadmap a menos que o CEO priorize (decisão fixa do projeto é sync manual).
- Tabelas pré-calculadas ou cache de agregação para dashboards — decisão fixa do projeto (leitura direta/agregação simples).
- VM de produção — adiada para sprint futura sob aprovação do CEO.

## Convenção

- Toda pasta nova de código de produto (`backend/`, `frontend/`) deve ser refletida aqui na sprint que a criar.
- PRDs numerados sequencialmente (`PRD-001-...`), ADRs idem (`ADR-NNN-...`), sprints idem (`SPRINT-NNN-...`).
