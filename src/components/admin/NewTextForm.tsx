"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDialed, sanitisePasted, toE164 } from "@/lib/phone";

/**
 * Start a conversation with any number.
 *
 * Just navigation: the thread page at /admin/messages/[number] is where the
 * composer lives, so "new text" is nothing more than turning what the owner
 * typed into that URL. Validating with the same strict toE164 the server
 * dials with keeps the promise the softphone makes — anything this lets
 * through is a number the send path will accept.
 */
export default function NewTextForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const e164 = toE164(value);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (e164) router.push(`/admin/messages/${e164.slice(1)}`);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="tel"
        inputMode="tel"
        value={formatDialed(value)}
        onChange={(event) => setValue(sanitisePasted(event.target.value))}
        placeholder="(514) 555-0188"
        aria-label="Number to text"
        className="w-44 rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30"
      />
      <button
        type="submit"
        disabled={!e164}
        className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-30"
      >
        New text
      </button>
    </form>
  );
}
