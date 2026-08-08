export interface PluggyConnectItemData {
  item: {
    id: string;
  };
}

export interface PluggyConnectOptions {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (itemData: PluggyConnectItemData) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

export interface PluggyConnectWidget {
  init: () => void;
}

declare global {
  interface Window {
    PluggyConnect: new (options: PluggyConnectOptions) => PluggyConnectWidget;
  }
}

const SCRIPT_URL = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";
const SCRIPT_ID = "pluggy-connect-sdk";

export function loadPluggyConnect(): Promise<void> {
  if (window.PluggyConnect) {
    return Promise.resolve();
  }

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Falha ao carregar o widget Pluggy Connect"))
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o widget Pluggy Connect"));
    document.body.appendChild(script);
  });
}
