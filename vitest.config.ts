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
