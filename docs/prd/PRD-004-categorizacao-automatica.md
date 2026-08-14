# PRD-004: Categorização automática (regras + memória) e associação despesa↔ativo

- **Status:** aprovado
- **Épico relacionado:** E3 — Categorização ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-004](../sprints/SPRINT-004-categorizacao-automatica-plan.md)

## Problema

Desde a Sprint 3, transações reais chegam via Pluggy (extrato, cartão,
investimento) mas ficam sem categoria (`subcategory_id` sempre `NULL`) —
nenhum dashboard de receita/despesa/patrimônio (E5/E6) pode ser calculado
sem isso. Categorizar 900+ transações uma a uma manualmente não escala; o
sistema precisa sugerir a categoria mais provável, mas **nunca aplicá-la
sozinho** — decisão fixa do projeto ("regras + memória, sem LLM").

Além disso, o CEO já entregou o arquivo de memória de classificação do
Financeiro v1 (`semente-classificacao.json`), pendência que bloqueava parte
da migração do legado (E8) desde a Sprint 2. Ele contém 328 mapeamentos
`descrição-padrão → categoria`, calibrados contra o histórico real do CEO no
v1, e serve de ponto de partida para o motor desta sprint.

## Escopo

- **Incluído:**
  - Tabela `categorization_rules`: memória de mapeamento
    `padrão-de-descrição normalizado → subcategoria`, por usuário.
  - Import do arquivo `semente-classificacao.json` (328 regras) para a
    tabela acima, atribuído à conta do CEO (memória privada — ver §Regras
    de negócio).
  - Motor de sugestão (`app/categorization/`), duas camadas de precedência:
    1. Match exato de descrição normalizada contra `categorization_rules`
       ou contra o próprio histórico de transações já confirmadas do
       usuário.
    2. Similaridade (`difflib.SequenceMatcher.ratio() >= 0.86`) contra o
       próprio histórico confirmado.
  - Normalização de descrição (NFKD→ASCII→minúsculas, remoção de
    pontuação/números isolados, remoção de prefixos de canal/meio de
    pagamento).
  - Novos campos em `pluggy_transactions` para guardar sugestão (categoria,
    confiança, fonte, score) sem nunca preencher `subcategory_id`
    automaticamente — só o usuário confirma.
  - Heurística de sugestão de ativo (`asset_sugerido_id`) por
    correspondência simples de descrição normalizada × nome do ativo,
    mesma filosofia "sugere, nunca confirma sozinho"; associação
    confirmada via `asset_id`.
  - API de fila de revisão: listar pendentes com sugestão, confirmar/editar
    categoria, confirmar/editar/limpar ativo associado.
  - Frontend mínimo: tela de revisão (fila de pendências) com
    confirmar/editar por transação.
  - Testes automatizados (meta ≥80% cobertura na lógica nova), sem
    depender de rede/credenciais reais.
- **Fora de escopo (explicitamente):**
  - Herança de regras entre usuários (memória compartilhada opt-in) — a
    tabela `categorization_rules` já é desenhada para suportar isso depois
    (`user_id` + campo `origem` extensível para `herdado:<user_id>`), mas
    o mecanismo de opt-in/onboarding em si fica para sprint futura.
  - Camada de token distintivo com IDF e léxico estático PT-BR de tipo de
    comércio (camadas 4 e 5 do motor de referência do v1) — adiadas até
    haver volume real suficiente para calibrar, seguindo o espírito de
    "schema simples primeiro" já usado em PRD-002.
  - Invalidação por digest / cache de sugestões — sugestões são recalculadas
    a cada listagem; aceitável no volume atual (2 usuários, sync manual).
  - Cálculo automático de data de competência de receita — continua fora
    (adiado para E3/E5 conforme já registrado em PRD-003).
  - Estado "pular/ignorar" na fila de revisão — uma transação pendente só
    sai da fila quando categorizada.
  - Qualquer chamada a LLM na pipeline de categorização — decisão fixa do
    projeto.

