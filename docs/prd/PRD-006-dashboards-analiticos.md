# PRD-006: Dashboards analíticos — design system, tendência e percentual (E6, parte 1)

- **Status:** aprovado
- **Épico relacionado:** E6 — Dashboards analíticos ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-006](../sprints/SPRINT-006-dashboards-analiticos-plan.md)

## Problema

A Sprint 5 entregou o dashboard funcional (resumo + drill-down), mas com
dois problemas reais reportados pelo CEO ao testar a versão deployada:

1. **Falta de identidade visual real.** A tipografia é `system-ui` puro, o
   layout centraliza tudo em `880px` deixando a lateral da tela vazia, e a
   nav do app (`ProtectedPage`) só recebeu estilo de fato numa correção
   pontual pós-deploy — o conjunto ainda lê como protótipo, não produto.
2. **O dashboard mostra o mês isolado, sem contexto histórico.** Um total
   de R$ 15.514,42 de despesa não diz se isso é normal, uma alta ou uma
   queda em relação aos meses anteriores. E dentro do drill-down, um valor
   de categoria/conta não diz que fração do nível acima ele representa —
   o usuário precisa fazer essa conta de cabeça.
3. **O drill-down esconde o nível anterior a cada clique**, obrigando o
   usuário a voltar para comparar duas categorias ou dois meios de
   pagamento lado a lado.

## Escopo

- **Incluído:**
  - Fundação de design system nova: tipografia mais distintiva (par de
    fontes auto-hospedado, escolhido por comparação visual real antes de
    fixar — ver §Regras de negócio) e melhor aproveitamento da largura da
    tela (`.dash-page` deixa de ser uma coluna estreita centralizada).
  - Campo `percentual` em `GET /dashboards/por-categoria` e
    `GET /dashboards/por-meio-pagamento` — cada linha ganha sua fração do
    total do nível imediatamente acima (categoria → despesa/receita do
    período; meio de pagamento → categoria selecionada). No nível de linha
    de extrato (transação individual), o percentual é calculado no
    frontend contra o total do meio de pagamento já conhecido do passo
    anterior do drill — sem endpoint novo nesse nível.
  - Endpoint novo `GET /dashboards/tendencia` — série mensal de
    receita/despesa/saldo dos últimos 3, 6 ou 12 meses (parametrizável),
    terminando no mês filtrado. Cards de Receita, Despesa e Saldo ganham
    sparkline de tendência.
  - Endpoint novo `GET /dashboards/por-categoria/tendencia` (ou parâmetro
    equivalente que estenda `/por-categoria`) — mesma série mensal, mas
    agrupada por subcategoria, para alimentar uma tendência por linha
    dentro do drill-down de categoria. Modelo visual mais simples que o
    dos cards de resumo (confirmado pelo CEO — não precisa ser o mesmo
    componente).
  - Drill-down em formato sanfona: `DashboardsPage.tsx` passa a manter
    cada nível expandido/recolhido de forma independente, sem esconder o
    nível anterior. Categoria → Meio de pagamento → Linha de extrato
    aparecem aninhados (indentados), não em telas que se substituem.
  - Testes automatizados (meta ≥80% cobertura na lógica nova), sem
    depender de rede/credenciais reais.
- **Fora de escopo (explicitamente):**
  - **Tendência de Patrimônio.** Limitação real de schema, já registrada
    no PRD-005: não existe série histórica de saldo de conta Pluggy nem de
    valor de ativo/passivo neste sistema — só o valor atual. Reconstruir
    isso exigiria snapshot periódico (job novo) ou uma fonte de dado que
    não existe hoje. Fica para quando isso for endereçado especificamente
    (E6 futuro, não esta sprint). O card de Patrimônio continua sem
    sparkline.
  - Tendência/percentual no nível de meio de pagamento e linha de extrato
    (confirmado pelo CEO — tendência vai só até categoria nesta sprint).
  - Tela de Ativos e sua tela de custos — vira Sprint 7 (E6, parte 2), ver
    `docs/roadmap.md`.
  - Modernização da tabela de Categorização e paginação — vira Sprint 8,
    ver `docs/roadmap.md`. Reaproveita a fundação de design system desta
    sprint, mas é módulo independente.
  - Qualquer nova biblioteca de gráficos — continua Recharts (já instalado
    na Sprint 5).

## Critérios de aceite

1. Dado o dashboard aberto num período com dados, então os cards de
   Receita, Despesa e Saldo mostram uma sparkline de tendência ao lado/
   próximo ao card, comparando o mês filtrado aos meses anteriores.
2. Dado o seletor de período histórico (3, 6 ou 12 meses), quando o
   usuário troca a opção, então a tendência exibida recalcula a partir do
   mês filtrado no dashboard (não do mês corrente do calendário).
