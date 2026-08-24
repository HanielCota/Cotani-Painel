#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Carrega .env.local se existir (útil para validação local).
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const required = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "DATABASE_URL",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CHECKOUT_URL",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_MONTHLY_PLAN_ID",
  "MERCADO_PAGO_ANNUAL_PLAN_ID",
];

const productionOnly = ["MERCADO_PAGO_WEBHOOK_SECRET", "PLATFORM_ADMIN_CLERK_USER_IDS"];

const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

let hasError = false;

console.log("Verificando variáveis de ambiente...\n");

for (const key of required) {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    console.error(`✗ ${key} — ausente ou vazia`);
    hasError = true;
  } else {
    console.log(`✓ ${key}`);
  }
}

if (isProduction) {
  console.log("\nVerificações obrigatórias em produção:");
  for (const key of productionOnly) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      console.error(`✗ ${key} — obrigatória em produção`);
      hasError = true;
    } else {
      console.log(`✓ ${key}`);
    }
  }

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) {
    console.error("✗ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — chave de teste detectada em produção");
    hasError = true;
  }

  if (process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
    console.error("✗ CLERK_SECRET_KEY — chave de teste detectada em produção");
    hasError = true;
  }

  for (const urlKey of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_CHECKOUT_URL"]) {
    try {
      if (new URL(process.env[urlKey]).protocol !== "https:") throw new Error();
    } catch {
      console.error(`✗ ${urlKey} — deve ser uma URL HTTPS válida em produção`);
      hasError = true;
    }
  }
}

if (process.env.WHATSAPP_SENDER_MODE === "api") {
  for (const key of ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID"]) {
    if (!process.env[key]?.trim()) {
      console.error(`✗ ${key} — obrigatória quando WHATSAPP_SENDER_MODE=api`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error("\nAlgumas variáveis estão faltando. Corrija antes de fazer deploy.");
  process.exit(1);
}

console.log("\nTodas as variáveis obrigatórias estão configuradas.");
