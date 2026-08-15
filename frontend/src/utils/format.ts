const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  return currencyFormatter.format(Number(value));
}
