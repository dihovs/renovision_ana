import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { db, isConfigured } from "@/lib/crm/db";

/**
 * What this deployment can actually reach.
 *
 * Written because "no database connected" is reported by the UI without
 * saying WHICH of the three possible causes it is: the environment variables
 * missing on this deployment, the credentials being wrong, or the tables not
 * existing yet. Guessing between those over a phone call wastes an evening.
 *
 * Signed-in only. It reveals no secret — never a value, never a length, only
 * whether a name is set — but which tables a business has is not public
 * information either.
 */
export const dynamic = "force-dynamic";

const TABLES = [
  { name: "projects", migration: "0015_projects.sql" },
  { name: "quote_line_items", migration: "0023_quote_projects_and_tiers.sql" },
  { name: "room_scans", migration: "0024_room_scans.sql" },
  { name: "affected_areas", migration: "0025_affected_areas.sql" },
  { name: "moisture_readings", migration: "0029_drying_log.sql" },
  { name: "equipment_placements", migration: "0029_drying_log.sql" },
];

/** Columns added by a migration to a table that already existed — a table
    being present says nothing about whether the later ALTER ran. */
const COLUMNS = [
  { table: "projects", column: "custom", migration: "0026_project_custom_fields.sql" },
  { table: "room_scans", column: "plan_x", migration: "0027_room_positions.sql" },
  { table: "project_files", column: "room_scan_id", migration: "0028_room_evidence.sql" },
];

export async function GET() {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const env = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    isConfigured,
  };

  if (!isConfigured) {
    return NextResponse.json({
      ok: false,
      // The single most useful sentence this endpoint can produce, because
      // this is the failure that looks like a code bug and is not one.
      diagnosis:
        "This deployment has no Supabase credentials. In Vercel, check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are enabled for the Preview environment, not only Production — a preview branch does not inherit Production-only variables.",
      env,
      tables: null,
    });
  }

  const client = db();
  const tables: Record<string, string> = {};
  let reachable = true;

  for (const { name, migration } of TABLES) {
    const { error } = await client!.from(name).select("*", { head: true, count: "exact" }).limit(1);
    if (!error) {
      tables[name] = "ok";
      continue;
    }
    // A missing table means a migration is pending; anything else means the
    // credentials reached a server that refused them, which is a different
    // problem with a different fix.
    const missing = /does not exist|schema cache|relation/i.test(error.message);
    tables[name] = missing ? `missing — run ${migration}` : `error — ${error.message}`;
    if (!missing) reachable = false;
  }

  for (const { table, column, migration } of COLUMNS) {
    const { error } = await client!.from(table).select(column).limit(1);
    if (!error) {
      tables[`${table}.${column}`] = "ok";
      continue;
    }
    // Two very different causes look identical from here, and only one is
    // the operator's to fix. PostgREST caches the schema: a column added a
    // minute ago exists in Postgres but is unknown to the API until the
    // cache reloads. Telling somebody to re-run a migration they already ran
    // wastes their evening, so the two are separated by what the error says.
    const stale = /schema cache/i.test(error.message);
    tables[`${table}.${column}`] = stale
      ? "column added but the API has not noticed yet — reload the schema cache"
      : `missing — run ${migration}`;
  }

  const pending = Object.entries(tables).filter(([, state]) => state.startsWith("missing"));
  const stale = Object.entries(tables).filter(([, state]) => state.includes("not noticed"));

  return NextResponse.json({
    ok: reachable && pending.length === 0,
    diagnosis: !reachable
      ? "The credentials are set but Supabase refused the query. Check the service-role key matches this project."
      : stale.length > 0 && pending.length === 0
        ? `Connected. ${stale.length} column(s) exist but Supabase's API has not picked them up yet. In the SQL editor run:  notify pgrst, 'reload schema';`
        : pending.length > 0
          ? `Connected. ${pending.length} step(s) still to run — paste supabase/RUN_ME_floor_plans.sql into the Supabase SQL editor.`
          : "Connected, and everything this app needs is present.",
    env,
    tables,
  });
}
