# SPRINT-010: Revisão de UX (Dashboard/Categorização) e Gestão de Passivos — Relatório

- **Plano:** [SPRINT-010-revisao-ux-e-passivos-plan.md](./SPRINT-010-revisao-ux-e-passivos-plan.md)
- **PRD:** [PRD-010-revisao-ux-e-passivos.md](../prd/PRD-010-revisao-ux-e-passivos.md)
- **Data do relatório:** 2026-08-15
- **Status:** aprovado pelo CEO em 2026-08-15

## Resumo

As 8 frentes do plano foram entregues: a causa do NuTag foi investigada
com dado real e corrigida — mas a causa raiz era sistêmica (agregação de
receita não considerava tipo de conta), não isolada como o PRD original
supunha, então o fix cobre todo o padrão, não só NuTag (decisão tomada
com o CEO durante a execução, ver seção própria abaixo). Menu sem aba
Início, tooltip dos gráficos sem "v:", drill-down de Patrimônio, edição
inline no Dashboard/Ativos/Passivos, tela nova de Gestão de Passivos,
filtros novos e motor de sugestão de ativo em 3 camadas na Categorização
foram todos implementados, testados (297 backend + 92 frontend) e
validados contra dado real na VM de dev.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Investigar NuTag na VM de dev | feito | Achado: causa sistêmica (ver "Decisões tomadas"), não isolada. |
| 2 | Aplicar correção pontual do NuTag | feito (escopo expandido) | Em vez de `UPDATE` pontual nas linhas de NuTag, fix na agregação (`_base_query`) cobre todo o padrão `cartao_credito`+`credito`, com aval do CEO — ver "Decisões tomadas". Nenhuma linha de dado foi alterada (`tipo` já estava correto). |
| 3 | Migration `asset_categorization_rules` | feito | — |
| 4 | Model `AssetCategorizationRule` | feito | — |
| 5 | Motor de sugestão de ativo em 3 camadas | feito | Mirror exato de `suggest_category`. |
| 6 | `list_transactions`: `has_asset`/`group_id` | feito | `group_id` filtra direto por `Subcategory.group_id`, sem precisar de join com `CategoryGroup`. |
| 7 | Router: `has_asset`/`group_id` em `GET /transactions` | feito | — |
| 8 | `dashboards/service.py`: helper de breakdown de patrimônio | feito | — |
| 9 | Schema/router: `GET /dashboards/patrimonio/breakdown` | feito | — |
| 10 | Mutations de edição invalidando queries do Dashboard | feito | Implementado via `predicate` (`invalidateAfterTransactionEdit`) em vez de lista fixa de chaves — cobre qualquer query futura prefixada `"dashboard"` automaticamente. |
| 11 | Extrair componente(s) de edição de transação | feito (parcial por design) | `DescriptionCell`/`AssetSelectCell` totalmente compartilhados (usados nas 3 telas). `CategorySelectCell` só nos 2 consumidores novos (Dashboard/Ativos/Passivos) — a fila de Categorização mantém o `<select>` bespoke porque tem um workflow de confirmação em lote (seleção não salva sozinha) que diverge do auto-save do componente; forçar essa asimetria dentro do componente compartilhado seria abstração vazando. |
| 12 | `CardSparkline`: `pontos` + tooltip MM/AAAA | feito | — |
| 13 | Atualizar usos de `CardSparkline` | feito | — |
| 14 | Tile Patrimônio clicável + breakdown | feito | — |
| 15 | `frontend/src/api/liabilities.ts` | feito | — |
| 16 | Hooks de Liability | feito | — |
| 17 | `LiabilitiesPage.tsx` | feito | — |
| 18 | `ProtectedPage.tsx`: nav | feito | — |
| 19 | Filtros + indicador débito/crédito na Categorização | feito | — |
| 20 | `api/categorization.ts`/hook: `has_asset`/`group_id` | feito | — |
| 21 | Testes backend | feito | 297 testes, 98% cobertura total, 100% nos módulos tocados. |
| 22 | Testes frontend | feito | 92 testes, todos verdes. |
| 23 | Deploy + validação manual | feito | Ver "Decisões tomadas" — corrida de migration concorrente na primeira tentativa, resolvida. |
| 24 | `check-sprint10.mjs` | feito | Rodado contra dado real do CEO, ver evidência abaixo. |
| 25 | Docs vivos | feito | OVERVIEW.md, directory-structure.md, roadmap.md. |
| 26 | Relatório de sprint | feito | Este documento. |

## Evidência de testes

Backend:
```
TOTAL                                 1591     33    98%
297 passed, 322 warnings in 11.56s
```

Frontend:
```
 Test Files  15 passed (15)
      Tests  92 passed (92)
```

Cobertura de lógica de negócio: 98% backend (100% em `app/dashboards/`,
`app/categorization/`, `app/models/`), meta ≥80% superada.

## Lint/formatter

