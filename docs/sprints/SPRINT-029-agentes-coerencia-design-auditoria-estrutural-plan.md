# SPRINT-029: Coerência de design no planejamento + auditoria estrutural recorrente — Plano

- **PRD(s):** [PRD-029-agentes-coerencia-design-auditoria-estrutural.md](../prd/PRD-029-agentes-coerencia-design-auditoria-estrutural.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

O CTO passa a checar automaticamente novos planos de UI contra `DESIGN.md` durante o planejamento, pode sugerir a próxima funcionalidade sob demanda, e ganha um agente de auditoria estrutural que o próprio CTO propõe rodar a cada 5 sprints aprovadas — nada disso exige nova ação do CEO além de aprovar cada execução quando ela for proposta.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Criar `templates/AUDIT-template.md` seguindo o padrão dos outros 4 templates | Sonnet: implementação | `templates/ADR-template.md`, `templates/PRD-template.md` |
| 2 | Adicionar seção condicional "Coerência de Design (DESIGN.md)" em `templates/SPRINT-plan-template.md` | Sonnet: implementação | `DESIGN.md` |
| 3 | Editar `.claude/agents/planner.md`: description, passo "2.5 Design Coherence Check", bloco no Plan Format, seção "On-Demand Feature Suggestion" | Sonnet: implementação | `DESIGN.md`, `PRODUCT.md`, `docs/roadmap.md` |
| 4 | Criar `.claude/agents/structural-auditor.md` (Sonnet, `Read/Grep/Glob/Bash`, só-leitura, description "só sob aprovação explícita") | Sonnet: implementação | `.claude/agents/security-reviewer.md`, `.claude/agents/code-reviewer.md`, `.claude/agents/planner.md` |
| 5 | Editar `CLAUDE.md`: linha em "Onde encontrar cada coisa" (docs/audits/), linha em "Decisões fixas" (cadência de auditoria), atualizar "Fluxo por sprint" | Sonnet: implementação | `CLAUDE.md` |
| 6 | Adicionar seção "Auditoria estrutural (cadência)" em `docs/roadmap.md`, logo após a tabela de Épicos | Sonnet: implementação | `docs/roadmap.md` |
| 7 | Criar `docs/architecture/adr/ADR-003-agentes-coerencia-design-auditoria-estrutural.md` | Sonnet: implementação | `templates/ADR-template.md`, `ADR-002-plugins.md` |
| 8 | Atualizar `docs/directory-structure.md` (novos arquivos/diretórios desta sprint) | Haiku: doc-updater | `docs/directory-structure.md` |
| 9 | Validação manual (ver Testes previstos) | Sonnet: implementação | — |

## Testes previstos

Não há lógica de negócio nova (tooling de prompts/docs), então não há testes automatizados de
backend/frontend. Validação funcional/manual:
- Simular um plano fictício com UI e conferir que a seção "Coerência de Design (DESIGN.md)" aparece
  corretamente preenchida.
- Simular um pedido "sugira a próxima funcionalidade" e conferir que a resposta cita
  DESIGN.md/PRODUCT.md/roadmap.md sem gerar PRD automaticamente.
- Invocar `structural-auditor` em modo dry-run contra o repo atual: relatório bem-formado, 5
  categorias cobertas, nenhuma tentativa de escrita em disco.
- Conferir que a tabela de cadência em `docs/roadmap.md` resolve para "Sprint 34" e que todos os
  links novos resolvem (CLAUDE.md → docs/audits/, ADR-003 → DESIGN.md/PRODUCT.md/roadmap.md).

## Impacto no roadmap

Sem épico prévio (cross-epic, tooling de processo). Não bloqueia nenhuma sprint futura de produto.
Cria a expectativa de que a Sprint 34 (29 + 5) seja o primeiro checkpoint proposto de auditoria
estrutural, conforme a tabela de cadência criada em `docs/roadmap.md`.

## Riscos / dependências

- **Risco:** a seção "Coerência de Design" virar burocracia preenchida de forma genérica em vez de
  uma checagem real. Mitigação: o passo exige citar componente/regra nomeada específico ou justificar
  novidade — não aceita frase genérica; validado na tarefa 9.
- **Risco:** `structural-auditor` gerar falsos positivos por não conhecer exceções já documentadas
  (ex.: `.simple-list` do DESIGN.md é presentation-only por decisão, não é "esquecimento"). Mitigação:
  o agente lê `DESIGN.md`/`CLAUDE.md` antes de reportar drift de design, e o CEO sempre aprova/rejeita
  achado por achado antes de virar sprint de débito técnico — não é uma ação automática.
- **Dependência:** nenhuma sprint de produto depende desta. Pode ser interrompida ou adiada sem
  impacto em outros épicos.
