# PRD-013: Natureza — rótulo, funil completo, e redesign de tabelas/botões

- **Status:** aprovado
- **Épico relacionado:** E9 Natureza e projeção de custos — ver [docs/roadmap.md](../roadmap.md)
- **Sprint(s):** [SPRINT-013](../sprints/SPRINT-013-natureza-funil-e-redesign-tabelas-plan.md)

## Problema

Usando a tela "Natureza" (Sprint 12) na prática, o CEO trouxe 3 pontos numa
única sessão de planejamento:

1. O rótulo "Custo eventual" (`Subcategory.natureza = eventual`) implica
   despesa — mas `natureza` já se aplica igualmente a receita (o toggle
   despesa/receita da tela já funciona ponta a ponta desde a Sprint 12,
   confirmado em código). O rótulo enganoso é puramente cosmético, não uma
   lacuna funcional.
2. O funil da tela Natureza (`Natureza → Subcategoria → Transação`) não tem
   o nível "Categoria" (grupo) que o funil de Dashboards já tem
   (`Categoria → Subcategoria → Transação`, Sprint 9). Isso foi um corte de
   escopo explícito do PRD-012 (critério de aceite 2 só previa 2 níveis),
   não um bug.
3. A tabela de classificação de Natureza — e, olhando o resto do app,
   praticamente toda tabela/lista do sistema — está com tratamento visual
   inconsistente: `<select>` nativo sem hover/cor/sort na tabela de
   Natureza; 3 implementações divergentes de "tabela de transação"
   (Dashboard/Natureza, Ativos, Passivos) com recursos diferentes entre si;
   listas cruas sem classe nenhuma em Gestão de Contas; botões sem
   hierarquia nos cards de Ativos/Passivos. Não é acidente: os planos das
   Sprints 10→11→12 registram pelo menos 3 vezes a decisão explícita de
   adiar "restilizar chrome das tabelas de drill-down" e "generalizar o
   padrão de combobox para outros selects" (ver `docs/roadmap.md`, entrada
   da Sprint 11, e `PRD-011`, seção "Fora de escopo"). `DESIGN.md` hoje
   documenta a tabela como "o nível mais plano do funil por design" —
   decisão que o CEO pediu para reabrir.

Decisões tomadas na sessão de planejamento (via perguntas diretas ao CEO,
não presumidas pelo CTO):
- Sprint única (não dividir em 13+14): rename + funil + redesign de tabelas
  saem juntos.
- Funil ganha nível Categoria **mantendo** Subcategoria — vira
  `Natureza → Categoria → Subcategoria → Transação` (4 níveis), replicando
  o funil de Dashboards, sem perder o que a Sprint 12 já entregou.
- Redesign cobre **todas** as superfícies de tabela/lista do app,
  inclusive os drill-downs passivos (reabre a regra atual do `DESIGN.md`).
- Ao unificar as 3 implementações de tabela de transação num componente
  compartilhado, o drill-down de Ativos ganha as colunas Categoria/Ativo
  editáveis que hoje não tem (hoje mostra só Data/Descrição/Valor em
  texto puro) — mudança de **comportamento**, não só visual, aceita
  explicitamente pelo CEO.

## Escopo

### Incluído

**1. Rename de rótulo**
- `NATUREZA_LABELS.eventual`: "Custo eventual" → "Eventual" — única fonte
  do rótulo (`frontend/src/utils/naturezaLabels.ts`).
- Elimina a duplicação hardcoded do mesmo rótulo dentro do `<select>` da
  tabela de classificação (`NaturezaPage.tsx`), trocando as 3 `<option>`
  estáticas por um `.map()` sobre `NATUREZA_ORDER` — não só corrige o
  texto, remove a segunda fonte de verdade.
- Prosa auxiliar da tela ("...contam como Custo eventual...") atualizada.
- Nenhuma mudança de backend/DB/migration — o valor do enum já é
  `eventual` desde a migration `0002` (Sprint 2), nunca teve "custo".
- Nomes de variável CSS `--nat-eventual`/`--nat-eventual-bg` não mudam.

**2. Nível "Categoria" no funil de Natureza**
- Funil passa de `Natureza → Subcategoria → Transação` para
  `Natureza → Categoria → Subcategoria → Transação`.
- Sem endpoint novo — `GET /dashboards/por-categoria` (já consumido pela
  tela) já retorna `group_id`/`group_nome` por item.
- Percentual em cada nível soma 100% do total do nível pai (mesma regra já
  aplicada no nível Subcategoria existente e no funil espelho de
  Dashboards).
