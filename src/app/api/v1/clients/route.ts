import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createClient, listClients } from "@/lib/crm/clients";
import { clientDisplayName, primaryEmail, primaryPhone } from "@/lib/crm/types";

/**
 * Customers, for the native list and for the dialer's contact book.
 *
 * Trimmed to what a phone screen uses: a name to show, and the numbers to
 * call. The full record stays behind the detail screen — sending every
 * address and note down to render a list is bandwidth spent on a basement
 * connection for nothing.
 */
export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("search") ?? undefined;

  return guarded(async () => ({
    clients: (await listClients({ search, limit: 500 })).map((client) => ({
      id: client.id,
      name: clientDisplayName(client),
      company: client.company_name,
      // The primary number, plus every other one — the dialer offers a
      // choice when a customer has a mobile and a landline, rather than
      // guessing and calling the wrong one.
      phone: primaryPhone(client),
      phones: (client.phones ?? []).map((p) => ({
        number: p.number,
        type: p.type,
        primary: p.primary,
      })),
      email: primaryEmail(client),
      propertyCount: client.property_count,
    })),
  }));
}

/**
 * Create a customer from the phone.
 *
 * Deliberately minimal: a name, a number, an email. Everything else — billing
 * address, tax rate, tags — is desk work, and a form asking for it on a
 * driveway is a form nobody finishes. The record can be filled in later; what
 * cannot be recovered later is the number of the person standing in front of
 * you.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const companyName = text(body.companyName);

  // A customer with no name at all is a row nobody can find again.
  if (!firstName && !lastName && !companyName) {
    return NextResponse.json(
      { error: "Give the customer a name or a company." },
      { status: 400 },
    );
  }

  const phone = text(body.phone);
  const email = text(body.email);

  return guarded(async () => ({
    id: await createClient({
      firstName,
      lastName,
      companyName,
      phones: phone
        ? [{ number: phone, type: "mobile", primary: true, smsAllowed: false }]
        : [],
      // Opted IN to both by default: a customer added on site is one whose
      // estimate and invoice are going to be emailed within the hour, and
      // discovering the flags were off after sending is a wasted trip back
      // into the record. Consent for MARKETING is a separate flag entirely
      // and is not touched here.
      emails: email
        ? [{ address: email, type: "main", primary: true, receivesQuotes: true, receivesInvoices: true }]
        : [],
    }),
  }));
}
