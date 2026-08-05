import { bridgeCallAction } from "../callActions";
import AdminNotice from "@/components/admin/AdminNotice";
import CallList from "@/components/admin/CallList";
import Dialer from "@/components/admin/Dialer";
import { listCalls, type StoredCall } from "@/lib/crm/calls";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { ownerMobile } from "@/lib/voice/bridge";

export const dynamic = "force-dynamic";

/**
 * Ana's calls, and a way to place his own.
 *
 * The dialer renders ABOVE every notice below rather than inside the happy
 * path, and that ordering is deliberate: placing a call needs Twilio and
 * nothing else, so an unconfigured database or an unrun migration must not
 * take the phone away too. Those notices are about the transcript list, which
 * is the only part that needs Supabase — previously each of them returned
 * early and replaced the entire page.
 */
export default async function CallsPage() {
  const dialer = <Dialer action={bridgeCallAction} ringsAt={ownerMobile()} />;

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        {dialer}
        <AdminNotice title="No database connected yet">
          Set the Supabase environment variables to turn this on.
        </AdminNotice>
      </div>
    );
  }

  let calls: StoredCall[] = [];
  try {
    calls = await listCalls();
  } catch (err) {
    return (
      <div className="space-y-4">
        {dialer}
        {err instanceof MigrationPendingError ? (
          <AdminNotice title="One migration left to run">
            Run{" "}
            <code className="font-mono text-brand-blue">supabase/migrations/0009_calls.sql</code> in
            the Supabase SQL editor.
          </AdminNotice>
        ) : (
          <AdminNotice title="Could not reach the database">
            {err instanceof Error ? err.message : "Unknown error"}.
          </AdminNotice>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dialer}
      {calls.length === 0 ? (
        <AdminNotice title="No calls yet">
          Ana isn&apos;t taking calls until a Twilio number points at{" "}
          <code className="font-mono text-brand-blue">/api/voice/incoming</code>. Everything on this
          side is built and waiting.
        </AdminNotice>
      ) : (
        <CallList calls={calls} />
      )}
    </div>
  );
}
