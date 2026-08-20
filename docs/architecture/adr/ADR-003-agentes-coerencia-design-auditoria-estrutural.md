# ADR-003: Agentes de coerência de design e auditoria estrutural (Sprint 29)

- **Status:** aprovado
- **Data:** 2026-08-19

## Contexto

Em ciclos recentes (sprints 7-9, 12-15, 23-28) o CEO repetidamente voltou de usar o app real com
listas de ajustes visuais pontuais que, mais de uma vez, revelaram implementações divergentes do
mesmo elemento visual crescidas em paralelo — 3 componentes de gráfico de linha diferentes só
consolidados na Sprint 26, 3 dialetos de tabela só consolidados na Sprint 13. O CEO pediu explorar
duas capacidades: (1) checar planos de UI contra os padrões visuais estabelecidos *antes* da
implementação, e (2) uma auditoria estrutural recorrente (código/docs/segurança) que gere sprint de
débito técnico quando aprovada.

## Decisão

**Capacidade 1 (coerência de design):** estender `.claude/agents/planner.md` com um passo de checagem
contra `DESIGN.md` — já existente, maduro (462 linhas, Regras Nomeadas, seção Do's/Don'ts) e
ativamente mantido a cada sprint visual desde a Sprint 5 — em vez de criar um documento novo ou um
agente dedicado separado. `DESIGN.md` é reutilizado como fonte única de padrões.

**Capacidade 1b (sugestão de feature sob demanda):** também embutida em `planner.md`, gatilho
explícito ("sugira a próxima funcionalidade"), nunca automática/periódica — decisão do CEO.

**Capacidade 2 (auditoria estrutural):** novo agente `.claude/agents/structural-auditor.md`, Sonnet,
`Read/Grep/Glob/Bash`, só-leitura (sem `Write`, mesmo padrão dos outros 4 agentes de revisão do
projeto). Cadência proposta pelo CTO a cada 5 sprints executadas e aprovadas, rastreada em
`docs/roadmap.md § Auditoria estrutural`; execução sempre com aprovação explícita do CEO por vez,
nunca cron/agendamento automático. Relatórios persistidos em `docs/audits/`, um por execução, via
novo `templates/AUDIT-template.md`.

## Alternativas consideradas

| Opção | Prós | Contras | Motivo da rejeição |
|---|---|---|---|
| Agente dedicado `design-coherence-checker` separado do planner | Responsabilidade isolada, mais fácil de testar sozinho | Só dispara se alguém lembrar de invocá-lo explicitamente; `planner`/`architect` não têm a tool `Task`, não podem delegar a ele automaticamente | Contraria o pedido do CEO de que a checagem seja automática dentro do fluxo normal de planejamento, não um passo manual extra |
| Novo documento de padrões visuais (design-memory.md ou similar) | Poderia ser desenhado especificamente para consumo por agente | Duplicaria `DESIGN.md`, que já cobre exatamente esse escopo e é ativamente mantido; violaria a regra de ouro do CLAUDE.md de poucos docs | `DESIGN.md` já resolve o problema; um segundo documento fragmentaria a fonte de verdade |
| Auditoria estrutural agendada via cron (CronCreate) | Totalmente automática, sem depender de o CTO lembrar | Introduziria a primeira automação agendada do projeto, contrariando a filosofia fixa (sync Pluggy manual pela mesma razão) | Rejeitada explicitamente pelo CEO nesta sessão |
| Auditoria estrutural só sob demanda pura (sem cadência) | Simples, zero infraestrutura de rastreamento | Depende inteiramente de o CEO lembrar de pedir — mesmo problema que motivou o pedido original | Rejeitada pelo CEO em favor de "CTO propõe proativamente" |
| N=3 sprints de cadência | Detecta drift mais cedo | Muito ruidoso — boa parte das sprints do projeto são ajustes visuais de 1 sessão, geraria proposta de auditoria com frequência excessiva | Mediana das "épocas" de drift observadas (3, 4, 6 sprints) é 4; N=3 fica abaixo até do mínimo observado |
| N=6 sprints de cadência | Menos interrupções | Já é o pior caso observado (6 sprints foi tempo suficiente para 3 dialetos de tabela nascerem antes da Sprint 13) | N=5, levemente acima da mediana, equilibra melhor ruído vs. detecção tardia |

## Consequências

- **Positivas:** planos de UI passam a citar explicitamente o que reaproveitam de `DESIGN.md`,
  tornando a decisão auditável no próprio `docs/sprints/*-plan.md`. Auditoria estrutural ganha um
  mecanismo formal sem introduzir automação agendada, mantendo consistência com a filosofia já fixada
  do projeto. Nenhum documento novo de padrões visuais foi criado — menor custo de manutenção.
- **Negativas / trade-offs aceitos:** a checagem de coerência de design só é confiável quando o CTO
  usa `planner.md` (via subagente) ou segue o CLAUDE.md ao planejar inline — não há enforcement
  automático fora dessas duas vias. A cadência de auditoria (N=5) é uma estimativa baseada em poucos
  ciclos observados; pode precisar de ajuste depois da primeira execução real (Sprint 34).
- **Impacto em decisões futuras:** a primeira execução real do `structural-auditor` (Sprint 34 ou
  antes, se priorizada) deve ser tratada como validação do mecanismo — se o relatório gerar ruído
  excessivo ou achados triviais demais, revisar N e/ou o escopo das 5 categorias nesta mesma ADR
  (atualizar Status para "substituído por ADR-XXX" se a revisão for grande).

## Referências

- [PRD-029-agentes-coerencia-design-auditoria-estrutural.md](../../prd/PRD-029-agentes-coerencia-design-auditoria-estrutural.md)
- [SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md](../../sprints/SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md)
- [DESIGN.md](../../../DESIGN.md)
- [PRODUCT.md](../../../PRODUCT.md)
- [docs/roadmap.md](../../roadmap.md) § Auditoria estrutural (cadência)
- [ADR-002-plugins.md](ADR-002-plugins.md) — decisão de agentes da Fase 0 (contexto, não alterada)
