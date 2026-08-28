#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPLY_FLAG = "--apply";
const shouldApply = process.argv.includes(APPLY_FLAG);
const envPath = resolve(process.cwd(), ".env.local");

function loadLocalEnv() {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

loadLocalEnv();

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
if (!accessToken) {
  console.error("MERCADO_PAGO_ACCESS_TOKEN não está configurado.");
  process.exit(1);
}

const isProductionToken = accessToken.startsWith("APP_USR-");
const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const defaultProductionUrl = "https://painel.cotani.com.br";
const appUrl = isProductionToken
  ? defaultProductionUrl
  : configuredUrl || "http://localhost:3000";
const backUrl = `${appUrl.replace(/\/$/, "")}/dashboard/assinatura`;

const plans = [
  {
    envKey: "MERCADO_PAGO_ESSENTIAL_MONTHLY_PLAN_ID",
    reason: "Cotani Essencial Mensal",
    amount: 34.9,
    frequency: 1,
  },
  {
    envKey: "MERCADO_PAGO_ESSENTIAL_ANNUAL_PLAN_ID",
    reason: "Cotani Essencial Anual",
    amount: 335.04,
    frequency: 12,
  },
  {
    envKey: "MERCADO_PAGO_PROFESSIONAL_MONTHLY_PLAN_ID",
    reason: "Cotani Profissional Mensal",
    amount: 49.99,
    frequency: 1,
  },
  {
    envKey: "MERCADO_PAGO_PROFESSIONAL_ANNUAL_PLAN_ID",
    reason: "Cotani Profissional Anual",
    amount: 479.9,
    frequency: 12,
  },
];

const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

async function mercadoPagoRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return payload;
}

function matchesPlan(candidate, expected) {
  const recurring = candidate.auto_recurring ?? {};
  return candidate.reason === expected.reason
    && candidate.status === "active"
    && Number(recurring.transaction_amount) === expected.amount
    && Number(recurring.frequency) === expected.frequency
    && recurring.frequency_type === "months"
    && recurring.currency_id === "BRL";
}

async function findExistingPlan(plan) {
  const params = new URLSearchParams({ status: "active", q: plan.reason, limit: "100" });
  const result = await mercadoPagoRequest(`https://api.mercadopago.com/preapproval_plan/search?${params}`);
  return result.results?.find((candidate) => matchesPlan(candidate, plan)) ?? null;
}

async function createPlan(plan) {
  return mercadoPagoRequest("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    body: JSON.stringify({
      reason: plan.reason,
      auto_recurring: {
        frequency: plan.frequency,
        frequency_type: "months",
        transaction_amount: plan.amount,
        currency_id: "BRL",
      },
      back_url: backUrl,
    }),
  });
}

console.log(`Ambiente detectado: ${isProductionToken ? "PRODUÇÃO" : "TESTE"}`);
console.log(`URL de retorno: ${backUrl}`);

if (!shouldApply) {
  let hasInvalidPlan = false;
  console.log("\nValidando os IDs configurados no ambiente:\n");
  for (const plan of plans) {
    const configuredId = process.env[plan.envKey]?.trim();
    if (!configuredId) {
      hasInvalidPlan = true;
      console.error(`- AUSENTE: ${plan.envKey}`);
      continue;
    }

    try {
      const configuredPlan = await mercadoPagoRequest(
        `https://api.mercadopago.com/preapproval_plan/${encodeURIComponent(configuredId)}`,
      );
      if (!matchesPlan(configuredPlan, plan)) {
        hasInvalidPlan = true;
        console.error(`- DIVERGENTE: ${plan.reason} não corresponde ao valor, ciclo ou status esperado.`);
      } else {
        console.log(`- OK: ${plan.reason}`);
      }
    } catch (error) {
      hasInvalidPlan = true;
      console.error(`- INVÁLIDO: ${plan.reason} (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  if (hasInvalidPlan) {
    console.error(`\nCorrija os IDs ou execute com ${APPLY_FLAG} para localizar/criar os planos esperados.`);
    process.exit(1);
  }

  console.log("\nTodos os planos configurados estão ativos e correspondem ao catálogo da Cotani.");
  process.exit(0);
}

const results = [];
for (const plan of plans) {
  const existing = await findExistingPlan(plan);
  const resolved = existing ?? await createPlan(plan);
  results.push({ ...plan, id: String(resolved.id), reused: Boolean(existing) });
  console.log(`${existing ? "Reutilizado" : "Criado"}: ${plan.reason}`);
}

console.log("\nCopie estas variáveis para o ambiente correspondente:\n");
for (const plan of results) {
  console.log(`${plan.envKey}=${plan.id}`);
}