## Critérios de aceite

1. Dado o arquivo `semente-classificacao.json`, quando rodo o script de
   import apontando para a conta do CEO, então as 328 regras (que resolvem
   validamente contra a taxonomia de categorias já existente) são
   inseridas em `categorization_rules` vinculadas ao `user_id` do CEO, sem
   duplicar por `(user_id, padrao_normalizado)`, e conflitos são logados,
   não sobrescritos.
2. Dado um usuário com regras importadas, quando chamo
   `GET /categorization/pending`, então cada transação pendente sem
   categoria confirmada retorna com sugestão de subcategoria (se alguma
   camada casar), confiança e fonte — mas `subcategory_id` continua `NULL`
   e `categorizacao_status` continua `pendente`.
3. Dado que uma descrição casa exatamente com uma regra importada ou com
   uma transação já confirmada pelo mesmo usuário, então a sugestão vem da
   camada 1 (fonte `regra` ou `historico_exato`), nunca da camada 2, mesmo
   que também exista um match por similaridade.
4. Dado que uma descrição não casa exatamente mas tem
   `SequenceMatcher.ratio() >= 0.86` contra uma transação confirmada do
   mesmo usuário, então a sugestão vem da camada 2 (fonte
   `historico_similar`) com o score real do ratio.
5. Dado um usuário autenticado, quando chama
   `POST /categorization/pending/{id}/confirm` com `subcategory_id`
   válido, então a transação passa a `categorizacao_status=confirmada`,
   `subcategory_id` é setado, e ela some da listagem de pendentes;
   reenviar com um `subcategory_id` diferente reedita a categoria (não é
   bloqueado).
6. Dado um usuário autenticado, quando chama
   `PUT /categorization/pending/{id}/asset` com `asset_id` válido do
   próprio usuário, então a transação passa a ter esse `asset_id`; enviar
   `asset_id: null` limpa a associação.
7. Dado dois usuários diferentes, quando o usuário A lista pendentes ou
   confirma uma transação, então nunca vê nem altera regras, sugestões ou
   transações do usuário B (isolamento em `categorization_rules` e nos
   novos campos de `pluggy_transactions`).
8. Dado qualquer requisição às rotas `/categorization/*` sem cookie de
   sessão válido, então recebo 401.
9. Dado o CI, quando a suíte roda, então os testes novos (normalização,
   motor de sugestão, service, endpoints, import) passam com cobertura
   ≥80% nos módulos novos.
10. Dado o frontend, quando o usuário abre a aba de categorização, vê a
    fila de pendentes com sugestão pré-preenchida, confirma uma linha, e
    ela desaparece da lista após recarregar.

## Regras de negócio

- `categorization_rules` é memória **por usuário** (`user_id` obrigatório)
  — mesmo as 328 regras importadas do legado são atribuídas à conta do
  CEO, não um seed global; decisão desta sessão de planejamento, alinhada
  à regra fixa do CLAUDE.md de que memória compartilhada é opt-in.
- Normalização de descrição é obrigatória antes de qualquer camada de
  match (regra e histórico), usando a mesma função em ambos os lados —
  sem isso a comparação não funciona (lição do v1, ver
  [legacy-data.md](../migration/legacy-data.md) §3).
- O motor **nunca** escreve em `subcategory_id`/`asset_id` — só em campos
  de sugestão (`subcategoria_sugerida_id`, `asset_sugerido_id` e
  correlatos). Só a confirmação explícita do usuário via API move o
  campo confirmado.
- Precedência de camadas: match exato (regra importada ou histórico
  próprio) sempre vence sobre similaridade, independente do score da
  similaridade.
- `categorizacao_status` (novo, em `pluggy_transactions`) é distinto do
  `status` já existente (que é o status bancário de liquidação
  pendente/efetivada da Pluggy) — não reutilizar/confundir os dois.
