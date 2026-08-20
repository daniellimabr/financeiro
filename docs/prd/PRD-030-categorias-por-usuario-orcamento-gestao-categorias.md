# PRD-030: Categorias por usuário, Orçamento, Gestão de Categorias/Subcategorias e remoção da Projeção

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO nesta sessão de planejamento)
- **Sprint(s):** [SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-plan.md](../sprints/SPRINT-030-categorias-por-usuario-orcamento-gestao-categorias-plan.md)

## Problema

Ao pedir uma sugestão de próxima funcionalidade, o CTO propôs "Orçamento mensal por categoria"
como a peça que faltava para fechar o ciclo visibilidade (Natureza, Projeção) → intenção →
acompanhamento do app. O CEO aprovou e, na mesma sessão de planejamento, trouxe mais 3 pedidos
conectados:

1. Uma tela de gestão de Categorias/Subcategorias — hoje só existe CRUD completo via API
   (`app/categories/`), sem UI de criar/renomear/excluir (só o `<select>` de `natureza` em
   `NaturezaPage.tsx` edita algo).
2. Eliminação completa da Projeção (Sprint 14) — "não serviu ao propósito, e orçamento me
   parece melhor pra isso".
3. Revamp visual da tabela de classificação de Natureza (`NaturezaPage.tsx`).

No meio da sessão, o CEO corrigiu duas premissas do primeiro rascunho do plano:
- **Orçamento deve existir a nível de usuário** (não global/compartilhado, como havia sido
  assumido por espelhar `Subcategory`/`CategoryGroup`).
- **Categoria/Subcategoria também precisam de uma tabela a nível de usuário** — o catálogo hoje
  global vira só o ponto de partida (seed) de cada usuário, que passa a poder editar sua própria
  cópia livremente sem afetar o outro usuário.
- **O mecanismo de Orçamento deve servir tanto para Despesa quanto Receita**, não só Despesa.

## Investigação técnica desta sessão de planejamento

Confirmado por leitura direta de código (3 agentes de exploração + leitura manual dos arquivos
críticos), sem necessidade de dado ao vivo na VM:

- `app/categories/service.py`/`router.py` hoje **não filtram por usuário em nenhuma função** —
  fazem sentido hoje porque `CategoryGroup`/`Subcategory` são globais, mas isso precisa mudar
  junto da migração para nível de usuário (sem isso, um usuário poderia ler/editar/excluir a
  categoria do outro).
- `delete_subcategory`/`delete_group` fazem `db.delete()` direto, sem checar uso.
  `PluggyTransaction.subcategory_id`/`CategorizationRule.subcategory_id` são as **únicas duas**
  colunas FK reais para `subcategories.id` no schema, sem `ondelete` configurado — expor
  "Excluir" numa tela nova sem corrigir isso quebra com `IntegrityError` na primeira tentativa
  real. Mesma classe de bug já corrigida duas vezes antes no projeto para `asset_id`/
  `liability_id` (Sprints 8 e 9).
- Toda agregação que cruza com `PluggyTransaction` já vive centralizada em
  `app/dashboards/service.py` mesmo quando a dimensão "pertence" a outro domínio
  (`get_por_ativo`, `get_por_natureza`) — o mesmo padrão vale para "orçado vs. realizado".
- `get_por_categoria` já aceita `tipo` (débito/crédito) como parâmetro em vez de fixar um lado —
  o endpoint de orçamento segue o mesmo padrão para cobrir Despesa e Receita sem duplicar código.
- A Projeção (Sprint 14) nunca teve migration/schema próprio — remoção é 100% código, sem dívida
  de migration a reverter.
- Não existe no schema nenhum precedente de "vigência temporal" (data início/fim opcional) nem
  de "múltiplos registros simultâneos para a mesma subcategoria" — o modelo de Orçamento é
  conceito novo, sem atalho a copiar.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas nesta sessão de planejamento (2026-08-20), via perguntas diretas:

1. Orçamento é por **Subcategoria** (não por Categoria/grupo) e **por usuário**.
2. Orçamento tem dois tipos: **eventual** (mês/ano único) ou **recorrente** (`data_inicio` +
   `data_fim` opcional — vazio = recorrência "ad eternum", sem impactar consultas/gráficos).
