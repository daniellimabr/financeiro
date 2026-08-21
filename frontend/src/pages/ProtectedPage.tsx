import type { ReactNode } from "react";
import { useState } from "react";

import type { CurrentUser } from "../api/auth";
import { AssetsPage } from "./AssetsPage";
import { CategorizationReviewPage } from "./CategorizationReviewPage";
import { ConfiguracoesPage } from "./ConfiguracoesPage";
import { DashboardsPage } from "./DashboardsPage";
import { InvestimentosPage } from "./InvestimentosPage";
import { LiabilitiesPage } from "./LiabilitiesPage";
import { NaturezaPage } from "./NaturezaPage";
import { OrcamentoPage } from "./OrcamentoPage";

interface ProtectedPageProps {
  user: CurrentUser;
}

type Tab =
  | "dashboards"
  | "categorizar"
  | "ativos"
  | "investimentos"
  | "passivos"
  | "natureza"
  | "orcamento"
  | "configuracoes";

// Ícones de navegação (Sprint 34, "Analyst Console") — mesmo idioma visual do
// mockup aprovado (viewBox 16x16, stroke currentColor, 1.3px): Dashboards/
// Categorizar/Ativos/Investimentos/Passivos vêm direto do mockup; Natureza/
// Orçamento/Categorias/Configurações são novos (o mockup só cobriu 6 telas),
// desenhados no mesmo traço pra não destoar. aria-hidden porque o nome
// acessível do botão já vem do texto do label ao lado.
const NAV_ICONS: Record<Tab, ReactNode> = {
  dashboards: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="8.5" width="3" height="5.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="11" y="2" width="3" height="12" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  categorizar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 5h12M2 8h12M2 11h7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  ativos: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 14V7.5L8 3l6 4.5V14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
  investimentos: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 12l3.5-4 2.5 2.5L14 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  passivos: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  natureza: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.2 13.5 5.5 8 8.8 2.5 5.5 8 2.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 9.8 8 13.1l5.5-3.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  orcamento: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="0.6" fill="currentColor" />
    </svg>
  ),
  configuracoes: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.7M8 12.5v1.7M14.2 8h-1.7M3.5 8H1.8M12.2 3.8l-1.2 1.2M5 9.8l-1.2 1.2M12.2 12.2 11 11M5 6.2 3.8 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: "dashboards", label: "Dashboards" },
  { tab: "categorizar", label: "Categorizar" },
  { tab: "ativos", label: "Ativos" },
  { tab: "investimentos", label: "Investimentos" },
  { tab: "passivos", label: "Passivos" },
  { tab: "natureza", label: "Natureza" },
  { tab: "orcamento", label: "Orçamento" },
  { tab: "configuracoes", label: "Configurações" },
];

export function ProtectedPage({ user }: ProtectedPageProps) {
  const [tab, setTab] = useState<Tab>("dashboards");

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <p className="app-brand">Financeiro</p>

        <nav className="app-nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.tab}
              type="button"
              className={item.tab === tab ? "active" : undefined}
              aria-current={item.tab === tab ? "page" : undefined}
              onClick={() => setTab(item.tab)}
            >
              {NAV_ICONS[item.tab]}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-user">
          <p className="app-user-name">{user.name}</p>
          <p className="app-user-email">{user.email}</p>
        </div>
      </aside>

      <main className="app-main">
        {tab === "dashboards" && <DashboardsPage />}
        {tab === "categorizar" && <CategorizationReviewPage />}
        {tab === "ativos" && <AssetsPage />}
        {tab === "investimentos" && <InvestimentosPage />}
        {tab === "passivos" && <LiabilitiesPage />}
        {tab === "natureza" && <NaturezaPage />}
        {tab === "orcamento" && <OrcamentoPage />}
        {tab === "configuracoes" && <ConfiguracoesPage user={user} />}
      </main>
    </div>
  );
}
