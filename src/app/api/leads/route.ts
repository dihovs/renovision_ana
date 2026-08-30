import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { isConfigured as isLeadStoreConfigured, saveLead, uploadLeadPhotos } from "@/lib/leadStore";
import { sanitizeBrief, type ProjectBrief } from "@/lib/projectBrief";
import { sanitizeLeadSource } from "@/lib/attribution";
import { formatReference } from "@/lib/leads/reference";
import {
  LEADS_NOTIFY_EMAIL,
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE,
  SITE_URL,
} from "@/lib/constants";

/** Photos attached to the owner notification. See the build site below. */
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

type EstimateLine = {
  name: string;
  quantity: number;
  unit: string;
  total: string;
  laborHours?: number;
};

type LeadPayload = {
  name: string;
  phone: string;
  email: string;
  address?: string;
  locale?: "en" | "fr";
  marketingConsent?: boolean;
  /** Consent evidence — see LeadCaptureForm for why a boolean isn't enough. */
  consent?: { grantedAt: string; wording: string; locale: string; source: string };
  message?: string;
  /** Qualifying answers from the contact form. Fixed slugs, allowlisted below —
   *  they arrive from the browser, so they are claims, not facts. */
  isEmergency?: boolean;
  contactRole?: string;
  heardAbout?: string;
  scopeSummary?: string;
  estimateLow?: string;
  estimateExpected?: string;
  estimateHigh?: string;
  lines?: EstimateLine[];
  subtotal?: string;
  gst?: string;
  qst?: string;
  total?: string;
  totalLaborHours?: number;
  estimatedWorkDays?: number;
  exclusions?: string[];
  /** Whatever the customer typed in the chat — for handyman jobs this is the
   *  only actual description of the work; the generated scope summary records
   *  only hours and postal code. */
  customerNotes?: string;
  /** data: URLs from the chat. Previously these went to Claude to judge scope
   *  and stopped there, so the owner never saw the photo they asked for. */
  photos?: string[];
  /** The AI's handover note — what it established, in job-sheet form. Comes
   *  straight from the model, so it is re-validated here rather than trusted. */
  projectBrief?: ProjectBrief | null;
  /** Where this lead came from, `channel[:token]` — e.g. "chat:facebook_cpc"
   *  or "contact:organic_google". Grammar and rationale live with
   *  sanitizeLeadSource in lib/attribution.ts; anything off-grammar is dropped
   *  (falling back to the "website" default), never stored. Before this field
   *  was declared, a bot-POSTed `source` rode the body spread below straight
   *  into the pipeline UI. */
  source?: string;
};

/** The only values the contact form's "I am the…" select can send. Anything
 *  else is dropped rather than stored: these render in the admin and in the
 *  owner email, so junk in would be junk shown. Keys are the slugs on the
 *  wire (and in the `contact_role` column); values are how they read. */
const CONTACT_ROLE_LABELS: Record<string, string> = {
  owner: "Property owner",
  property_manager: "Property manager",
  insurance: "Insurance adjuster / broker",
  syndicate: "Condo syndicate",
  other: "Other",
};

/** Same contract for "How did you hear about us?". */
const HEARD_ABOUT_LABELS: Record<string, string> = {
  google: "Google",
  referral: "Referral from a friend",
  plumber: "Plumber",
  insurance_broker: "Insurance broker / adjuster",
  social: "Facebook / Instagram",
  neighbourhood: "Saw our work in the neighbourhood",
  other: "Other",
};

const SECTION_H = "color:#2b5c9e;margin:20px 0 6px;font-size:14px;";

