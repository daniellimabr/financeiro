# PRD-002: Dados mestres (categorias/subcategorias/natureza, ativos/passivos) e migração de categorias do legado

- **Status:** aprovado
- **Épico relacionado:** E4 — Gestão de dados mestres, E8 — Migração de dados legados ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-002](../sprints/SPRINT-002-dados-mestres-migracao-legado-plan.md)

## Problema

Hoje o banco só tem a tabela `users` (Sprint 1). Nenhuma funcionalidade financeira
pode existir sem dados mestres: categorias/subcategorias/natureza (para
categorizar transações em E3) e ativos/passivos (para os dashboards de patrimônio
em E6 e a associação despesa↔ativo em E3). Além disso, a lista de categorias do
Financeiro v1 já foi confirmada pelo CEO e precisa virar seed do sistema, para não
recomeçar a taxonomia do zero.

## Escopo

- **Incluído:**
  - Schema relacional `category_groups` (grupo) + `subcategories` (FK a grupo),
    com `natureza` opcional por subcategoria (enum `fixa`/`variavel`/`eventual`).
  - CRUD via API para `category_groups` e `subcategories` (list/get/create/update/delete).
  - Schema de `assets` (ativos) e `liabilities` (passivos), simples: nome, tipo,
    valor, datas, status; endpoint de baixa por venda (assets) e quitação (liabilities).
  - CRUD via API para `assets`/`liabilities`, isolado por `user_id`.
  - Script de import da lista de categorias/subcategorias do legado (CSV
    confirmado em [legacy-data.md](../migration/legacy-data.md)), com merge de
    duplicatas e log de conflitos (nunca sobrescreve silenciosamente).
  - Testes automatizados (unitários + integração), cobertura ≥80% da lógica de
    negócio nova.
- **Fora de escopo (explicitamente):**
  - Frontend/telas de gestão de categorias e ativos/passivos — decisão desta
    sessão de planejamento, fica para quando E5/E6/E3 exigirem uma tela real.
  - Import da memória de classificação do v1 (mapeamento descrição→categoria) —
    arquivo ainda não entregue pelo CEO; entra junto com o design da tabela de
    regras em E3 (Sprint 4).
  - Tabela de regras de categorização (memória) — pertence a E3, não a este PRD.
  - Financiamento parcelado (parcelas, taxa de juros, vínculo passivo↔ativo
    financiado) — schema simples primeiro, aprofundar se E6 exigir.
  - Qualquer integração Pluggy ou transação real — E2 (Sprint 3).

## Critérios de aceite

1. Dado o CSV de categorias confirmado em legacy-data.md, quando rodo o script de
   import, então as 50 combinações grupo/subcategoria existem no banco, sem
   duplicatas, e qualquer conflito é logado (não sobrescrito silenciosamente).
2. Dado um usuário autenticado, quando chama `POST /category-groups` (ou
   `/subcategories`) com um nome já existente no mesmo grupo, então recebo erro
   de validação (não duplica).
3. Dado um usuário autenticado, quando cria um ativo e depois marca venda
   (`POST /assets/{id}/sell` com data+valor), então o ativo muda para
   `status=baixado` e uma segunda tentativa de venda falha (idempotência).
4. Dado um usuário autenticado, quando cria um passivo e marca quitação
   (`POST /liabilities/{id}/settle`), então o passivo muda para `status=quitado`.
5. Dado dois usuários diferentes, quando o usuário A lista seus ativos/passivos,
   então não vê os ativos/passivos do usuário B.
6. Dado qualquer requisição às rotas de categoria/ativo/passivo sem cookie de
   sessão válido, então recebo 401.
7. Dado o CI, quando a suíte roda, então os testes novos (unit + integração)
   passam com cobertura ≥80% nos módulos novos.

## Regras de negócio

