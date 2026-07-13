import { NextResponse } from "next/server";
import { mkdir, appendFile } from "fs/promises";
import path from "path";

type LeadPayload = {
  name: string;
  phone: string;
  email: string;
  projectType?: string;
  size?: string;
  tier?: string;
  estimateLow?: string;
  estimateHigh?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LeadPayload>;

  if (!body.name || !body.phone || !body.email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const lead = {
    ...body,
    receivedAt: new Date().toISOString(),
  };

  console.log("[lead captured]", lead);

  try {
    const dataDir = path.join(process.cwd(), "data");
    await mkdir(dataDir, { recursive: true });
    await appendFile(path.join(dataDir, "leads.jsonl"), `${JSON.stringify(lead)}\n`, "utf-8");
  } catch (err) {
    console.error("Could not persist lead to local file (expected on read-only hosts):", err);
  }

  return NextResponse.json({ ok: true });
}
