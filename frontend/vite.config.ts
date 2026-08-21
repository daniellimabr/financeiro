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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Exclui bootstrap sem lógica (main.tsx só monta o QueryClient/App) e
      // os próprios arquivos de teste — o resto do app (páginas, hooks,
      // componentes, utils) entra na cobertura, mesmo o que é majoritariamente
      // apresentação, porque não há uma linha divisória limpa sem revisar
      // arquivo a arquivo; o threshold de 80% (Sprint 34) é aplicado por
      // glob nos arquivos de lógica de negócio tocados nesta sprint, não
      // globalmente ainda — ver comentário do bloco thresholds abaixo.
      exclude: ["src/main.tsx", "src/test/**", "**/*.test.{ts,tsx}"],
      thresholds: {
        // Sprint 34: primeira vez que cobertura é medida no projeto. Setar
        // um piso global de 80% imediatamente quebraria o CI em código
        // legado nunca coberto por essa régua — o threshold de 80% do
        // PRD-034 vale para a lógica de negócio nova/alterada desta sprint,
        // aplicada por glob abaixo. Elevar o piso global fica para uma
        // sprint futura dedicada a isso (não decisão desta sprint).
        "src/components/KpiTile.tsx": { statements: 80, branches: 80, functions: 80, lines: 80 },
        "src/components/ChartTooltip.tsx": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        "src/utils/sharedChartDomain.ts": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
