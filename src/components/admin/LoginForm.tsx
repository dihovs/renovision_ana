"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/(internal)/admin/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  // Typing a long password blind on a phone at a job site is where sign-in
  // actually fails, and this page is only ever used by one person on their own
  // device — so the usual argument against a reveal toggle (shoulder surfing in
  // a shared office) doesn't really apply here.
  const [revealed, setRevealed] = useState(false);

  return (
    <form action={formAction} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="font-heading text-base font-bold text-brand-blue">Sign in</h2>
      <p className="mt-1.5 text-sm text-charcoal/60">
        This page shows customer contact details, so it needs a password.
      </p>

      <div className="relative mt-4">
        <input
          type={revealed ? "text" : "password"}
          name="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          // Right padding keeps the text clear of the toggle.
          className="w-full rounded-xl border border-black/10 bg-black/[0.02] py-2.5 pl-4 pr-12 text-base outline-none focus:border-brand-blue"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-charcoal/45 transition-colors hover:text-brand-blue"
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full cursor-pointer rounded-full bg-brand-green px-5 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white hover:bg-brand-green-dark disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <path
        d="M10.6 6.1A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9M6.2 8.1A17 17 0 0 0 2 12s3.6 6.5 10 6.5a9.7 9.7 0 0 0 4-.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
