# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + Vite + TypeScript no frontend (SPA), FastAPI no backend — ver [ADR-001](docs/architecture/adr/ADR-001-stack.md) (aguardando aprovação do CEO). Critério: simplicidade operacional dentro do Oracle Free Tier > modernidade.

## Users

Família (CEO/idealizador do produto e mais 1 usuário) usando login via Google OAuth. Escala inicial: 2 usuários; arquitetura deve permitir crescer para ~10 sem retrabalho, mas não é otimizada para comercialização.

## Product Purpose

Sistema financeiro pessoal/familiar: consolida extratos, cartão de crédito e investimentos via Pluggy, categoriza transações automaticamente (regras + memória de revisão do usuário, sem LLM), e oferece dashboards de receita/despesa/saldo/patrimônio com drill-down. Reinício do zero do Financeiro v1 (mesma finalidade, código e repositório recomeçados por causa de desorganização no v1).

## Positioning

Categorização automática por regras + memória de revisões manuais anteriores — sem depender de chamada a LLM na pipeline de sync, ao contrário de ferramentas financeiras genéricas. Dashboards são leitura/agregação direta sobre o banco, sem tempo real nem cache complexo — otimizados para simplicidade operacional em vez de sofisticação.

## Operating Context

- Sincronização Pluggy é manual, disparada por um botão (não agendada).
- Fluxo de categorização inclui revisão manual do usuário, que retroalimenta a memória de classificação.
- Dashboards com filtro por ano/mês; drill-down: Receita-Despesa → Categoria → Meio de pagamento → Linha de extrato.
- Gestão de ativos (imóveis, veículos) e passivos (financiamentos), com baixa por venda.
- Corte real de dados a partir de janeiro/2026 (receitas de fim de dezembro/2025 importadas para viabilizar esse corte).

## Capabilities and Constraints

- Multiusuário com isolamento de dados por usuário em toda query (constraint transversal de segurança).
- Memória de categorização compartilhável entre usuários, mas apenas opt-in e apenas o mapeamento descrição-padrão→categoria — nunca valores ou descrições brutas de transação.
- Sem sincronização agendada (backlog futuro, não escopo atual).
- Sem cache complexo ou dashboards em tempo real; agregações pré-calculadas na sync são aceitáveis.
- Deploy em Oracle Cloud VM Free Tier, banco no mesmo servidor.
- Reaproveitamento do v1 limitado a dois artefatos de dados: lista de categorias/subcategorias e memória de classificação (nenhum código do v1 é reaproveitado).

## Brand Commitments

Nenhum ainda confirmado (projeto de uso familiar, sem identidade visual/marca definida nesta fase).

## Evidence on Hand

Nenhum dado real, screenshot ou conteúdo do produto ainda disponível nesta fase (Fase 0 — bootstrap, sem código). Dados de categorias e memória de classificação do v1 serão fornecidos pelo CEO — ver [docs/migration/legacy-data.md](docs/migration/legacy-data.md).

## Product Principles

1. Simplicidade operacional acima de modernidade técnica (restrição explícita do CEO).
2. Categorização determinística (regras + memória), nunca dependente de LLM em produção.
3. Isolamento de dados por usuário é inegociável, em toda camada.
4. Nenhuma automação/agendamento além do que foi explicitamente pedido (sync manual por decisão).
5. Documentação viva sempre atualizada — uma nova sessão deve se orientar sem reler código.