- Sugestões são recalculadas a cada `GET /categorization/pending`
  (sem cache/digest) e persistidas na própria linha da transação.
- Import de regras: upsert por `(user_id, padrao_normalizado)` — se já
  existe, não sobrescreve, só loga conflito (mesmo padrão de
  `import_legacy_categories.py`, Sprint 2).

## Dados e modelo

- `categorization_rules` (nova, migration `0005`): `id`, `user_id` (FK
  `users`, not null), `subcategory_id` (FK `subcategories`, not null),
  `padrao_descricao` (original, auditoria), `padrao_normalizado` (usado no
  match), `origem` (`legado` | `usuario_confirmou` (futuro) |
  `herdado:<user_id>` (futuro)), timestamps. Unique
  `(user_id, padrao_normalizado)`.
- `pluggy_transactions` (migration `0006`, altera tabela existente):
  `categorizacao_status` (enum `pendente`/`confirmada`, default
  `pendente`), `subcategoria_sugerida_id` (FK nullable), `sugestao_confianca`
  (string, `alta` nesta sprint), `sugestao_fonte_tipo` (string: `regra` |
  `historico_exato` | `historico_similar`), `sugestao_fonte_id` (integer,
  referência polimórfica sem FK — só auditoria), `sugestao_score`
  (numeric 4,3), `asset_id` (FK `assets`, nullable — associação
  confirmada), `asset_sugerido_id` (FK `assets`, nullable), `asset_sugestao_confianca`
  (string, `media` nesta sprint). Índice composto
  `(user_id, categorizacao_status)`.
- `subcategory_id` (já existente desde a Sprint 3) passa a ser
  oficialmente preenchido nesta sprint — é o campo de categoria
  **confirmada**.
- Migrations Alembic: `0005` (`categorization_rules`), `0006` (colunas em
  `pluggy_transactions`), ambas reversíveis.

## Segurança

- Isolamento por usuário: `categorization_rules` e todos os campos novos
  de `pluggy_transactions` filtrados por `user_id` do JWT em toda query,
  mesmo padrão de `assets`/`liabilities`/`pluggy_*`.
- Nenhum dado de transação bruto (valor, descrição completa) é
  compartilhado entre usuários nesta sprint — só o próprio usuário lê sua
  fila e suas regras. A tabela `categorization_rules` é desenhada para
  que, quando a memória compartilhada opt-in for implementada, só o
  mapeamento padrão→categoria trafegue (nunca valor/descrição de
  transação), conforme regra fixa do CLAUDE.md.
- Nenhum secret novo introduzido nesta sprint.
- Nenhuma chamada a serviço de LLM externo em nenhum ponto do motor.

## Fora de escopo / decisões adiadas

- Herança de regras entre usuários (memória compartilhada opt-in) — schema
  pronto para isso (`origem` extensível), mecanismo em si adiado.
- Camadas de token distintivo/IDF e léxico estático PT-BR — adiadas até
  calibração com mais volume real.
- Estado "pular/ignorar" na fila — adiado; toda pendência exige categoria
  eventualmente.
- Frontend de gestão de `categorization_rules` (editar/remover regra
  manualmente) — fora de escopo, só o import e o motor automático.

## Referências

- [docs/roadmap.md](../roadmap.md) (E3)
- [docs/migration/legacy-data.md](../migration/legacy-data.md) §2, §3
  (formato da memória e lições do motor de referência do v1)
- [PRD-002 — Dados mestres](PRD-002-dados-mestres-migracao-legado.md)
  (schema de categorias reaproveitado)
- [PRD-003 — Integração Pluggy](PRD-003-integracao-pluggy.md) (schema de
  `pluggy_transactions`, campos `subcategory_id`/`categoria_pluggy` já
  reservados desde a Sprint 3)
- [ADR-001 — Stack](../architecture/adr/ADR-001-stack.md)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
