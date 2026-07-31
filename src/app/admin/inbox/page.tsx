import AdminNotice from "@/components/admin/AdminNotice";
import WhatsAppInbox from "@/components/admin/WhatsAppInbox";
import { fileMessageAction } from "./actions";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listJobs } from "@/lib/crm/jobs";
import { listUnfiled, signMediaUrls } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

/**
 * Everything that arrived on WhatsApp without a job attached.
 *
 * Deliberately a queue rather than a chat app: the goal is to empty it, one tap
 * per message, so the photos end up on the job they belong to.
 */
export default async function InboxPage() {
  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  try {
    const [messages, jobs] = await Promise.all([listUnfiled(), listJobs({ limit: 100 })]);

    // Signed per request, never stored — a persisted URL outlives its expiry.
    const urls = await signMediaUrls(
      messages.flatMap((m) => (m.media_path ? [m.media_path] : [])),
    );

    if (messages.length === 0) {
      return (
        <AdminNotice title="Nothing waiting">
          Messages from subcontractors land here when we can&apos;t tell which job they belong to.
          Nothing is waiting — either everything is filed, or WhatsApp isn&apos;t connected yet.
        </AdminNotice>
      );
    }

    return (
      <WhatsAppInbox
        messages={messages}
        mediaUrls={urls}
        jobs={jobs.map((j) => ({
          id: j.id,
          label: `#${j.job_number} — ${j.title || j.client_name}`,
        }))}
        fileAction={fileMessageAction}
      />
    );
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">supabase/migrations/0010_whatsapp.sql</code>{" "}
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
}
