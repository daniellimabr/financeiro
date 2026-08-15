const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

interface PeriodFilterProps {
  ano: number;
  mes: number;
  onChange: (next: { ano?: number; mes?: number }) => void;
}

export function PeriodFilter({ ano, mes, onChange }: PeriodFilterProps) {
  return (
    <>
      <label>
        Mês
        <select
          aria-label="Mês"
          value={mes}
          onChange={(event) => onChange({ mes: Number(event.target.value) })}
        >
          {MESES.map((nome, index) => (
            <option key={nome} value={index + 1}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ano
        <select
          aria-label="Ano"
          value={ano}
          onChange={(event) => onChange({ ano: Number(event.target.value) })}
        >
          {[ano - 1, ano, ano + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
