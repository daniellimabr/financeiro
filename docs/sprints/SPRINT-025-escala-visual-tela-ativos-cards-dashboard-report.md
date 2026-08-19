# SPRINT-025: Escala visual, tela Ativos e cards Ativos/Passivos/Patrimônio/Saldo Acumulado — Relatório

- **Plano:** [SPRINT-025-escala-visual-tela-ativos-cards-dashboard-plan.md](./SPRINT-025-escala-visual-tela-ativos-cards-dashboard-plan.md)
- **Data do relatório:** 2026-08-19

## Resumo

Entregue toda a escala visual (~20% de redução nos tokens de `index.css`), a tela Ativos ganhou
accordion Categoria→Subcategoria→Transação no lugar da tabela plana (sem mais toggle
Competência/Caixa) e os cards Ativos/Passivos/Saldo Acumulado do Dashboard ficaram consistentes
entre si (mesma convenção de percentual do total, cor por item onde fazia sentido). O Bloco 0
investigou a transação "Encerramento de dívida" ao vivo na VM de dev e achou uma premissa diferente
da do PRD — o CEO decidiu não aplicar nenhum fix nesta sprint, registrado como pendência.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Bloco 0: investigar via SSH a transação "encerramento de dívida"; confirmar achado e decisão com o CEO | feito | **Achado real diverge da premissa do PRD:** a transação (id 684, débito, R$142,67, competência 08/2026, subcategoria "Estornos"/grupo "Receitas") não tem `asset_id` nenhum — nunca aparece no drilldown por ativo da tela Ativos. O sintoma relatado vem do funil geral de Despesa do Dashboard, que filtra por `tipo` bruto (débito/crédito) da Pluggy, não pelo grupo Receita/Despesa da categoria — mesmo padrão usado em `get_por_ativo`. Faz parte de um lançamento de 3 itens do mesmo dia na fatura (684 débito +142,67 "Encerramento de dívida", 696 crédito −142,67 "Estorno de juros da dívida encerrada" que cancela exatamente 684, 695 crédito −1603,89 "Estorno de pagamento de transferência NuPay", sem relação de valor). Não existe subcategoria genérica de "juros/dívida" no catálogo hoje. Apresentado ao CEO por pergunta direta — decisão: **nenhum fix agora** |
| 2 | Reduzir tokens `--text-*`/`--space-*` em ~20% em `index.css` | feito | Valores escolhidos por arredondamento a pixels inteiros próximos de 80% (ex.: `--text-base` 16px→13px, `--space-4` 16px→13px) — ver `frontend/src/index.css` linhas 116-132 |
| 3 | `AssetsPage.tsx`: remover `RegimeToggle`/estado `regime`, fixar competência | feito | — |
| 4 | `AssetDrilldown`: accordion Categoria→Subcategoria→Transação escopado a um ativo | feito | Sem endpoint agregado "por categoria dentro de um ativo" — os totais de grupo/subcategoria são somados no frontend a partir da lista de transações já filtrada por `asset_id` (poucas dezenas de itens por ativo/mês); o nível folha reaproveita o `TransactionsTable` existente (mesmo componente do funil), preservando edição inline de categoria e ordenação |
| 5 | Aplicar o fix decidido no Bloco 0 | não feito | CEO decidiu não aplicar fix nesta sprint (ver item 1) — pendência registrada abaixo |
| 6 | Card Ativos: nova seção "Valor atual por Ativo" (1ª); "Despesas por Ativo" (última); remover "Saldo por conta" | feito | `SaldoPorContaList` e o hook `useSaldoPorConta` ficaram sem nenhum call site após a remoção — removidos por completo (código morto), não deixados órfãos |
| 7 | `InvestimentosValorAtualList`: cor única → cor por investimento | feito | — |
| 8 | Card Passivos: `LiabilitiesValorAtualList` troca `<table>` por `dash-row` (barra+%, sem expandir) | feito | Implementado como `<li className="dash-row">` estático (sem `<button>`/chevron/expand), não reaproveitando o componente `Row` (que é sempre clicável) — mesma classe CSS, comportamento visual idêntico ao pedido, sem interatividade |
| 9 | Percentual do total em `AssetsValorAtualList`, `LiabilitiesValorAtualList`, `InvestimentoHoldingsList` | feito | — |
| 10 | Card Saldo Acumulado: frase da fórmula | feito | Adicionada como primeira linha de `SaldoAcumuladoMemoriaCalculo`, logo abaixo do parágrafo explicativo já existente no início do drilldown |
| 11 | QA visual real na VM de dev — `check-sprint25.mjs` | feito | Rodado desktop+mobile, claro+escuro (4 combinações) contra a VM de dev real, pós-deploy do commit desta sprint — 0 falhas de asserção, 0 erros de console. Screenshots em `scripts/browser-check/shots/*-s25-*.png` |
| 12 | Atualizar `docs/dashboards-guia-cards.md` | feito | Delegado ao doc-updater (Haiku) |
| 13 | Relatório de sprint | feito | Este documento |

