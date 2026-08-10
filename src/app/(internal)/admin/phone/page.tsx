import Softphone from "@/components/admin/Softphone";
import { SITE_PHONE } from "@/lib/constants";

/**
 * The phone, on its own page.
 *
 * It used to be a card wedged at the top of /admin/calls, which is the page for
 * reading what Ana did — a log. Placing the thing you ACT with inside the thing
 * you REVIEW meant scrolling past a dial pad every time he wanted to read a
 * transcript, and hunting for the log every time he wanted to dial. They are
 * two different jobs and now they are two different pages, with the pad one
 * click away from anywhere in the admin via the rail.
 */

export const metadata = { robots: { index: false, follow: false } };

export default function PhonePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-charcoal">Phone</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-charcoal/60">
          Dial from here and talk through this browser — no handset, and nothing rings on your
          mobile. Whoever you call sees {SITE_PHONE}, the same number Ana answers on, so your
          personal number stays private and they have something callable to ring back.
        </p>
      </div>

      <Softphone />

      <p className="max-w-prose text-xs leading-relaxed text-charcoal/45">
        Your browser will ask for the microphone the first time. Calls placed here are not
        recorded — Ana announces recording on hers, and these are not announced.
      </p>
    </div>
  );
}
