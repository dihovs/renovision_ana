
/**
 * Tell the owner when something happens he would walk over and look at: a
 * lead lands, Ana takes a call, a job gets approved.
 *
 * **Push only.** This began as SMS, because push needed an APNs key out of
 * his Apple Developer account and nothing could be done until he produced
 * one. He was clear once he had it: *"I don't want SMS alerts, I want push
 * notifications."* So the text path is gone rather than left switched off —
 * a second delivery route that nobody wants is a second thing to keep
 * working, and an alert arriving twice is worse than arriving once.
 *
 * **Never throws, never blocks.** Every caller is in the middle of something
 * that matters more — saving a lead, closing a call — and an alert that cost
 * a real customer enquiry because Apple was slow would be a bad trade.
 *
 * Push is loaded ON DEMAND, and that is not an optimisation. `push.ts`
 * reaches for `node:http2`, because APNs speaks HTTP/2 and Node's `fetch`
 * does not. This file is reached from `leadStore`, which a client component
 * imports for its types — so a static import would drag `node:http2` into a
 * browser bundle, and Turbopack refuses to build that at all. A dynamic
 * import keeps it in a chunk the server alone ever loads.
 */
function notify(input: { title: string; body: string; path?: string }): void {
  if (typeof window !== "undefined") return;
  void (async () => {
    try {
      const { push } = await import("@/lib/notify/push");
      push(input);
    } catch (error) {
      console.error("[notify] push unavailable:", (error as Error).message);
    }
  })();
}

/** A lead just landed. */
export function notifyNewLead(input: {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  isEmergency?: boolean | null;
  source?: string | null;
}): void {
  const who = input.name?.trim() || input.phone?.trim() || "Someone";
  const where = input.address?.trim();
  // The emergency flag leads, because it is the only part of a lead that
  // changes what he does in the next ten minutes.
  const head = input.isEmergency ? "URGENT lead" : "New lead";
  const from = input.source && input.source !== "website" ? ` (${input.source})` : "";
  const line = [where ? where : null, input.phone ? input.phone : null]
    .filter(Boolean)
    .join(" — ");
  notify({
    title: `${head}${from}`,
    body: [who, line].filter(Boolean).join(" — "),
    path: "/admin/leads",
  });
}

/** Ana finished a call. */
export function notifyCallEnded(input: {
  from?: string | null;
  seconds?: number | null;
  becameLead?: boolean;
  escalated?: boolean;
  transferred?: boolean;
}): void {
  const who = input.from?.trim() || "Unknown number";
  const length =
    input.seconds == null
      ? ""
      : input.seconds >= 60
        ? `, ${Math.round(input.seconds / 60)} min`
        : `, ${input.seconds}s`;
  // Worst first, same order the home screen uses — a call Ana had to hand
  // over is the one worth walking inside for.
  const outcome = input.escalated
    ? " — she escalated it"
    : input.transferred
      ? " — transferred to you"
      : input.becameLead
        ? " — became a lead"
        : "";
  notify({
    title: "Ana answered a call",
    body: `${who}${length}${outcome}`,
    path: "/admin/calls",
  });
}

/**
 * A customer texted in.
 *
 * The gap the other two notifiers left. A lead landing and a call ending both
 * reached him; the thing customers actually do most — send a text — did not,
 * so the inbox was the one place he had to remember to go and look at.
 *
 * **Opt-outs notify too, deliberately.** `STOP` reads oddly as an alert, but a
 * customer who just made himself untextable is exactly the kind of thing worth
 * knowing within the minute rather than discovering the next time a message
 * silently refuses to send.
 *
 * The deep link drops him in the thread, not the inbox list: he is being told
 * about one conversation and the next thing he wants is to reply to it.
 */
export function notifyNewMessage(input: {
  phone: string;
  body?: string | null;
  clientName?: string | null;
  /** How many photos came with it. Changes the body when there is no text. */
  mediaCount?: number;
}): void {
  const text = input.body?.trim() ?? "";
  const photos = input.mediaCount ?? 0;

  // A picture with no caption is ordinary on this trade — someone photographs
  // a burst pipe and sends it without a word. An empty notification body would
  // be the one case where the alert says nothing at all.
  const line = text
    ? photos > 0
      ? `${text}  📷${photos}`
      : text
    : photos > 0
      ? photos === 1
        ? "Sent a photo"
        : `Sent ${photos} photos`
      : "(no message)";

  notify({
    title: input.clientName?.trim() || input.phone,
    body: line,
    // The thread stores the number without its leading +, matching the route.
    path: `/admin/messages/${input.phone.replace(/^\+/, "")}`,
  });
}
