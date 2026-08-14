import { guarded } from "../guard";
import { listJobs } from "@/lib/crm/jobs";
import { JOB_STATUSES, type JobStatus } from "@/lib/crm/opsTypes";

/**
 * The job list the native app's Jobs tab reads.
 *
 * A thin wrapper over the same `listJobs` the web admin's own page calls —
 * no business logic lives here, so the two surfaces cannot drift.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const limit = Number(params.get("limit"));

  return guarded(async () => ({
    jobs: await listJobs({
      status: JOB_STATUSES.includes(status as JobStatus) ? (status as JobStatus) : undefined,
      clientId: params.get("clientId") || undefined,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : undefined,
    }),
  }));
}
