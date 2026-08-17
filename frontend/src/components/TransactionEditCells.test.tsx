import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Asset } from "../api/assets";
import type { CategoryGroup, Subcategory } from "../api/categories";
import type { EditableTransaction } from "../utils/transactionEdit";
import {
  AssetSelectCell,
  CategorySelectCell,
  DateCell,
  DescriptionCell,
} from "./TransactionEditCells";

const GROUPS: CategoryGroup[] = [{ id: 1, nome: "Alimentação", created_at: "", updated_at: "" }];

const SUBCATEGORIES: Subcategory[] = [
  {
    id: 10,
    group_id: 1,
    nome: "Supermercado",
    natureza: "variavel",
    created_at: "",
    updated_at: "",
  },
  {
    id: 11,
    group_id: 1,
    nome: "Restaurante",
    natureza: "variavel",
    created_at: "",
    updated_at: "",
  },
];

const ASSETS: Asset[] = [
  {
    id: 5,
    user_id: 1,
    nome: "Carro",
    tipo: "veiculo",
    valor_atual: "50000",
    data_aquisicao: "2025-01-01",
    status: "ativo",
    data_venda: null,
    valor_venda: null,
    created_at: "",
    updated_at: "",
  },
];

const TRANSACTION: EditableTransaction = {
  id: 1,
  descricao: "Mercado Sao Joao",
  descricao_usuario: null,
  descricao_sugerida: null,
  subcategory_id: null,
  subcategoria_sugerida_id: 10,
  asset_id: null,
  asset_sugerido_id: null,
  data: "2026-01-15",
  data_editada_manualmente: false,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("TransactionEditCells", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("CategorySelectCell", () => {
    it("shows the grouped label for the currently suggested subcategory", () => {
      renderWithQueryClient(
        <CategorySelectCell
          transaction={TRANSACTION}
          subcategories={SUBCATEGORIES}
          groups={GROUPS}
        />
      );

      const input = screen.getByLabelText("Categoria de Mercado Sao Joao") as HTMLInputElement;
      expect(input.value).toBe("Alimentação / Supermercado");
    });

    it("selecting a new option mutates immediately", async () => {
      const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === "/categorization/transactions/1/category" && method === "PUT") {
          return Promise.resolve(jsonResponse({ ...TRANSACTION, subcategory_id: 11 }));
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      renderWithQueryClient(
        <CategorySelectCell
          transaction={TRANSACTION}
          subcategories={SUBCATEGORIES}
          groups={GROUPS}
        />
      );

      await userEvent.click(screen.getByLabelText("Categoria de Mercado Sao Joao"));
      await userEvent.click(screen.getByRole("option", { name: "Restaurante" }));

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(
          (c) =>
            String(c[0]) === "/categorization/transactions/1/category" &&
            (c[1] as RequestInit)?.method === "PUT"
        );
        expect(call).toBeDefined();
        expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
          subcategory_id: 11,
        });
      });
    });
  });

  describe("AssetSelectCell", () => {
    it("selecting an asset mutates immediately", async () => {
      const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === "/categorization/transactions/1/asset" && method === "PUT") {
          return Promise.resolve(jsonResponse({ ...TRANSACTION, asset_id: 5 }));
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      renderWithQueryClient(<AssetSelectCell transaction={TRANSACTION} assets={ASSETS} />);

      await userEvent.selectOptions(screen.getByLabelText("Ativo de Mercado Sao Joao"), "Carro");

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(
          (c) =>
            String(c[0]) === "/categorization/transactions/1/asset" &&
            (c[1] as RequestInit)?.method === "PUT"
        );
        expect(call).toBeDefined();
      });
    });
  });

  describe("DateCell", () => {
    it("editing the date calls the data endpoint", async () => {
      const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === "/categorization/transactions/1/data" && method === "PUT") {
          return Promise.resolve(
            jsonResponse({ ...TRANSACTION, data: "2026-01-16", data_editada_manualmente: true })
          );
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      renderWithQueryClient(<DateCell transaction={TRANSACTION} />);

      await userEvent.click(screen.getByText("2026-01-15"));
      const input = screen.getByLabelText("Editar data de Mercado Sao Joao");
      await userEvent.clear(input);
      await userEvent.type(input, "2026-01-16");
      await userEvent.tab();

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(
          (c) =>
            String(c[0]) === "/categorization/transactions/1/data" &&
            (c[1] as RequestInit)?.method === "PUT"
        );
        expect(call).toBeDefined();
        expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
          data: "2026-01-16",
        });
      });
    });

    it("shows a visual indicator when the date was edited manually", () => {
      renderWithQueryClient(
        <DateCell transaction={{ ...TRANSACTION, data_editada_manualmente: true }} />
      );

      expect(screen.getByLabelText("Data editada manualmente")).toBeInTheDocument();
    });

    it("does not show the indicator when the date was not edited manually", () => {
      renderWithQueryClient(<DateCell transaction={TRANSACTION} />);

      expect(screen.queryByLabelText("Data editada manualmente")).not.toBeInTheDocument();
    });
  });

  describe("DescriptionCell", () => {
    it("editing the description calls the description endpoint", async () => {
      const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === "/categorization/transactions/1/description" && method === "PUT") {
          return Promise.resolve(
            jsonResponse({
              transaction: { ...TRANSACTION, descricao_usuario: "Mercado do bairro" },
              propagated: 0,
            })
          );
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      renderWithQueryClient(<DescriptionCell transaction={TRANSACTION} />);

      await userEvent.click(screen.getByText("Mercado Sao Joao"));
      const input = screen.getByLabelText("Editar descrição de Mercado Sao Joao");
      await userEvent.clear(input);
      await userEvent.type(input, "Mercado do bairro{Enter}");

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(
          (c) =>
            String(c[0]) === "/categorization/transactions/1/description" &&
            (c[1] as RequestInit)?.method === "PUT"
        );
        expect(call).toBeDefined();
      });
    });
  });
});
