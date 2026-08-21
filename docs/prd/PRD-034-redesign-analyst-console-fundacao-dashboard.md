# PRD-034: Redesign visual "Analyst Console" — fundação + Dashboard

- **Status:** proposto, aguardando aprovação do CEO
- **Épico relacionado:** E10 — Redesign visual (Analyst Console), novo épico (ver `docs/roadmap.md`).
  Esta é a primeira sprint do épico; as demais 10 telas ficam como backlog, a planejar
  individualmente.
- **Sprint(s):** [SPRINT-034-redesign-analyst-console-fundacao-dashboard-plan.md](../sprints/SPRINT-034-redesign-analyst-console-fundacao-dashboard-plan.md)

## Problema

O dashboard atual (`DashboardsPage.tsx`) esconde o que o CEO mais usa atrás de clique — a tabela de
conferência do Saldo Acumulado só aparece ao abrir o drill-down, e o comparativo de Receita/Despesa
por categoria também. Isso não reflete o workflow real: desde a Sprint 32, o Saldo Acumulado é
literalmente a ferramenta que o CEO usa para conciliar o extrato bancário ao centavo, conta por
conta (Sprints 32/33 — 4 divergências reais encontradas e corrigidas usando essa tabela). Uma
ferramenta de conciliação que exige um clique extra para aparecer está desalinhada com a frequência
real de uso.

Além disso, o sistema visual atual (paleta verde/terracota, `DESIGN.md`) tem uma folga grande de
espaço vazio abaixo dos cards e nenhum contexto de variação (não dá pra ver, olhando só os cards, se
a receita deste mês está acima ou abaixo do normal).

## Decisão do CEO

O CEO pediu 3 propostas visuais comparáveis (drafts publicados como Artifacts), cada uma cobrindo
Dashboard + shell + uma tela secundária, com dados fictícios. Escolheu a **Proposta 3 — "Analyst
Console"**: ótica de analista de dados sênior — cada KPI mostra delta vs. mês anterior + sparkline
com referência; paleta desaturada estilo ferramenta de BI (Inter, azul-aço como accent, separado da
semântica verde=receita/vermelho=despesa); a tabela de conferência do Saldo Acumulado por conta fica
sempre visível, não atrás de clique; comparativo Receita/Despesa como pequenos múltiplos (nunca
gráfico de eixo duplo) com tooltip no hover; navegador de mês (◀ mês ▶) na barra superior.

Refinamentos pedidos e já validados no mockup antes desta sprint:
- Sparklines dos cards de Ativos/Passivos/Patrimônio no mesmo tamanho/traço dos demais KPIs (sem
  variação de estilo dentro da mesma tela).
- Gráfico de Receita vs. Despesa numa escala compartilhada entre as duas séries (não cada uma
  normalizada no seu próprio mínimo/máximo) — comparação real, não só visual.
- Tooltip funcional no hover (crosshair + valor do mês), não decorativo.

Mockup de referência (fonte de verdade visual para esta sprint): Artifact "Analyst Console"
publicado nesta sessão de planejamento — visão Dashboard.

**Decisão de escopo confirmada com o CEO nesta sessão:** uma reforma completa nas 11 telas do app de
uma vez é maior que qualquer sprint já feita (a Sprint 13, maior até hoje, cobriu só a unificação de
tabelas e já deslocou 2 sprints da fila). Esta sprint cobre **fundação (tokens/sistema) + shell +
Dashboard**; as outras 10 telas ficam para sprints futuras do épico E10, cada uma com seu próprio
`/plan`.

**Auditoria estrutural:** esta é a Sprint 34, o checkpoint exato da cadência (4/5 sprints desde a
última verificação — ver `docs/roadmap.md` § Auditoria estrutural). O CTO propôs rodar o
`structural-auditor` antes de começar o redesign; **o CEO decidiu adiar** — não reabrir sem pedido
explícito dele.

## Escopo

### Incluído

