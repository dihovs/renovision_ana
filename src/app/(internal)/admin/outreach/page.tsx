import AdminNotice from "@/components/admin/AdminNotice";
import OutreachManager from "@/components/admin/OutreachManager";
import {
  queueIntroCallAction,
  recordConsentAction,
  suppressNumberAction,
  withdrawConsentAction,
} from "./actions";
import { listConsents } from "@/lib/crm/consentStore";

/**
 * Introductory calls, and the consent that is the only thing that permits one.
 *
 * A separate screen from Tasks on purpose. Tasks answers "what is Ana about to
 * do"; this answers "who has agreed to be called, and what exactly did they
 * agree to". The second is a compliance record with a thirty-day production
 * deadline and a three-year retention on the do-not-call side, and burying it
 * inside an operations list would treat it as an operational detail.
 *
 * WHY THIS SCREEN IS SHAPED THE WAY IT IS. An AI voice placing a call is an
 * ADAD under the CRTC's Unsolicited Telecommunications Rules. Introducing the
 * company is solicitation. Part IV rule 2 forbids a telemarketing ADAD call
 * without express consent from that number, Telecom Regulatory Policy 2014-155
 * ¶51–53 refused to carve out calls that are only partly promotional, and an
 * existing relationship does not substitute. Business-to-business does not
 * rescue it either: B2B calls are exempt from the National DNCL Rules and from
 * nothing else — the CRTC's own guidance says calls to business numbers are
 * "only regulated under Part III and Part IV", and Part IV is the consent one.
 *
 * So there is no field on this page for a number to call. Only a number that
 * already has consent on file can be called, and the button that does it asks
 * the server again before anything is queued.
 */

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const result = await listConsents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-bold text-charcoal">Introductions</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-charcoal/50">
          Ana can introduce the company to a contractor, a property manager or an insurer — once
          per number, and only where they have agreed to it beforehand. This is the one thing she
          does that counts as selling, so it is the one thing that needs permission on file first.
        </p>
      </div>

      {result.ok ? (
        <OutreachManager
          rows={result.rows}
          doNotCall={result.doNotCall}
          now={new Date().toISOString()}
          recordConsent={recordConsentAction}
          withdraw={withdrawConsentAction}
          suppress={suppressNumberAction}
          queueIntro={queueIntroCallAction}
        />
      ) : (
        <Unavailable reason={result.reason} detail={result.detail} />
      )}
    </div>
  );
}

function Unavailable({ reason, detail }: { reason: string; detail?: string }) {
  if (reason === "unconfigured") {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }
  if (reason === "migration_pending") {
    return (
      <AdminNotice title="One migration left to run">
        Open the Supabase SQL editor and run{" "}
        <code className="font-mono text-brand-blue">
          supabase/migrations/0021_outbound_consent.sql
        </code>
        . Until those tables exist there is nowhere to record a consent — and no introductory call
        can be placed, because the gate refuses when it cannot check rather than assuming the
        answer is yes.
      </AdminNotice>
    );
  }
  return (
    <AdminNotice title="Could not reach the database">
      {detail ?? "Unknown error"}. If the project has been idle for over a week it may be paused —
      open the Supabase dashboard to resume it.
    </AdminNotice>
  );
}
