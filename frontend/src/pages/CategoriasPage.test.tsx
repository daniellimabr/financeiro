import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoriasPage } from "./CategoriasPage";

const GROUP_MORADIA = {
  id: 1,
  nome: "Moradia",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const GROUP_LAZER = {
  id: 2,
  nome: "Lazer",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const SUB_ALUGUEL = {
  id: 10,
  group_id: 1,
  nome: "Aluguel",
  natureza: "fixa",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const SUB_CONDOMINIO = {
  id: 11,
  group_id: 1,
  nome: "Condomínio",
  natureza: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CategoriasPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders without its own page heading (title comes from the Drawer that hosts it)", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/category-groups") return Promise.resolve(jsonResponse([GROUP_MORADIA]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByRole("button", { name: "Novo grupo" });

    expect(screen.queryByRole("heading", { name: "Categorias" })).not.toBeInTheDocument();
  });

  it("lists groups and subcategories grouped, including a group with no subcategories", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/category-groups") {
        return Promise.resolve(jsonResponse([GROUP_MORADIA, GROUP_LAZER]));
      }
      if (url === "/subcategories") {
        return Promise.resolve(jsonResponse([SUB_ALUGUEL, SUB_CONDOMINIO]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);

    expect(await screen.findByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("Condomínio")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma subcategoria neste grupo.")).toBeInTheDocument();
  });

  it("creates a new category group via POST /category-groups", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/category-groups" && method === "GET") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/subcategories" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/category-groups" && method === "POST") {
        return Promise.resolve(jsonResponse({ ...GROUP_MORADIA, nome: "Educação" }, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByRole("button", { name: "Novo grupo" });

    await userEvent.click(screen.getByRole("button", { name: "Novo grupo" }));
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Educação");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/category-groups" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ nome: "Educação" });
    });
  });

  it("edits an existing group via PUT /category-groups/{id}", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/category-groups" && method === "GET") {
        return Promise.resolve(jsonResponse([GROUP_MORADIA]));
      }
      if (url === "/subcategories" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/category-groups/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...GROUP_MORADIA, nome: "Moradia 2" }));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByText("Nenhuma subcategoria neste grupo.");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const nomeInput = screen.getByLabelText("Nome do grupo");
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "Moradia 2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/category-groups/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ nome: "Moradia 2" });
    });
  });

  it("deletes a group after confirmation via DELETE /category-groups/{id}", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/category-groups" && method === "GET") {
        return Promise.resolve(jsonResponse([GROUP_MORADIA]));
      }
      if (url === "/subcategories" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/category-groups/1" && method === "DELETE") {
        return Promise.resolve(jsonResponse(null, 204));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByText("Nenhuma subcategoria neste grupo.");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/category-groups/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("shows a blocked-deletion alert when the backend returns 400", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/category-groups" && method === "GET") {
        return Promise.resolve(jsonResponse([GROUP_MORADIA]));
      }
      if (url === "/subcategories" && method === "GET") {
        return Promise.resolve(jsonResponse([SUB_ALUGUEL]));
      }
      if (url === "/subcategories/10" && method === "DELETE") {
        return Promise.resolve(jsonResponse({ detail: "Subcategoria 'Aluguel' está em uso" }, 400));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByText("Aluguel");

    await userEvent.click(screen.getAllByRole("button", { name: "Excluir" })[1]);

    expect(
      await screen.findByText(
        "Não é possível excluir: há transações, regras de categorização ou orçamentos vinculados."
      )
    ).toBeInTheDocument();
  });

  it("creates a new subcategory scoped to a group via POST /subcategories", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/category-groups" && method === "GET") {
        return Promise.resolve(jsonResponse([GROUP_MORADIA]));
      }
      if (url === "/subcategories" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/subcategories" && method === "POST") {
        return Promise.resolve(jsonResponse({ ...SUB_ALUGUEL, natureza: null }, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByText("Nenhuma subcategoria neste grupo.");

    await userEvent.click(screen.getByRole("button", { name: "Nova subcategoria" }));
    await userEvent.type(screen.getByLabelText("Nome da subcategoria"), "Aluguel");
    await userEvent.selectOptions(screen.getByLabelText("Grupo da subcategoria"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/subcategories" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ group_id: 1, nome: "Aluguel", natureza: null });
    });
  });

  it("editing a subcategory's name preserves its existing natureza", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/category-groups" && method === "GET") {
        return Promise.resolve(jsonResponse([GROUP_MORADIA]));
      }
      if (url === "/subcategories" && method === "GET") {
        return Promise.resolve(jsonResponse([SUB_ALUGUEL]));
      }
      if (url === "/subcategories/10" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...SUB_ALUGUEL, nome: "Aluguel novo" }));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByText("Aluguel");

    await userEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    const nomeInput = screen.getByLabelText("Nome da subcategoria");
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "Aluguel novo");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/subcategories/10" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ group_id: 1, nome: "Aluguel novo", natureza: "fixa" });
    });
  });

  it("sorts by Categoria/Subcategoria, keeping rowSpan grouping intact", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/category-groups") {
        return Promise.resolve(jsonResponse([GROUP_LAZER, GROUP_MORADIA]));
      }
      if (url === "/subcategories") {
        return Promise.resolve(jsonResponse([SUB_ALUGUEL, SUB_CONDOMINIO]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategoriasPage />);
    await screen.findByText("Aluguel");

    const gruposEmOrdem = () =>
      Array.from(
        document.querySelectorAll(".subcategory-group-table tbody tr.group-start td:first-child")
      ).map((td) => td.textContent);
    // asc por padrão: Lazer (vazio) antes de Moradia.
    expect(gruposEmOrdem()[0]).toContain("Lazer");

    await userEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(gruposEmOrdem()[0]).toContain("Moradia");
  });
});
