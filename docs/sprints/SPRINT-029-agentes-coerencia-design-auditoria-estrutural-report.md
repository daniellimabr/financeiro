# SPRINT-029: Coerência de design no planejamento + auditoria estrutural recorrente — Relatório

- **Plano:** [SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md](./SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md)
- **Data do relatório:** 2026-08-19

## Resumo

Sprint de tooling de processo (não código de produto): `planner.md` foi estendido para checar planos de UI contra `DESIGN.md` durante o planejamento e para sugerir a próxima funcionalidade sob demanda; um novo agente só-leitura `structural-auditor` foi criado para auditoria estrutural (dívida técnica, docs, segurança, testes, drift de design); uma cadência proativa de auditoria (a cada 5 sprints aprovadas, rastreada em `docs/roadmap.md`) foi instituída sem introduzir automação agendada. Nenhum documento novo de padrões visuais foi criado — `DESIGN.md`, já maduro, foi reutilizado como fonte única.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `templates/AUDIT-template.md` | feito | — |
| 2 | Seção condicional "Coerência de Design" em `templates/SPRINT-plan-template.md` | feito | — |
| 3 | `.claude/agents/planner.md`: description, passo 2.5, bloco no Plan Format, seção On-Demand Feature Suggestion | feito | — |
| 4 | `.claude/agents/structural-auditor.md` (novo, só-leitura) | feito | — |
| 5 | `CLAUDE.md`: 3 edições pontuais | feito | — |
| 6 | Seção "Auditoria estrutural (cadência)" em `docs/roadmap.md` | feito | Também foi adicionada a entrada narrativa "### Sprint 29" na seção de histórico de sprints, seguindo o padrão das sprints anteriores (não estava listada como tarefa própria no plano, mas é o mesmo padrão usado em todo o roadmap) |
| 7 | `docs/architecture/adr/ADR-003-*.md` | feito | — |
| 8 | `docs/directory-structure.md` atualizado | feito | Executado diretamente pela sessão principal em vez de delegado ao subagente `doc-updater` — a atualização era pequena e já totalmente especificada pelo plano; delegar teria custado uma rodada extra sem ganho. Ao editar, foi encontrado e documentado um gap pré-existente (não causado por esta sprint): a lista sequencial de PRDs/Sprints no arquivo parava na Sprint 19, embora o repo já tivesse PRDs/planos até a Sprint 28 — registrado como nota inline e como candidato a achado da primeira auditoria estrutural, sem tentar backfill completo (fora de escopo desta sprint) |
| 9 | Validação manual | parcial | Itens (a), (b) e (d) da seção "Testes previstos" do plano foram verificados por leitura/inspeção direta dos arquivos editados. Item (c) — invocar `structural-auditor` em dry-run — não foi possível nesta mesma sessão: agentes definidos em `.claude/agents/*.md` são registrados no início da sessão, e `structural-auditor` foi criado durante esta sessão. O arquivo do agente foi inspecionado manualmente (formato, frontmatter, preâmbulo, escopo) e está consistente com os demais 5 agentes existentes; a primeira invocação real fica pendente para a próxima sessão nova (`/clear`) — ver Pendências abaixo |

## Evidência de testes

Não aplicável — sprint de tooling de prompts/documentação, sem lógica de negócio de backend/frontend. Não há suíte automatizada a rodar (mesmo racional documentado no plano e no PRD).

Cobertura de lógica de negócio: não aplicável (nenhum código de produto alterado).

## Lint/formatter

Não aplicável — nenhum arquivo `.py`/`.ts`/`.tsx` foi criado ou editado nesta sprint (apenas Markdown e frontmatter YAML em arquivos de agente).

## Decisões tomadas durante a execução

- N=5 sprints de cadência de auditoria, já decidido e justificado no plano/PRD/ADR-003 (mediana das "épocas" de drift observadas: 3, 4, 6 sprints).
- Atualização de `docs/directory-structure.md` feita diretamente pela sessão principal em vez de via subagente `doc-updater` (ver item 8 acima) — decisão de execução, não de arquitetura, não gerou ADR.
- Ao editar `docs/directory-structure.md`, optou-se por registrar honestamente o gap de PRDs/Sprints 020-028 (não documentados nesse arquivo desde a Sprint 19) em vez de tentar um backfill completo fora do escopo desta sprint — decisão alinhada ao próprio propósito da sprint (deixar esse tipo de achado para a auditoria estrutural formal).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Plano com UI produz seção "Coerência de Design (DESIGN.md)" citando componentes/regras reaproveitados ou justificando novidade | sim | `.claude/agents/planner.md` linhas 41-60 (passo 2.5) e 92-96 (bloco no Plan Format); `templates/SPRINT-plan-template.md` (seção condicional) |
| 2. Plano sem UI omite a seção (não aparece vazia) | sim | Instrução explícita "skip this step entirely" (planner.md linha 59-60) e "[Omit this entire section if...]" (Plan Format, linha 93) |
| 3. Pedido "sugira a próxima funcionalidade" cita PRODUCT.md/DESIGN.md/roadmap.md sem gerar PRD automaticamente | sim | `.claude/agents/planner.md` seção "On-Demand Feature Suggestion" (linhas 235-246) |
| 4. `structural-auditor` produz relatório no formato de AUDIT-template.md, cobre as 5 categorias, sem escrita em disco | parcial | Agente criado com as 5 categorias e tools só-leitura (`Read, Grep, Glob, Bash`, sem `Write`) verificado por inspeção manual do arquivo; invocação real de dry-run pendente para próxima sessão (agentes só registram no início da sessão) — ver Pendências |
| 5. Tabela de cadência em roadmap.md resolve corretamente para Sprint 34 | sim | `docs/roadmap.md` § Auditoria estrutural: "Próxima checagem devida: Sprint 34 (29 + 5)" |

## Documentação atualizada

- `docs/prd/PRD-029-agentes-coerencia-design-auditoria-estrutural.md` (novo)
- `docs/sprints/SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md` (novo)
- `docs/sprints/SPRINT-029-agentes-coerencia-design-auditoria-estrutural-report.md` (novo, este arquivo)
- `templates/AUDIT-template.md` (novo)
- `templates/SPRINT-plan-template.md` (editado)
- `.claude/agents/planner.md` (editado)
- `.claude/agents/structural-auditor.md` (novo)
- `CLAUDE.md` (editado — 3 pontos)
- `docs/roadmap.md` (editado — nova seção de cadência + entrada de histórico da Sprint 29)
- `docs/architecture/adr/ADR-003-agentes-coerencia-design-auditoria-estrutural.md` (novo)
- `docs/directory-structure.md` (editado)

## Consumo estimado de tokens/sessões

Uma sessão de planejamento (exploração + design + aprovação) seguida de uma sessão de execução única, sem necessidade de `/clear` intermediário — sprint pequena, sem código de produto, todos os arquivos são Markdown/YAML de baixo volume.

## Pendências e próximos passos sugeridos

1. **Validar `structural-auditor` em sessão nova**: rodar um dry-run real (`Agent` com `subagent_type: structural-auditor`) na próxima sessão para confirmar que o relatório gerado é bem-formado e cobre as 5 categorias como esperado — item 9(c) do plano ficou pendente só por essa limitação de registro de agente dentro da mesma sessão que o criou.
2. **Backfill de `docs/directory-structure.md`** (Sprints 020-028): registrado como candidato a achado da primeira auditoria estrutural (Sprint 34), não como pendência urgente desta sprint.
3. Nenhuma ação de deploy é necessária — esta sprint não altera `backend/`/`frontend/`/infra, então não há nada para rodar na VM de dev.
