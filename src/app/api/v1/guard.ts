import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { MigrationPendingError } from "@/lib/crm/db";

/**
 * The shape every /api/v1 route shares: check the session, run the work,
 * turn the known failures into honest status codes.
 *
 * A route handler is a public endpoint — the admin layout's session check
 * protects pages only and grants a route handler nothing. Every one of
 * these has to ask for itself, which is exactly what the existing
 * /api/admin/* routes already do.
 */
export async function guarded<T>(work: () => Promise<T>): Promise<NextResponse> {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  try {
    return NextResponse.json(await work());
  } catch (err) {
    // Migrations are applied by hand in this project, so "the table isn't
    // there yet" is a routine state with a specific fix, not a 500 — the
    // native client can say which file to run rather than "server error".
    if (err instanceof MigrationPendingError) {
      return NextResponse.json(
        { error: err.message, migrationPending: true },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
