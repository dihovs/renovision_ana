import { guarded } from "../guard";
import { listCalls } from "@/lib/crm/calls";

/**
 * The call log, for Recents on the phone.
 *
 * Trimmed hard: a recents list needs a number, a direction, a time and a
 * duration. The transcripts and project briefs these rows also carry are
 * several kilobytes each and belong on the call detail screen, not in a list
 * that loads every time somebody opens the dialer.
 */
export async function GET() {
  return guarded(async () => ({
    calls: (await listCalls(80)).map((call) => ({
      id: call.id,
      fromNumber: call.from_number,
      toNumber: call.to_number,
      status: call.status,
      startedAt: call.started_at,
      durationSeconds: call.duration_seconds,
      // Whether anybody actually spoke. A recents row for a call that rang
      // out should not look the same as one that was answered.
      answered: call.status === "completed" && (call.duration_seconds ?? 0) > 0,
      escalated: call.escalated_at !== null,
    })),
  }));
}
