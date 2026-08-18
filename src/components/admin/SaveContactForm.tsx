"use client";

import { useActionState, useState } from "react";

/**
 * Turn the stranger who texted in into a client, without retyping their
 * number.
 *
 * Collapsed to a single button until asked for. An unknown number is the
 * ordinary case in this inbox — most of them are never going to be clients —
 * and a three-field form sitting open above every such conversation would be
 * noise on the screen the owner reads most.
 *
 * The number is deliberately not editable here. It came from the thread, it is
 * already E.164, and it is the value attribution will match on. Offering it as
 * a field would only create the chance to break that.
 */
export default function SaveContactForm({
  phone,
  action,
}: {
  /** Display form, e.g. `(514) 555-0188` — the real number rides with the action. */
  phone: string;
  action: (prev: string | null, formData: FormData) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [error, submit, pending] = useActionState(action, null);

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
        >
          Save as client
        </button>
        <span className="text-xs text-charcoal/45">Not in the CRM yet — texting works anyway.</span>
      </div>
    );
  }

  return (
    <form action={submit} className="w-full max-w-sm space-y-2 rounded-xl border border-black/10 bg-white p-3">
      <p className="text-xs text-charcoal/45">
        Saving <span className="font-medium text-charcoal">{phone}</span>
      </p>

      <div className="flex gap-2">
        <input
          name="firstName"
          placeholder="First name"
          autoFocus
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30"
        />
        <input
          name="lastName"
          placeholder="Last name"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30"
        />
      </div>

      <input
        name="companyName"
        placeholder="Company (optional)"
        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30"
      />

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="cursor-pointer text-xs font-medium text-charcoal/50 hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
