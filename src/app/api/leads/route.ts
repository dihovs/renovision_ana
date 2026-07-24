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
  address?: string;
  marketingConsent?: boolean;
  message?: string;
  scopeSummary?: string;
  estimateLow?: string;
  estimateExpected?: string;
  estimateHigh?: string;
  lines?: EstimateLine[];
  subtotal?: string;
  gst?: string;
  qst?: string;
  total?: string;
  exclusions?: string[];
};

const SECTION_H = "color:#2b5c9e;margin:20px 0 6px;font-size:14px;";

function renderLeadEmailHtml(lead: LeadPayload & { receivedAt: string }): string {
  // 1. Contact.
  const consentLabel = lead.marketingConsent
    ? `<span style="color:#3d7d24;font-weight:bold;">Yes — opted in</span>`
    : `<span style="color:#999;">No</span>`;
  const contact = `
    <table cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td><strong>${escapeHtml(lead.name)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
      ${lead.address ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Address</td><td>${escapeHtml(lead.address)}</td></tr>` : ""}
      ${lead.message ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;">Message</td><td>${escapeHtml(lead.message)}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Marketing consent</td><td>${consentLabel}</td></tr>
    </table>`;

  // 2. What the customer saw — the range and the scope summary, exactly as the
  // widget presented it, so you know what was promised on screen.
  let customerView = "";
  if (lead.estimateLow || lead.estimateHigh) {
    const range =
      lead.estimateLow && lead.estimateHigh
        ? `${escapeHtml(lead.estimateLow)} – ${escapeHtml(lead.estimateHigh)}`
        : escapeHtml(lead.estimateExpected ?? lead.estimateLow ?? lead.estimateHigh ?? "");
    customerView = `
      <h3 style="${SECTION_H}">What the customer saw</h3>
      <div style="background:#eaf1fb;border-radius:8px;padding:12px 14px;">
        <div style="font-size:20px;font-weight:bold;color:#1f4677;">${range}</div>
        <div style="font-size:12px;color:#666;margin-top:2px;">Preliminary range shown in the chat (pre-tax)</div>
        ${lead.scopeSummary ? `<div style="font-size:13px;color:#2b2b2b;margin-top:8px;">${escapeHtml(lead.scopeSummary)}</div>` : ""}
      </div>`;
  }

  // 3. Detailed breakdown — how the estimator got there: the exact line items
  // Vision AI selected, plus the tax math. This is the traceability you need to
  // understand what the AI did and turn it into a real quote.
  let breakdown = "";
  if (lead.lines && lead.lines.length > 0) {
    const lineRows = lead.lines
      .map(
        (l) =>
          `<tr><td style="padding:3px 12px 3px 0;">${escapeHtml(l.name)}</td>` +
          `<td style="padding:3px 12px 3px 0;color:#666;white-space:nowrap;">${escapeHtml(String(l.quantity))} ${escapeHtml(l.unit)}</td>` +
          `<td style="padding:3px 0;text-align:right;white-space:nowrap;">${escapeHtml(l.total)}</td></tr>`,
      )
      .join("");
    const totalsRows = [
      lead.subtotal ? ["Subtotal (labour, pre-tax)", lead.subtotal, false] : null,
      lead.gst ? ["GST (5%)", lead.gst, false] : null,
      lead.qst ? ["QST (9.975%)", lead.qst, false] : null,
      lead.total ? ["Total with tax", lead.total, true] : null,
    ]
      .filter((r): r is [string, string, boolean] => r !== null)
      .map(
        ([label, value, bold]) =>
          `<tr><td colspan="2" style="padding:3px 12px 3px 0;text-align:right;${bold ? "font-weight:bold;border-top:1px solid #ddd;" : "color:#666;"}">${escapeHtml(label)}</td>` +
          `<td style="padding:3px 0;text-align:right;white-space:nowrap;${bold ? "font-weight:bold;border-top:1px solid #ddd;" : ""}">${escapeHtml(value)}</td></tr>`,
      )
      .join("");
    breakdown = `
      <h3 style="${SECTION_H}">Detailed breakdown — what the estimator calculated</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
        ${lineRows}
        ${totalsRows}
      </table>`;
  }

  let exclusionsHtml = "";
  if (lead.exclusions && lead.exclusions.length > 0) {
    const items = lead.exclusions.map((e) => `<li>${escapeHtml(e)}</li>`).join("");
    exclusionsHtml = `
      <h3 style="${SECTION_H}">Noted exclusions</h3>
      <ul style="margin:0;padding-left:18px;color:#666;font-size:13px;">${items}</ul>`;
  }

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#2b2b2b;max-width:560px;">
      <h2 style="color:#2b5c9e;margin:0 0 12px;">New lead from ${escapeHtml(SITE_NAME)}</h2>
      ${contact}
      ${customerView}
      ${breakdown}
      ${exclusionsHtml}
      <p style="margin-top:18px;color:#999;font-size:12px;">Preliminary estimator figures — not a binding quote. Received ${escapeHtml(lead.receivedAt)}</p>
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
