/**
 * Export every lead to a CSV on this machine.
 *
 *   npm run leads:export
 *
 * The point of this script is ownership: the database is only the always-on
 * thing that catches a lead at 11pm. The file it writes here is yours outright
 * — opens in Excel, works offline, readable in ten years with no account and no
 * subscription. If the hosted database ever goes away, this file does not.
 *
 * Writes to LEADS_EXPORT_DIR if set, otherwise ./exports. Point it at a synced
 * folder (OneDrive, Dropbox) and the copy is backed up automatically.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Read .env.local without adding a dependency — Next loads it automatically,
// but a plain node script does not.
import { readFile } from "node:fs/promises";
try {
  const raw = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env.local — fall back to whatever is already in the environment.
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Lead storage is not configured yet.\n" +
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then run this again.",
  );
  process.exit(1);
}

const COLUMNS = [
  "created_at",
  "name",
  "phone",
  "email",
  "address",
  "locale",
  "status",
  "scope_summary",
  "estimate_low",
  "estimate_expected",
  "estimate_high",
  "total",
  "estimated_work_days",
  "marketing_consent",
  "consent_granted_at",
  "notes",
];

/** Excel-safe CSV: quote everything, double internal quotes, keep newlines. */
function csvCell(value) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db
  .from("leads")
  .select(COLUMNS.join(", "))
  .order("created_at", { ascending: false });

if (error) {
  console.error("Could not read leads:", error.message);
  process.exit(1);
}

const rows = data ?? [];
const csv = [
  COLUMNS.map(csvCell).join(","),
  ...rows.map((row) => COLUMNS.map((c) => csvCell(row[c])).join(",")),
].join("\r\n");

const outDir = process.env.LEADS_EXPORT_DIR || path.join(process.cwd(), "exports");
await mkdir(outDir, { recursive: true });

// Stamped file for history, plus a stable filename that always holds the
// latest — so a shortcut or a linked spreadsheet never breaks.
const stamp = new Date().toISOString().slice(0, 10);
const stampedPath = path.join(outDir, `renovision-leads-${stamp}.csv`);
const latestPath = path.join(outDir, "renovision-leads-latest.csv");

// BOM so Excel opens accented French characters correctly instead of mojibake.
const withBom = `﻿${csv}`;
await writeFile(stampedPath, withBom, "utf8");
await writeFile(latestPath, withBom, "utf8");

console.log(`Exported ${rows.length} lead(s)`);
console.log(`  ${stampedPath}`);
console.log(`  ${latestPath}`);
