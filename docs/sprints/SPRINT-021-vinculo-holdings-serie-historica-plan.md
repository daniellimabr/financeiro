# SPRINT-021: Vínculo holdings↔Investimento + série histórica mensal — Plano

- **PRD(s):** [PRD-021-vinculo-holdings-serie-historica](../prd/PRD-021-vinculo-holdings-serie-historica.md)
- **Data do plano:** 2026-08-18

## Objetivo da sprint

Ao final: (1) toda holding sincronizada da Pluggy sem `investimento_id` recebe uma sugestão
automática de vínculo a um `Investimento` (cascata código-exato → similaridade de nome),
exibida pré-selecionada em `AccountManagementPage`, recorrente a cada sync — não mais um
mapeamento manual pontual; (2) o CEO recebe uma proposta gerada de saldo em 31/12/2025 por
holding (com confiança marcada por linha) pra revisar/aprovar, em vez de digitar manualmente;
(3) uma série histórica mensal (jan-ago/2026, reconstruída; dali pra frente, via job de
snapshot novo) mostra saldo, valorização, rendimento/dividendos, aportes e resgates por
holding, com valorização e rendimento separados por tipo (renda fixa vs. ações, ações também
podem ter dividendos). O algoritmo definitivo do baseline e da separação valorização/
rendimento só é fechado depois do achado real do Bloco 0 (investigação obrigatória em prod).

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Bloco 0, investigação read-only em produção: confirmar com o CEO o comando (aprovação explícita por comando, dado real), puxar 1 holding `FIXED_INCOME` + 1 `EQUITY` reais e suas transações via API já autenticada; documentar campos presentes/ausentes (taxa/vencimento, `type` de dividendo) | Sonnet: investigação, com o CEO | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), [PRD-021, "Achado técnico"](../prd/PRD-021-vinculo-holdings-serie-historica.md) |
| 2 | Bloco 0, passo 2: fechar o algoritmo definitivo de baseline dez/2025 (por tipo) e de separação valorização/rendimento/dividendos a partir do achado real; ajustar o rascunho de schema do PRD-021 se necessário | Sonnet: investigação | resultado da tarefa 1 |
| 3 | Migration `0017`: colunas de sugestão em `pluggy_investments` (`investimento_sugerido_id`/`_confianca`/`_fonte_tipo`/`_fonte_id`/`_score`) + tabela nova `pluggy_investment_snapshots` (schema conforme achado do Bloco 0, rascunho no PRD-021) | Sonnet: implementação | [alembic/versions/0016_investments_da_pluggy.py](../../backend/alembic/versions/0016_investments_da_pluggy.py) (padrão de migration mais recente) |
| 4 | Model `PluggyInvestment` ganha as colunas de sugestão; model novo `PluggyInvestmentSnapshot`; registro em `models/__init__.py` | Sonnet: implementação | [models/pluggy.py:190-245](../../backend/app/models/pluggy.py) |
| 5 | Motor de sugestão holding→Investimento: `suggest_holding_investimento` em `categorization/engine.py` — camada 1 match exato por `codigo` contra holdings já vinculadas do usuário, camada 2 similaridade de `nome` (`difflib`, `SIMILARITY_THRESHOLD`); sem camada de regra importada | Sonnet: implementação | [categorization/engine.py:15,229-263](../../backend/app/categorization/engine.py) (padrão `suggest_investimento`) |
| 6 | `pluggy_integration/service.py`: aplicar sugestão dentro de `sync_item`, só para holdings com `investimento_id IS NULL`, sem sobrescrever vínculo manual | Sonnet: implementação | [pluggy_integration/service.py:353-361,426-456](../../backend/app/pluggy_integration/service.py) |
| 7 | Rotina de proposta de baseline dez/2025: função/script que calcula `saldo_inicial` estimado por holding (algoritmo do Bloco 0), com `confianca` por linha; endpoint de revisão que lista a proposta sem persistir, e endpoint de confirmação que grava `saldo_inicial` só após aprovação explícita | Sonnet: implementação | [investimentos/service.py:125-175](../../backend/app/investimentos/service.py), achado do Bloco 0 |
| 8 | Reconstrução retroativa: popular `pluggy_investment_snapshots` para jan-ago/2026 a partir de `pluggy_investment_transactions` + baseline aprovado, separando valorização/rendimento/dividendos por tipo | Sonnet: implementação | resultado da tarefa 7; [models/pluggy.py:225-245](../../backend/app/models/pluggy.py) (`PluggyInvestmentTransaction`) |
| 9 | Job de snapshot mensal: grava o snapshot do mês corrente por holding a cada sync, idempotente (`UniqueConstraint(investment_id, ano_mes)`, upsert) | Sonnet: implementação | resultado da tarefa 8 |
| 10 | `app/investimentos/service.py`: novo `get_evolucao_mensal`/endpoint de série mensal, sem alterar `get_evolucao` (snapshot atual) existente | Sonnet: implementação | [investimentos/service.py:125-175](../../backend/app/investimentos/service.py) |
| 11 | `pluggy_integration/router.py` + `schemas/pluggy.py`: expor sugestão nos schemas de holding existentes; endpoints de proposta/confirmação de baseline; endpoint de série mensal | Sonnet: implementação | [pluggy_integration/router.py](../../backend/app/pluggy_integration/router.py), [schemas/pluggy.py](../../backend/app/schemas/pluggy.py) |
| 12 | Testes backend: motor de sugestão (código exato, similaridade, sem match, não sobrescreve manual), rotina de baseline (fórmulas por tipo, casos sintéticos), reconstrução retroativa, idempotência do job de snapshot, isolamento por usuário, 401 sem cookie | Sonnet + skill tdd-workflow | `test_pluggy_service.py`, `test_pluggy_endpoints.py`, `test_categorization_engine.py`, `test_investimento_service.py` (padrão) |
| 13 | `api/pluggy.ts` + hooks novos (sugestão de holding, proposta/confirmação de baseline, série mensal) | Sonnet: implementação | [api/pluggy.ts](../../frontend/src/api/pluggy.ts), hooks equivalentes já existentes |
| 14 | `AccountManagementPage.tsx`: `<select>` de "Posições de investimento" pré-seleciona a sugestão com indicação de confiança | Sonnet: implementação | [pages/AccountManagementPage.tsx:349-424](../../frontend/src/pages/AccountManagementPage.tsx) |
| 15 | Tela de revisão do baseline dez/2025 (tabela com confiança por linha, aprovar/ajustar antes de persistir) | Sonnet + skill impeccable | padrão de revisão já usado no fluxo de categorização |
| 16 | UI de série histórica (gráfico/tabela mês a mês) na tela de Investimento ou no dashboard de Patrimônio | Sonnet + skill impeccable + skill dataviz | [pages/InvestimentosPage.tsx](../../frontend/src/pages/InvestimentosPage.tsx) |
| 17 | Testes frontend: `AccountManagementPage` (sugestão pré-selecionada), tela de revisão de baseline, componente de série histórica | Sonnet + skill tdd-workflow | testes equivalentes existentes como referência |
| 18 | Deploy VM de dev, validação ao vivo (script `browser-check` estendido) — sugestões aparecendo, fluxo de aprovação de baseline, série mensal renderizando | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md), `scripts/browser-check/` |
| 19 | Deploy em produção (aprovação do CEO), aplicar o vínculo/baseline real nas 22 holdings existentes | Sonnet: implementação, com aprovação do CEO | dado real de produção |
| 20 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `dashboards-guia-cards.md`, `roadmap.md` — remover a lacuna de série histórica registrada desde a Sprint 5/6) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, dashboards-guia-cards.md, roadmap.md |
| 21 | Relatório de sprint — achados reais do Bloco 0, ajustes de schema/algoritmo em relação ao rascunho do PRD-021, resultado da revisão do baseline com o CEO | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/integração (pytest):** motor de sugestão holding→Investimento (código exato,
  similaridade de nome, ausência de match, nunca sobrescreve vínculo manual existente);
  rotina de baseline dez/2025 (fórmulas por tipo com dados sintéticos, marcação de
  confiança); reconstrução retroativa da série jan-ago/2026; idempotência do job de snapshot
  mensal (rodar 2x no mesmo mês não duplica, `UniqueConstraint`); isolamento por usuário e
  401 em toda rota nova; regressão explícita de `get_evolucao` (snapshot atual) inalterado.
