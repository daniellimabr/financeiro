import type { ReactNode } from "react";

// Card reutilizável do sistema "Analyst Console" (Sprint 36, épico E10) —
// extraído da estrutura hoje duplicada entre AssetsPage/LiabilitiesPage
// (classe .dash-tile do sistema antigo: tipo, valor grande, nome, tag
// opcional, sparkline opcional, grupo de botões de ação). Mesmo raciocínio
// que gerou SubcategoryGroupTable compartilhado entre Categorias/Natureza na
// Sprint 35. Cobre também a variante secundária (itens baixados/quitados):
// mesma forma, normalmente sem sparkline/com menos botões — a variante é
// escolha de quem usa (via ausência de `sparkline`/menos `children`), o
// único comportamento que o componente controla é o dimming via `secondary`.
export interface AcItemCardProps {
  tipo: string;
  valor: string;
  nome: string;
  tag?: string;
  sparkline?: ReactNode;
  // Lista secundária (Baixados/Quitados) — mesmo dimming que .dash-tile.baixado
  // tinha no sistema antigo (opacity reduzida), sem introduzir uma 2ª classe.
  secondary?: boolean;
  // Grupo de botões de ação (Editar/Vender/Quitar/Excluir/Ver gasto...) — quem
  // chama decide quais botões renderizar, o card só provê o slot/layout.
  children?: ReactNode;
}

export function AcItemCard({
  tipo,
  valor,
  nome,
  tag,
  sparkline,
  secondary = false,
  children,
}: AcItemCardProps) {
  return (
    <div className={`ac-item-card${secondary ? " secondary" : ""}`}>
      <span className="ac-item-type">{tipo}</span>
      <span className="ac-item-value">{valor}</span>
      <strong className="ac-item-name">{nome}</strong>
      {tag && <span className="ac-item-tag">{tag}</span>}
      {sparkline}
      {children && <div className="ac-btn-row">{children}</div>}
    </div>
  );
}