3. Múltiplos orçamentos podem existir para a mesma subcategoria; quando mais de um está vigente
   no mesmo mês, o "orçado total" exibido é a **soma** de todos os vigentes.
4. Orçamento vale tanto para Despesa quanto Receita — não é exclusivo de despesa.
5. Orçamento aparece em duas superfícies: tela própria com CRUD completo, e uma barra
   orçado-vs-realizado em cada linha de Subcategoria nos funis de Despesa **e** Receita do
   Dashboard.
6. Categoria/Subcategoria deixam de ser globais — cada usuário tem sua própria cópia editável,
   semeada a partir do catálogo atual no momento da migração (usuários futuros são semeados a
   partir do mesmo catálogo padrão, congelado em código).
7. Tudo entra numa sprint só (Sprint 30) — decisão explícita do CEO mesmo com a alternativa de
   dividir em sprints temáticas recomendada pelo CTO nesta sessão.
8. Eliminação completa da Projeção (não só ocultar do menu).

## Escopo

### Incluído

**Migração de Categorias/Subcategorias para nível de usuário** (fundacional, roda primeiro):
- `user_id` novo em `CategoryGroup`/`Subcategory`; unicidade de grupo passa a ser por
  `(user_id, nome)`.
- Migration que clona o catálogo global atual para cada usuário existente, repontando toda
  transação e regra de categorização para a cópia do dono, e remove as linhas globais.
- `seed_categories_for_user(db, user_id)` novo (`app/categories/seed.py`), usado pela migration
  e por `upsert_user_from_google` (todo usuário novo nasce com uma cópia do catálogo padrão).
- Threading de `user_id` em toda função de `app/categories/service.py`/`router.py` (isolamento
  sem vazamento de existência, mesmo padrão de `app/assets/`).

**Mecanismo de Orçamento**:
- Modelo `Orcamento` (tabela única, por usuário, tipo eventual/recorrente, sem unicidade —
  múltiplos orçamentos por subcategoria permitidos).
- Filtro de vigência por mês em tempo constante (sem expandir "ad eternum" em série).
- CRUD completo (`app/orcamentos/`) + agregação orçado-vs-realizado em
  `app/dashboards/service.py` (`get_orcamento_status`, parametrizada por `tipo`).
- Tela `OrcamentoPage.tsx` (CRUD) + barra orçado-vs-realizado nos funis de Despesa e Receita do
  Dashboard.

**Fix de segurança de exclusão de Categoria/Subcategoria**:
- Bloqueio de `delete_subcategory`/`delete_group` quando há transação, regra de categorização ou
  orçamento vinculado, com mensagem explicando o que está em uso.

**Gestão de Categorias/Subcategorias**:
- Tela `CategoriasPage.tsx` — criar/renomear/excluir grupo; criar/renomear/mover/excluir
  subcategoria. Não duplica edição de `natureza` (continua exclusiva de `NaturezaPage.tsx`).
- Componente de tabela agrupada compartilhado, extraído e revampado visualmente (rodada
  Impeccable/Artifact), reaproveitado também pela tabela de classificação de Natureza.

**Remoção da Projeção**:
- Remoção completa de código/testes/rota/nav de `ProjecaoPage`, `get_projecao`,
  `ProjectionChart`, `useDashboardProjecao`, `utils/projecao.ts` e script de QA associado.

### Fora de escopo (explicitamente)

- Orçamento no nível de Categoria/grupo (só Subcategoria).
- UI de compartilhamento/visualização cruzada de orçamento entre os 2 usuários da família —
  cada um vê e edita só o seu.
- Edição de `natureza` na nova tela de Categorias (continua só em `NaturezaPage.tsx`).
- Qualquer heurística de "orçamento sugerido" automático (ex. baseado em média histórica) — fica
  como candidato de sprint futura se o CEO priorizar.
- Downgrade limpo e totalmente reversível da migration de categorias — documentado como
  best-effort/irreversível, dada a natureza da operação (fusão de catálogos por usuário).

## Critérios de aceite

