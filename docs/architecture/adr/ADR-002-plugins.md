# ADR-002: Plugins e skills ativados na Fase 0

- **Status:** aprovado (execução da Fase 0; reversível a qualquer momento)
- **Data:** 2026-08-03

## Contexto

O prompt de bootstrap pede a instalação de 4 plugins (Everything Claude Code, Ponytail, Graphify, Impeccable) e a **não** instalação de um quinto (Understand Anything), com a exigência de ativar apenas o que é útil e justificar cada ativação — "menos é mais" — dado o teto de tokens da licença Claude Pro.

## Decisão

### 1. Everything Claude Code (`ecc@ecc`) — instalado seletivamente, NÃO como plugin completo

O marketplace real chama-se `ecc` (não `everything-claude-code` como no texto do bootstrap — nome desatualizado, corrigido aqui). Medi o custo com `claude plugin details ecc@ecc` antes de decidir:

- Plugin completo: **67 agentes, 375 skills, ~34.700 tokens always-on por sessão** — incompatível com "sessões curtas e focadas" do plano Pro.
- Decisão: **desinstalei o plugin completo** e copiei manualmente apenas os 5 agentes pedidos para `.claude/agents/` (nível de projeto), seguindo o próprio fluxo de instalação seletiva que o plugin recomenda (skill `configure-ecc`):
  - `planner.md` — modelo trocado de `opus` para `sonnet` (roteamento do projeto: Sonnet para planejamento).
  - `architect.md` — mesma troca opus→sonnet.
  - `code-reviewer.md` — já vem com `model: sonnet`, mantido.
  - `security-reviewer.md` — já vem com `model: sonnet`, mantido.
  - `doc-updater.md` — já vem com `model: haiku`, mantido (bate com a política "Haiku para tarefas mecânicas").
- `tdd-guide` **não existe** como agente nesse marketplace; o equivalente mais próximo é a **skill** `tdd-workflow` (TDD com meta de 80%+ cobertura), copiada para `.claude/skills/tdd-workflow/`.
- Todos os demais 62 agentes e ~374 skills (marketing, conteúdo, frameworks não usados — Django, Laravel, Kotlin, Rust, etc., pesquisa/social media) **não foram instalados**: nenhum se aplica à stack proposta (Python/FastAPI + React) ou ao escopo funcional deste produto.
- `.claude/settings.json` do projeto tem `enabledPlugins: {}` — o plugin `ecc@ecc` está desabilitado; os agentes/skills copiados funcionam como arquivos de projeto independentes, sem o custo always-on do marketplace inteiro.

### 2. Ponytail — instalado como plugin completo, modo `full`

Custo medido: ~983 tokens always-on (6 skills, 0 agentes, 3 hooks) — desprezível, plugin inteiro instalado (`ponytail@ponytail`, scope project).

Modo escolhido: **full** (o default do próprio plugin, entre lite/full/ultra). Justificativa: `full` já entrega o comportamento anti-over-engineering (YAGNI, stdlib primeiro, sem abstrações não pedidas) alinhado à filosofia deste projeto, sem a agressividade de `ultra`, que poderia atrapalhar decisões arquiteturais legítimas (ex.: separar API/frontend). Pode ser trocado a qualquer momento com `/ponytail lite|full|ultra`.

### 3. Graphify — pacote instalado, primeira construção do grafo adiada

`graphifyy` (pacote Python que fornece o binário `graphify`) instalado via pip a nível de usuário (ferramenta de dev, não dependência do produto). A skill `graphify` já existia a nível de usuário (`~/.claude/skills/graphify/`), conforme CLAUDE.md pessoal do CEO.

**Não rodei o pipeline completo agora.** Motivo: o repositório nesta fase contém só documentação/templates (nenhum código). Rodar `/graphify` sobre um corpus só-de-docs aciona extração semântica via subagentes (custo de tokens) para gerar um grafo que ficará obsoleto assim que o código real da Sprint 1 existir. Decisão: primeira construção do grafo ao final da Sprint 1 (quando houver backend/frontend reais), e regeneração ao fim de cada sprint seguinte — já registrado em [CLAUDE.md](../../../CLAUDE.md) e [docs/roadmap.md](../../roadmap.md).

Sobre "modo strict" mencionado no prompt de bootstrap: essa opção **não existe** na versão atual do graphify (não há flag `--strict`; o mais próximo é `--mode deep` para extração mais completa). Recomendação: usar o modo padrão nas primeiras execuções e avaliar `--mode deep` apenas se o relatório de auditoria (`GRAPH_REPORT.md`) se mostrar raso demais.

### 4. Impeccable — instalado, PRODUCT.md gerado; DESIGN.md adiado

`npx impeccable install` rodado na raiz do projeto (scope project) — instalou a skill em `.claude/skills/impeccable/` e dois hooks em `.claude/settings.local.json` (`PostToolUse` em Edit/Write/MultiEdit e `Stop`, ambos chamando o detector de anti-padrões de design, sem custo de contexto quando não disparam).

Segui o próprio fluxo `init` do Impeccable: ele **não gera DESIGN.md nesta etapa** — apenas [PRODUCT.md](../../../PRODUCT.md), com os fatos de produto já confirmados pelo CEO no prompt de bootstrap (usuários, propósito, posicionamento, constraints, princípios). **DESIGN.md é criado pelo fluxo `new-work` quando o primeiro trabalho visual real começar** (Sprint de dashboards/frontend) — divergência intencional do texto literal do bootstrap ("gerar PRODUCT.md/DESIGN.md"), pois gerar um DESIGN.md sem nenhuma tela ainda seria inventar um mundo visual prematuramente.

`/impeccable audit` será usado como gate nas sprints que tocarem frontend (a partir da Sprint 1/E1 se incluir UI, ou nas sprints de dashboards E5/E6).

### 5. Understand Anything — não instalado (conforme instrução)

Marketplace já conhecido globalmente neste ambiente (de sessões anteriores em `c:\Financeiro v2`), mas **não instalado nem habilitado neste projeto**. Reavaliar quando o codebase passar de ~100 arquivos — registrado em [docs/roadmap.md](../../roadmap.md).

## Consequências

- Positivas: custo always-on por sessão fica baixo (Ponytail ~1k + os 5 agentes/1 skill do ECC, que só custam tokens quando efetivamente invocados, não sempre-on) — compatível com o teto do plano Pro.
- Negativas / trade-offs aceitos: se novas necessidades surgirem (ex.: precisar de um reviewer de outra linguagem), será preciso copiar manualmente mais agentes do marketplace `ecc` em vez de já tê-los todos disponíveis — custo aceito em troca de economia de tokens contínua.
- Ação pendente de aprovação do CEO: nenhuma — instalação de plugin já estava na lista pré-aprovada; only a *forma* de instalação (seletiva em vez de completa) foi uma decisão técnica minha, documentada aqui para transparência.

## Referências

- [CLAUDE.md](../../../CLAUDE.md) — seção "Plugins ativos"
- [PRODUCT.md](../../../PRODUCT.md)
- [docs/roadmap.md](../../roadmap.md)