- Sanfona multi-nível (mais de uma Categoria pode ficar aberta ao mesmo
  tempo), alinhando `NaturezaPage` ao comportamento de accordion já
  documentado no resto do app — hoje a tela só permite 1 subcategoria
  aberta por vez, divergência introduzida pelo escopo reduzido da Sprint 12.
- Aritmética de agrupamento por grupo extraída para um util compartilhado
  (`categoriaGrouping.ts`), sem forçar reuso de `GrupoAccordion`/
  `SubcategoriaAccordion` (que têm acoplamento de cor/dado/tendência
  divergente — ver "Regras de negócio").

**3. Redesign de tabelas/listas/botões — todas as superfícies**
- Unificação das 3 implementações de "tabela de transação"
  (`TransacoesPanel` em Dashboard/Natureza, `LiabilityDrilldown`,
  `AssetDrilldown`) num componente compartilhado (`TransactionsTable`).
  Drill-down de Ativos ganha colunas Categoria (editável) e sort — decisão
  de produto explícita do CEO, não assumida.
- Toda `<table>` do app ganha `table-layout: fixed` + `<colgroup>`
  explícito, hover de linha, e ordenação (`useTableSort`/`SortableHeader`)
  onde há coluna numérica/data — incluindo a tabela de Categorização (que,
  apesar de ser a "flagship" da Sprint 11, nunca teve sort), a tabela de
  classificação de Natureza, e os drill-downs de Ativos/Passivos.
- Densidade de linha (padding) padronizada em todo `.dash-table`.
- Listas cruas (Gestão de Contas, diálogo de sincronização) herdam o
  vocabulário visual de espaçamento/hover/tipografia — sem virar accordion.
- Hierarquia de botões nos cards de Ativos/Passivos (Editar/Vender/
  Excluir/Quitar) usando as variantes já documentadas (Default/Ghost) —
  **sem** introduzir cor nova de "destrutivo" nesta sprint sem antes passar
  por uma rodada de decisão visual explícita com o CEO.
- Rodada da skill `impeccable` (mesmo processo das Sprints 5/6/9/12,
  comparação renderizada real via Artifact) **antes** de aplicar CSS nas 9
  superfícies — cobre a decisão de densidade/hover/sort da tabela
  unificada e, se o CEO quiser, uma cor "destrutiva" nova.
- `DESIGN.md` reescrito para refletir a decisão final: remove "a tabela é
  o nível mais plano do funil por design" e documenta a tabela unificada
  como uma segunda variante formal (com nota de histórico, mesmo padrão já
  usado na seção Navigation).
- `scripts/browser-check/check-sprint13.mjs` novo.

### Fora de escopo (explicitamente)

- Qualquer mudança de backend/schema — nenhum ponto desta sprint precisa
  de endpoint novo ou migration.
- CRUD de criação/renomeação/exclusão de categoria/grupo — continua sem
  UI (mesmo corte já registrado em PRD-012).
- Projeção de custos futuros, despesas hipotéticas — vira Sprint 14
  (E9), empurrada pela entrada desta sprint na frente da fila.
- Tela de Configurações + competência de salário — vira Sprint 15 (E7).
- Introduzir cor "destrutiva" nova sem decisão explícita via rodada
  `impeccable` — se o CEO não pedir, a hierarquia de botão fica só
  Default/Ghost, sem 3ª variante.
- Reescrever `PRD-012`/`SPRINT-012-*` para refletir o rótulo novo — tratados
  como log histórico imutável; este PRD é quem passa a valer a partir de
  agora.

## Critérios de aceite

1. Dado qualquer lugar da UI que exiba a natureza "eventual" (cards, funil,
   tabela de classificação, prosa auxiliar), quando renderizado, então
   mostra "Eventual", nunca "Custo eventual".
2. Dado um card de natureza, quando o usuário clica, então abre um
   drill-down com 3 níveis — Categoria (grupo) → Subcategoria → Transação
   — cada nível com total e percentual somando 100% do total do nível pai;
   mais de uma Categoria pode ficar expandida ao mesmo tempo.
3. Dado o drill-down de Ativos (`AssetDrilldown`), quando o usuário abre a
   tabela de transações de um ativo, então vê e pode editar a Categoria da
   transação (paridade com Dashboard/Passivos), e pode ordenar por
   Data/Valor.
