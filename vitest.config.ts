import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Mesmo fuso do runner do CI (UTC). Sem isso, testes que montam datas sem
// offset passam no Brasil e quebram no CI (como ocorreu desde 18/09).
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Testes de interação (agendamento, formulários) passam de 5 s em máquina
    // ou runner carregado; 15 s evita falsos negativos sem esconder travamentos.
    testTimeout: 15_000,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/generated/",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/mocks/server-only.ts"),
    },
  },
});
