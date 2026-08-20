# Migração de dados do Financeiro v1

Reaproveitamento **estrito**: apenas os dois artefatos abaixo (categorias/subcategorias e memória de classificação). O código do v1 não é copiado para o v2; o arquivo `sugestoes_engine.py` compartilhado pelo CEO é tratado apenas como **referência de calibração** (seção 3) para informar o design da futura engine de categorização (épico E3), não como código a reaproveitar.

## 1. Categorias e subcategorias — lista confirmada (2026-08-03)

**Nota Sprint 30 (2026-08-20):** Categorias e Subcategorias deixaram de ser um catálogo global e passaram a ser **por usuário**. Cada usuário tem sua própria cópia editável. Para os usuários já existentes no momento da migração, a migration `0018` clonou o catálogo global vivo do banco (uma cópia por usuário, repontando toda transação/regra de categorização). Para usuários novos a partir de então, o cadastro semeia a mesma composição a partir de um snapshot congelado em código (`backend/app/categories/seed.py`, capturado do catálogo real em 2026-08-20 — mesmo conteúdo, agora fixo, não mais lido do CSV). O antigo script de import do catálogo global (`backend/scripts/import_legacy_categories.py`) foi deletado — é estruturalmente incompatível com o novo schema (coluna `user_id` em `CategoryGroup`/`Subcategory` é `NOT NULL`). O mapeamento de classificação do v1 (`import_legacy_categorization_rules.py`) continua funcional, mas agora resolve subcategorias escopadas ao usuário de destino, não a um catálogo global.

**Lista confirmada (2026-08-03, base para snapshot de 2026-08-20):** Formato `grupo,subcategoria`:

```csv
grupo,subcategoria
Alimentação,Comer fora
Alimentação,Supermercado
Compras,Eletrônicos
Compras,Miudezas e diversos
Compras,Móveis
Compras,Outras
Compras,Presentes
Compras,Roupas
Comunicação,Assinaturas
Comunicação,Celular
Doações,Doações
Educação,Cursos
Educação,Eventos
Educação,Livros
Empréstimos,Empréstimos Concedidos
Impostos e taxas,Impostos e taxas
Lazer,Ingressos
Lazer,Pelada
Lazer,Viagens
Moradia,Aluguel
Moradia,Condomínio
Moradia,Energia
Moradia,Financiamento imóvel
Moradia,Gás
Moradia,Internet
Pets,Pets
Receitas,Descontos
Receitas,Estornos
Receitas,Outras
Receitas,Recebimento de empréstimos
Receitas,Reembolsos
Receitas,Rendimentos de investimentos
Receitas,Salário
Receitas,Venda de ativos
Saúde,Academia
Saúde,Consultas e exames
Saúde,Cuidados Pessoais
Saúde,Farmácia
Saúde,Plano de saúde
Saúde,Suplementos
Seguros não-veiculares,Seguros não-veiculares
Transferência interna,Pagamento de Fatura
Transferência interna,Transferência interna
Veículos,Apps de transporte
Veículos,Combustível
Veículos,Estacionamento e pedágio
Veículos,Financiamento veículo
Veículos,Impostos veículo (IPVA e licenciamento)
Veículos,Manutenção veículo
Veículos,Multas
Veículos,Seguro veículo
```

- 15 grupos, 51 pares grupo/subcategoria (contagem verificada na Sprint 2 ao rodar
  o import real; a versão anterior desta linha dizia "16 grupos, 50 pares" —
  divergência da contagem em prosa vs. a lista abaixo, não da lista em si, que
  permanece a fonte confirmada pelo CEO).
