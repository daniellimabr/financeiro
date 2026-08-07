import { useState } from "react";

import type { CurrentUser } from "../api/auth";
import { ConnectAccountPage } from "./ConnectAccountPage";
import { TransactionsPage } from "./TransactionsPage";

interface ProtectedPageProps {
  user: CurrentUser;
}

type Tab = "inicio" | "conectar" | "transacoes";

export function ProtectedPage({ user }: ProtectedPageProps) {
  const [tab, setTab] = useState<Tab>("inicio");

  return (
    <main>
      <h1>Bem-vindo, {user.name}</h1>
      <p>{user.email}</p>

      <nav>
        <button onClick={() => setTab("inicio")}>Início</button>
        <button onClick={() => setTab("conectar")}>Conectar conta</button>
        <button onClick={() => setTab("transacoes")}>Transações</button>
      </nav>

      {tab === "conectar" && <ConnectAccountPage />}
      {tab === "transacoes" && <TransactionsPage />}
    </main>
  );
}
