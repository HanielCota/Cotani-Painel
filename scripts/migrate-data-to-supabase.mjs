#!/usr/bin/env node

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";

if (existsSync(".env.local")) loadEnvFile(".env.local");

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SUPABASE_DIRECT_URL;
if (!sourceUrl || !targetUrl) throw new Error("DATABASE_URL (origem) e SUPABASE_DIRECT_URL (destino) são obrigatórias.");
if (sourceUrl === targetUrl) throw new Error("Origem e destino não podem ser o mesmo banco.");

const tables = [
  "Clinic",
  "User",
  "Membership",
  "Customer",
  "Service",
  "BusinessHour",
  "Professional",
  "ProfessionalService",
  "Appointment",
  "Notification",
  "WebhookEvent",
  "RateLimit",
  "PaymentHistory",
  "AdminAuditLog",
];

const renamedColumns = {
  Clinic: { legacyExternalId: "clerkOrgId" },
  User: { legacyExternalUserId: "clerkUserId" },
  AdminAuditLog: { actorAuthUserId: "actorClerkUserId" },
};

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

const source = new pg.Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
const target = new pg.Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });

try {
  await Promise.all([source.connect(), target.connect()]);
  const existing = [];
  for (const table of tables) {
    const result = await target.query(`SELECT COUNT(*)::int AS count FROM ${quote(table)}`);
    existing.push([table, result.rows[0].count]);
  }
  const populated = existing.filter(([, count]) => count > 0);
  if (populated.length > 0) throw new Error(`O destino não está vazio: ${populated.map(([table]) => table).join(", ")}.`);

  await target.query("BEGIN");
  for (const table of tables) {
    const [{ rows }, targetColumnsResult] = await Promise.all([
      source.query(`SELECT * FROM ${quote(table)}`),
      target.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [table],
      ),
    ]);
    const targetColumns = targetColumnsResult.rows.map(({ column_name }) => column_name);
    const renameMap = renamedColumns[table] ?? {};

    for (const row of rows) {
      const columns = targetColumns.filter((column) => column !== "authUserId" && (column in row || renameMap[column] in row));
      const values = columns.map((column) => row[renameMap[column] ?? column]);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      await target.query(
        `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${placeholders})`,
        values,
      );
    }
    console.log(`${table}: ${rows.length} registro(s)`);
  }
  await target.query("COMMIT");

  for (const table of tables) {
    const [sourceCount, targetCount] = await Promise.all([
      source.query(`SELECT COUNT(*)::int AS count FROM ${quote(table)}`),
      target.query(`SELECT COUNT(*)::int AS count FROM ${quote(table)}`),
    ]);
    if (sourceCount.rows[0].count !== targetCount.rows[0].count) {
      throw new Error(`Validação de contagem falhou em ${table}.`);
    }
  }
  console.log("Migração e validação concluídas.");
} catch (error) {
  await target.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await Promise.all([source.end(), target.end()]);
}
