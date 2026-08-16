import { useState } from "react";

import type { CurrentUser } from "../api/auth";
import { AccountManagementPage } from "./AccountManagementPage";
import { AssetsPage } from "./AssetsPage";
import { CategorizationReviewPage } from "./CategorizationReviewPage";
import { DashboardsPage } from "./DashboardsPage";
import { LiabilitiesPage } from "./LiabilitiesPage";
import { NaturezaPage } from "./NaturezaPage";
import { ProjecaoPage } from "./ProjecaoPage";

interface ProtectedPageProps {
  user: CurrentUser;
}

type Tab =
  "dashboards" | "categorizar" | "ativos" | "passivos" | "natureza" | "projecao" | "contas";

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: "dashboards", label: "Dashboards" },
  { tab: "categorizar", label: "Categorizar" },
  { tab: "ativos", label: "Ativos" },
  { tab: "passivos", label: "Passivos" },
  { tab: "natureza", label: "Natureza" },
  { tab: "projecao", label: "Projeção" },
  { tab: "contas", label: "Gestão de contas" },
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
        {tab === "passivos" && <LiabilitiesPage />}
        {tab === "natureza" && <NaturezaPage />}
        {tab === "projecao" && <ProjecaoPage />}
        {tab === "contas" && <AccountManagementPage />}
      </main>
    </div>
  );
}
