import { NextResponse } from "next/server";
import { mkdir, appendFile } from "fs/promises";
import path from "path";
import { Resend } from "resend";
import { LEADS_NOTIFY_EMAIL, SITE_EMAIL, SITE_NAME } from "@/lib/constants";

type EstimateLine = { name: string; quantity: number; unit: string; total: string };

type LeadPayload = {
  name: string;
  phone: string;
  email: string;
  message?: string;
  scopeSummary?: string;
  estimateLow?: string;
  estimateExpected?: string;
  estimateHigh?: string;
  lines?: EstimateLine[];
  exclusions?: string[];
};

const LEAD_FIELD_LABELS: Record<
  keyof Omit<LeadPayload, "name" | "phone" | "email" | "lines" | "exclusions">,
  string
> = {
  message: "Message",
  scopeSummary: "Scope summary",
  estimateLow: "Estimate (low)",
  estimateExpected: "Estimate (expected)",
  estimateHigh: "Estimate (high)",
};

function renderLeadEmailHtml(lead: LeadPayload & { receivedAt: string }): string {
  const rows: string[] = [
    `<tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td><strong>${escapeHtml(lead.name)}</strong></td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>`,
  ];

  for (const key of Object.keys(LEAD_FIELD_LABELS) as (keyof typeof LEAD_FIELD_LABELS)[]) {
    const value = lead[key];
    if (!value) continue;
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;">${LEAD_FIELD_LABELS[key]}</td><td>${escapeHtml(String(value))}</td></tr>`,
    );
  }

  // Itemized breakdown of exactly what the estimator priced — this is the
  // traceability the team needs to sanity-check or turn into a real quote.
  let breakdown = "";
  if (lead.lines && lead.lines.length > 0) {
    const lineRows = lead.lines
      .map(
        (l) =>
          `<tr><td style="padding:2px 12px 2px 0;">${escapeHtml(l.name)}</td>` +
          `<td style="padding:2px 12px 2px 0;color:#666;white-space:nowrap;">${escapeHtml(String(l.quantity))} ${escapeHtml(l.unit)}</td>` +
          `<td style="padding:2px 0;text-align:right;white-space:nowrap;">${escapeHtml(l.total)}</td></tr>`,
      )
      .join("");
    breakdown = `
      <h3 style="color:#2b5c9e;margin:18px 0 6px;font-size:14px;">Estimator line items (labour, pre-tax)</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">${lineRows}</table>`;
  }

  let exclusionsHtml = "";
  if (lead.exclusions && lead.exclusions.length > 0) {
    const items = lead.exclusions.map((e) => `<li>${escapeHtml(e)}</li>`).join("");
    exclusionsHtml = `
      <h3 style="color:#2b5c9e;margin:18px 0 6px;font-size:14px;">Noted exclusions</h3>
      <ul style="margin:0;padding-left:18px;color:#666;font-size:13px;">${items}</ul>`;
  }

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#2b2b2b;">
      <h2 style="color:#2b5c9e;margin:0 0 12px;">New lead from ${escapeHtml(SITE_NAME)}</h2>
      <table cellpadding="0" cellspacing="0">${rows.join("")}</table>
      ${breakdown}
      ${exclusionsHtml}
      <p style="margin-top:16px;color:#999;font-size:12px;">Preliminary estimator figures — not a binding quote. Received ${escapeHtml(lead.receivedAt)}</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LeadPayload>;

  if (!body.name || !body.phone || !body.email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const lead = {
    ...body,
    name: body.name,
    phone: body.phone,
    email: body.email,
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

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        // Default to the verified renovisionana.ca domain so lead emails
        // actually deliver. The old fallback (onboarding@resend.dev) is
        // Resend's sandbox sender, which can ONLY reach the account owner's
        // address — every real lead notification to LEADS_NOTIFY_EMAIL was
        // being silently 403-rejected. LEADS_FROM_EMAIL can still override.
        from: process.env.LEADS_FROM_EMAIL || `${SITE_NAME} <${SITE_EMAIL}>`,
        to: LEADS_NOTIFY_EMAIL,
        replyTo: lead.email,
        subject: `New lead: ${lead.name}`,
        html: renderLeadEmailHtml(lead),
      });
      // The Resend SDK returns { data, error } instead of throwing on API-level
      // rejections (e.g. sandbox sender restrictions) — must check explicitly.
      if (error) {
        console.error("Resend rejected the lead notification email:", error);
      } else {
        console.log("[lead email sent]", data);
      }
    } catch (err) {
      console.error("Failed to send lead notification email:", err);
    }
  } else {
    console.warn("[lead email skipped] RESEND_API_KEY is not set — see .env.local.example");
  }

  return NextResponse.json({ ok: true });
}
