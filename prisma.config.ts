import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
} else if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.SUPABASE_DIRECT_URL || "postgresql://placeholder:placeholder@localhost:5432/cotani?schema=public",
  },
});