3. Dado o drill-down por categoria aberto, então cada linha mostra uma
   tendência histórica própria (visual mais simples que a dos cards) e o
   percentual que representa do total de despesa/receita do período.
4. Dado o drill-down por meio de pagamento aberto (dentro de uma
   categoria), então cada linha mostra o percentual que representa do
   total daquela categoria.
5. Dado o nível de linha de extrato aberto (dentro de categoria + meio de
   pagamento), então cada transação mostra o percentual que representa do
   total daquele meio de pagamento, calculado no frontend.
6. Dado que o usuário expande uma categoria e depois um meio de pagamento
   dentro dela, então a lista de categorias e a lista de meios de
   pagamento continuam visíveis simultaneamente (nenhum nível anterior é
   escondido); recolher um nível some só com o que está abaixo dele.
7. Dado o CI, quando a suíte roda, então os testes novos (tendência,
   percentual, sanfona) passam com cobertura ≥80% nos módulos novos.
8. Dado qualquer requisição a `/dashboards/tendencia` ou
   `/dashboards/por-categoria/tendencia` sem cookie de sessão válido,
   então recebo 401; dado um usuário autenticado, então nunca vejo
   tendência/total de outro usuário.

## Regras de negócio

- Percentual é sempre calculado sobre o mesmo universo já filtrado da
  agregação (mesmo período, mesma exclusão de `Transferência interna`) —
  nunca um percentual "bruto" sobre dado não filtrado.
- Percentual com denominador zero (período sem nenhuma transação do tipo)
  retorna `0`, nunca erro ou `NaN`.
- Tendência usa sempre `data_competencia`, mesma base de `get_summary` —
  nunca `data`.
- A escolha de tipografia não é travada neste PRD. A execução roda uma
  rodada de comparação visual real (2-3 pares de fonte renderizados via
  `scripts/browser-check`, mesmo processo usado para a direção de cor na
  Sprint 5) e o CEO escolhe antes da fonte entrar em `index.css`. Fonte
  precisa ser auto-hospedável (licença permite `.woff2` local, sem
  depender de CDN externo).
- Sanfona: expandir um nível não fecha os demais — múltiplas categorias
  podem estar expandidas ao mesmo tempo, cada uma com seu próprio estado
  de meio de pagamento/extrato expandido ou não.

## Dados e modelo

- Nenhuma tabela nova, nenhuma migration. Tendência é recalculada por
  consulta direta sobre `pluggy_transactions.data_competencia` já
  existente — mesmo padrão de simplicidade das sprints anteriores (sem
  tabela pré-calculada, sem cache).
- `app/dashboards/service.py` ganha `get_tendencia()` e
  `get_tendencia_por_categoria()` — agregação por `(ano, mês)` extraído de
  `data_competencia`, e por `(ano, mês, subcategory_id)` para a versão por
  categoria, numa única query cada (evita N chamadas por mês/categoria).
- `app/schemas/dashboards.py`: `TendenciaMesOut` (ano, mes, receita,
  despesa, saldo), `TendenciaCategoriaOut` (subcategory_id,
  subcategory_nome, pontos: lista de `{ano, mes, total}`).
  `CategoriaTotalOut`/`MeioPagamentoTotalOut` ganham campo `percentual:
  Decimal`.

## Segurança

- Isolamento por usuário: `/dashboards/tendencia` e
  `/dashboards/por-categoria/tendencia` filtram por `user_id` do JWT, mesmo
  padrão dos demais endpoints de `/dashboards/*`.
- Nenhum secret novo. Nenhuma chamada a serviço externo nova (fontes
  auto-hospedadas, servidas pelo próprio nginx do frontend, não CDN).

## Fora de escopo / decisões adiadas

- Tendência de patrimônio — precisa de snapshot histórico, não existe
  ainda (ver §Escopo).
- Tela de Ativos (Sprint 7) e modernização de Categorização (Sprint 8) —
  PRDs próprios.
- Cache/pré-cálculo de tendência — decisão fixa do projeto (agregação
  direta), mesmo com o custo adicional de series temporais; revisitar só
  se a VM de produção mostrar necessidade real.

## Referências

- [docs/roadmap.md](../roadmap.md) (E6)
- [PRD-005 — Dashboards core](PRD-005-dashboards-core.md) (fundação que
  esta sprint estende; registra a limitação de série histórica de
  patrimônio que segue valendo aqui)
- [DESIGN.md](../../DESIGN.md) (sistema de design a estender, não
  substituir — tokens de cor/espaçamento continuam os mesmos, só
  tipografia e largura mudam)
- [docs/sprints/SPRINT-005-dashboards-core-report.md](../sprints/SPRINT-005-dashboards-core-report.md)
  (achados de QA visual real via `scripts/browser-check`, ferramenta a
  reaproveitar nesta sprint para a escolha de tipografia)
