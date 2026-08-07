import { useState } from "react";

import { fetchConnectToken } from "../api/pluggy";
import { usePluggyItems } from "../hooks/usePluggyItems";
import { useRegisterPluggyItem } from "../hooks/useRegisterPluggyItem";
import { loadPluggyConnect } from "../pluggy/loadPluggyConnect";

export function ConnectAccountPage() {
  const { data: items, isLoading } = usePluggyItems();
  const registerItem = useRegisterPluggyItem();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      await loadPluggyConnect();
      const { access_token: connectToken } = await fetchConnectToken();
      const widget = new window.PluggyConnect({
        connectToken,
        includeSandbox: true,
        onSuccess: (itemData) => {
          registerItem.mutate(itemData.item.id);
        },
        onError: () => {
          setError("Não foi possível conectar a conta bancária.");
        },
      });
      widget.init();
    } catch {
      setError("Não foi possível abrir o widget de conexão.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <section>
      <h2>Conectar conta bancária</h2>
      <button onClick={handleConnect} disabled={connecting}>
        Conectar conta bancária
      </button>
      {error && <p role="alert">{error}</p>}

      <h3>Contas conectadas</h3>
      {isLoading && <p>Carregando...</p>}
      <ul>
        {items?.map((item) => (
          <li key={item.id}>
            {item.connector_name} — {item.status}
            {item.status === "updating" && " (atualizando, aguarde)"}
          </li>
        ))}
      </ul>
    </section>
  );
}
