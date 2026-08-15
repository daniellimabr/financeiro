import { useState } from "react";

import type { CurrentUser } from "../api/auth";
import { AccountManagementPage } from "./AccountManagementPage";
import { CategorizationReviewPage } from "./CategorizationReviewPage";
import { DashboardsPage } from "./DashboardsPage";

interface ProtectedPageProps {
  user: CurrentUser;
}

type Tab = "inicio" | "dashboards" | "contas" | "categorizar";

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: "inicio", label: "Início" },
  { tab: "dashboards", label: "Dashboards" },
  { tab: "categorizar", label: "Categorizar" },
  { tab: "contas", label: "Gestão de contas" },
];

export function ProtectedPage({ user }: ProtectedPageProps) {
  const [tab, setTab] = useState<Tab>("inicio");

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
        {tab === "inicio" && (
          <section className="app-home">
            <h1>Bem-vindo, {user.name}</h1>
            <p>
              Use <strong>Dashboards</strong> para ver receita, despesa, saldo e patrimônio do mês,
              ou <strong>Categorizar</strong> para revisar e confirmar o extrato sincronizado.
            </p>
          </section>
        )}
        {tab === "dashboards" && <DashboardsPage />}
        {tab === "contas" && <AccountManagementPage />}
        {tab === "categorizar" && <CategorizationReviewPage />}
      </main>
    </div>
  );
}
