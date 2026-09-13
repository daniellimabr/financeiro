# PRD-039: Débito técnico real identificado pelo scan `aislop` (2026-09-11)

- **Status:** proposto
- **Épico relacionado:** cross-epic, sem épico prévio (qualidade/manutenibilidade de código, não funcionalidade de produto)
- **Sprint(s):** [SPRINT-039](../sprints/SPRINT-039-debito-tecnico-scan-aislop-plan.md)

## Problema

O CEO rodou `npx aislop scan` (ferramenta externa de qualidade de código) em 2026-09-11 e pediu
avaliação dos achados. Investigação registrada em
[docs/audits/aislop-scan-2026-09-11.md](../audits/aislop-scan-2026-09-11.md) concluiu que:

- O score bruto (66/100, 72 erros) era quase todo ruído — `.claude/skills/impeccable` é um skill de
  terceiros vendorizado no commit de bootstrap, não código do projeto. Excluindo esse caminho, o
  projeto real está em **92/100 ("Healthy"), 0 erros**.
- Dos achados restantes, vários eram falsos positivos já descartados na auditoria anterior
  (`alembic/env.py` import com `noqa` documentado, URL pública da Pluggy em `config.py`, formatação
  de `scripts/ssh_vm.py` já correta).
- O que sobra como débito real é mecânico e de baixo risco: funções de backend com excesso de
  parâmetros e blocos de código duplicado no frontend — nenhum bug funcional, só manutenibilidade.

O CEO pediu explicitamente para planejar uma sprint que revise esses itens, com uma condição clara:
**a revisão não pode quebrar o projeto**. Isso define o critério central desta sprint — zero mudança
de comportamento, só forma interna do código — mais do que qualquer PRD funcional anterior.

## Escopo

### Incluído

**Backend — funções com excesso de parâmetros (limite do linter: 6), sem mudar comportamento:**

- `update_asset`/`create_asset` (`app/assets/service.py:44` e vizinha) — já recebem os campos
  explodidos de um schema Pydantic (`AssetIn`) no router (`app/assets/router.py:25-31,53-61`).
  Trocar a assinatura para receber `payload: AssetIn` diretamente elimina a explosão dos dois lados
  (router e service) — reduz parâmetros e remove uma pequena duplicação lateral entre `create`/`update`.
- `update_liability`/`create_liability` (`app/liabilities/service.py:26-46,48-65`) — mesmo padrão
  exato, mesmo fix (`LiabilityIn` já existe em `app/schemas/liability.py`, usado do mesmo jeito em
  `app/liabilities/router.py:21,46-60`).
- `_apply_suggestions` (`app/categorization/service.py:152`, 9 params) — função interna (não ligada a
  payload de API). Agrupar os parâmetros de regras/histórico por tipo (categoria, ativo, passivo,
  investimento) num dataclass de contexto (`SuggestionSources` ou nome equivalente).
- `_upsert_snapshot` (`app/pluggy_integration/service.py:552`, 10 params) — função interna, todos os
  parâmetros são valores calculados do snapshot mensal. Agrupar num dataclass (`SnapshotValores` ou
  equivalente).

**Frontend — blocos de código duplicado (13 identificados pelo scan):**

- `api/assets.ts` (`createAsset`/`updateAsset`, L35-59) e `api/liabilities.ts`
  (`createLiability`/`updateLiability`, L29-53) — extrair helper de montagem do corpo da requisição,
  compartilhado entre create/update de cada recurso.
- `components/TransactionEditCells.tsx` (`DescriptionCell`/`DateCell` e possivelmente outras células
  irmãs, L25-90+) — mesmo padrão de estado de edição inline (draft/editing, salvar no blur, Enter
  confirma, Escape cancela) repetido por célula. Extrair hook compartilhado (`useInlineEditCell` ou
  equivalente) mantendo o comportamento de teclado/blur idêntico.
- `pages/AssetsPage.tsx` (L366-411), `pages/LiabilitiesPage.tsx` (L271-318),
  `pages/InvestimentosPage.tsx` (3 blocos: L260-273, L261-287, L599-815),
  `pages/DashboardsPage.tsx` (L368-391), `pages/CategorizationReviewPage.tsx` (2 blocos: L322-336,
  L325-346) — investigar cada bloco na execução (o scan aponta início/fim, não a causa) e extrair
  helper/componente compartilhado quando a duplicação for genuína; documentar e descartar o achado
  no relatório se a semelhança for coincidência estrutural sem lógica compartilhada real.

**Achado real de ai-slop:**

- `app/dashboards/service.py:1274` — `salario_por_conta_mes.get(conta.id, {}).get(mes_atual,
  Decimal("0"))`. Normalizar a estrutura (ex.: `defaultdict` na construção de
  `salario_por_conta_mes`, ou uma função `_salario_do_mes(mapa, conta_id, mes)` explícita) para
  eliminar o encadeamento de fallback duplo.

**Verificação (não negociável, dado o pedido explícito do CEO de não quebrar o projeto):**

- Suíte completa (backend `pytest` + frontend `vitest`) 100% verde antes de cada mudança e depois de
  cada uma — não só no final. Cobertura de lógica de negócio não pode cair.
