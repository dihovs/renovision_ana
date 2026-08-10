import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import NewTextForm from "@/components/admin/NewTextForm";
import { SITE_PHONE } from "@/lib/constants";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { formatDialed } from "@/lib/phone";
import { listConversations, type Conversation } from "@/lib/sms/inbox";

export const dynamic = "force-dynamic";

/**
 * The SMS inbox — every text conversation on the business number, newest
 * activity first.
 *
 * This page is why texting is now a function rather than a feature of the
 * client card: an inbound text used to land in the database and be visible
 * only if the owner happened to open that exact client — and a stranger's
 * text was visible nowhere. Here, the conversations waiting on an answer
 * carry the badge, and a number the CRM has never seen is a first-class row.
 */
export default async function MessagesPage() {
  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <Header />
        <AdminNotice title="No database connected yet">
          Set the Supabase environment variables to turn this on.
        </AdminNotice>
      </div>
    );
  }

  let conversations: Conversation[];
  try {
    conversations = await listConversations();
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <div className="space-y-4">
          <Header />
          <AdminNotice title="One migration to run">
            Run <code className="font-mono text-brand-blue">supabase/migrations/0022_sms.sql</code>{" "}
            in the Supabase SQL editor and reload.
          </AdminNotice>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="space-y-4">
      <Header />

      {conversations.length === 0 ? (
        <AdminNotice title="No conversations yet">
          Texts sent from here or from a client&rsquo;s page show up as conversations, and so does
          anyone who texts {SITE_PHONE}. Start one with the number box above.
        </AdminNotice>
      ) : (
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
          {conversations.map((conversation) => (
            <ConversationRow key={conversation.phone} conversation={conversation} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-xl font-bold text-charcoal">Messages</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-charcoal/60">
          Texts on {SITE_PHONE} — sent and received. Replies land here even from numbers that
          aren&rsquo;t clients yet.
        </p>
      </div>
      <NewTextForm />
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const title = conversation.clientName ?? formatDialed(conversation.phone);
  const when = new Date(conversation.lastAt).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <li>
      <Link
        href={`/admin/messages/${conversation.phone.slice(1)}`}
        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-black/[0.02] sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-sm font-bold text-charcoal">{title}</span>
            {conversation.clientName && (
              <span className="font-mono text-[11px] text-charcoal/40">
                {formatDialed(conversation.phone)}
              </span>
            )}
            {conversation.awaitingReply && (
              <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-green-dark">
                Needs a reply
              </span>
            )}
            {conversation.lastFailed && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                Not delivered
              </span>
            )}
            {conversation.optedOut && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                Opted out
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs leading-relaxed text-charcoal/55">
            {conversation.lastDirection === "outbound" ? "You: " : ""}
            {conversation.lastBody}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-charcoal/40">{when}</p>
          <p className="mt-0.5 text-[11px] text-charcoal/30">
            {conversation.messageCount} message{conversation.messageCount === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
    </li>
  );
}
