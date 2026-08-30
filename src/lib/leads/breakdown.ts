import { HEARD_ABOUT_OPTIONS, isHeardAboutValue } from "./heardAbout";

/**
 * Where the leads came from, counted two ways that must not be added together.
 *
 * ONLINE is `leads.source`, written by the browser from the address bar and the
 * referrer. It is a record of what happened: the visit really did arrive from a
 * Google results page.
 *
 * OFFLINE is `leads.heard_about`, which the customer typed or said. It is
 * testimony, and it is wrong a fair amount of the time — people say "Google"
 * when they clicked a Facebook ad, and "a friend" when the friend sent a link.
 * Its value is the rows the referrer physically cannot produce: the plumber,
 * the adjuster, the neighbour who saw a truck.
 *
 * They are returned as two lists, never merged into one ranking, because a
 * single "sources" chart mixing a measurement with a self-report reads as one
 * fact and is two. Nothing here sums the two columns.
 */

export type BreakdownRow = { label: string; count: number };
export type LeadBreakdown = {
  online: BreakdownRow[];
  offline: BreakdownRow[];
  /** Leads whose arrival the browser could not describe — the ones worth asking. */
  unattributed: number;
  total: number;
};

type Countable = { source?: string | null; heard_about?: string | null };

/** Channels the server sets. They carry no token and never will. */
const SERVER_CHANNEL_LABEL: Record<string, string> = {
  voice: "Phone call",
  phone: "Phone call",
  whatsapp: "WhatsApp",
};

const SEARCH_LABEL: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  ecosia: "Ecosia",
  qwant: "Qwant",
};

/**
 * One lead's arrival, as a label — or null when the browser learned nothing.
 *
 * Null is not "unknown other"; it is the answer that drives the heard-about
 * question, so it is counted separately rather than dropped into a bucket that
 * makes the online list look more complete than it is.
 */
export function labelForSource(source: string | null | undefined): string | null {
  const raw = (source ?? "").trim();
  if (!raw) return null;

  const [channel, token] = raw.split(":", 2);

  // A phone call has no referrer and never had one. It is a real, known arrival
  // rather than a gap, so it is labelled rather than counted as unattributed.
  if (!token) return SERVER_CHANNEL_LABEL[channel] ?? null;

  if (token.startsWith("organic_")) {
    const engine = token.slice("organic_".length);
    return `${SEARCH_LABEL[engine] ?? engine} search`;
  }
  if (token.startsWith("social_")) {
    const network = token.slice("social_".length);
    return network.charAt(0).toUpperCase() + network.slice(1);
  }
  // A referring site, stored as its hostname with dots flattened.
  if (token.startsWith("ref_")) return token.slice("ref_".length).replace(/_/g, ".");

  // Anything else is a UTM campaign the owner named himself. Shown as he wrote
  // it, because a slug he chose is more meaningful to him than any tidying.
  return token;
}

function tally(labels: string[]): BreakdownRow[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  // Biggest first, then alphabetically so equal counts do not reshuffle
  // between renders — a list that reorders itself on refresh cannot be read.
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function leadBreakdown(leads: Countable[]): LeadBreakdown {
  const online: string[] = [];
  let unattributed = 0;

  for (const lead of leads) {
    const label = labelForSource(lead.source);
    if (label) online.push(label);
    else unattributed += 1;
  }

  const offline = leads
    .map((lead) => lead.heard_about)
    .filter(isHeardAboutValue)
    .map((value) => HEARD_ABOUT_OPTIONS[value].en);

  return {
    online: tally(online),
    offline: tally(offline),
    unattributed,
    total: leads.length,
  };
}
