# Roadmap

Fases em épicos, derivados do escopo funcional do bootstrap. PRDs individuais serão gerados na primeira sessão de planejamento (`/plan`), um por item, não nesta fase.

## Épicos

| # | Épico | Escopo funcional relacionado |
|---|---|---|
| E1 | Fundação técnica ✅ | Setup de repo, stack (ADR-001), auth Google OAuth, deploy inicial na VM — concluído na Sprint 1 (2026-08-04) |
| E2 | Integração Pluggy | Extratos, cartão de crédito, investimentos; setup técnico (item 8) |
| E3 | Categorização | Regras + memória de revisão manual; associação despesa↔ativo (item 2) |
| E4 | Gestão de dados mestres ✅ | Categorias/subcategorias/natureza (item 10); ativos/passivos (item 9) — concluído na Sprint 2 (2026-08-06) |
| E5 | Dashboards core | Receita/despesa/saldo/patrimônio com drill-down; filtros ano/mês (itens 3, 7) |
| E6 | Dashboards analíticos | Despesas por natureza; despesas por ativo; patrimônio e evolução de investimentos (itens 4, 5, 6) |
| E7 | Conta e perfil | Perfil de usuário, logout, multiusuário (item 11) |
| E8 | Migração de dados legados | Import de categorias + memória do v1 |

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

### Sprint 3 — Integração Pluggy + categorização automática (E2, E3)
- Setup técnico: credenciais Pluggy, seleção de contas, corte de histórico, data de competência de receita (item 8).
- Sync manual (botão) trazendo extratos/cartão/investimentos.
- Motor de categorização por regras + memória (sem LLM), com fallback para revisão manual.
- Associação despesa↔ativo.
- Testes unitários da lógica de categorização e de competência de receita (meta ≥80%).

Sprints seguintes (E5, E6, E7) serão detalhadas ao final da Sprint 3, quando houver dados reais fluindo para validar os dashboards.

## Registro de reavaliações futuras

- **Understand Anything:** reavaliar instalação quando o codebase ultrapassar ~100 arquivos (ver ADR-002-plugins).
- **Sync Pluggy agendada:** só entra no roadmap se o CEO priorizar explicitamente.
