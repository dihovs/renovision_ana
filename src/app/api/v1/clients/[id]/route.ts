import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { addClientPhone } from "@/lib/crm/clients";

/** Attach a number to an existing customer — "Add to Existing Contact" on
    the call log. A focused phones-only update; see addClientPhone for why
    this must not go through the full updateClient. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const phone = typeof body.addPhone === "string" ? body.addPhone.trim() : "";
  if (!phone) {
    return NextResponse.json({ error: "Send addPhone with the number." }, { status: 400 });
  }

  return guarded(async () => {
    await addClientPhone(id, phone, typeof body.type === "string" ? body.type : "mobile");
    return { ok: true };
  });
}
