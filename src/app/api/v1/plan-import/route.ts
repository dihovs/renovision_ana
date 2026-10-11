import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { importPlan, PlanReadError } from "@/lib/planImport";

/** Reading a whole house at high effort can take a minute or two. */
export const maxDuration = 300;

/** ~4 MB of base64: a phone-compressed JPEG of a plan is well under. */
const MAX_BASE64 = 4_000_000;

/**
 * Read somebody else's floor plan — a PDF page, a screenshot, a photo of a
 * printed sheet — into rooms ready to file. Writes nothing: the phone shows
 * the result and files each room the way it files a room drawn by hand.
 * See `src/lib/planImport`.
 */
export async function POST(request: Request) {
  let body: { image?: unknown };
  try {
    body = (await request.json()) as { image?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof body.image !== "string" || body.image.length < 100) {
    return NextResponse.json({ error: "Send the plan as a base64 image." }, { status: 400 });
  }
  if (body.image.length > MAX_BASE64) {
    return NextResponse.json({ error: "That image is too large. Send a smaller copy." }, { status: 413 });
  }
  const image = Buffer.from(body.image.replace(/^data:[^,]+,/, ""), "base64");

  return guarded(async () => {
    try {
      return await importPlan(image);
    } catch (err) {
      // A plan the reader could not make sense of is the operator's to know
      // about in plain words, not a 500.
      if (err instanceof PlanReadError) return { error: err.message, rooms: [], notes: [] };
      throw err;
    }
  });
}