1. **Tokens de design** (`frontend/src/index.css`, blocos `:root` e `:root[data-theme="dark"]`):
   paleta Analyst Console — accent azul-aço (`#2a5fd6` claro / `#6d93ec` escuro), mantendo
   verde=receita e vermelho=despesa como semântica **separada** do accent (mudança conceitual: hoje
   o verde é accent e receita ao mesmo tempo). Tipografia Inter (self-hosted em
   `frontend/public/fonts/`, mesmo padrão do Archivo/Public Sans atual — pesos 400/500/600/700/800).
   Mantém Tabular Money Rule e Flat Ledger Rule (sem sombra) — regras não contrariadas pela Proposta 3.
2. **Componentes novos reutilizáveis** em `frontend/src/components/`: `KpiTile` (label + delta vs.
   período anterior + valor + sparkline + selo de conferência opcional) e um helper de
   tooltip/crosshair para gráfico de linha (hover mostra mês + valor exato, seguindo o padrão do
   mockup). Ambos servem às sprints seguintes do épico, não só esta.
3. **Shell** (`frontend/src/pages/ProtectedPage.tsx`): sidebar/nav no novo sistema visual, mesma
   navegação.
4. **`DashboardsPage.tsx`**: migração completa —
   - KPI row (Saldo Anterior, Receita, Despesa, Saldo, Saldo Acumulado) usando `KpiTile`, com delta
     vs. mês anterior calculado a partir dos dados de tendência já buscados (não deve exigir
     endpoint novo — confirmar no início da execução se o histórico de 6 meses já carregado para os
     sparklines atuais é suficiente; se não for, é um desvio de escopo a reportar, não a resolver
     silenciosamente ampliando o backend).
   - Row secundária Ativos/Passivos/Patrimônio, mesmo padrão `KpiTile`.
   - Tabela de conferência do Saldo Acumulado (`SaldoAcumuladoConferenciaTable`, já existe — só
     restilizar, sem tocar na lógica de dados) sempre visível, não atrás de clique.
   - Comparativo Receita vs. Despesa como pequenos múltiplos (dois gráficos, mesma escala
     compartilhada), tooltip funcional no hover.
   - Navegador de mês (◀ mês ▶) substituindo o filtro de mês simples, plugado no estado de
     ano/mês já existente na página.
5. **Cobertura de testes**: configurar `@vitest/coverage-v8` (`frontend/vite.config.ts` +
   `package.json` script `test:coverage`), definindo que o threshold de 80% se aplica a lógica de
   negócio (hooks, cálculos, componentes com comportamento — não cobertura cega de todo JSX
   decorativo).
6. Atualizar/reescrever `DashboardsPage.test.tsx` e `ProtectedPage.test.tsx` para a nova estrutura;
   testes novos para `KpiTile` e a interação de tooltip/crosshair.
7. **`DESIGN.md`** reescrito a partir do sistema construído (mesmo padrão das Sprints 5/13 —
   documentar o que foi implementado, não o planejado).
8. **`docs/roadmap.md`**: novo épico E10, Sprint 34 como primeira entrada, as 10 telas restantes
   como backlog do épico; registro da decisão de adiar a auditoria estrutural.

### Fora de escopo (explicitamente)

- Categorização, Ativos, Investimentos, Passivos, Configurações, Natureza, Orçamento, Categorias,
  Login — continuam no sistema visual atual até suas próprias sprints do épico E10. Os dois sistemas
  de tokens/estilo coexistem durante o épico; é o preço aceito de não repetir o excesso de escopo já
  sinalizado como arriscado pela Sprint 13.
- Indicador de status de conciliação no rodapé da sidebar ("3 de 3 contas conferidas") do mockup —
  precisa de um hook/endpoint novo que não existe ainda. Backlog do épico, não implementado nesta
  sprint.
- Qualquer mudança de lógica de negócio/cálculo (Saldo Acumulado, Receita/Despesa, Patrimônio) —
  esta sprint é estritamente visual/estrutural de front-end; nenhuma fórmula validada nas Sprints
  32/33 é reaberta.
- Auditoria estrutural (`structural-auditor`) — adiada por decisão explícita do CEO.

## Critérios de aceite

1. `frontend/src/index.css` usa a paleta/tipografia Analyst Console; Inter carrega self-hosted (sem
   CDN externo em produção), mesmo padrão do Archivo/Public Sans hoje.
