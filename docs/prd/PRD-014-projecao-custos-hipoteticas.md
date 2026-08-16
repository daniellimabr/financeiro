# PRD-014: Projeção de custos futuros com despesas hipotéticas

- **Status:** aprovado
- **Épico relacionado:** E9 Natureza e projeção de custos — fecha o épico (ver [docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-014](../sprints/SPRINT-014-projecao-custos-hipoteticas-plan.md)

## Problema

`Subcategory.natureza` (fixo recorrente/variável recorrente/eventual, Sprint
12) existe justamente para viabilizar projeção de custos futuros — o próprio
PRD-012 registrou que a classificação seria "pré-requisito direto da tela de
projeção de custos futuros... que vai projetar médias justamente a partir de
itens fixos/variáveis recorrentes". Até esta sessão de planejamento,
"projeção de custos futuros com despesas hipotéticas" existia só como título
no roadmap (empurrado da Sprint 13 para a Sprint 14), sem nenhuma decisão de
produto registrada. O CEO quer conseguir olhar para os próximos meses e
estimar quanto vai gastar/receber com base no padrão recorrente já
classificado, e simular o efeito de gastos/receitas hipotéticos (ex.: "e se
eu comprar um carro em 6 meses?") sobre esse cenário.

## Escopo

- **Incluído:**
  - Novo cálculo de projeção no backend (`app/dashboards/service.py`):
    `get_projecao()` — para cada um dos próximos N meses (horizonte
    parametrizável, 3/6/12), retorna receita/despesa/saldo projetados como a
    **média dos últimos 3 meses** (janela parametrizável) de subcategorias
    classificadas como `fixa` ou `variavel` (despesa e receita), valor
    constante repetido em todos os meses futuros — sem crescimento,
    inflação ou sazonalidade.
  - `eventual` e subcategoria sem `natureza`/sem categoria ficam **fora da
    base projetada** — mesma premissa de não recorrência já usada desde a
    Sprint 12, aqui aplicada por exclusão em vez de fallback.
  - Endpoint `GET /dashboards/projecao?ano=&mes=&meses_futuros=&janela_media=`,
    isolado por usuário, mesmo padrão dos demais endpoints de `/dashboards/*`.
  - Tela nova "Projeção" no menu: seletor de mês-base + horizonte (3/6/12),
    gráfico combinando histórico real (linha sólida) e projeção (linha
    tracejada) de receita/despesa/saldo, 3 cards com os valores projetados
    (média mensal do horizonte).
  - Painel de simulação "hipotéticas": o usuário adiciona linhas ad-hoc
    (nome, valor, despesa ou receita, única — aplicada a um mês do
    horizonte — ou mensal — aplicada em todos os meses do horizonte); cards
    e gráfico recalculam no cliente, sem chamada de API. **Efêmero — não
    persiste** entre sessões/reload.
  - Testes automatizados (meta ≥80% cobertura nos módulos novos) e
    `scripts/browser-check/check-sprint14.mjs` novo.

- **Fora de escopo (explicitamente):**
  - Persistência de despesas/receitas hipotéticas (CRUD, tabela nova) —
    decisão do CEO nesta sessão: a simulação é só uma ferramenta de "e se",
    não um planejamento salvo. Registrada como candidata futura no roadmap,
    sem sprint numerada.
  - Crescimento/inflação/sazonalidade na projeção — sempre valor constante
    repetido.
  - Drill-down até transação dentro da tela de Projeção — não há transação
    real para uma projeção; a tela "Natureza" (Sprint 12) já cobre
    drill-down do que já aconteceu.
  - Qualquer mudança em `get_por_natureza`/na tela "Natureza" existente.

## Critérios de aceite

1. Dada a tela "Projeção", quando o usuário a abre, então vê um gráfico com
   histórico real (últimos N meses, N = horizonte selecionado) em linha
   sólida seguido de projeção em linha tracejada, e 3 cards (Receita/
   Despesa/Saldo projetados).
2. Dado o seletor de horizonte (3/6/12 meses futuros), quando o usuário
   troca o valor, então gráfico e cards recalculam para o novo horizonte.
3. Dada uma subcategoria classificada como `fixa` ou `variavel`, quando
   contribui para os últimos 3 meses (janela padrão), então seu valor médio
   entra na projeção; uma subcategoria `eventual`, sem `natureza`, ou uma
   transação sem subcategoria, não entram.
4. Dado o painel de simulação, quando o usuário adiciona uma hipotética
   "única" com mês-alvo dentro do horizonte, então só aquele mês do
   gráfico/cards é afetado; quando adiciona uma "mensal", todos os meses do
   horizonte são afetados — em ambos os casos, sem nenhuma chamada de rede
   nova.
5. Dado o painel de simulação, quando o usuário recarrega a página, então
   nenhuma hipotética anterior persiste (comportamento efêmero, decisão
   explícita do CEO).
6. Dado o endpoint `GET /dashboards/projecao`, quando chamado sem
   autenticação ou por outro usuário, então retorna 401/dados isolados por
   `user_id`, mesmo padrão de todos os endpoints de dashboard existentes.
7. Dado o CI, quando a suíte roda, então os testes novos (backend e
   frontend) passam com cobertura ≥80% nos módulos novos, sem regressão nas
   suítes existentes de dashboards.

## Regras de negócio

- Projeção é sempre **valor constante repetido** (média da janela) em cada
  mês futuro — não há tendência, crescimento ou ajuste sazonal.
- Base da média usa as mesmas exclusões já aplicadas em todo dashboard
  (`_base_query`): grupos com `excluir_de_totais=true`, e `tipo=credito` em
  conta de cartão de crédito (nunca receita real, achado da Sprint 10).
- Hipotéticas nunca tocam o backend — são estado local da tela, aplicadas
  sobre os pontos já retornados por `GET /dashboards/projecao`.
- Mês-base da projeção segue o mesmo padrão de filtro ano/mês das outras
  telas (`PeriodFilter`); os meses futuros são sempre os N meses seguintes
  ao mês-base, nunca meses passados.

## Dados e modelo

Nenhuma migration, nenhuma tabela nova. Reaproveita `Subcategory.natureza`
(Sprint 2/12) e `PluggyTransaction.data_competencia`. Entidades novas: 1
dataclass de agregação (`PontoProjecao`) e 1 schema Pydantic
(`PontoProjecaoOut`) em `app/dashboards/`, mesmo padrão de
`TendenciaMes`/`TendenciaMesOut`. No frontend, tipo `Hipotetica` é puramente
local (não trafega para o backend).

## Segurança

Sem superfície nova de dados sensíveis. O endpoint novo segue exatamente o
padrão de isolamento por `user_id` já usado em todos os outros endpoints de
`app/dashboards/router.py`. Hipotéticas não persistem, então não há dado
novo em repouso a proteger.

## Fora de escopo / decisões adiadas

- Persistir despesas/receitas hipotéticas como cenários salvos — candidata
  futura, sem sprint numerada (ver "Registro de reavaliações futuras" no
  roadmap).
- Projeção com crescimento/inflação/sazonalidade.
- Drill-down até transação na tela de Projeção.

## Referências

- [docs/roadmap.md](../roadmap.md) (entrada da Sprint 14, fecha épico E9)
- [PRD-012 — Natureza: classificação e dashboard de visibilidade](PRD-012-natureza-classificacao-dashboard.md)
  (origem da premissa fixa/variável recorrente vs. eventual, motivação
  original desta feature)
- [PRD-013 — Natureza: funil e redesign de tabelas](PRD-013-natureza-funil-e-redesign-tabelas.md)
  (empurrou esta sprint de 13 para 14)
- [PRD-006 — Dashboards analíticos](PRD-006-dashboards-analiticos.md)
  (origem do padrão de tendência/janela histórica 3/6/12 meses reaproveitado
  aqui para o horizonte futuro)