1. Dado dois usuários diferentes, nenhum vê, edita ou exclui a categoria/subcategoria do outro —
   cada um só enxerga sua própria cópia, semeada do catálogo original no momento da migração.
2. Dado um usuário novo (signup via Google OAuth), ele nasce com uma cópia completa do catálogo
   padrão de categorias/subcategorias.
3. Dada a migração, nenhuma transação ou regra de categorização existente fica com
   `subcategory_id` nulo ou apontando para a subcategoria de outro usuário.
4. Dado um orçamento do tipo eventual, ele só aparece como vigente no mês/ano exato definido.
5. Dado um orçamento do tipo recorrente com `data_fim` vazia, ele aparece como vigente em
   qualquer mês igual ou posterior a `data_inicio`, incluindo meses arbitrariamente distantes no
   futuro, sem degradação de performance da consulta.
6. Dados dois ou mais orçamentos vigentes na mesma subcategoria/mês, o "orçado total" exibido é
   a soma de todos.
7. Dado um orçamento numa subcategoria de receita, o mecanismo funciona igual ao de despesa
   (orçado vs. realizado, barra no funil de Receita).
8. Dada uma tentativa de excluir uma categoria/subcategoria em uso (transação, regra de
   categorização ou orçamento vinculado), a exclusão é bloqueada com mensagem explicando o que
   está em uso — não gera erro de integridade não tratado.
9. Dada a tela Categorias, criar/renomear/excluir grupo e subcategoria funciona ponta a ponta
   sem afetar o catálogo de outro usuário.
10. Dada a remoção da Projeção, nenhuma rota, componente, teste ou item de menu referente a ela
    permanece no código.
11. Dado o CI, a suíte roda 100% verde com cobertura ≥80% nos módulos novos/tocados.

## Regras de negócio

- Vigência de orçamento: eventual = `ano`+`mes` exatos; recorrente = `data_inicio <= referência`
  e (`data_fim` nula ou `data_fim >= referência`), comparando por mês/ano, não por dia.
- Orçamento não tem campo de "tipo de transação" (débito/crédito) — o tipo é implícito na
  natureza das transações que caem naquela subcategoria (mesma convenção já usada em todo
  agregador de `app/dashboards/service.py`).
- Em Despesa, ultrapassar o orçado é o sinal de alerta (estouro); em Receita, o sinal de alerta é
  o oposto — não alcançar o orçado (a decisão visual exata fica para a rodada de design da
  sprint, mas a regra de negócio de qual direção é "ruim" já está definida).
- Exclusão de categoria/subcategoria em uso é bloqueada, nunca resolvida silenciosamente
  (nenhuma desassociação automática de `subcategory_id` em transações/regras/orçamentos).

## Dados e modelo

- Migration nova: `user_id` em `category_groups`/`subcategories`, com backfill de dados reais
  (clonagem por usuário + repontamento de FKs existentes).
- Tabela nova `orcamentos` (por usuário, tipo eventual/recorrente, sem unicidade por
  subcategoria).
- Sem tabela nova para a remoção da Projeção (só remoção de código).

## Segurança

- Isolamento por usuário é o núcleo desta sprint — tanto para o catálogo de categorias (hoje
  ausente) quanto para Orçamento (novo, desde o início).
- Migração de dados reais na VM de dev (único ambiente real hoje) exige validação de contagem de
  linhas antes/depois, sem perda ou troca de dono de nenhuma referência existente.
- Nenhum secret novo introduzido.

## Referências

- [PRD-012 — Natureza: classificação e dashboard de visibilidade](PRD-012-natureza-classificacao-dashboard.md)
  — origem da tabela de classificação que esta sprint revampa e generaliza.
- [PRD-014 — Projeção de custos futuros com hipotéticas](PRD-014-projecao-custos-hipoteticas.md)
  — funcionalidade removida nesta sprint.
- [PRD-013 — Natureza: funil completo e redesign de tabelas](PRD-013-natureza-funil-e-redesign-tabelas.md)
  — precedente do mesmo tipo de unificação de componente de tabela buscada aqui.
- Plano de sessão: `C:\Users\Daniel\.claude\plans\entrando-no-modo-planejamento-dapper-shannon.md`.
