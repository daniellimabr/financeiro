# PRD-027: Simulação "ocultar gasto" e gráfico comparativo de categorias

- **Status:** executado (CEO, 2026-08-19). Substituído mais cedo no mesmo dia da aprovação da
  Sprint 26, antes de qualquer execução — o CEO reverteu essa decisão no mesmo dia e pediu a
  execução do escopo abaixo, com uma revisão à decisão 1 feita ao vivo durante a execução (ver
  nota na decisão 1). Ver
  [SPRINT-027-ocultar-gasto-comparativo-categorias-report.md](../sprints/SPRINT-027-ocultar-gasto-comparativo-categorias-report.md).
- **Épico relacionado:** nenhum (cross-epic, 3ª de 3 sprints desta sessão de planejamento — ver
  PRD-025/PRD-026)
- **Sprint(s):** [SPRINT-027-ocultar-gasto-comparativo-categorias-plan.md](../sprints/SPRINT-027-ocultar-gasto-comparativo-categorias-plan.md)

## Problema

O CEO quer poder simular "como teria sido um mês sem um determinado gasto" diretamente no
drilldown de Despesa/Receita do Dashboard, e comparar como a composição de gasto por categoria
evoluiu mês a mês.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-19), via perguntas diretas — as duas features desta
sprint são as mais novas do pedido, com mais decisões de produto em aberto:

1. **Escopo do "ocultar gasto":** ocultar um item recalcula **só o funil de Despesa/Receita
   aberto** (total do grupo/subcategoria, mini gráfico local) — não recalcula os cards de resumo do
   topo (Saldo, Patrimônio, Saldo Acumulado, sparklines dos cards). Escolhido sobre a alternativa de
   recalcular a tela inteira porque os cards de resumo vêm de endpoints agregados separados no
   backend, não do mesmo dado já carregado no funil — recalcular a tela inteira exigiria um
   parâmetro de exclusão threaded por vários endpoints, escopo bem maior.
   >
   > **Revisado ao vivo durante a execução (2026-08-19):** o CEO pediu que os cards **Receita**,
   > **Despesa** e **Saldo** do topo também reflitam a simulação — sem isso não dava pra
   > visualizar o impacto de uma linha oculta no total do mês. Esses 3 cards são derivados
   > diretamente do mesmo período filtrado (soma/subtração simples, sem chamada de rede nova, só
   > ajuste no cliente); **Patrimônio e Saldo Acumulado continuam intocados** — vêm de fórmulas
   > (patrimônio líquido, saldo bancário acumulado) sem relação direta com "ocultar uma linha de
   > gasto do mês", então incluí-los seria estranho conceitualmente, não só mais trabalho. Ver
   > detalhe em
   > [SPRINT-027-ocultar-gasto-comparativo-categorias-report.md](../sprints/SPRINT-027-ocultar-gasto-comparativo-categorias-report.md).
2. **Persistência:** estado 100% local/efêmero, mesmo padrão de `applyHipoteticas` da tela
   Projeção (Sprint 14) — sem tabela nova, sem CRUD, reseta ao fechar o funil ou trocar filtro.
3. **Gráfico comparativo de categorias:** aparece dentro do funil Despesa/Receita, ao ser aberto —
   não em seção própria fixa do Dashboard.

## Escopo

### Incluído

- **"Ocultar gasto" (binóculo):** toggle por linha de transação dentro do funil Despesa/Receita
  aberto no Dashboard — ícone SVG de binóculo. Ativa "modo visão simulada" pro funil aberto;
  múltiplos itens podem ser marcados. Itens marcados saem da soma exibida (total do grupo/
  subcategoria, mini gráfico local) enquanto o funil estiver aberto. Estado local ao componente do
  funil, sem persistência.
- **Gráfico comparativo de categorias:** ao abrir o funil Despesa (ou Receita) no Dashboard, exibe
  um gráfico de composição por categoria ao longo dos últimos meses (mesma janela do seletor de
  histórico já existente — 3/6/12), permitindo comparar a evolução mês a mês.

### Fora de escopo (explicitamente)

