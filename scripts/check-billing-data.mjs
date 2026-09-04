import { loadEnvFile } from "node:process";
import pg from "pg";
loadEnvFile(".env.local");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const databaseUrl = new URL(process.env.SUPABASE_DIRECT_URL);
if (!databaseUrl.hostname.includes(projectRef) && !decodeURIComponent(databaseUrl.username).endsWith(`.${projectRef}`)) {
  throw new Error("Banco não corresponde ao projeto Supabase configurado.");
}
const client = new pg.Client({ connectionString: process.env.SUPABASE_DIRECT_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const result = await client.query(`SELECT "subscriptionStatus", count(*)::int AS total,
    count(*) FILTER (WHERE "mercadoPagoSubscriptionId" IS NOT NULL)::int AS linked,
    count(*) FILTER (WHERE "billingOwnerId" IS NOT NULL)::int AS units
    FROM "Clinic" WHERE "deletedAt" IS NULL GROUP BY "subscriptionStatus"`);
  const payments = await client.query('SELECT status, count(*)::int AS total FROM "PaymentHistory" GROUP BY status');
  const security = await client.query(`SELECT relrowsecurity AS rls,
    has_table_privilege('anon', oid, 'SELECT') AS anon_read,
    has_table_privilege('authenticated', oid, 'SELECT') AS authenticated_read
    FROM pg_class WHERE oid = to_regclass('public."BillingContract"')`);
  console.log(JSON.stringify({ clinics: result.rows, payments: payments.rows, contractSecurity: security.rows }));
  await client.query("ROLLBACK");
} catch {
  console.error("Falha na leitura de diagnóstico de cobrança. Nenhuma alteração foi realizada.");
  process.exitCode = 1;
} finally { await client.end(); }
