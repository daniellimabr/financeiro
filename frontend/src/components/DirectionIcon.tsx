// Ícone de direção do valor (Sprint 34, "Analyst Console") — mesmo idioma do
// mockup aprovado: só a setinha é colorida (--ac-good/--ac-bad), o valor em
// si continua em --ac-text-h (evita competir com o restante da paleta).
// Direção vem de `transaction.tipo` (debito/credito), NUNCA do sinal de
// `valor` — regressão real encontrada em QA (Sprint 34): despesas no
// cartão de crédito guardam `valor` positivo (é um aumento da fatura, não
// uma saída de caixa como no débito), então `Number(valor) < 0` classifica
// essas despesas como receita. `tipo` é o mesmo campo que
// TransactionTipoIcon.tsx já usa por causa exatamente desse bug (achado
// "NuTag" documentado ali, Sprint 10) — não reinventar o sinal aqui.
// Extraído de TransactionsTable.tsx na Sprint 35 pra reuso em
// CategorizationReviewPage (ac-txn-table também na Sprint 35).
export function DirectionIcon({ despesa }: { despesa: boolean }) {
  const path = despesa ? "M5 9L1 3h8z" : "M5 1l4 6H1z";
  return (
    <svg
      className={`ac-valor-direction ${despesa ? "bad" : "good"}`}
      width="8"
      height="8"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