2. `ProtectedPage` (shell/sidebar) renderiza no novo sistema visual, navegação idêntica à atual.
3. No Dashboard: os 5 KPIs de fluxo (Saldo Anterior/Receita/Despesa/Saldo/Saldo Acumulado) mostram
   delta vs. mês anterior + sparkline; a tabela de conferência do Saldo Acumulado está sempre
   visível (nenhum clique necessário para vê-la); o comparativo Receita/Despesa usa escala
   compartilhada entre as duas séries e tem tooltip funcional no hover (mês + valor exato); o
   navegador de mês (◀ ▶) troca o período corretamente, incluindo os limites (não navega para o
   futuro além do mês corrente).
4. Nenhuma mudança de valor/cálculo — os números exibidos no Dashboard novo batem exatamente com os
   do Dashboard atual, para o mesmo usuário/período (mesma fonte de dados, só apresentação nova).
5. `KpiTile` e o helper de tooltip/crosshair existem como componentes isolados, testados, e são
   reaproveitados (não duplicados) entre Ativos/Passivos/Patrimônio e os 5 KPIs de fluxo.
6. `npm run test:coverage` roda e reporta cobertura; lógica de negócio nova/alterada (cálculo de
   delta, lógica do tooltip/crosshair, navegador de mês) tem cobertura ≥80%.
7. Suíte 100% verde (`npm test`), lint sem erros (`npm run lint`), `npx tsc -b` sem erros.
8. `DESIGN.md` reescrito reflete o sistema de fato implementado.
9. Browser-check (`scripts/browser-check/`) capturado em claro/escuro, desktop/mobile, comparado
   visualmente ao mockup aprovado — sem overflow, sem quebra de layout.
10. `docs/roadmap.md` tem o novo épico E10 e o registro da decisão de adiar a auditoria estrutural,
    datado.

## Regras de negócio

- Delta de cada KPI é sempre "este período vs. o período imediatamente anterior" (mesmo regime
  competência/caixa selecionado) — não uma média móvel, não configurável nesta sprint.
- O navegador de mês nunca permite avançar além do mês corrente (mesma regra implícita já usada no
  filtro de mês/ano atual).
- A tabela de conferência do Saldo Acumulado continua usando exatamente os dados de
  `get_saldo_acumulado_conferencia` (Sprint 32) — só a apresentação muda, nunca a lógica de
  agregação.
- Nenhuma cor nova carrega significado de dado — accent azul-aço é só interação/marca; verde/
  vermelho continuam exclusivos de receita/despesa (nenhuma reabertura da One Meaning Rule).

## Dados e modelo

- Nenhuma migration de schema prevista.
- Nenhum endpoint novo esperado — a implementação deve reaproveitar os dados de tendência/histórico
  já buscados pela página atual para os sparklines existentes. Se a investigação inicial da
  execução mostrar que o delta vs. mês anterior precisa de um dado que a API não expõe hoje, isso é
  um desvio a reportar ao CEO antes de expandir o backend, não a decidir sozinho.
- Nenhum dado sensível novo, nenhum secret.

## Segurança

- Sem mudança de isolamento por usuário — puramente front-end, mesmas chamadas de API já
  autenticadas/filtradas por `user_id`.

## Referências

- Mockup aprovado: Artifact "Analyst Console" (Proposta 3), publicado nesta sessão de planejamento —
  visão Dashboard é a fonte de verdade visual.
- [DESIGN.md](../../DESIGN.md) — sistema atual, será substituído a partir do que for construído.
- [PRD-032](PRD-032-saldo-acumulado-saldo-real-e-conferencia-por-conta.md) e
  [PRD-033](PRD-033-auditoria-saldo-acumulado-abril-agosto.md) — por que a conferência do Saldo
  Acumulado é o módulo mais importante da tela, não decoração.
- [ADR-003](../architecture/adr/ADR-003-agentes-coerencia-design-auditoria-estrutural.md) — cadência
  de auditoria estrutural, checkpoint desta sprint (adiado por decisão do CEO).
- `docs/dashboards-guia-cards.md` — semântica de cada card, não alterada por esta sprint.
