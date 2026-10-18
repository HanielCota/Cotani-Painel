import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração do Playwright para os testes E2E do Cotani.
 *
 * Sem E2E_BASE_URL, o Playwright inicia o servidor local automaticamente:
 * `pnpm dev` na máquina de desenvolvimento e `pnpm start` (build de produção)
 * no CI. Nunca reutiliza um servidor já aberto, que poderia estar apontando
 * para serviços reais (Supabase, Mercado Pago, Resend).
 */
const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