## Evidência de testes

Frontend (`npm run test` via `vitest run`, suíte completa):

```
 Test Files  25 passed (25)
      Tests  208 passed (208)
   Duration  9.05s
```

Backend (`pytest`, suíte completa — nenhum arquivo de backend tocado nesta sprint, rodado como
confirmação de não-regressão):

```
598 passed, 565 warnings in 12.96s
TOTAL coverage: 98%
```

Cobertura de lógica de negócio: 98% backend (meta ≥80%, inalterado — nenhum módulo de backend
tocado). Frontend não mede cobertura percentual no CI deste projeto (ver ADR-001) — 208 testes
cobrindo os 2 arquivos de página tocados (`AssetsPage`, `DashboardsPage`), incluindo casos novos
para o accordion de extrato por ativo (agrupamento correto por categoria/subcategoria, grupos
separados por categoria diferente), cor por investimento sem colisão, e percentual do total em
cada lista de valor atual (Ativos, Passivos, holdings de Investimento).

## Lint/formatter

```
$ npx eslint .
(sem saída — sem erros)

$ npx prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npx tsc -b
(sem saída — build limpo)
```

## Decisões tomadas durante a execução

1. **Bloco 0 mudou de escopo em tempo real** — a premissa do PRD ("aparece classificado em
   Receitas/Estornos dentro do drilldown de despesa" na tela Ativos) não bateu com o dado real: a
   transação não tem `asset_id`, então nunca poderia aparecer ali. O achado real (funil geral de
   Despesa do Dashboard, mesmo padrão de filtro por tipo bruto usado em `get_por_ativo`) foi
   apresentado ao CEO por pergunta direta antes de qualquer código — decisão: não mexer nesta
   sprint. Mesmo padrão de "investigar antes de reinterpretar premissa" das Sprints 21/22.
2. **`SaldoPorContaList`/`useSaldoPorConta` removidos por completo**, não deixados órfãos — sem
   nenhum outro call site no app após a tarefa 6 (verificado via grep antes de remover, conforme
   risco listado no plano).
3. **Passivos — saldo devedor não reaproveita o componente `Row`** (usado por Ativos/Investimentos)
   porque `Row` é sempre um `<button>` clicável com chevron — o CEO pediu explicitamente sem
   conteúdo expansível aqui. Implementado como marcação estática com as mesmas classes CSS
   (`.dash-row`/`.track`/`.fillbar`/`.amt`/`.pct`), mesmo visual, sem semântica de botão.
4. **Accordion de extrato por ativo agrega no frontend**, não no backend — não existe endpoint
   "totais por categoria dentro de um ativo"; como a lista de transações por ativo/mês é pequena
   (poucas dezenas de itens), a agregação client-side não tem custo perceptível e evita mudança de
   backend nesta sprint (nenhuma prevista no PRD).

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Densidade visual ~80%, sem texto cortado em `--text-2xs` | sim | QA visual desktop+mobile, claro+escuro (`check-sprint25.mjs`, screenshots `s25-01`) |
| 2. Tela Ativos sem toggle Competência/Caixa | sim | `AssetsPage.tsx` — `RegimeToggle` removido; QA visual confirma ausência (`s25-02`) |
| 3. Drilldown por ativo em accordion Categoria→Subcategoria→Transação | sim | `AssetExtratoAccordion` (novo); QA visual confirma ausência de `table.txn-table` e presença de `.dash-accordion` (`s25-02`) |
| 4. Comportamento do caso "encerramento de dívida" reflete decisão do CEO | sim | CEO decidiu não aplicar fix — comportamento inalterado, decisão registrada no item 1 acima |
| 5. Card Ativos na ordem Valor atual por Ativo → Valor atual por Investimento (cor por item) → Despesas por Ativo, sem Saldo por conta | sim | QA visual confirma ordem exata dos `<h3>` e ausência do texto "Saldo por conta" (`s25-03`) |
| 6. Passivos — saldo devedor com o mesmo estilo barra+% de Investimento | sim | QA visual confirma ausência de `<table>` e presença de `.pct` na linha (`s25-04`) |
| 7. Percentual do total em todo drilldown de valor atual (Ativos, Passivos, holdings) | sim | Testes novos em `DashboardsPage.test.tsx`; QA visual mostra `%` nas 3 listas |
| 8. Card Patrimônio sem disclaimer "fora do filtro" | sim | Já corrigido no QA pós-Sprint 24 (commit `2024f45`); QA visual desta sprint reconfirma ausência ao vivo |
| 9. Fórmula do Saldo Acumulado visível no card/drilldown | sim | `SaldoAcumuladoMemoriaCalculo`; QA visual confirma texto no início do drilldown (`s25-05`) |
| 10. Isolamento por `user_id` preservado em todo drilldown/consulta alterada | sim | Nenhuma consulta nova de backend — reaproveita `/pluggy/transactions`, `/assets`, `/liabilities`, `/investimentos`, todos já filtrados por `current_user.id` |
| 11. CI: testes novos/alterados passam, cobertura ≥80%, suíte 100% verde | sim | Ver seção "Evidência de testes" acima; CI do commit `1fd8133` concluiu com sucesso |

## Documentação atualizada

- `docs/dashboards-guia-cards.md` — ordem/títulos novos dos drilldowns de Ativos/Passivos, remoção
  da seção "Saldo por conta", convenção de percentual generalizada (delegado ao doc-updater).
- Este relatório (`docs/sprints/SPRINT-025-...-report.md`).

## Consumo estimado de tokens/sessões

Sessão única e longa: investigação de dado real (Bloco 0, com pergunta direta ao CEO em tempo
real), implementação em 2 páginas grandes (`AssetsPage.tsx`, `DashboardsPage.tsx`), reescrita
substancial de 2 suítes de teste (accordion novo muda a estrutura de DOM que os testes antigos
verificavam), QA visual real na VM de dev (mint de token pausado para aprovação, confirmado antes
de prosseguir) e atualização de doc delegada. Comparável em escopo às Sprints 22/24.

## Pendências e próximos passos sugeridos

- **Bloco 0 não resolvido:** a transação "Encerramento de dívida" (id 684) segue hoje em
  Receitas/Estornos, sem `asset_id`/`liability_id`. Se o CEO quiser retomar, as opções continuam
  as mesmas: (a) recategorizar pontualmente (precisa de uma subcategoria destino — não existe uma
  genérica de "juros/dívida" hoje) ou (b) mudar o funil geral de Despesa/Receita (e `get_por_ativo`)
  pra agrupar por grupo da categoria em vez de tipo bruto débito/crédito — mudança sistêmica, maior
  escopo que uma correção pontual.
- PRD-026 (interatividade de gráficos) e PRD-027 (ocultar gasto + comparativo de categorias) já
  planejados na mesma sessão desta PRD-025, prontos para execução em sessões futuras.
