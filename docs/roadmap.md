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
| E6 | Dashboards analíticos | Tendência histórica, percentual de representatividade, despesas por ativo (itens 4, 5, 6) — dividido em Sprint 6 (tendência/percentual/design system) e Sprint 7 (Ativos); patrimônio/evolução de investimentos adiado por falta de série histórica no schema |
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

### Sprint 6 — Dashboards analíticos: tendência e percentual (E6, parte 1)
- Design system: tipografia própria (escolhida por comparação visual real,
  não só descrita) + layout que aproveita a largura da tela, em vez da
  coluna estreita centralizada da Sprint 5.
- Tendência histórica (3/6/12 meses) nos cards de Receita/Despesa/Saldo e,
  num modelo visual mais simples, em cada linha do drill-down de
  categoria. Patrimônio fica de fora — não há série histórica de
  saldo/valor de ativo no schema (mesma limitação já registrada na Sprint
  5).
- Percentual de representatividade em cada nível do funil (categoria % do
  total do período; meio de pagamento % da categoria; linha de extrato %
  do meio de pagamento, calculado no frontend).
- Drill-down em formato sanfona — expandir um nível não esconde os
  anteriores, diferente do comportamento de "substituir tela" da Sprint 5.
- PRD: [PRD-006-dashboards-analiticos.md](prd/PRD-006-dashboards-analiticos.md). Plano: [SPRINT-006-dashboards-analiticos-plan.md](sprints/SPRINT-006-dashboards-analiticos-plan.md).

### Sprint 7 — Ativos: gestão e custos (E6, parte 2)
*Escopo ainda não detalhado em PRD/plano — planejar em sessão própria,
depois que a Sprint 6 estabelecer a fundação de design system.*

Tela `AssetsPage.tsx`: cards por ativo (reaproveitando `.dash-tile`),
botão/formulário para cadastrar ativo novo (backend de CRUD já existe em
`app/assets/` desde a Sprint 2 — falta só mutation hooks no frontend, hoje
só há leitura via `fetchAssets`). Clicar num card abre drill-down de custos
relacionados: total gasto + lista de transações vinculadas (via `asset_id`
confirmado em `pluggy_transactions`, associação já existente desde a
Sprint 4). Versão simples confirmada pelo CEO — sem tendência/percentual
nesta primeira versão da tela.

### Sprint 8 — Categorização: tabela moderna e paginação (E3, polish)
*Escopo ainda não detalhado em PRD/plano — planejar em sessão própria.*

A lentidão em si (N+1 na busca de sugestões) já foi corrigida fora de
sprint formal (ver nota acima). Falta: paginar `GET /categorization/pending`
(hoje recomputa sugestão para todas as pendências a cada chamada — paginar
limita esse custo a uma página por vez, resolvendo o restante da lentidão
observada mesmo após o fix de N+1) e modernizar a tabela reaproveitando a
fundação de design system da Sprint 6.

## Registro de reavaliações futuras

- **Understand Anything:** reavaliar instalação quando o codebase ultrapassar ~100 arquivos (ver ADR-002-plugins).
- **Sync Pluggy agendada:** só entra no roadmap se o CEO priorizar explicitamente.