- QA visual real (`scripts/browser-check/check-sprint39.mjs`, novo) nas telas tocadas (Ativos,
  Passivos, Investimentos, Categorização, Dashboard) confirmando zero mudança visual ou de
  comportamento — mesmo padrão de todo QA visual do projeto desde a Sprint 5.
- Nenhuma migration, nenhuma mudança de schema, nenhuma mudança de contrato de API (mesmo path,
  método, request/response shape) em nenhum item desta sprint.

### Fora de escopo (explicitamente)

- **Quebrar os arquivos grandes** (backend, limite 400 linhas: `categorization/engine.py` 445,
  `categorization/service.py` 473, `dashboards/service.py` 1299, `pluggy_integration/service.py`
  1044; frontend, limite 600 linhas: `AccountManagementPage.tsx` 713, `DashboardsPage.tsx` 1618,
  `InvestimentosPage.tsx` 841) — refatoração estrutural de escopo muito maior (`dashboards/service.py`
  sozinho sustenta praticamente todo dashboard do app) e risco desproporcional ao ganho para uma
  sprint de arrumação. Registrado no roadmap como candidato a sprint dedicada futura, com plano
  próprio de fases incrementais (um arquivo por vez, não tudo de uma vez).
- **`app/planejamento/service.py`** e seus 3 achados de excesso de parâmetros
  (`_linha_subcategoria`, `create_item_planejado`, `update_item_planejado`) — código da Sprint 38,
  ainda sem relatório/aprovação do CEO. Mexer nele antes da Sprint 38 estabilizar arrisca conflitar
  com ajustes que ela ainda pode receber.
- **As 25 ocorrências de "função muito longa"** e o "unused variable" em
  `scripts/browser-check/*.mjs` — são scripts internos de QA (ferramenta, não produto). Sem valor de
  negócio em refatorar agora.
- **`config.py` (URL hardcoded) e `alembic/env.py` (import "não usado")** — falsos positivos já
  confirmados em `docs/audits/aislop-scan-2026-09-11.md` (URL pública padrão sobrescrevível por env
  var; import com `# noqa` documentado, necessário pro Alembic autogenerate). Nenhuma ação.
- Adotar `aislop` como gate formal de CI/`scripts/check-all.ps1` — fora do escopo desta sprint
  (decisão de processo, não de código); pode ser proposto separadamente se o CEO quiser recorrência
  automatizada.

## Critérios de aceite

1. Dada a suíte de testes existente (backend + frontend), ela passa 100% antes e depois de cada
   mudança desta sprint, sem exceção — nenhuma mudança é considerada concluída com suíte vermelha.
2. Dado qualquer endpoint tocado (`assets`, `liabilities`), o contrato de API (path, método, formato
   de request/response) permanece idêntico ao anterior — validado por teste de integração existente,
   sem necessidade de atualizar cliente frontend além do já prescrito.
3. Dada qualquer tela tocada no frontend (Ativos, Passivos, Investimentos, Categorização, Dashboard),
   o comportamento visível ao usuário (dados exibidos, interação de edição inline, teclado) é
   idêntico ao anterior — validado por QA visual real (`check-sprint39.mjs`) e pela suíte de testes
   de componente já existente.
4. Dado o scan `aislop scan --exclude .claude/skills` rodado ao final da sprint, os achados
   "Function has too many parameters" em `assets/service.py`, `liabilities/service.py`,
   `categorization/service.py` e `pluggy_integration/service.py`, e os 11 blocos de "Duplicate code
   block" fora de `scripts/browser-check/`, não aparecem mais (ou o relatório da sprint documenta
   explicitamente por que um item específico não foi resolvido).
5. Dado o achado de `dashboards/service.py:1274`, o valor calculado (`salario_recebido`) permanece
   numericamente idêntico ao anterior para todo dado real da VM de dev — validado contra a mesma
   conferência de saldo (`GET /dashboards/conferencia-saldo` ou equivalente) já usada desde a
   Sprint 32/33.

## Regras de negócio

Nenhuma regra de negócio muda nesta sprint — é uma sprint de forma interna do código, não de
comportamento. Qualquer mudança de comportamento descoberta como necessária durante a execução (ex.:
um "bloco duplicado" que na verdade tinha uma sutileza não óbvia entre as duas cópias) para a
execução daquele item específico e volta ao CEO antes de prosseguir, em vez de decidir sozinho por
manter ou unificar o comportamento.

## Dados e modelo

Nenhuma migration, nenhuma mudança de schema.

## Segurança

Nenhuma mudança de superfície de segurança — isolamento por `user_id` já existente em todos os
endpoints tocados permanece exatamente como está; esta sprint não adiciona nem remove validação.

## Referências

- [docs/audits/aislop-scan-2026-09-11.md](../audits/aislop-scan-2026-09-11.md) — triagem completa do
  scan original (ruído do vendor vs. achados reais, falsos positivos descartados).
- [docs/roadmap.md](../roadmap.md) — registro do backlog futuro (quebra dos arquivos grandes) criado
  por esta sprint.
