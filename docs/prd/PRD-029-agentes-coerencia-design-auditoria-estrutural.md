# PRD-029: Coerência de design no planejamento + auditoria estrutural recorrente

- **Status:** aprovado
- **Épico relacionado:** cross-epic, sem épico prévio (tooling de processo CTO↔CEO, não funcionalidade de produto)
- **Sprint(s):** [SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md](../sprints/SPRINT-029-agentes-coerencia-design-auditoria-estrutural-plan.md)

## Problema

Em ciclos recentes (sprints 7-9, 12-15, 23-28) o mesmo padrão se repetiu: o CEO usa o app real, volta
com uma lista de ajustes visuais pontuais, e frequentemente esses ajustes revelam que o mesmo elemento
visual foi implementado de formas divergentes em paralelo antes de ser notado — 3 componentes de
gráfico de linha diferentes só consolidados na Sprint 26, 3 dialetos de tabela só consolidados na
Sprint 13. Hoje não existe nenhum mecanismo institucionalizado para checar um plano de UI contra os
padrões já estabelecidos em `DESIGN.md` antes da implementação — a checagem só acontece depois, como
feedback do CEO usando o app pronto.

Da mesma forma, não existe hoje nenhum mecanismo institucionalizado de auditoria estrutural periódica
(dívida técnica, docs desatualizados, postura de segurança, cobertura de testes) — a saúde do repo só
é revisada quando algo já incomodou o suficiente para o CEO pedir.

## Escopo

- **Incluído:**
  - Extensão de `.claude/agents/planner.md` com um passo de checagem de coerência de design contra
    `DESIGN.md`, embutido no fluxo normal de planejamento (não um passo manual extra).
  - Extensão de `planner.md` com uma capacidade de sugestão de feature sob demanda, também apoiada em
    `DESIGN.md`/`PRODUCT.md`/`docs/roadmap.md`.
  - Novo agente `.claude/agents/structural-auditor.md`, só-leitura, para auditoria estrutural
    (dívida técnica/duplicação, docs desatualizados, segurança, cobertura de testes, drift de design).
  - Novo template `templates/AUDIT-template.md` e novo diretório `docs/audits/` para persistir
    relatórios de auditoria.
  - Mecanismo de cadência proativa (a cada 5 sprints executadas/aprovadas) rastreado em
    `docs/roadmap.md`, sem cron/agendamento automático.
  - Atualizações de `CLAUDE.md`, `docs/roadmap.md`, `docs/directory-structure.md` e novo
    `ADR-003-agentes-coerencia-design-auditoria-estrutural.md`.
- **Fora de escopo (explicitamente):**
  - Qualquer automação agendada (cron) — decisão explícita do CEO, mantendo a filosofia fixa do
    projeto ("sem automação agendada além do que foi pedido", mesma razão do sync Pluggy manual).
  - Execução real de uma auditoria estrutural nesta sprint — apenas o mecanismo é criado; a primeira
    execução real fica para a Sprint 34 (ou quando o CEO priorizar antes).
  - Criação de um novo documento de design — `DESIGN.md`, já existente e maduro, é reutilizado como
    fonte única de padrões, evitando duplicar "memória" em dois lugares.
  - Um agente dedicado separado para checagem de design — `planner.md`/`architect.md` não têm a tool
    `Task` (não podem delegar a um subagente), então a checagem precisa estar embutida no próprio
    `planner.md` para ser automática.

## Critérios de aceite

1. Dado um plano de sprint que envolve mudança de UI, quando o `planner` (ou o CTO planejando inline)
   segue o processo descrito, então o plano produzido inclui uma seção "Coerência de Design
   (DESIGN.md)" citando componentes/tokens/regras nomeadas reaproveitados ou justificando novidade.
2. Dado um plano de sprint que não envolve UI, então a seção "Coerência de Design" é omitida (não
   aparece como campo vazio).
3. Dado um pedido explícito do CEO ("sugira a próxima funcionalidade"), quando o CTO responde, então a
   sugestão cita `PRODUCT.md`/`DESIGN.md`/`docs/roadmap.md` e não gera PRD automaticamente — fica como
   proposta para aprovação.
4. Dado o agente `structural-auditor` invocado manualmente, quando ele roda contra o repo atual, então
   produz um relatório no formato de `AUDIT-template.md`, cobrindo as 5 categorias de escopo, sem
   nenhuma tentativa de escrita em disco (agente é só-leitura).
5. Dado o número da sprint atual, quando o CTO consulta a tabela de cadência em
   `docs/roadmap.md § Auditoria estrutural`, então consegue determinar corretamente se uma auditoria
   está devida (Sprint 34 é a primeira checagem, calculada como 29 + 5).

## Regras de negócio

Não há regras de negócio de domínio financeiro nesta sprint — é tooling de processo (prompts de
agentes + documentação viva). A única "regra" é de processo: a execução da auditoria estrutural
exige aprovação explícita do CEO a cada vez, mesmo quando a cadência indica que está devida.

## Dados e modelo

Nenhuma mudança de schema/banco de dados. Nenhuma migration.

## Segurança

- Isolamento de dados por usuário: não aplicável (nenhum dado de usuário é lido/exposto por esta
  sprint). O `structural-auditor`, quando eventualmente rodar checagens de isolamento por `user_id`
  no código (categoria "Postura de segurança" do seu escopo), opera só sobre o próprio código-fonte,
  nunca sobre dados reais de produção/dev.
- Secrets/credenciais envolvidas: nenhuma. O novo agente é só-leitura (`Read, Grep, Glob, Bash`), sem
  `Write`, e o `Bash` é usado apenas para comandos de análise (testes, lint, `npm audit`), nunca para
  persistir arquivos.

## Fora de escopo / decisões adiadas

- Primeira execução real da auditoria estrutural: adiada para a Sprint 34 (ou antes, se o CEO
  priorizar explicitamente).
- Agendamento automático (cron) da auditoria: explicitamente rejeitado pelo CEO nesta sessão de
  planejamento — reavaliar apenas se o CEO pedir explicitamente no futuro.
- Sugestão de feature automática/periódica: explicitamente rejeitada pelo CEO — permanece só sob
  demanda.

## Referências

- [DESIGN.md](../../DESIGN.md) — fonte única de padrões visuais consultada pela Capacidade 1.
- [PRODUCT.md](../../PRODUCT.md) — contexto de produto consultado pela sugestão de feature sob demanda.
- [docs/roadmap.md](../roadmap.md) — seção "Auditoria estrutural (cadência)" e "Registro de
  reavaliações futuras".
- [ADR-002-plugins.md](../architecture/adr/ADR-002-plugins.md) — decisão de agentes da Fase 0
  (contexto, não alterada por esta sprint).
- [ADR-003-agentes-coerencia-design-auditoria-estrutural.md](../architecture/adr/ADR-003-agentes-coerencia-design-auditoria-estrutural.md)
  — decisão de arquitetura desta sprint.