- Recalcular cards de resumo do Dashboard (Saldo, Patrimônio, Saldo Acumulado) a partir de itens
  ocultos — decisão explícita do CEO nesta sessão (ver "Decisões do CEO", item 1).
- Persistir cenários de "ocultar gasto" entre sessões — mesma decisão já tomada para a tela
  Projeção (Sprint 14, registrada em "Registro de reavaliações futuras" do roadmap); candidato a
  revisão conjunta futura se o CEO priorizar os dois.
- Aplicar "ocultar gasto" em telas fora do Dashboard (Ativos, Passivos, Investimentos, Natureza) —
  só o funil Despesa/Receita do Dashboard foi pedido.

## Critérios de aceite

1. Dado o funil de Despesa ou Receita aberto no Dashboard, quando o usuário marca o ícone de
   binóculo numa transação, então essa transação some do total do grupo/subcategoria exibido e do
   mini gráfico local, sem chamada de rede nova.
2. Dado o mesmo funil, quando múltiplas transações são marcadas, então todas saem da soma
   simultaneamente; desmarcar uma restaura seu valor à soma.
3. Dado o funil fechado ou o filtro de mês/ano trocado, então todo item marcado como oculto volta
   ao estado normal (sem persistência).
4. Dado os cards de resumo do topo do Dashboard (Saldo, Patrimônio, Saldo Acumulado), quando um
   item é ocultado no funil, então esses cards **não** mudam de valor.
5. Dado o funil Despesa ou Receita aberto, então um gráfico de composição por categoria ao longo
   dos últimos meses (3/6/12, conforme seletor de histórico) é exibido dentro do funil.
6. Dado dois usuários diferentes, nenhuma consulta nova quebra isolamento por `user_id`.
7. Dado o CI, quando a suíte roda, então os testes novos/alterados passam com cobertura ≥80% nos
   módulos tocados, suíte completa 100% verde.

## Regras de negócio

- "Ocultar gasto" é uma simulação puramente de apresentação — não altera categorização, não marca
  a transação de nenhuma forma persistente, não afeta nenhum outro usuário nem sessão futura do
  mesmo usuário.
- O gráfico comparativo de categorias usa dado já agregado por categoria/mês (mesma fonte de
  `GET /dashboards/por-categoria/tendencia`, já existente) — confirmar em execução se atende sem
  mudança, ou se precisa de um parâmetro adicional (aditivo, sem quebrar contrato existente).

## Dados e modelo

- Sem tabela nova, sem migration prevista.
- Nenhum endpoint novo previsto para "ocultar gasto" (estado 100% client-side). O gráfico
  comparativo de categorias pode reaproveitar `GET /dashboards/por-categoria/tendencia`; se a
  execução encontrar necessidade de agregação diferente (ex.: top N categorias por gasto, não
  todas), registrar como achado real no relatório da sprint, não presumido aqui.

## Segurança

- Isolamento por usuário preservado (nenhuma consulta nova além do possível reuso do endpoint de
  tendência por categoria já existente e já isolado por `user_id`).
- Nenhum secret novo introduzido.

## Fora de escopo / decisões adiadas

- Persistir "ocultar gasto" como cenário salvo entre sessões — candidato a sprint futura conjunta
  com a mesma pauta já registrada para a tela Projeção, se o CEO priorizar.
- Escopo "tela inteira" do ocultar gasto (recalcular todos os cards) — decisão explícita do CEO de
  não fazer agora; retomar só se o CEO pedir depois de usar a versão escopada ao funil.

## Referências

- [PRD-014 — Projeção de custos futuros com despesas hipotéticas](PRD-014-projecao-custos-hipoteticas.md)
  — precedente direto de simulação client-side efêmera (`applyHipoteticas`), padrão reaproveitado
  aqui para "ocultar gasto".
- [PRD-025](PRD-025-escala-visual-tela-ativos-cards-dashboard.md) /
  [PRD-026](PRD-026-interatividade-graficos-dashboard.md) — sprints irmãs desta sessão de
  planejamento, independentes entre si.
- Plano de sessão: `C:\Users\Daniel\.claude\plans\planejar-sprint-25-ou-distributed-noodle.md`.
