# SPRINT-021 — Progresso de execução

Acompanhamento ao vivo das 21 tarefas do plano
([SPRINT-021-vinculo-holdings-serie-historica-plan.md](SPRINT-021-vinculo-holdings-serie-historica-plan.md)).
Atualizado a cada tarefa concluída. Não é o relatório final (tarefa 21) — esse
é gerado no fechamento.

- [x] 1. Bloco 0: investigação read-only (payload real FIXED_INCOME + EQUITY) — rodou na VM de **dev** (correção: dev tem as 22 holdings reais, doc desatualizada será corrigida na tarefa 20)
- [x] 2. Fechar algoritmo definitivo de baseline + separação valorização/rendimento — ver achado abaixo
- [x] 3. Migration 0017 (colunas de sugestão + tabela `pluggy_investment_snapshots`)
- [x] 4. Models `PluggyInvestment` (colunas novas) + `PluggyInvestmentSnapshot`
- [x] 5. Motor de sugestão `suggest_holding_investimento`
- [x] 6. Aplicar sugestão em `sync_item`
- [x] 7. Rotina de proposta de baseline dez/2025 + endpoints revisão/confirmação
- [x] 8. Reconstrução retroativa jan-ago/2026
- [x] 9. Job de snapshot mensal idempotente
- [x] 10. `get_evolucao_mensal` em `investimentos/service.py`
- [x] 11. Router + schemas novos
- [x] 12. Testes backend (563 passando, cobertura 98% nos módulos tocados)
- [x] 13. `api/pluggy.ts` + hooks
- [x] 14. `AccountManagementPage.tsx` — sugestão pré-selecionada
- [x] 15. Tela de revisão do baseline
- [x] 16. UI de série histórica
- [x] 17. Testes frontend (186 passando, lint/prettier limpos)
- [ ] 18. Deploy VM dev + validação ao vivo
- [ ] 19. Deploy produção (aprovação do CEO)
- [ ] 20. Atualizar docs vivos
- [ ] 21. Relatório de sprint

## Achado do Bloco 0 (payload real, dev VM — 22 holdings reais)

**FIXED_INCOME (18 posições, CDB Nubank + Tesouro XP):** payload expõe
`purchaseDate`, `dueDate`, `rate`+`rateType`+`ratePeriodicity` (CDI/IPCA) OU
`fixedAnnualRate` (prefixado, quando `rate`/`rateType` vêm `null`).
`investment_transactions` só tem `type` `BUY`/`SELL` — nenhuma transação de
rendimento própria — confirma que rendimento é sempre residual (saldo −
aportes − resgates), nunca uma linha isolada.

**Ajuste em relação ao rascunho do PRD (achado real, mais fino que o
previsto):** `rate`/`rateType` CDI ou IPCA **não é taxa fixa** — é um
percentual sobre um índice (ex. "100% do CDI") cujo valor histórico diário o
sistema não tem e não vai integrar (mesma fronteira de "fonte de cotação de
mercado" já fora de escopo pra ações — CDI/IPCA histórico é essa mesma
categoria de dependência externa). Juros compostos com confiança real só é
possível quando a taxa é **verdadeiramente fixa** (`fixedAnnualRate`
presente, `rateType` nulo — só o Tesouro Prefixado da amostra). Algoritmo
fechado, por caso:
1. `purchaseDate` (ou 1ª transação BUY) depois de 31/12/2025 → `saldo_inicial
   = 0`, confiança **alta** (posição não existia ainda — fato, não
   estimativa). Cobre a maioria das posições CDI/IPCA da amostra (compradas
   em 2026).
2. Taxa verdadeiramente fixa (`fixedAnnualRate`) e existia antes do corte →
   juros compostos desde `purchaseDate` até 31/12/2025, confiança **alta**.
3. Resto (CDI/IPCA indexado existindo antes do corte, e todo `EQUITY`) →
   fórmula reversa de fluxo (`saldo_atual − aportes líquidos desde
   jan/2026`, via `pluggy_investment_transactions`/BUY-SELL), confiança
   **"estimada"**.

**EQUITY (4 ações XP: HAPV3, VALE3, BBSE3, TAEE11):** zero transações
registradas desde jan/2026 em todas as 4 — sem BUY/SELL, sem dividendo. Sem
fonte de cotação histórica (fora de escopo) e sem transação alguma pra
reconstruir quantidade/fluxo, o baseline cai no fallback previsto no PRD-021:
valor atual como estimativa de dez/2025, confiança **"estimada"**, aviso
visual obrigatório na UI. Nenhum `type` de dividendo pôde ser confirmado no
payload real (não existe amostra) — decisão registrada, não é necessário
voltar ao CEO (autorizado no PRD), mas fica documentado no relatório final.

**Decisão de arquitetura:** os campos de taxa/vencimento (`rate`, `rateType`,
`ratePeriodicity`, `fixedAnnualRate`, `purchaseDate`) só são necessários uma
vez, no momento de gerar a proposta de baseline — não em todo carregamento de
tela. Em vez de persistir como colunas novas em `pluggy_investments` (uso
único, não recorrente), a rotina de baseline busca esses campos **ao vivo**
via `PluggyClient.get_investments()` no momento da geração da proposta.
Mantém a migration 0017 do jeito que o PRD já previa (só colunas de sugestão
+ tabela de snapshot), sem campos que ficariam sempre `NULL` depois do
baseline aprovado.