```
$ ruff check app tests alembic
All checks passed!

$ ruff format --check app tests alembic
81 files already formatted (1 reformatado durante a execução, corrigido)

$ npx eslint . --max-warnings 0
(sem output — 0 erros, 0 warnings)

$ npx prettier --check "src/**/*.{ts,tsx}"
All matched files use Prettier code style!

$ npx tsc --noEmit -p tsconfig.app.json
(sem output — 0 erros)
```

## Decisões tomadas durante a execução

1. **NuTag: causa sistêmica, não isolada — escopo expandido com aval do
   CEO.** A investigação (SSH, dado real) mostrou que `PluggyTransaction.tipo`
   já estava correto para as 63 transações de NuTag; o problema real é
   que a agregação de receita/despesa somava toda transação `tipo=credito`
   como receita sem considerar o tipo de conta. Em cartão de crédito,
   `credito` é **sempre** pagamento de fatura ou estorno (100% das 43
   transações `cartao_credito`+`credito` da conta real do CEO têm `valor`
   negativo, contra 100% dos `debito` com `valor` positivo — mesma
   convenção de sinal já validada na Sprint 5 para saldo/fatura), nunca
   receita real. O mesmo padrão afetava, além do NuTag (11 transações,
   -R$78 histórico), "Pagamento recebido" (-R$31.119), estornos de NuPay,
   IOF de assinatura, créditos de devolução de compra etc. Apresentei o
   achado ao CEO com 3 opções (só NuTag / expandir pro padrão completo /
   só documentar sem corrigir); o CEO escolheu expandir. Implementado
   como filtro de agregação (`_base_query` exclui `cartao_credito`+
   `credito`), não como `UPDATE` nas linhas — mutar o `tipo` bruto
   quebraria o cálculo de fatura/saldo já validado, que depende do sinal
   de `credito` nesse tipo de conta. Nenhuma migration, nenhum dado
   alterado — é fix de lógica, não de dado.
2. **`PluggyTransactionOut` ganha 5 campos novos** (`descricao_usuario`,
   `descricao_sugerida`, `subcategoria_sugerida_id`, `asset_id`,
   `asset_sugerido_id`) — não estava no plano original em detalhe, mas
   necessário pra edição inline funcionar no drill-down do Dashboard/
   Ativos/Passivos: esses drill-downs usam `GET /pluggy/transactions`
   (não `/categorization/transactions`), por causa dos filtros
   específicos de cada um (`subcategory_id`/`asset_id`/`liability_id`/
   `competencia`, que `/categorization/transactions` não tem). Os campos
   já existiam no model desde a Sprint 4/7, só nunca eram expostos por
   esse endpoint.
3. **`CategorySelectCell` não foi extraído pra `CategorizationReviewPage`**
   (só `DescriptionCell`/`AssetSelectCell` foram) — ver item 11 da
   tabela acima.