4. Dada qualquer tabela do app (Categorização, Natureza-classificação,
   drill-downs de Dashboard/Natureza/Ativos/Passivos, breakdown de
   Patrimônio), quando renderizada, então usa `table-layout: fixed` +
   colgroup, tem hover de linha, e oferece ordenação nas colunas
   Data/Valor (e Descrição onde aplicável).
5. Dada a lista de contas em Gestão de Contas e o diálogo de sincronização,
   quando renderizados, então usam o mesmo vocabulário visual de
   espaçamento/hover das demais listas do app, sem virar accordion.
6. Dado o `DESIGN.md`, quando revisado após esta sprint, então não contém
   mais a afirmação de que a tabela é "o nível mais plano do funil por
   design" sem uma nota de histórico explicando a mudança, e documenta a
   tabela unificada como componente formal.
7. Dado o CI, quando a suíte roda, então os testes novos/atualizados
   (backend sem mudança esperada; frontend cobrindo funil de 4 níveis,
   tabela unificada, rename) passam com cobertura ≥80% nos módulos
   tocados, sem regressão nas suítes existentes.
8. Dada uma rodada `impeccable` de decisão visual (densidade/hover/sort da
   tabela unificada e, se aplicável, cor destrutiva), quando concluída,
   então o CEO escolheu a direção antes de qualquer CSS ser aplicado nas 9
   superfícies.

## Regras de negócio

- `natureza` continua atributo de subcategoria, herdado por transação — sem
  mudança desta regra (já fixada em PRD-012).
- O funil de Natureza **não** reaproveita `GrupoAccordion`/
  `SubcategoriaAccordion` (privados em `DashboardsPage.tsx`) como
  componentes prontos: eles buscam sua própria query, colorem pela paleta
  categórica `--cat-N` (que a Natureza deliberadamente não usa — regra já
  documentada de que as cores de natureza são dessaturadas para não
  competir com a paleta de categoria), e carregam tendência por
  subcategoria que a Natureza não tem nesse grão. Só a aritmética pura de
  agrupamento (soma por `group_id`, percentual do total do pai, ordenação)
  é extraída para um util compartilhado — cor, dado e tendência continuam
  proprietários de cada tela.
- Terracotta (`--despesa`) continua exclusivo de despesa — a "One Meaning
  Rule" do `DESIGN.md` não é reaberta nesta sprint; qualquer necessidade de
  cor "destrutiva" para Excluir/Quitar é decidida via rodada `impeccable`,
  nunca reaproveitando terracotta.
- Sort client-side na tabela de Categorização (paginada no servidor, 20
  itens/página) ordena só a página carregada — limitação conhecida,
  registrada aqui para não virar "achado" de revisão depois.

## Dados e modelo

Nenhuma migration, nenhum endpoint novo. `GET /dashboards/por-categoria`
já retorna o campo `group_id`/`group_nome` necessário para o nível
Categoria do funil de Natureza.

## Segurança

Sem superfície nova de dados sensíveis — nenhuma mudança de backend/API
nesta sprint. Isolamento por `user_id` já garantido pelos endpoints
existentes reaproveitados.

## Fora de escopo / decisões adiadas

- Projeção de custos futuros — Sprint 14 (E9), reordenada por esta sprint.
- Tela de Configurações + competência de salário — Sprint 15 (E7),
  reordenada por esta sprint.
- Cor "destrutiva" nova — só se o CEO decidir na rodada `impeccable`; caso
  contrário, hierarquia de botão fica em Default/Ghost.
- Colapsar `.dash-row` (linhas de accordion) e `<table>` num único
  componente de DOM — mantidos estruturalmente separados (buttons vs.
  linhas de tabela), só a linguagem visual (hover/espaçamento) é
  documentada como compartilhada.

## Referências

- [docs/roadmap.md](../roadmap.md) (reordenação da fila de sprints do
  épico E9/E7 causada por esta sprint entrar na frente)
- [PRD-012 — Natureza: classificação e dashboard de visibilidade](PRD-012-natureza-classificacao-dashboard.md)
  (origem da tela, do rótulo "Custo eventual", e do corte de escopo do
  funil de 2 níveis)
- [PRD-011 — Categorização: tabela moderna](PRD-011-categorizacao-tabela-moderna.md)
  (origem do `.cat-review-table`, e dos itens "fora de escopo" —
  restilizar chrome de drill-down, generalizar combobox — que esta sprint
  finalmente endereça)
- [PRD-009 — Dashboards Ativos/Passivos](PRD-009-dashboards-ativos-passivos.md)
  (origem do funil `Categoria > Tipo > Transação` que o funil de Natureza
  passa a replicar)