function renderLeadEmailHtml(lead: LeadPayload & { receivedAt: string }): string {
  // 1. Contact.
  // Record the evidence, not just the answer — the exact wording shown, when,
  // and in which language. Until leads are stored in a database this email is
  // the only place that proof exists, so it has to travel with the lead.
  const consentEvidence = lead.consent
    ? `<div style="margin-top:4px;color:#888;font-size:11px;line-height:1.5;">
         ${escapeHtml(new Date(lead.consent.grantedAt).toLocaleString("en-CA", { timeZone: "America/Toronto" }))}
         &middot; ${escapeHtml(lead.consent.locale.toUpperCase())}
         &middot; ${escapeHtml(lead.consent.source)}<br />
         <em>&ldquo;${escapeHtml(lead.consent.wording)}&rdquo;</em>
       </div>`
    : "";
  const consentLabel = lead.marketingConsent
    ? `<span style="color:#3d7d24;font-weight:bold;">Yes — opted in</span>${consentEvidence}`
    : `<span style="color:#999;">No</span>`;
  const contact = `
    <table cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td><strong>${escapeHtml(lead.name)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
      ${lead.address ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Address</td><td>${escapeHtml(lead.address)}</td></tr>` : ""}
      ${lead.contactRole ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Role</td><td>${escapeHtml(CONTACT_ROLE_LABELS[lead.contactRole] ?? lead.contactRole)}</td></tr>` : ""}
      ${lead.heardAbout ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Heard about us</td><td>${escapeHtml(HEARD_ABOUT_LABELS[lead.heardAbout] ?? lead.heardAbout)}</td></tr>` : ""}
      ${lead.message ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;">Message</td><td>${escapeHtml(lead.message)}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Marketing consent</td><td>${consentLabel}</td></tr>
    </table>`;

  // The one flag that reorders the owner's next five minutes, so it sits above
  // everything — including the contact block it exists to escalate.
  const emergencyBanner = lead.isEmergency
    ? `<div style="background:#fbe9e7;border:1px solid #f2b8ae;border-radius:8px;padding:10px 14px;margin:0 0 14px;font-size:14px;font-weight:bold;color:#c0392b;">
         🚨 The customer marked this as an EMERGENCY — call before reading further.
       </div>`
    : "";

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
          `<td style="padding:3px 12px 3px 0;color:#888;text-align:right;white-space:nowrap;">${l.laborHours != null ? `${escapeHtml(String(l.laborHours))} h` : ""}</td>` +
          `<td style="padding:3px 0;text-align:right;white-space:nowrap;">${escapeHtml(l.total)}</td></tr>`,
      )
      .join("");
    // colspan is 3 here because the table now has 4 columns (item, qty, hours, total).
    const totalsRows = [
      lead.subtotal ? ["Subtotal (labour, pre-tax)", lead.subtotal, false] : null,
      lead.gst ? ["GST (5%)", lead.gst, false] : null,
      lead.qst ? ["QST (9.975%)", lead.qst, false] : null,
      lead.total ? ["Total with tax", lead.total, true] : null,
    ]
      .filter((r): r is [string, string, boolean] => r !== null)
      .map(
        ([label, value, bold]) =>
          `<tr><td colspan="3" style="padding:3px 12px 3px 0;text-align:right;${bold ? "font-weight:bold;border-top:1px solid #ddd;" : "color:#666;"}">${escapeHtml(label)}</td>` +
          `<td style="padding:3px 0;text-align:right;white-space:nowrap;${bold ? "font-weight:bold;border-top:1px solid #ddd;" : ""}">${escapeHtml(value)}</td></tr>`,
      )
      .join("");
    const laborRow =
      lead.totalLaborHours != null
        ? `<tr><td colspan="3" style="padding:3px 12px 3px 0;text-align:right;color:#666;">Estimated crew labour</td>` +
          `<td style="padding:3px 0;text-align:right;white-space:nowrap;color:#666;">${escapeHtml(String(lead.totalLaborHours))} h</td></tr>`
        : "";
    // 2-person crew, 8h/day, +20% delay buffer — see calculate.ts for the
    // owner-confirmed assumptions this is derived from.
    const durationRow =
      lead.estimatedWorkDays != null
        ? `<tr><td colspan="3" style="padding:3px 12px 3px 0;text-align:right;color:#666;">Est. duration (2-crew, +20% buffer)</td>` +
          `<td style="padding:3px 0;text-align:right;white-space:nowrap;color:#666;">${escapeHtml(String(lead.estimatedWorkDays))} day${lead.estimatedWorkDays === 1 ? "" : "s"}</td></tr>`
        : "";
    breakdown = `
      <h3 style="${SECTION_H}">Detailed breakdown — what the estimator calculated</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
        <tr><td style="padding:0 12px 4px 0;color:#999;font-size:11px;">Item</td><td style="padding:0 12px 4px 0;color:#999;font-size:11px;">Qty</td><td style="padding:0 12px 4px 0;color:#999;font-size:11px;text-align:right;">Labour</td><td style="padding:0 0 4px 0;color:#999;font-size:11px;text-align:right;">Sell</td></tr>
        ${lineRows}
        ${laborRow}
        ${durationRow}
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

  // 2. The brief — first, because it is the thing you read before phoning.
  // Everything below it explains how the number was reached; this is what the
  // job actually is.
  const brief = lead.projectBrief;
  let briefHtml = "";
  if (brief) {
    const factRows = brief.facts
      .map(
        (f) =>
          `<tr><td style="padding:3px 14px 3px 0;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(f.label)}</td>` +
          `<td style="padding:3px 0;">${escapeHtml(f.value)}</td></tr>`,
      )
      .join("");
    const words = brief.customerWords
      ? `<div style="margin-top:10px;padding-left:10px;border-left:3px solid #d5dee9;color:#555;font-style:italic;font-size:13px;">${escapeHtml(brief.customerWords)}</div>`
      : "";
    // Amber rather than the blue used elsewhere: these are the questions to
    // ask on the call, and they should not blend into the reference material.
    const questions = brief.openQuestions?.length
      ? `<div style="margin-top:12px;background:#fdf6e3;border-radius:6px;padding:10px 12px;">
           <div style="font-size:12px;font-weight:bold;color:#8a6d1f;text-transform:uppercase;letter-spacing:0.4px;">Still to confirm</div>
           <ul style="margin:6px 0 0;padding-left:18px;color:#6b5514;font-size:13px;">${brief.openQuestions
             .map((q) => `<li style="margin:2px 0;">${escapeHtml(q)}</li>`)
             .join("")}</ul>
         </div>`
      : "";
    briefHtml = `
      <h3 style="${SECTION_H}">The job</h3>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">
        ${brief.headline ? `<div style="font-size:15px;font-weight:bold;color:#1f4677;margin-bottom:8px;">${escapeHtml(brief.headline)}</div>` : ""}
        ${factRows ? `<table style="border-collapse:collapse;font-size:13px;">${factRows}</table>` : ""}
        ${words}
        ${questions}
      </div>`;
  }

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#2b2b2b;max-width:560px;">
      <h2 style="color:#2b5c9e;margin:0 0 12px;">New lead from ${escapeHtml(SITE_NAME)}</h2>
      ${emergencyBanner}
      ${contact}
      ${briefHtml}
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

