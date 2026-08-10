import Link from "next/link";
import { notFound } from "next/navigation";
import { sendToPhoneAction } from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import SmsThread from "@/components/admin/SmsThread";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { formatDialed } from "@/lib/phone";
import { findClientForPhone } from "@/lib/sms/attribution";
import { listThread, type SmsThread as Thread } from "@/lib/sms/thread";

export const dynamic = "force-dynamic";

/**
 * One conversation, with anyone.
 *
 * The URL carries the E.164 number minus its plus sign — digits are the one
 * spelling that survives a URL untouched, and re-prefixing the plus is
 * lossless. /admin/messages/15145550188 is +1 514 555 0188's thread whether
 * or not any client owns that number: the composer works either way, which is
 * what makes this a phone-shaped inbox rather than a CRM report.
 */
export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone: raw } = await params;
  const phone = `+${decodeURIComponent(raw)}`;
  // The strict E.164 shape, same as the check constraint on the table. A URL
  // that does not name a real number is a 404, not a guess.
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) notFound();

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let thread: Thread;
  try {
    thread = await listThread(phone);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0022_sms.sql</code> in
          the Supabase SQL editor and reload.
        </AdminNotice>
      );
    }
    throw err;
  }

  const attributed = await findClientForPhone(phone).catch(() => null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-charcoal/45">
            <Link href="/admin/messages" className="font-medium text-brand-blue hover:underline">
              Messages
            </Link>{" "}
            / {formatDialed(phone)}
          </p>
          <h1 className="mt-1 font-heading text-xl font-bold text-charcoal">
            {attributed?.name ?? formatDialed(phone)}
          </h1>
        </div>
        {attributed ? (
          <Link
            href={`/admin/clients/${attributed.id}`}
            className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
          >
            Open client page
          </Link>
        ) : (
          <span className="text-xs leading-relaxed text-charcoal/45">
            Not in the CRM yet — texting works anyway.
          </span>
        )}
      </div>

      <SmsThread
        phone={formatDialed(phone)}
        messages={thread.messages}
        optedOut={thread.optedOut}
        action={sendToPhoneAction.bind(null, phone)}
      />
    </div>
  );
}
