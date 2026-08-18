# PRD-021: Vínculo automático de holdings a Investimentos + série histórica mensal

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO na sessão de aprovação da
  Sprint 20, 2026-08-18 — mesmo padrão da Sprint 18)
- **Sprint(s):** [SPRINT-021-vinculo-holdings-serie-historica-plan.md](../sprints/SPRINT-021-vinculo-holdings-serie-historica-plan.md)

## Problema

A Sprint 20 entregou a sincronização real de holdings da Pluggy (22 holdings reais: 18
CDB/Tesouro da Nubank Investimentos + 4 ações da XP) e o campo `PluggyInvestment.
investimento_id` para vincular cada holding a um `Investimento` cadastrado — mas o vínculo é
100% manual, um por um, via `<select>` em `AccountManagementPage.tsx` (seção "Posições de
investimento"). Não existe nenhuma sugestão automática, ao contrário do que já existe pra
Aporte/Resgate/Ativo/Passivo. Toda holding nova que aparecer num sync futuro (rebalanceamento
de carteira, CDB novo, etc.) exige o mesmo trabalho manual de novo.

Além disso, o sistema nunca teve série histórica de saldo/valor de nenhum ativo ou
investimento — lacuna registrada desde a Sprint 5/6 no roadmap ("Patrimônio/evolução de
investimentos segue adiado por falta de série histórica no schema") e reconfirmada em
`docs/dashboards-guia-cards.md` ("Patrimônio fica de fora — não há série histórica de
saldo/valor de ativo no schema"). `PluggyInvestment.saldo_inicial` (Sprint 20) é só um campo
de baseline — não populado com dado real, sem nenhuma série mês a mês. O CEO quer detalhar a
evolução de cada holding ao longo de 2026 (saldo em 31/12/2025, valorização, rendimento,
aportes, resgates, saldo atual) mês a mês, pra enriquecer a visão de patrimônio total.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-18), respondendo a perguntas diretas sobre os
3 pontos que a Sprint 20 tinha deixado em aberto:

1. **Vínculo holding→Investimento é um motor de sugestão automática recorrente** — não é ação
   pontual do CTO nesta rodada. Mesmo padrão de 3 camadas já usado pra Aporte/Resgate/
   Ativo/Passivo (`backend/app/categorization/engine.py`), precisa continuar sugerindo pra
   holdings novas em syncs futuros.
2. **Fonte da série histórica é híbrida**: reconstrução retroativa (jan-ago/2026) a partir de
   `pluggy_investment_transactions` + baseline dez/2025, com job de snapshot mensal novo dali
   pra frente. O CEO pediu explicitamente para o CTO **gerar uma proposta de saldo em
   31/12/2025 por holding** (não digitar manualmente), pra só revisar/aprovar linha a linha.
3. **Valorização e rendimento são conceitos distintos**, a separar por tipo de holding: ações
   (EQUITY) têm valorização de preço **e** podem gerar dividendos (os dois, não um ou outro);
   renda fixa (CDB/Tesouro) tem rendimento de juros.
4. **Sprint única, blocos sequenciais** — mesmo formato da Sprint 20 (Blocos 1-4), não
   dividida em duas sprints.

## Achado técnico que condiciona o escopo (checado nesta sessão de planejamento)

- `backend/app/pluggy_integration/service.py:438-453`/`475-479` (`_upsert_investment`/
  `_upsert_investment_transaction`) confirma que **hoje só são persistidos**: por holding —
  `type`, `subtype`, `name`, `code`/`isin`, `quantity`, `amountOriginal`, `balance`,
  `currencyCode`; por transaction — `type` (string bruta, sem taxonomia mapeada),
  `description`, `amount`, `quantity`, `date`. **Nenhum campo de taxa contratada
  (`annualRate`), vencimento (`dueDate`) ou breakdown de proventos é capturado hoje** — pode
  existir no payload bruto da Pluggy sem nunca ter sido mapeado para uma coluna, ou pode
  simplesmente não existir na API. Isso só é confirmável contra o payload real.
- `settings.pluggy_sync_cutoff_date = date(2026, 1, 1)` (`backend/app/config.py:26`) — o
  histórico de `pluggy_investment_transactions` nunca cobre dez/2025; a reconstrução do
  baseline não pode se apoiar em transações anteriores ao corte.
- **Os dados reais das 22 holdings estão em produção** — a VM de dev não tem dado real (ver
  [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md)). Não foi possível inspecionar o
  payload bruto real nesta sessão de planejamento (só leitura de código). Vira **Bloco 0** de
  investigação obrigatória na sessão de execução, mesmo princípio já usado nos Blocos 1 das
  Sprints 19/20 (nunca implementar às cegas).

### Viabilidade da leitura de saldo dez/2025 (resposta à pergunta do CEO)

Parcialmente viável, com confiança desigual por tipo de holding — decisão de design: **gerar
a proposta com o melhor método disponível por linha, marcar a confiança explicitamente
(alta/estimada), e nunca persistir em `saldo_inicial` sem revisão/aprovação do CEO** (mesmo
espírito do import de categorização legada, que também é revisado antes de virar dado ativo):

- **Quantidade (ações XP):** reconstrução segura, subtraindo/somando as transações BUY/SELL
  desde jan/2026 da quantidade atual — desde que o item já estivesse conectado antes do corte
  (confirmar por holding no Bloco 0).
- **Valor em R$ das ações:** exige cotação histórica do ativo em 31/12/2025. A Pluggy não
  fornece isso no payload de holdings/transações, e o sistema não integra hoje nenhuma fonte
  de preço histórico de mercado (fora de escopo desta sprint). Sem essa fonte, só resta
  aproximar por fórmula reversa de fluxo (`valor_atual − aportes líquidos desde jan/2026`),
  que assume implicitamente que toda a variação de preço ocorreu só no período — presunção
  fraca para ações, **confiança marcada como "estimada"** na tabela de revisão.
- **CDB/Tesouro:** se o Bloco 0 confirmar que o payload real expõe taxa contratada e data de
  aplicação, o saldo em qualquer data é calculável por juros compostos com boa confiança
  ("alta"). Se não expuser, resta a mesma fórmula reversa de fluxo, marcada "estimada" — mas
  mais defensável que para ações, já que CDB não tem preço de mercado flutuante, só acréscimo
  de juros.

## Escopo

- **Incluído:**
  - **Bloco 0 (investigação read-only obrigatória):** confirmar no payload real (prod, com
    aprovação do CEO por comando) os campos de taxa/vencimento em holdings `FIXED_INCOME` e o
    `type` real usado para dividendos/proventos em holdings `EQUITY`, antes de fechar o
    algoritmo definitivo do baseline dez/2025 e da separação valorização/rendimento.
  - Motor de sugestão holding→Investimento: match exato por `codigo` (ticker/ISIN) como
    camada primária + fallback de similaridade por `nome` (`difflib`, threshold 0.86, mesmo
    padrão de `SIMILARITY_THRESHOLD` em `categorization/engine.py:15`), rodando dentro do
    fluxo de sync, só para holdings ainda sem `investimento_id`. Sem camada de regra
    importada de legado (ver "Fora de escopo").
  - Novas colunas de sugestão em `PluggyInvestment` (mesmo padrão das colunas
    `*_sugerido_id`/`*_sugestao_confianca` já usadas em `PluggyAccount`/`PluggyTransaction`).
  - UI: `<select>` de "Posições de investimento" em `AccountManagementPage.tsx` passa a vir
    pré-selecionado com a sugestão, indicando a confiança; edição manual continua disponível.
  - Rotina de proposta de baseline dez/2025 por holding (algoritmo definido pelo achado do
    Bloco 0), com tabela de revisão explícita — o CEO aprova/ajusta linha a linha antes de
    persistir em `saldo_inicial`. Nunca grava automaticamente sem essa revisão.
  - Schema novo de snapshot mensal por holding (saldo, valorização do mês, rendimento/
    dividendos do mês, aportes, resgates), populado retroativamente para jan-ago/2026 a
    partir de `pluggy_investment_transactions` + baseline aprovado.
  - Job novo de snapshot mensal, rodando a partir de agora, gravando o snapshot do mês
    corrente por holding a cada sync (sem duplicar se já existir snapshot do mês).
  - Lógica de separação valorização/rendimento por tipo: `FIXED_INCOME` → toda variação não
    explicada por aporte/resgate é rendimento; `EQUITY` → separa dividendos (transaction
    `type` identificado no Bloco 0) de valorização (resto da variação).
  - Novo endpoint de série mensal (extensão de `Investimento.get_evolucao`,
    `backend/app/investimentos/service.py:125-175`), sem alterar o cálculo de snapshot atual
    vigente (`saldo_base`/`saldo_atual`/`rendimento_estimado`).
  - UI de série histórica (gráfico/tabela) na tela de Investimento ou no dashboard de
    Patrimônio, mostrando saldo/valorização/rendimento/dividendos/aportes/resgates mês a mês.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados), incluindo o motor de
    sugestão, a reconstrução do baseline e a idempotência do job de snapshot.
- **Fora de escopo (explicitamente):**
  - Camada de "regra importada de legado" no motor de sugestão holding→Investimento — não
    existe dado legado de vínculo holding↔Investimento pra importar (`Investimento` é
    conceito novo desde a Sprint 19, não existia no v1 nesse formato). O motor nasce só com
    histórico/similaridade.
  - Integração com fonte de preço histórico de mercado (cotação de ações em datas passadas)
    — a reconstrução de valor de ações fica como estimativa por fluxo, marcada como tal.
    Reavaliar como sprint futura se o CEO priorizar precisão maior aqui.
  - Sync agendado/automático (continua manual, decisão fixa do CLAUDE.md).

## Critérios de aceite

1. Dado um sync novo com holdings ainda sem `investimento_id`, quando o sync termina, então
   cada holding recebe uma sugestão (ou nenhuma, se não houver match) via a cascata
   código-exato → similaridade de nome, sem sobrescrever holdings já vinculadas manualmente.
2. Dado o `<select>` de "Posições de investimento" em `AccountManagementPage`, quando uma
   holding tem sugestão, então ela aparece pré-selecionada com indicação de confiança, e o
   usuário pode aceitar ou trocar manualmente.
3. Dado o Bloco 0 já concluído com o achado real, quando a rotina de baseline roda, então
   gera uma proposta de `saldo_inicial` (dez/2025) por holding com confiança explícita
   (alta/estimada) por linha, sem persistir nada até o CEO revisar e aprovar.
4. Dado o baseline aprovado, quando a série retroativa é populada, então cada holding tem um
   snapshot mensal jan-ago/2026 reconstruído a partir de `pluggy_investment_transactions` +
   baseline, com valorização e rendimento/dividendos separados conforme o tipo da holding.
5. Dado o job de snapshot mensal, quando ele roda mais de uma vez no mesmo mês, então não
   duplica o snapshot desse mês (idempotente).
6. Dado o novo endpoint de série mensal, quando consultado para um `Investimento` com
   holdings vinculadas, então retorna a série mês a mês sem alterar o resultado de
   `get_evolucao` (snapshot atual) já existente.
7. Dado dois usuários diferentes, quando cada um sincroniza/revisa sugestões/consulta a série
   histórica, então nunca vê ou altera dado do outro usuário.
8. Dado qualquer requisição às rotas novas sem cookie de sessão válido, então recebo 401.
9. Dado o CI, quando a suíte roda, então os testes novos passam com cobertura ≥80% nos
   módulos tocados.

## Regras de negócio

- Motor de sugestão holding→Investimento: camada 1 é match exato por `codigo` (ticker/ISIN)
  contra holdings já vinculadas manualmente pelo mesmo usuário (equivalente à camada de
  "histórico exato" das outras cascatas, mas usando `codigo` em vez de descrição
  normalizada — mais forte aqui porque a mesma posição reaparece com o mesmo código a cada
  sync); camada 2 é similaridade de `nome` via `difflib.SequenceMatcher`, threshold 0.86,
  mesmo valor de `SIMILARITY_THRESHOLD` já usado nas outras cascatas. Sem camada de regra
  importada (ver "Fora de escopo").
- Sugestão nunca sobrescreve `investimento_id` já definido manualmente — só preenche o campo
  de sugestão (`investimento_sugerido_id`) para holdings com `investimento_id IS NULL`.
- Baseline dez/2025: gerado por rotina/script de revisão, nunca persistido em `saldo_inicial`
  sem confirmação explícita do CEO — mesmo padrão de revisão humana já usado no import de
  categorização legada.
- Separação valorização/rendimento por `tipo` da holding (`FIXED_INCOME` vs `EQUITY`,
  conforme achado real do Bloco 0) — critério e fórmula exatos dependem do achado do Bloco 0
  e devem ser documentados no relatório de sprint se divergirem deste PRD.
- Snapshot mensal é histórico imutável uma vez gravado para meses fechados; o mês corrente
  pode ser regravado a cada sync até o mês fechar (mesmo princípio de "mês corrente é
  provisório, meses passados são fixos" já implícito noutras partes do sistema).
- Isolamento por usuário em toda tabela/endpoint novo, mesmo padrão já usado em
  `pluggy_investments`/`investimentos`.

## Dados e modelo

- Migration nova (`0017`, sequência após `0016_investments_da_pluggy.py`):
  - Colunas de sugestão em `pluggy_investments`: `investimento_sugerido_id` (FK nullable),
    `investimento_sugestao_confianca` (`String`, nullable), `investimento_sugestao_fonte_tipo`
    (`String`, nullable), `investimento_sugestao_fonte_id` (nullable), `investimento_
    sugestao_score` (nullable) — mesmo padrão das colunas equivalentes já existentes em
    `PluggyTransaction`.
  - Tabela nova de snapshot mensal (ex. `pluggy_investment_snapshots`): `id`, `investment_id`
    (FK `pluggy_investments`), `user_id`, `ano_mes` (ou `data` truncada ao mês), `saldo`,
    `valorizacao`, `rendimento`, `dividendos` (nullable, só EQUITY), `aportes`, `resgates`,
    `confianca` (marcando se é dado reconstruído/estimado ou snapshot real do job),
    `created_at`/`updated_at`. Unique constraint em `(investment_id, ano_mes)` para
    idempotência do job.
- Schema acima é um **rascunho informado pelo modelo atual** (`backend/app/models/
  pluggy.py:190-245`), sujeito a ajuste pelo achado real do Bloco 0 antes de a migration ser
  escrita definitivamente — mesmo princípio já usado nas Sprints 19/20.

## Segurança

- Isolamento por usuário em toda tabela/endpoint novo: filtro `user_id` em toda query, mesmo
  padrão já usado em `pluggy_investments`.
- Nenhum secret novo introduzido — reaproveita as credenciais Pluggy já configuradas.
- Investigação do Bloco 0 em produção segue a política de autonomia do CLAUDE.md: SSH em prod
  exige aprovação explícita do CEO por comando, mesmo sendo leitura.

## Fora de escopo / decisões adiadas

- Camada de regra importada de legado no motor de sugestão holding→Investimento (sem dado
  legado equivalente).
- Integração com fonte de cotação histórica de mercado para ações — reconstrução de valor de
  ações permanece estimativa por fluxo, marcada como tal na UI.
- Sync agendado/automático (decisão fixa do CLAUDE.md, não revisitada aqui).

## Referências

- [docs/roadmap.md](../roadmap.md) — lacuna de série histórica registrada desde a Sprint 5/6.
- [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) — nota sobre Patrimônio sem
  série histórica.
- [PRD-020 — Integração completa de Investments da Pluggy](PRD-020-integracao-completa-investments-pluggy.md)
  — modelo `PluggyInvestment`/`PluggyInvestmentTransaction`, `saldo_inicial` por holding.
- [PRD-019 — Gestão de Investimentos](PRD-019-gestao-de-investimentos.md) — modelo
  `Investimento`, padrão da cascata regra→histórico→similaridade em `categorization/
  engine.py` (`suggest_investimento`/`suggest_asset`).
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) — procedimento para o Bloco 0 de
  investigação em produção.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-sprint-21-relacionar-logical-dusk.md` — a sessão de
  execução deve ler este PRD + o plano de sprint associado; não é necessário reler o plano de
  sessão bruto.
