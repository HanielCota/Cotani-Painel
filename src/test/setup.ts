import "@testing-library/jest-dom";
import { loadEnvFile } from "node:process";
import { vi } from "vitest";

// Carrega variáveis de ambiente locais para testes.
try {
  loadEnvFile(".env.local");
} catch {
  // .env.local pode não existir em alguns ambientes.
}

// Garante a URL do runtime Supabase para módulos que importam o Prisma client.
process.env.SUPABASE_DATABASE_URL =
  process.env.SUPABASE_DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";

process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";

// Token fictício fixo: os testes do Mercado Pago não podem depender de um
// token no ambiente nem usar o token real carregado do .env.local.
process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-vitest";

// O unstable_cache do Next.js depende de infraestrutura interna do servidor.
// Em testes unitários, fazemos cache ser transparente.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// O headers() do Next.js só funciona dentro de uma request. Em testes,
// retornamos valores padrão para funções que caem no fallback.
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(
    new Map([
      ["host", "localhost:3000"],
      ["x-forwarded-host", "localhost:3000"],
      ["x-forwarded-proto", "http"],
    ]),
  ),
  cookies: vi.fn().mockResolvedValue(new Map()),
  draftMode: vi.fn().mockReturnValue({ isEnabled: false }),
}));
