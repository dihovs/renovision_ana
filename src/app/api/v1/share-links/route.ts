import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/crm/shareLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Get Shareable Link (migration 0059). `?projectId=` lists a project's links. */
export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  return guarded(async () => ({ links: await listShareLinks(projectId) }));
}

/** `{ projectId }` → a fresh view-only link. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  return guarded(async () => ({ link: await createShareLink(projectId) }));
}

/** `?id=` → that link stops working. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  return guarded(async () => {
    await revokeShareLink(id);
    return { ok: true };
  });
}
