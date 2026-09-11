import { useQuery } from "@tanstack/react-query";

import { fetchPlanejamentoGrade } from "../api/planejamento";

export function usePlanejamentoGrade(anoBase: number, mesBase: number) {
  return useQuery({
    queryKey: ["planejamento", "grade", anoBase, mesBase],
    queryFn: () => fetchPlanejamentoGrade(anoBase, mesBase),
  });
}
