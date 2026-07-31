import AdminNotice from "@/components/admin/AdminNotice";
import CallList from "@/components/admin/CallList";
import { listCalls, type StoredCall } from "@/lib/crm/calls";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let calls: StoredCall[] = [];
  try {
    calls = await listCalls();
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0009_calls.sql</code>{" "}
          in the Supabase SQL editor.
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}.
      </AdminNotice>
    );
  }

  if (calls.length === 0) {
    return (
      <AdminNotice title="No calls yet">
        The phone agent isn&apos;t taking calls until a Twilio number points at{" "}
        <code className="font-mono text-brand-blue">/api/voice/incoming</code>. Everything on this
        side is built and waiting.
      </AdminNotice>
    );
  }

  return <CallList calls={calls} />;
}
