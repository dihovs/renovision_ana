#!/usr/bin/env node
/**
 * Apply one migration file to the Supabase database.
 *
 * WHY THIS EXISTS. Migrations in this repo have always been run by hand, pasted
 * into the Supabase SQL editor. That works and it is not wrong — but it means a
 * migration lands only when the owner is at a browser, and the ANA-nn orders
 * bring several more. This is the same job without the browser.
 *
 *   node scripts/apply-migration.mjs supabase/migrations/0046_people_identities.sql
 *   node scripts/apply-migration.mjs --dry-run supabase/migrations/0046_...sql
 *
 * IT NEEDS A DIRECT POSTGRES CONNECTION, which is not the same credential the
 * app uses. SUPABASE_SERVICE_ROLE_KEY talks to PostgREST, and PostgREST cannot
 * create a table — it exposes rows, not DDL. So this reads SUPABASE_DB_URL:
 * Supabase dashboard -> Settings -> Database -> Connection string -> URI.
 *
 * EVERYTHING RUNS IN ONE TRANSACTION. A migration that fails halfway is worse
 * than one that never ran: half a schema is a state nobody wrote code for and
 * nobody can reason about. On any error this rolls back and the database is
 * exactly as it was.
 */

import { readFileSync } from "node:fs";
import { argv, env, exit } from "node:process";

const args = argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("usage: node scripts/apply-migration.mjs [--dry-run] <path-to.sql>");
  exit(2);
}

/** .env.local is not loaded for us — this is a plain node script, not Next. */
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (value && !env[match[1]]) env[match[1]] = value;
    }
  } catch {
    // No .env.local is a normal state; the check below reports it properly.
  }
}
loadEnvLocal();

const sql = readFileSync(file, "utf8");

if (dryRun) {
  console.log(`${file}: ${sql.split("\n").length} lines, ${sql.length} bytes`);
  const destructive = sql.match(/^\s*(drop\s+table|drop\s+column|delete\s+from|truncate)/gim);
  console.log(`destructive statements: ${destructive ? destructive.length : 0}`);
  console.log("dry run — nothing was sent to the database");
  exit(0);
}

const url = env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    [
      "SUPABASE_DB_URL is not set, so there is no way to reach the database.",
      "",
      "It is NOT the service role key — that one talks to PostgREST, which cannot",
      "create a table. This needs the direct Postgres URI:",
      "",
      "  Supabase dashboard -> Settings -> Database -> Connection string -> URI",
      "",
      "Add it to .env.local as one line, and never to a commit:",
      "",
      "  SUPABASE_DB_URL=postgresql://postgres:...",
    ].join("\n"),
  );
  exit(1);
}

const { default: pg } = await import("pg");
// Supabase terminates TLS with its own certificate chain; the pooler hostname
// does not match it. The connection is still encrypted.
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
} catch (error) {
  console.error(`could not connect: ${error.message}`);
  exit(1);
}

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`applied ${file}`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`FAILED, rolled back — the database is unchanged.\n\n${error.message}`);
  if (error.position) console.error(`at character ${error.position}`);
  exit(1);
} finally {
  await client.end();
}
