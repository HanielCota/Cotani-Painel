import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL não foi definida.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Cada conexão nova assume o papel restrito de runtime antes de ser usada. */
async function setRuntimeRole(client: { query: (sql: string) => Promise<unknown> }, done: (error?: Error) => void) {
  try {
    await client.query("SET ROLE cotani_backend");
    done();
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    verify(client, done) {
      void setRuntimeRole(client, done);
    },
  });

  return new PrismaClient({ adapter });
}

const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
