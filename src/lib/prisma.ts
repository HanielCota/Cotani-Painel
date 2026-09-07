import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL não foi definida.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    verify(client, done) {
      client.query("SET ROLE cotani_backend").then(() => done()).catch((error: Error) => done(error));
    },
  });

  return new PrismaClient({ adapter });
}

const existingPrisma = globalForPrisma.prisma;
let prisma: PrismaClient;

if (existingPrisma) {
  prisma = existingPrisma;
} else {
  prisma = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
