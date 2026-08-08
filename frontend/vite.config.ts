/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // "assets" já é o prefixo de rota da API pra entidade financeira "Ativos"
    // (ver Caddyfile: @api path ... /assets* ...) — evita colisão com os
    // arquivos estáticos do build, que por padrão o Vite também põe em /assets.
    assetsDir: "static",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
