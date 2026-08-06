# SPRINT-002: Dados mestres + migração de categorias do legado — Plano

- **PRD(s):** [PRD-002-dados-mestres-migracao-legado](../prd/PRD-002-dados-mestres-migracao-legado.md)
- **Data do plano:** 2026-08-05

## Objetivo da sprint

Ao final, o banco tem schema de categorias/subcategorias/natureza e de
ativos/passivos, geridos via API com CRUD testado e isolado por usuário, e as 50
categorias confirmadas do Financeiro v1 estão importadas como seed do sistema.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Modelos SQLAlchemy + migration Alembic `0002` (`category_groups`, `subcategories`, enum `natureza`, constraints de unicidade) | Sonnet: implementação | PRD-002 §Dados e modelo |
| 2 | Schemas Pydantic + service + router CRUD para `category_groups`/`subcategories` (list/get/create/update/delete, validação de nome único) | Sonnet: implementação | PRD-002 §Regras de negócio |
| 3 | Modelos SQLAlchemy + migration Alembic `0003` (`assets`, `liabilities`, enums `tipo`/`status`, FK `user_id`) | Sonnet: implementação | PRD-002 §Dados e modelo |
| 4 | Schemas Pydantic + service + router CRUD para `assets`/`liabilities`, incl. `POST /assets/{id}/sell` e `POST /liabilities/{id}/settle`, filtrados por `get_current_user` | Sonnet: implementação | PRD-002 §Regras de negócio; [app/auth/deps.py](../../backend/app/auth/deps.py) (dependency já existente da Sprint 1) |
| 5 | Script `backend/scripts/import_legacy_categories.py`: lê CSV `grupo,subcategoria`, upsert em `category_groups`/`subcategories`, loga conflitos, não sobrescreve duplicata | Sonnet: implementação | [legacy-data.md](../migration/legacy-data.md) §1 |
| 6 | Testes unitários: nome único por grupo/subcategoria, `natureza` inválida rejeitada, venda de ativo exige valor+data e é idempotente, quitação de passivo idempotente, upsert do import com merge de duplicatas | Sonnet + skill tdd-workflow | PRD-002 §Critérios de aceite |
| 7 | Testes de integração: endpoints CRUD (200/401/404), isolamento `user_id` entre dois usuários (assets/liabilities), script de import rodando contra fixture CSV | Sonnet + skill tdd-workflow | PRD-002 §Critérios de aceite 5, 6 |
| 8 | Rodar o import real contra o CSV confirmado (50 pares grupo/subcategoria) na VM de dev via `ssh_vm.py dev` e conferir no banco | Sonnet: implementação | [legacy-data.md](../migration/legacy-data.md) §1 |
| 9 | Atualizar docs vivos (`OVERVIEW.md` — novas tabelas e endpoints; `directory-structure.md` — novos módulos/arquivos) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md |
| 10 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** validação de nome único (grupo e subcategoria dentro do
  grupo), `natureza` só aceita `fixa`/`variavel`/`eventual`/`null`, venda de
  ativo exige `valor_venda`+`data_venda` e falha se já `baixado`, quitação de
  passivo falha se já `quitado`, upsert do import mescla duplicata sem
  sobrescrever e loga conflito.
- **Integração:** CRUD completo de `category_groups`/`subcategories`/`assets`/`liabilities`
  (sucesso e 401 sem cookie), isolamento `user_id` (usuário A não vê dados do
  usuário B), script de import rodado contra uma fixture CSV pequena.
- Todos executados na VM de dev via `scripts/ssh-vm.ps1 dev "..."`. Meta ≥80%
  de cobertura nos módulos novos (categorias, ativos, passivos, import) — hard
  gate desta sprint, ao contrário da Sprint 1 (agora já existe lógica de negócio
  real).

## Impacto no roadmap

Fecha o épico E4 por completo. Fecha a parte de categorias de E8 (import de
memória de classificação continua pendente, aguardando arquivo do CEO — ver
PRD-002 §Fora de escopo). Desbloqueia a Sprint 3 (E2 Pluggy + E3 categorização),
que depende de `category_groups`/`subcategories` existirem para categorizar
transações.

## Riscos / dependências

- Import de memória de classificação (E8) fica incompleto até o CEO entregar o
  arquivo real — não bloqueia a Sprint 3, mas fica registrado como pendência
  recorrente (já estava assim desde legacy-data.md).
- Schema simples de `assets`/`liabilities` pode precisar de revisão quando os
  dashboards de patrimônio (E6) forem desenhados — decisão consciente de não
  sobre-projetar agora; se precisar mudar, é uma migration nova, não retrabalho
  arquitetural.
- Nenhuma dependência de infraestrutura nova — reaproveita VM de dev, Docker
  Compose, CI e pipeline de testes já existentes da Sprint 1.
- Decisão de deixar `category_groups`/`subcategories` editáveis por qualquer
  usuário autenticado (sem papel de admin) é aceitável para 2 usuários da
  família, mas não escala além disso sem revisão.
