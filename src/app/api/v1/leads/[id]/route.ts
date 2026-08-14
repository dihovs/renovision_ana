import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { LEAD_STATUSES, markLeadOpened, updateLeadStatus, type LeadStatus } from "@/lib/leadStore";

/** Move a lead along the pipeline, or record that it was looked at.
    Reading and advancing stay separate on purpose — opening a lead must
    never move it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  return guarded(async () => {
    if (body.opened === true) await markLeadOpened(id);
    if (typeof body.status === "string") {
      if (!LEAD_STATUSES.includes(body.status as LeadStatus)) {
        throw new Error(`Not a lead status: ${body.status}`);
      }
      await updateLeadStatus(id, body.status as LeadStatus);
    }
    return { ok: true };
  });
}