- `category_groups`/`subcategories` são dados globais do sistema (sem
  `user_id`) — compartilhados entre todos os usuários, como já indicado em
  legacy-data.md ("seed inicial do sistema").
- Nome de `category_group` único (case-insensitive); nome de `subcategory`
  único dentro do mesmo grupo.
- `natureza` é opcional em `subcategories` (nullable); valores possíveis:
  `fixa`, `variavel`, `eventual`. Sem valor default herdado da lista do legado
  (não veio associada ao lote — ver legacy-data.md §1).
- `assets`/`liabilities` pertencem a um usuário (`user_id` obrigatório, FK);
  isolamento aplicado em toda query via a dependency `get_current_user` já
  existente da Sprint 1.
- Baixa de ativo (`sell`): exige `valor_venda` e `data_venda`; só permitido se
  `status` atual = `ativo`; idempotente (não pode vender duas vezes).
- Quitação de passivo (`settle`): só permitido se `status` atual = `ativo`;
  idempotente.
- Import de categorias: upsert por (grupo, subcategoria) — se já existe, não
  sobrescreve, apenas loga conflito (comportamento definido em legacy-data.md).

## Dados e modelo

- `category_groups`: `id` (PK), `nome` (unique, not null), `created_at`, `updated_at`.
- `subcategories`: `id` (PK), `group_id` (FK `category_groups`, not null),
  `nome` (not null), `natureza` (enum nullable: `fixa`/`variavel`/`eventual`),
  `created_at`, `updated_at`. Unique (`group_id`, `nome`).
- `assets`: `id` (PK), `user_id` (FK `users`, not null), `nome` (not null),
  `tipo` (enum: `imovel`/`veiculo`/`outro`), `valor_atual` (numeric),
  `data_aquisicao` (date), `status` (enum: `ativo`/`baixado`, default `ativo`),
  `data_venda` (nullable date), `valor_venda` (nullable numeric), `created_at`, `updated_at`.
- `liabilities`: `id` (PK), `user_id` (FK `users`, not null), `nome` (not null),
  `tipo` (enum: `financiamento`/`outro`), `valor_total` (numeric),
  `saldo_devedor` (numeric), `status` (enum: `ativo`/`quitado`, default `ativo`),
  `data_quitacao` (nullable date), `created_at`, `updated_at`.
- Migrations Alembic: `0002` (`category_groups`+`subcategories`), `0003`
  (`assets`+`liabilities`), ambas reversíveis (`upgrade`/`downgrade`).

## Segurança

- Isolamento por usuário: `assets`/`liabilities` filtrados por `user_id` do JWT
  em toda query (dependency `get_current_user` reaproveitada da Sprint 1);
  `category_groups`/`subcategories` são globais por design (dado mestre do
  sistema, não dado pessoal do usuário).
- Nenhum secret novo introduzido nesta sprint.
- O CSV de categorias não é dado sensível (não contém transação/valor real) —
  pode ser versionado no repo como fixture/seed do import.

## Fora de escopo / decisões adiadas

- Frontend de gestão de dados mestres: adiado (decisão desta sessão de planejamento).
- Import de memória de classificação: adiado até o CEO entregar o arquivo real —
  ver [legacy-data.md](../migration/legacy-data.md) §Pendências.
- Financiamento parcelado (parcelas/juros/vínculo a ativo): adiado, schema
  simples por ora.
- Quem pode editar dados mestres globais: hoje qualquer usuário autenticado pode
  alterar `category_groups`/`subcategories` — aceitável para os 2 usuários da
  família; revisitar se o número de usuários crescer.

## Referências

- [docs/roadmap.md](../roadmap.md) (E4, E8)
- [docs/migration/legacy-data.md](../migration/legacy-data.md)
- [ADR-001 — Stack](../architecture/adr/ADR-001-stack.md)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
- [PRD-001 — Fundação técnica](PRD-001-fundacao-tecnica.md) (padrão de isolamento por usuário, JWT)
