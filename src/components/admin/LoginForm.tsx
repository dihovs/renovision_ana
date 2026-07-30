"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
    >
      <h2 className="font-heading text-base font-bold text-brand-blue">Sign in</h2>
      <p className="mt-1.5 text-sm text-charcoal/60">
        This page shows customer contact details, so it needs a password.
      </p>
      <input
        type="password"
        name="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Password"
        className="mt-4 w-full rounded-xl border border-black/10 bg-black/[0.02] px-4 py-2.5 text-base outline-none focus:border-brand-blue"
      />
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full cursor-pointer rounded-full uppercase tracking-[0.08em] bg-brand-green px-5 py-3 text-sm font-bold text-white hover:bg-brand-green-dark disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
