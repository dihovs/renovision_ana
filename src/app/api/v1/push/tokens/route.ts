import { guarded } from "../../guard";
import { db, isMissingTable, MigrationPendingError } from "@/lib/crm/db";
import { isMissingColumn } from "@/lib/crm/conversions";

/**
 * Where the phone says "send my notifications here".
 *
 * Called on every launch, not just the first: Apple can reissue a device
 * token at any time — after a restore, an update, or for no reason it
 * explains — and a stale token is a notification that silently goes nowhere.
 * So this is an upsert, and it bumps `last_seen_at` so a device that stopped
 * checking in is visible rather than merely quiet.
 *
 * `nodejs`, because the sender it feeds speaks HTTP/2 and Edge cannot.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    environment?: unknown;
    bundleId?: unknown;
  } | null;

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  // An APNs token is hex. Checked because a token that is not one will be
  // refused by Apple on every future send, and finding out then means
  // debugging a delivery failure rather than a bad request.
  if (!/^[0-9a-fA-F]{32,200}$/.test(token)) {
    return guarded(async () => {
      throw new Error("That is not an APNs device token.");
    });
  }

  const environment =
    body?.environment === "production" ? "production" : "development";
  const bundleId = typeof body?.bundleId === "string" ? body.bundleId : null;

  return guarded(async () => {
    const supabase = db();
    if (!supabase) throw new Error("Database is not configured");

    const row: Record<string, unknown> = {
      token,
      platform: "ios",
      environment,
      bundle_id: bundleId,
      last_seen_at: new Date().toISOString(),
      // Re-registering revives a device Apple had told us was gone: the
      // app is plainly installed again if it is asking.
      disabled_at: null,
      disabled_reason: null,
    };

    let { error } = await supabase
      .from("device_tokens")
      .upsert(row, { onConflict: "token" });

    // The table can predate its own newest column. Migrations here are
    // applied by hand, so a table created from an earlier copy of 0039 is a
    // real state, not a hypothetical — and it cost an evening: the phone
    // registered every launch, the write 500'd on a column that was not
    // there, and the server truthfully reported NO DEVICE registered while
    // the device tried and tried.
    //
    // Registration is the wrong place to be strict. `disabled_reason` is
    // only ever read to explain a disabling; a device that cannot register
    // gets no notifications at all, which is far worse than one whose stale
    // reason is not cleared. So drop the optional fields and try once more.
    if (error && isMissingColumn(error)) {
      console.warn(
        `[push] device_tokens is missing a column (${error.message}) — registering without the optional fields. Run supabase/migrations/0039_device_tokens.sql to add them.`,
      );
      delete row.disabled_reason;
      delete row.disabled_at;
      ({ error } = await supabase
        .from("device_tokens")
        .upsert(row, { onConflict: "token" }));
    }

    if (error) {
      if (isMissingTable(error)) {
        throw new MigrationPendingError("device_tokens", error.message);
      }
      throw new Error(`Could not register for notifications: ${error.message}`);
    }
    return { registered: true };
  });
}