// The confirmation the CUSTOMER receives — a warm, personal note from Artush,
// branded with the logo and company footer, in the language they used in chat.
// Deliberately does NOT include the internal breakdown or labour hours.
function renderCustomerConfirmationHtml(lead: LeadPayload, reference: string | null): string {
  const fr = lead.locale === "fr";
  const firstName = escapeHtml(lead.name.trim().split(/\s+/)[0] || lead.name.trim());
  const range =
    lead.estimateLow && lead.estimateHigh
      ? `${escapeHtml(lead.estimateLow)} – ${escapeHtml(lead.estimateHigh)}`
      : escapeHtml(lead.estimateExpected ?? "");

  // Only claim cleanup/disposal is included when the estimate actually has
  // those line items — a tiny patch-repair job may not, and this email must
  // stay accurate to what was actually quoted.
  const includesCleanup = (lead.lines ?? []).some((l) => /cleanup|disposal|dump/i.test(l.name));

  const t = fr
    ? {
        greeting: `Bonjour ${firstName},`,
        intro:
          "Merci d'avoir communiqué avec Renovision AnA. Je tenais à vous confirmer personnellement que nous avons bien reçu votre demande et qu'un membre de notre équipe communiquera avec vous très bientôt.",
        summaryHeading: "Voici un résumé de ce dont nous avons discuté :",
        needLabel: "Votre besoin",
        estimateLabel: "Estimation préliminaire",
        estimateNote:
          "une fourchette approximative seulement — ce n'est pas un prix final; le prix exact dépend d'une visite sur place.",
        cleanupNote:
          "Ce prix inclut le nettoyage du chantier et l'élimination des débris à la fin des travaux — vous n'aurez pas à gérer les résidus.",
        durationLabel: "Durée approximative",
        durationSuffix: (d: number) => `environ ${d} jour${d > 1 ? "s" : ""} ouvrable${d > 1 ? "s" : ""} de travail`,
        durationNote:
          "une estimation seulement — les échéanciers de rénovation peuvent varier selon ce qu'on découvre une fois les travaux commencés.",
        outro: reference
          ? `Nous ferons un suivi sous peu. Votre numéro de référence est le <strong>${escapeHtml(formatReference(reference))}</strong> — si vous nous appelez au ${SITE_PHONE} pour un suivi, donnez simplement ce numéro et nous retrouverons votre dossier tout de suite.`
          : `Nous ferons un suivi sous peu. Si quelque chose est urgent entre-temps, n'hésitez pas à nous appeler au ${SITE_PHONE}.`,
        signoff: "Cordialement,",
        title: "Président, Renovision AnA",
      }
    : {
        greeting: `Hi ${firstName},`,
        intro:
          "Thank you for reaching out to Renovision AnA. I wanted to personally let you know that we've received your request and a member of our team will contact you very soon.",
        summaryHeading: "Here's a quick summary of what we discussed:",
        needLabel: "What you need",
        estimateLabel: "Preliminary estimate",
        estimateNote:
          "a rough range only — not a final quote; the exact price depends on an in-person look at the work.",
        cleanupNote:
          "This price includes site cleanup and debris disposal once the work is done — you won't be left to deal with the mess.",
        durationLabel: "Approximate duration",
        durationSuffix: (d: number) => `about ${d} working day${d > 1 ? "s" : ""}`,
        durationNote:
          "an estimate only — renovation timelines can shift depending on what we find once work is underway.",
        outro: reference
          ? `We'll follow up shortly. Your reference number is <strong>${escapeHtml(formatReference(reference))}</strong> — if you call us at ${SITE_PHONE} to check on it, just give that number and we'll pull your file up right away.`
          : `We'll follow up shortly. If anything is urgent in the meantime, don't hesitate to call us at ${SITE_PHONE}.`,
        signoff: "Warm regards,",
        title: "President, Renovision AnA",
      };

  const summaryRows: string[] = [];
  if (lead.scopeSummary) {
    summaryRows.push(
      `<tr><td style="padding:3px 12px 3px 0;color:#666;vertical-align:top;">${t.needLabel}</td><td style="padding:3px 0;">${escapeHtml(lead.scopeSummary)}</td></tr>`,
    );
  }
  if (range) {
    summaryRows.push(
      `<tr><td style="padding:3px 12px 3px 0;color:#666;vertical-align:top;">${t.estimateLabel}</td><td style="padding:3px 0;"><strong>${range}</strong><br><span style="color:#888;font-size:12px;">${t.estimateNote}</span></td></tr>`,
    );
  }
  if (lead.estimatedWorkDays) {
    summaryRows.push(
      `<tr><td style="padding:3px 12px 3px 0;color:#666;vertical-align:top;">${t.durationLabel}</td><td style="padding:3px 0;"><strong>${escapeHtml(t.durationSuffix(lead.estimatedWorkDays))}</strong><br><span style="color:#888;font-size:12px;">${t.durationNote}</span></td></tr>`,
    );
  }
  if (includesCleanup) {
    summaryRows.push(
      `<tr><td colspan="2" style="padding:8px 0 0;color:#555;font-size:13px;">${t.cleanupNote}</td></tr>`,
    );
  }
  const summary =
    summaryRows.length > 0
      ? `<p style="margin:16px 0 6px;">${t.summaryHeading}</p>
         <table cellpadding="0" cellspacing="0" style="font-size:14px;">${summaryRows.join("")}</table>`
      : "";

  const addressLine = [
    SITE_ADDRESS.streetAddress,
    SITE_ADDRESS.addressLocality,
    SITE_ADDRESS.addressRegion,
    SITE_ADDRESS.postalCode,
  ].join(", ");

  return `
  <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#2b2b2b;max-width:560px;">
    <div style="padding-bottom:14px;border-bottom:2px solid #eaf1fb;">
      <img src="${SITE_URL}/renovision-logo.png" alt="Renovision AnA" width="48" height="55" style="height:55px;width:auto;" />
    </div>
    <p style="margin:20px 0 12px;">${t.greeting}</p>
    <p style="margin:0 0 12px;">${t.intro}</p>
    ${summary}
    <p style="margin:16px 0 24px;">${t.outro}</p>
    <p style="margin:0;">${t.signoff}</p>
    <p style="margin:2px 0 0;"><strong style="color:#2b5c9e;">Artush</strong><br><span style="color:#666;font-size:13px;">${t.title}</span></p>
    <div style="margin-top:26px;padding-top:14px;border-top:1px solid #e5e5e5;color:#999;font-size:12px;">
      <strong style="color:#2b5c9e;">${escapeHtml(SITE_NAME)}</strong><br>
      ${escapeHtml(addressLine)}<br>
      <a href="tel:${escapeHtml(SITE_PHONE)}" style="color:#2b5c9e;">${escapeHtml(SITE_PHONE)}</a> ·
      <a href="mailto:${escapeHtml(SITE_EMAIL)}" style="color:#2b5c9e;">${escapeHtml(SITE_EMAIL)}</a> ·
      <a href="${SITE_URL}" style="color:#2b5c9e;">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a>
    </div>
  </div>`;
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
    // Re-validated at the boundary. The brief was written by the model and
    // relayed through the browser, so by the time it arrives here it is
    // untrusted input like any other field in this payload.
    projectBrief: sanitizeBrief(body.projectBrief),
    // Qualifiers pass only if they're slugs the form actually offers; a
    // hand-crafted request with prose in these fields stores nothing rather
    // than something that renders in the admin. The lead itself is unaffected.
    contactRole:
      body.contactRole && CONTACT_ROLE_LABELS[body.contactRole] ? body.contactRole : undefined,
    heardAbout:
      body.heardAbout && HEARD_ABOUT_LABELS[body.heardAbout] ? body.heardAbout : undefined,
    isEmergency: typeof body.isEmergency === "boolean" ? body.isEmergency : undefined,
    // Explicit override, not a spread passenger: `...body` above would carry
    // any string a bot chose into the pipeline UI. The gate returns undefined
    // for anything off-grammar, which saveLead stores as plain "website".
    source: sanitizeLeadSource(body.source),
    receivedAt: new Date().toISOString(),
  };

  // Correlation id only — never the lead itself. Logging the payload put the
  // customer's name, phone, email and home address into the hosting provider's
  // logs, on a retention schedule we don't control and can't purge on request.
  const leadId = randomUUID();
  console.log("[lead captured]", { leadId, receivedAt: lead.receivedAt, locale: lead.locale });

  // The local-file append that used to sit here was dead code in production:
  // the deployment bundle is read-only, so it threw on every invocation and was
  // swallowed.
  //
  // A lead counts as recorded if EITHER the database stored it or the owner
  // notification sent. Either alone is a durable enough record; only losing
  // both means the lead reached nobody, and that is what fails the request.
  let recorded = false;
  // The number the customer reads back to Ana on the phone. Null when the
  // storage layer is off or the migration is pending — the confirmation simply
  // omits it rather than printing a number nothing can look up.
  let reference: string | null = null;

  // Storage runs first so a database outage can't be masked by a working
  // mailbox. No-ops until SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set,
  // which is why the site keeps working email-only in the meantime.
  if (isLeadStoreConfigured) {
    try {
      // Upload first so the row records where the photos actually landed.
      // Upload failures return fewer paths rather than throwing — losing a
      // photo must never cost the customer their enquiry.
      const photoPaths = await uploadLeadPhotos((lead.photos ?? []).slice(0, MAX_PHOTOS));
      const stored = await saveLead({
        ...lead,
        address: lead.address ?? undefined,
        photoPaths,
        projectBrief: lead.projectBrief ?? undefined,
      });
      if (stored) {
        recorded = true;
        reference = stored.reference;
        console.log("[lead stored]", { leadId, rowId: stored.id, reference });
      }
    } catch (err) {
      console.error("Failed to store lead:", { leadId, err });
    }
  }

  // Customer photos, attached to the OWNER email only. They were previously
  // sent to Claude to judge scope and stopped there, so the person who needs to
  // see the damage never got the picture they were asked for.
  //
  // Capped deliberately: Resend rejects oversized messages outright, and a
  // rejected email is worse than a missing photo because the lead itself
  // travels in that message. The chat already re-encodes to ~1568px JPEG, so
  // four photos is comfortably inside the limit.
  const photoAttachments = (lead.photos ?? [])
    .slice(0, MAX_PHOTOS)
    .map((dataUrl, i) => {
      const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
      if (!match) return null;
      const [, mime, base64] = match;
      const ext = mime.split("/")[1].replace("jpeg", "jpg");
      // base64 inflates by ~4/3; check the decoded size against the budget.
      if ((base64.length * 3) / 4 > MAX_PHOTO_BYTES) return null;
      return { filename: `photo-${i + 1}.${ext}`, content: base64 };
    })
    .filter((a): a is { filename: string; content: string } => a !== null);

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Default to the verified renovisionana.ca domain so emails actually
    // deliver. The old fallback (onboarding@resend.dev) is Resend's sandbox
    // sender, which can ONLY reach the account owner. LEADS_FROM_EMAIL can
    // still override. The Resend SDK returns { data, error } instead of
    // throwing on API-level rejections, so we check `error` explicitly.
    const fromDomain = process.env.LEADS_FROM_EMAIL || SITE_EMAIL;

    // 1. Internal notification to the team, with the full breakdown.
    try {
      const { error } = await resend.emails.send({
        from: process.env.LEADS_FROM_EMAIL || `${SITE_NAME} <${SITE_EMAIL}>`,
        to: LEADS_NOTIFY_EMAIL,
        replyTo: lead.email,
        // The prefix is for the phone's lock screen: subjects survive
        // truncation left-to-right, so URGENT has to come first.
        subject: `${lead.isEmergency ? "🚨 URGENT — " : ""}New lead: ${lead.name}`,
        html: renderLeadEmailHtml(lead),
        ...(photoAttachments.length > 0 ? { attachments: photoAttachments } : {}),
      });
      if (error) console.error("Resend rejected the lead notification email:", { leadId, error });
      else {
        recorded = true;
        console.log("[lead notification sent]", { leadId });
      }
    } catch (err) {
      console.error("Failed to send lead notification email:", { leadId, err });
    }

    // 2. Personal confirmation to the customer, from Artush, in their language.
    try {
      const fr = lead.locale === "fr";
      const { error } = await resend.emails.send({
        from: `Artush from ${SITE_NAME} <${fromDomain}>`,
        to: lead.email,
        replyTo: LEADS_NOTIFY_EMAIL,
        subject: fr
          ? "Nous avons bien reçu votre demande — Renovision AnA"
          : "We've received your request — Renovision AnA",
        html: renderCustomerConfirmationHtml(lead, reference),
      });
      // Best-effort by design: the customer's own copy failing does not mean
      // the lead was lost, so it must not fail the request.
      if (error) console.error("Resend rejected the customer confirmation email:", { leadId, error });
      else console.log("[customer confirmation sent]", { leadId });
    } catch (err) {
      console.error("Failed to send customer confirmation email:", { leadId, err });
    }
  } else {
    console.warn("[lead email skipped] RESEND_API_KEY is not set — see .env.local.example");
  }

  // Report the truth. Previously this returned ok unconditionally, so a lead
  // that reached nobody still showed the customer a thank-you — the worst
  // possible failure mode, since they believe they're waiting on a callback.
  if (!recorded) {
    return NextResponse.json(
      { ok: false, error: "Lead could not be recorded" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, leadId, reference });
}