4. **Deploy: corrida de migration concorrente.** Rodei
   `docker compose exec api alembic upgrade head` manualmente logo após
   `docker compose up -d`, sem saber que o entrypoint do container `api`
   já roda a migration sozinho ao subir. Os dois processos concorrentes
   colidiram criando a mesma tabela/sequência (`IntegrityError`), o que
   derrubou o container. A migration e o dado ficaram corretos (`alembic_version`
   em `0011`, tabela `asset_categorization_rules` íntegra) — só o
   processo do container morreu. Resolvido com `docker compose up -d api`
   de novo. Documentado em OVERVIEW.md pra não repetir.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Causa raiz do NuTag documentada, transações históricas corrigidas | sim (com desvio consciente) | Causa raiz documentada acima; o PRD previa `UPDATE` de `tipo` nas linhas, mas a correção real foi na lógica de agregação (ver "Decisões tomadas" #1) — as transações de NuTag não contam mais como receita, sem quebrar o cálculo de fatura/saldo. |
| 2. Indicador visual débito/crédito na Categorização | sim | `TransactionTipoIcon` na célula Valor de cada linha; `check-sprint10.mjs` confirmou visualmente em telas com dado (ver nota abaixo sobre falso positivo do script). |
| 3. Sem aba "Início", Dashboards é a tela inicial | sim | `ProtectedPage.test.tsx` + confirmado ao vivo na VM de dev. |
| 4. Tooltip mostra mês/ano, fonte igual ao `TrendChart` | sim | Confirmado ao vivo: tooltip mostra "05/2026" / "Valor : R$ 20.054,24", `itemStyle`/`labelStyle` com `fontSize: 12`. |
| 5. Card Patrimônio abre tabela com as 4 partes somando o valor do card | sim | Confirmado ao vivo: Ativos + Passivos + Saldo em conta + Saldo de cartão = Total, batendo com o card. |
| 6. Edição de transação no drill-down do Dashboard reflete sem F5 | sim | `invalidateAfterTransactionEdit` + teste `DashboardsPage.test.tsx` cobrindo refetch de `dashboardSummary` após editar categoria. |
| 7. Tela "Passivos" com paridade funcional de "Ativos" | sim | `LiabilitiesPage.tsx` + `LiabilitiesPage.test.tsx` (7 testes), confirmado ao vivo (criar/drill-down/excluir). |
| 8. `has_asset=true/false` filtra corretamente | sim | Testado em `test_categorization_service.py`/`test_categorization_endpoints.py`. |
| 9. `group_id=X` filtra corretamente | sim | Idem. |
| 10. Motor de sugestão de ativo em 3 camadas | sim | `test_categorization_engine.py`, mirror exato dos testes de categoria. |
| 11. "Gestão de Contas" é o último item do menu | sim | `ProtectedPage.test.tsx` verifica a ordem exata. |
| 12. Isolamento por usuário em endpoints novos/alterados | sim | Testes de isolamento em todos os endpoints tocados (backend). |
| 13. 401 sem cookie nas rotas novas | sim | `test_patrimonio_breakdown_without_cookie_returns_401` e equivalentes. |
| 14. CI com cobertura ≥80% | sim | 98% backend, suíte CI verde (ver evidência acima). |

Nota sobre o critério 2: `check-sprint10.mjs` reportou um falso positivo
("indicador ausente") porque a fila de pendentes de agosto/2026 da conta
real do CEO está vazia (0 resultados no filtro padrão) — não há linha
pra mostrar o ícone. Confirmado que o ícone renderiza corretamente via
`CategorizationReviewPage.test.tsx` (`renders a débito/crédito direction
icon...`) e via inspeção de outras capturas de tela do mesmo script
(`AccountTipoIcon`, mesmo padrão de componente, aparece normalmente no
drill-down do Dashboard).

## Documentação atualizada

`docs/architecture/OVERVIEW.md` (seção "Revisão de UX e Gestão de
Passivos (Sprint 10)" nova + nota de aprendizado sobre corrida de
migration no ciclo de deploy + contadores de teste), `docs/directory-structure.md`
(arquivos novos/alterados do backend e frontend), `docs/roadmap.md`
(parágrafo da Sprint 10 atualizado pra refletir a causa sistêmica do
NuTag + link do relatório).

## Consumo estimado de tokens/sessões

Sprint grande (8 frentes, backend+frontend+investigação+deploy) — sessão
única, consumo alto de contexto (múltiplas leituras de arquivo grandes,
ida e volta de testes). Para sprints de escopo/tamanho equivalente,
esperar consumo similar; sprints menores (1-2 frentes) consomem
proporcionalmente menos.

## Pendências e próximos passos sugeridos

- Nenhuma pendência bloqueante. `asset_categorization_rules` começa vazia
  (esperado — sem precedente de uso real, diferente de
  `categorization_rules` que já tem 328 regras herdadas do v1); a taxa de
  sugestão automática de ativo deve ser baixa até o usuário confirmar
  itens suficientes pra popular o histórico/regras. Não é regressão.
- O padrão sistêmico corrigido (cartão de crédito `credito` excluído da
  receita) pode valer uma checagem futura: confirmar com o CEO se os
  números de Receita/Saldo históricos (meses anteriores a agosto/2026)
  mudaram de forma esperada, já que o fix altera retroativamente como
  qualquer período é agregado (sem alterar dado armazenado).
- Sprint 11 ("Categorização: tabela moderna") segue sem PRD/plano —
  próxima a planejar quando o CEO priorizar.

## Revisão pós-entrega (mesmo dia, feedback do CEO)

CEO testou o Dashboard já em produção (VM de dev) e reportou percentuais
sem sentido (ex.: 1124.2%) no drill-down Despesa > Categoria > Tipo, com
estornos de cartão aparecendo junto de uma despesa real na mesma
subcategoria "Receitas / Estornos". Investigação encontrou um bug
pré-existente da Sprint 9 (não introduzido nesta sprint): `SubcategoriaAccordion`
nunca repassava a prop `tipo` pro `TransacoesPanel` do nível de
transação — invisível até uma subcategoria ter transações de débito e
crédito ao mesmo tempo, como "Estornos". Sem o filtro, a lista buscava
todas as transações da subcategoria (os 2 tipos), enquanto o total usado
pro cálculo de % continuava vindo só do tipo do funil aberto. Corrigido
(`tipo` agora propagado corretamente), testado (93 testes frontend,
+1 regressão) e validado contra dado real (`GET /pluggy/transactions?
subcategory_id=28&tipo=debito` retorna só a transação débito esperada).

Duas ideias levantadas pelo CEO na mesma revisão, ambas resolvidas sem
implementação nova:
- **Override manual de débito/crédito por transação:** com o bug acima
  corrigido, o CEO confirmou que não precisa mais dessa feature —
  mantém a decisão original do PRD-010 de não construir.
- **Camada "Ativo" no funil Categoria>Tipo>Transação:** CEO confirmou
  que é só uma ideia pra registrar, não pra planejar agora — anotada em
  [roadmap.md](../roadmap.md#registro-de-reavaliações-futuras).

---

**Sprint aprovada pelo CEO em 2026-08-15.**
