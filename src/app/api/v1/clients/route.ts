import { guarded } from "../guard";
import { listClients } from "@/lib/crm/clients";
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
