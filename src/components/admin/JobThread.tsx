import Link from "next/link";
import { listJobMessages, signMediaUrls } from "@/lib/whatsapp/store";
import { summariseJobThread } from "@/lib/whatsapp/summarise";

/**
 * The job's WhatsApp thread, summarised.
 *
 * Claude's overview sits on top and the messages underneath, because the point
 * is to know what happened without scrolling — but the full thread stays one
 * scroll away, since a summary is a way in, not a replacement for the evidence.
 */
export default async function JobThread({ jobId }: { jobId: string }) {
  let messages;
  try {
    messages = await listJobMessages(jobId);
  } catch {
    // The migration may not have run. A job page must not break because an
    // optional integration isn't set up.
    return null;
  }

  if (messages.length === 0) return null;

  const [summary, urls] = await Promise.all([
    summariseJobThread(jobId).catch(() => null),
    signMediaUrls(messages.flatMap((m) => (m.media_path ? [m.media_path] : []))),
  ]);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-sm font-bold text-charcoal">WhatsApp</h2>
        <span className="text-xs text-charcoal/40">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </span>
      </div>

      {summary && (
        <div className="mt-3 rounded-lg bg-brand-blue/[0.04] p-3">
          <p className="text-sm leading-relaxed text-charcoal/80">{summary.summary}</p>
          <p className="mt-1.5 text-[11px] text-charcoal/40">
            Written from the thread below. Photos are noted but not interpreted.
          </p>
        </div>
      )}

      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.map((message) => {
          const url = message.media_path ? urls[message.media_path] : null;
          return (
            <li
              key={message.id}
              className={
                message.direction === "inbound"
                  ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-black/[0.04] px-3 py-2"
                  : "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-green/[0.10] px-3 py-2"
              }
            >
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
                {message.direction === "inbound" ? "Sub" : "Us"} ·{" "}
                {new Date(message.sent_at).toLocaleDateString("en-CA", {
                  day: "numeric",
                  month: "short",
                  timeZone: "America/Toronto",
                })}
              </span>
              {message.body && (
                <span className="block whitespace-pre-wrap text-sm leading-relaxed text-charcoal/85">
                  {message.body}
                </span>
              )}
              {url && message.media_mime?.startsWith("image/") && (
                <Link href={url} target="_blank" className="mt-1.5 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="From the thread"
                    className="max-h-40 rounded-lg border border-black/10 object-cover"
                  />
                </Link>
              )}
              {url && !message.media_mime?.startsWith("image/") && (
                <Link
                  href={url}
                  target="_blank"
                  className="mt-1 inline-block text-xs font-semibold text-brand-blue hover:underline"
                >
                  Open {message.kind}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