- **Componente (Vitest):** `AccountManagementPage` (sugestão pré-selecionada com confiança),
  tela de revisão de baseline, componente de série histórica.
- Meta ≥80% cobertura nos módulos novos/tocados. Suíte completa 100% verde antes de fechar.
- Testes do Bloco 0 (investigação) não são previsíveis de antemão — dependem do achado real,
  mesmo precedente das Sprints 17/18/19/20.

## Impacto no roadmap

Sprint sem épico prévio (pedido direto do CEO na sessão de aprovação da Sprint 20, sem
pré-registro em "Registro de reavaliações futuras"). Ao fechar, remove a nota de lacuna de
série histórica registrada desde a Sprint 5/6 (E6) e adiciona a entrada padrão de sprint
concluída, com referência a PRD-021/SPRINT-021.

## Riscos / dependências

- **Todo o algoritmo definitivo do baseline dez/2025 e da separação valorização/rendimento
  (Blocos de tarefas 3, 7, 8, 9) depende do achado real do Bloco 0** — se o payload real não
  expuser taxa/vencimento pra renda fixa nem um `type` de dividendo identificável pra ações,
  o PRD-021 já prevê o fallback (estimativa por fluxo, confiança "estimada") — aplicar sem
  precisar voltar ao CEO, mas registrar no relatório.
- **Precisão do valor histórico de ações é uma limitação estrutural desta sprint** (sem fonte
  de cotação histórica) — precisa de aviso visual explícito na UI de série histórica e na
  tela de revisão de baseline, mesmo padrão já usado para `rendimento_estimado`.
- **Bloco 0 roda em produção** (dado real não existe em dev) — cada comando exige aprovação
  explícita do CEO, mesmo sendo leitura; confirmar isso no início da sessão de execução antes
  de rodar qualquer comando.
- **Sprint grande** — motor de sugestão novo + schema de snapshot novo + job novo + 2 telas
  novas (revisão de baseline, série histórica). Comparável às Sprints 19/20. Se o Bloco 0
  revelar complexidade extra (ex.: taxonomia de `type` de investimento muito heterogênea
  entre instituições), dividir o que faltar em sprint futura é uma saída válida — mesmo
  precedente das Sprints 7/8/9, 12/13/14/15, 20.
