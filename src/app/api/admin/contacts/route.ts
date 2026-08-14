import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { listClients } from "@/lib/crm/clients";
import { clientDisplayName } from "@/lib/crm/types";

export type ContactPhone = { number: string; type: string };
export type Contact = { id: string; name: string; phones: ContactPhone[] };

/**
 * The softphone's contact list — every client with at least one phone
 * number, name-sorted like an actual phone book.
 *
 * One fetch, filtered in the browser, rather than a `q`-driven search route:
 * a single-operator client book is small enough to hand over whole, the same
 * call GlobalSearch's own clients query already makes for the same reason.
 */
export async function GET() {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  let clients;
  try {
    clients = await listClients({ limit: 500 });
  } catch (err) {
    // The dial pad itself must keep working even when the contact book
    // can't load — a stalled migration here is not a reason to lose calling.
    console.warn(
      `[contacts] could not load: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json({ contacts: [] });
  }

  const contacts: Contact[] = clients
    .filter((client) => client.phones.length > 0)
    .map((client) => ({
      id: client.id,
      name: clientDisplayName(client),
      phones: client.phones.map((p) => ({ number: p.number, type: p.type })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ contacts });
}
