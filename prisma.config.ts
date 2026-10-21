import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

const envFile = [".env.local", ".env"].find((path) => existsSync(path));
if (envFile) loadEnvFile(envFile);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.SUPABASE_DIRECT_URL || "postgresql://placeholder:placeholder@localhost:5432/cotani?schema=public",
  },
});