- `natureza` (fixa/variável/eventual — escopo funcional #10) **não veio associada a este lote**: é um eixo independente da categoria e será atribuído por regra própria (ex.: `Moradia/Aluguel` tende a `fixa`, `Lazer/Viagens` tende a `eventual`, mas isso é configurável por transação/categoria, não fixo no seed).
- Detalhe do modelo de dados do v1 (visível em `sugestoes_engine.py`, ver seção 3): categoria é armazenada como string única `"Grupo/Subcategoria"` (ex.: `"Alimentação/Supermercado"`) em vez de duas colunas separadas. Considerar essa convenção (ou uma equivalente com FK) no schema do v2 — decisão de schema para o ADR/PRD de E4, não travada aqui.
- Import gera registros únicos por par (grupo, subcategoria); duplicatas são mescladas, não sobrescritas silenciosamente (log de conflitos).

## 2. Memória de classificação (regras aprendidas)

Ver também a seção 3 abaixo: o formato de "regra aprendida" do v1 é mais rico que um simples `padrao_descricao → categoria` — vale revisar antes de fechar o schema de E3.

Formato de entrada esperado: mapeamento **descrição-padrão da transação → categoria/subcategoria**, sem valores monetários nem metadados de conta.

```csv
padrao_descricao,categoria,subcategoria,confianca
"PAG*IFOOD*","Alimentação","Comer fora",alta
"UBER TRIP","Veículos","Apps de transporte",alta
```

- `padrao_descricao`: string ou regex simples usada para casar a descrição bruta do extrato/cartão.
- `confianca`: opcional; usado para desempate quando múltiplas regras casam.
- **Este é o único artefato elegível para a memória compartilhada entre usuários** (opt-in) — ver regra de segurança transversal no CLAUDE.md: nunca compartilhar valores ou descrições brutas de transação, apenas o mapeamento padrão→categoria.

## 3. Referência: motor de sugestão do v1 (não copiado, só informa o design de E3)

O CEO compartilhou `sugestoes_engine.py` do v1 para dar contexto de calibração — **o código não entra no v2**, mas os aprendizados abaixo devem informar o PRD/design da engine de categorização (épico E3) para não repetir erros já corrigidos no v1 com dado real:

- **Fila de pendências, nunca auto-confirmar:** o motor só preenche `categoria_sugerida`/`confianca`/`motivo` numa transação `pendente`; quem confirma é sempre o usuário. Bate com a decisão já tomada "categorização por regras + memória, sem LLM" — reforça que "sem LLM" também significa sem auto-aplicação silenciosa de nenhuma camada, por mais confiante que seja.
- **Camadas em ordem de precedência** (a primeira que casar ganha), cada uma com uma confiança (`alta`/`média`):
  1. Histórico exato do próprio usuário (descrição normalizada idêntica a uma já confirmada) — alta.
  2. Similaridade (`difflib.SequenceMatcher >= 0.86`) contra o histórico próprio — alta.
  3. Herança de regras de outro usuário (mecanismo de onboarding — ver abaixo) — média (nunca alta: é padrão de consumo alheio).
  4. Token distintivo do histórico (suporte ≥ 3 transações, pureza ≥ 0.7 pra uma única categoria, desempate por IDF) — média.
  5. Léxico PT-BR de tipo de comércio (fallback estático) — média.
- **Normalização de descrição** antes de qualquer camada: NFKD→ASCII→minúsculas, remove pontuação e números isolados, e **remove prefixos de canal/meio de pagamento** ("compra débito", "pix recebido", "débito automático", etc.) — sem isso "Compra débito PADARIA X" e "PADARIA X" nunca se parecem.
- **Descrições genéricas de gateway/marketplace nunca entram no histórico de treino** (ex.: "Pagamento de Pix QR Code PIX Marketplace" virava "histórico exato" para a categoria errada por coincidência de gateway, não de comerciante). Vale mapear quais descrições são "genéricas demais" para o v2 desde o início do PRD de E3.
- **Stoplist de tokens e sobrenomes comuns** existe porque, sem ela, a camada de token distintivo às vezes casava pelo nome de quem pagou/recebeu ou por um termo genérico do template bancário, não pelo tipo de estabelecimento — todos os itens da lista do v1 vieram de erros reais observados, não de suposição.
- **Cortes numéricos (0.86 similaridade, suporte ≥ 3, pureza ≥ 0.7) foram calibrados em dado real** e, segundo o autor do v1, não são seguros de afrouxar sem repetir os mesmos falsos positivos — ponto de partida razoável para a calibração do v2, a validar com o volume real de transações da família.
- **Mecanismo de herança entre usuários** (regras com `origem="herdado:<id-do-doador>"`, copiadas num fluxo de onboarding e nunca com confiança alta) é o design mais próximo do requisito "memória compartilhada opt-in" deste projeto — vale revisitar esse desenho ao especificar o PRD de compartilhamento de memória, respeitando que aqui só o mapeamento descrição→categoria é compartilhado, nunca a transação em si.
- **Invalidação por "impressão" (digest) do histórico** evita recalcular sugestões a cada leitura de extrato — só recalcula quando o digest do histórico confirmado/categorias visíveis/versão do léxico muda. Padrão de otimização a considerar quando o volume de transações justificar (não crítico para os ~2 usuários iniciais).

## Processo de import

1. CEO fornece os dois arquivos (formato a confirmar quando chegarem — atualizar exemplos acima se divergir).
2. Script de import (a implementar em sprint futura, não na Fase 0) valida schema, reporta duplicatas/conflitos, e popula:
   - tabela de categorias/subcategorias (seed inicial do sistema).
   - tabela de regras de memória de classificação, associada ao usuário que importou (respeitando opt-in antes de qualquer compartilhamento).
3. Nenhum dado transacional (extratos, saldos) vem do v1 — a sincronização de transações começa do zero via Pluggy, com corte a partir de fim de dezembro/2025.

## Pendências

- Lista de categorias/subcategorias: **recebida e confirmada** (seção 1).
- Memória de classificação (mapeamento descrição→categoria real do usuário): **recebida e importada** na Sprint 4 — arquivo `semente-classificacao.json` (328 regras), entregue pelo CEO, importado via `backend/scripts/import_legacy_categorization_rules.py` para a tabela `categorization_rules`, atribuído à conta do CEO (memória privada, não seed global — ver [PRD-004](../prd/PRD-004-categorizacao-automatica.md) §Regras de negócio). O exemplo da seção 2 acima permanece ilustrativo; o formato real usa `categoria` como string única `"Grupo/Subcategoria"` em vez de colunas separadas (ver seção 3), resolvida pelo script contra a taxonomia já importada.
- Motor de sugestão da Sprint 4 implementa só as camadas 1 (match exato: regra ou histórico confirmado) e 2 (similaridade `difflib >= 0.86`) da referência da seção 3 — camadas 3 (herança entre usuários), 4 (token distintivo/IDF) e 5 (léxico PT-BR) ficam adiadas até haver volume real suficiente para calibrar.
