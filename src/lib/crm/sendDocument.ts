import { Resend } from "resend";
import { db } from "./db";
import { formatMoney } from "./money";
import { copyFor, type QuoteLocale } from "./quoteCopy";
import { getCompany, type CompanySetting } from "./settings";
import { SITE_EMAIL, SITE_NAME, SITE_URL } from "@/lib/constants";

/**
 * Email a quote or an invoice to the client.
 *
 * The email is a short covering note plus a link, not the document itself.
 * Two reasons: the customer-facing page is interactive — they tick optional
 * lines there and approve in place — and an emailed PDF is a copy that stops
 * being true the moment anything changes, while the link always shows the
 * current state of what was agreed.
 *
 * Recipients come from the client's contacts, filtered on the per-address
 * flags: only addresses marked as receiving quotes get quotes, only those
 * marked as receiving invoices get invoices. A property manager's accounts
 * department should not receive an estimate they cannot approve.
 */

type EmailContactRow = {
  address?: string;
  receivesQuotes?: boolean;
  receivesInvoices?: boolean;
};

export type SendResult = { sent: string[]; skipped: string };

async function recipientsFor(
  clientId: string,
  kind: "quote" | "invoice",
): Promise<string[]> {
  const client = db();
  if (!client) return [];

  const { data } = await client.from("clients").select("emails").eq("id", clientId).maybeSingle();
  const emails = ((data as { emails?: EmailContactRow[] } | null)?.emails ?? []) as EmailContactRow[];

  return emails
    .filter((entry) => {
      if (!entry.address?.trim()) return false;
      // Absent means yes: a contact added before these flags existed should
      // still receive their own quote rather than silently getting nothing.
      return kind === "quote" ? entry.receivesQuotes !== false : entry.receivesInvoices !== false;
    })
    .map((entry) => entry.address!.trim());
}

function shell(company: CompanySetting, body: string, footerNote: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2b2b2b;max-width:520px;">
      ${body}
      <hr style="border:none;border-top:1px solid #e6e9ee;margin:24px 0 12px;">
      <p style="font-size:12px;color:#8b9099;margin:0;">
        ${escapeHtml(company.tradeName || SITE_NAME)}${company.phone ? ` · ${escapeHtml(company.phone)}` : ""}<br>
        ${company.rbqLicence ? `RBQ ${escapeHtml(company.rbqLicence)}<br>` : ""}
        ${escapeHtml(footerNote)}
      </p>
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function emailQuote(quote: {
  id: string;
  client_id: string;
  quote_number: number;
  title: string | null;
  total_cents: number;
  language: "fr" | "en";
  public_token: string | null;
  valid_until: string | null;
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: [], skipped: "Email is not configured (RESEND_API_KEY is missing)." };
  }
  if (!quote.public_token) {
    return { sent: [], skipped: "Send the quote first so it has a link." };
  }

  const [company, to] = await Promise.all([
    getCompany(),
    recipientsFor(quote.client_id, "quote"),
  ]);

  if (to.length === 0) {
    return { sent: [], skipped: "No email address on this client is set to receive quotes." };
  }

  const locale = quote.language as QuoteLocale;
  const t = copyFor(locale);
  const url = `${SITE_URL}/q/${quote.public_token}`;
  const fr = locale === "fr";

  const subject = fr
    ? `Soumission #${quote.quote_number} — ${company.tradeName || SITE_NAME}`
    : `Quote #${quote.quote_number} — ${company.tradeName || SITE_NAME}`;

  const body = `
    <p>${fr ? "Bonjour," : "Hello,"}</p>
    <p>${
      fr
        ? `Voici votre soumission${quote.title ? ` pour ${escapeHtml(quote.title)}` : ""}.`
        : `Here is your quote${quote.title ? ` for ${escapeHtml(quote.title)}` : ""}.`
    }</p>
    <p style="font-size:22px;font-weight:bold;color:#1f4677;margin:18px 0 4px;">
      ${escapeHtml(formatMoney(quote.total_cents, locale))}
    </p>
    ${
      quote.valid_until
        ? `<p style="font-size:13px;color:#666;margin:0 0 18px;">${escapeHtml(t.validUntil)} ${escapeHtml(quote.valid_until)}</p>`
        : ""
    }
    <p style="margin:22px 0;">
      <a href="${url}" style="display:inline-block;background:#2b5c9e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;">
        ${escapeHtml(fr ? "Voir la soumission" : "View the quote")}
      </a>
    </p>
    <p style="font-size:13px;color:#666;">${
      fr
        ? "Vous pourrez y choisir les options souhaitées et l'approuver directement."
        : "You can pick any options you'd like and approve it right there."
    }</p>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.LEADS_FROM_EMAIL || `${SITE_NAME} <${SITE_EMAIL}>`,
    to,
    subject,
    html: shell(
      company,
      body,
      fr ? "Cette soumission n'est pas une facture." : "This quote is not an invoice.",
    ),
  });

  if (error) throw new Error(`Could not send the email: ${error.message}`);
  return { sent: to, skipped: "" };
}

export async function emailInvoice(invoice: {
  id: string;
  client_id: string;
  invoice_number: number;
  total_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  language: "fr" | "en";
  public_token: string | null;
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: [], skipped: "Email is not configured (RESEND_API_KEY is missing)." };
  }
  if (!invoice.public_token) {
    return { sent: [], skipped: "Send the invoice first so it has a link." };
  }

  const [company, to] = await Promise.all([
    getCompany(),
    recipientsFor(invoice.client_id, "invoice"),
  ]);

  if (to.length === 0) {
    return { sent: [], skipped: "No email address on this client is set to receive invoices." };
  }

  const locale = invoice.language as QuoteLocale;
  const url = `${SITE_URL}/i/${invoice.public_token}`;
  const fr = locale === "fr";
  const balance = invoice.total_cents - invoice.amount_paid_cents;

  const subject = fr
    ? `Facture #${invoice.invoice_number} — ${company.tradeName || SITE_NAME}`
    : `Invoice #${invoice.invoice_number} — ${company.tradeName || SITE_NAME}`;

  const body = `
    <p>${fr ? "Bonjour," : "Hello,"}</p>
    <p>${fr ? "Voici votre facture." : "Here is your invoice."}</p>
    <p style="font-size:22px;font-weight:bold;color:#1f4677;margin:18px 0 4px;">
      ${escapeHtml(formatMoney(balance, locale))}
    </p>
    ${
      invoice.due_date
        ? `<p style="font-size:13px;color:#666;margin:0 0 18px;">${escapeHtml(fr ? "Échéance" : "Due")} ${escapeHtml(invoice.due_date)}</p>`
        : ""
    }
    <p style="margin:22px 0;">
      <a href="${url}" style="display:inline-block;background:#2b5c9e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;">
        ${escapeHtml(fr ? "Voir la facture" : "View the invoice")}
      </a>
    </p>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.LEADS_FROM_EMAIL || `${SITE_NAME} <${SITE_EMAIL}>`,
    to,
    subject,
    // Charter of the French Language s. 57 names invoices explicitly, so the
    // French version is what goes out unless the client record says otherwise.
    html: shell(company, body, fr ? "Merci de votre confiance." : "Thank you for your business."),
  });

  if (error) throw new Error(`Could not send the email: ${error.message}`);
  return { sent: to, skipped: "" };
}
