/**
 * Campaign attribution, cookielessly.
 *
 * The privacy policy promises no tracking cookies and no cross-site profile,
 * and this module is built to keep that promise: the only thing captured is
 * what the visitor's own address bar and referrer already say on the first
 * page of THIS visit, held in sessionStorage (dies with the tab), and stored
 * only if they actually submit a request.
 *
 * ## The source grammar
 *
 * A lead's `source` column is free text by design (0011_lead_source.sql), but
 * anything the BROWSER may write into it must fit this grammar:
 *
 *     channel[:token]
 *     channel ∈ { web, chat, contact }        — where on the site it was sent
 *     token   ∈ [a-z0-9_-]{1,64}              — which campaign brought them
 *
 * e.g. "chat:facebook_cpc_july", "contact:organic_google", "chat:ref_lespac_ca".
 * Server-set channels (phone, whatsapp, website) never carry a token and are
 * NOT accepted from the wire — a bot claiming to be the phone agent should
 * store as the default, not as a phone lead. `sanitizeLeadSource` is the
 * single gate: /api/leads drops anything that doesn't parse, keeping the lead.
 *
 * The token itself is built from utm_source/utm_medium/utm_campaign/
 * utm_content when present, otherwise classified from the referrer
 * (organic_*, social_*, ref_*). Every part is lowercased, stripped to
 * [a-z0-9_-] and length-capped, so hostile query strings can at worst store a
 * short boring slug.
 */

/** Longest token the grammar admits — matches the regex in sanitizeLeadSource. */
export const MAX_SOURCE_TOKEN_LENGTH = 64;

/** Per-utm-part cap. Four parts + separators still fit inside the token cap
 *  often enough, and anything longer is ad-platform noise, not a name a human
 *  chose. */
const MAX_PART_LENGTH = 24;

/** Channels the browser is allowed to claim. Deliberately excludes the
 *  server-set ones (phone, whatsapp, website) — see module doc. */
const BROWSER_CHANNELS = new Set(["web", "chat", "contact"]);

/** Referrer hosts classified as search engines → "organic_<name>". Matched as
 *  a whole DNS label so "google.ca", "www.google.co.uk" and
 *  "images.google.com" all count but "notgoogle.com" does not. */
const SEARCH_ENGINES = ["google", "bing", "duckduckgo", "yahoo", "ecosia", "qwant"];

/** Referrer hosts classified as social networks → "social_<name>". Keyed by
 *  label, valued by the canonical name so fb/facebook collapse together. */
const SOCIAL_NETWORKS: Record<string, string> = {
  facebook: "facebook",
  fb: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  lnkd: "linkedin",
  twitter: "twitter",
  x: "twitter",
  t: "twitter", // t.co, Twitter's link shim
  tiktok: "tiktok",
  pinterest: "pinterest",
  youtube: "youtube",
  reddit: "reddit",
};

/** Lowercase, strip to the grammar's alphabet, cap. Empty string means "this
 *  part contributed nothing" — callers drop it rather than store filler. */
function sanitizePart(value: string, maxLength = MAX_PART_LENGTH): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, maxLength);
}

/** True when the hostname contains `label` as a whole DNS label. */
function hasLabel(host: string, label: string): boolean {
  return host.split(".").includes(label);
}

/**
 * Turn a landing URL's query string and referrer into a campaign token, or
 * null when there is nothing worth recording (direct visit, internal
 * navigation, unparseable garbage).
 *
 * Pure on purpose — window.location.search, document.referrer and the site's
 * own hostname arrive as arguments so the whole thing runs under vitest in
 * node with hostile inputs.
 */
export function parseAttribution(
  search: string,
  referrer: string,
  currentHost?: string,
): string | null {
  // UTM wins over referrer: an ad click through Facebook has both, and the
  // campaign tag is the one the owner paid to be able to see.
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = new URLSearchParams();
  }
  const utmParts = ["utm_source", "utm_medium", "utm_campaign", "utm_content"]
    .map((key) => sanitizePart(params.get(key) ?? ""))
    .filter((part) => part.length > 0);
  if (utmParts.length > 0) {
    return utmParts.join("_").slice(0, MAX_SOURCE_TOKEN_LENGTH);
  }

  // No campaign tags — classify where they came from instead.
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null; // not a URL; browsers never send these, so a bot did
  }
  host = host.replace(/^www\./, "");
  if (!host) return null;

  // Internal navigation is not a source — the session already has one or
  // genuinely arrived direct.
  if (currentHost && host === currentHost.toLowerCase().replace(/^www\./, "")) {
    return null;
  }

  for (const engine of SEARCH_ENGINES) {
    if (hasLabel(host, engine)) return `organic_${engine}`;
  }
  for (const [label, name] of Object.entries(SOCIAL_NETWORKS)) {
    if (hasLabel(host, label)) return `social_${name}`;
  }

  // Anything else keeps its hostname, dots flattened so it stays one token.
  const refToken = sanitizePart(host.replace(/\./g, "_"), MAX_SOURCE_TOKEN_LENGTH - 4);
  return refToken ? `ref_${refToken}` : null;
}

/**
 * The server-side gate for browser-supplied `source`. Returns the value to
 * store, or undefined to fall back to the "website" default — NEVER an error,
 * because a mangled source must not cost a customer their enquiry.
 */
export function sanitizeLeadSource(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const pieces = value.split(":");
  if (pieces.length > 2) return undefined;
  const [channel, token] = pieces;
  if (!BROWSER_CHANNELS.has(channel)) return undefined;
  if (pieces.length === 1) return channel;
  if (!/^[a-z0-9_-]{1,64}$/.test(token)) return undefined;
  return `${channel}:${token}`;
}

/** sessionStorage, not localStorage and not a cookie: scoped to the tab,
 *  gone when it closes, never sent over the wire on its own. */
const STORAGE_KEY = "rv_attribution";

/**
 * Capture the campaign token for this visit, once. First touch wins: a later
 * full page load inside the same tab (internal referrer, no utm) parses to
 * null and leaves the stored value alone.
 *
 * Safe to call anywhere — no-ops on the server and when storage is blocked,
 * because attribution is a nice-to-have and must never break a page.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const token = parseAttribution(
      window.location.search,
      document.referrer,
      window.location.hostname,
    );
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage disabled or quota'd — the lead still goes through sourceless.
  }
}

/**
 * The `source` value a lead POST should carry, or null to send nothing and
 * keep the server's "website" default. Re-validated through the same gate the
 * server uses, so a devtools-edited token degrades to null here instead of a
 * doomed round-trip.
 */
export function leadSourceFor(channel: "web" | "chat" | "contact"): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.sessionStorage.getItem(STORAGE_KEY);
    if (!token) return null;
    return sanitizeLeadSource(`${channel}:${token}`) ?? null;
  } catch {
    return null;
  }
}
