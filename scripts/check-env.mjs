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
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DATABASE_URL",
  "SUPABASE_DIRECT_URL",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_ESSENTIAL_MONTHLY_PLAN_ID",
  "MERCADO_PAGO_ESSENTIAL_ANNUAL_PLAN_ID",
  "MERCADO_PAGO_PROFESSIONAL_MONTHLY_PLAN_ID",
  "MERCADO_PAGO_PROFESSIONAL_ANNUAL_PLAN_ID",
];

const productionOnly = [
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PLATFORM_ADMIN_USER_IDS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];

const turnstileTestSiteKey = "1x00000000000000000000AA";
const turnstileTestSecret = "1x0000000000000000000000000000000AA";

const twilioKeys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"];

// `next build` sempre define NODE_ENV=production, inclusive quando a build é
// executada no computador para testes. VERCEL_ENV identifica o deploy real;
// APP_ENV cobre uma eventual hospedagem própria.
const isProduction = process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";

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

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://")) {
    console.error("✗ NEXT_PUBLIC_SUPABASE_URL — URL HTTPS inválida");
    hasError = true;
  }

  for (const urlKey of ["NEXT_PUBLIC_APP_URL"]) {
    try {
      if (new URL(process.env[urlKey]).protocol !== "https:") throw new Error();
    } catch {
      console.error(`✗ ${urlKey} — deve ser uma URL HTTPS válida em produção`);
      hasError = true;
    }
  }
}

const graceDays = Number(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? 3);
if (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 30) {
  console.error("✗ SUBSCRIPTION_GRACE_PERIOD_DAYS — use um inteiro entre 1 e 30");
  hasError = true;
}

const databasePoolMax = Number(process.env.DATABASE_POOL_MAX ?? 3);
if (!Number.isInteger(databasePoolMax) || databasePoolMax < 1 || databasePoolMax > 20) {
  console.error("✗ DATABASE_POOL_MAX — use um inteiro entre 1 e 20");
  hasError = true;
}

if (isProduction && (
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() === turnstileTestSiteKey
  || process.env.TURNSTILE_SECRET_KEY?.trim() === turnstileTestSecret
)) {
  console.error("✗ TURNSTILE — as chaves oficiais de teste não podem ser usadas em produção");
  hasError = true;
}

const abandonedCheckoutRetentionDays = Number(process.env.ABANDONED_CHECKOUT_RETENTION_DAYS ?? 30);
if (!Number.isInteger(abandonedCheckoutRetentionDays) || abandonedCheckoutRetentionDays < 7 || abandonedCheckoutRetentionDays > 90) {
  console.error("✗ ABANDONED_CHECKOUT_RETENTION_DAYS — use um inteiro entre 7 e 90");
  hasError = true;
}

const whatsAppMode = process.env.WHATSAPP_SENDER_MODE?.trim() || "manual";
if (!["manual", "api"].includes(whatsAppMode)) {
  console.error("✗ WHATSAPP_SENDER_MODE — use 'manual' ou 'api'");
  hasError = true;
}

if (whatsAppMode === "api") {
  for (const key of ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID", "META_WHATSAPP_VERIFY_TOKEN", "META_APP_SECRET", "META_WHATSAPP_APPOINTMENT_TEMPLATE"]) {
    if (!process.env[key]?.trim()) {
      console.error(`✗ ${key} — obrigatória quando WHATSAPP_SENDER_MODE=api`);
      hasError = true;
    }
  }
}

const configuredTwilioKeys = twilioKeys.filter((key) => process.env[key]?.trim());
if (configuredTwilioKeys.length > 0 && configuredTwilioKeys.length < twilioKeys.length) {
  console.error("✗ Twilio — configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_SMS_FROM juntos, ou deixe os três vazios");
  hasError = true;
}

if (hasError) {
  console.error("\nAlgumas variáveis estão faltando. Corrija antes de fazer deploy.");
  process.exit(1);
}

console.log("\nTodas as variáveis obrigatórias estão configuradas.");
