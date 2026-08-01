"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { ProjectFormState } from "@/app/admin/projects/actions";

/**
 * The new-project form: a name, optionally whose it is, and what it covers.
 *
 * Deliberately short. A project gets created standing in a hallway with a
 * phone in one hand; everything beyond the name can be filled in later, and
 * the files — the point of the feature — are added from the detail page it
 * redirects to.
 */

export default function ProjectForm({
  action,
  clients,
  cancelHref,
}: {
  action: (prev: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  clients: { id: string; label: string }[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ProjectFormState);
  const id = useId();

  return (
    <form
      action={formAction}
      className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2 className="font-heading text-sm font-bold text-charcoal">New project</h2>
      <p className="mt-0.5 text-xs text-charcoal/50">
        A folder for one piece of work — its jobs, and every file that belongs with them.
      </p>

      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={`${id}-name`} className={labelClass}>
            Name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={200}
            placeholder="Dubois basement renovation"
            className={inputClass}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-client`} className={labelClass}>
              Client
            </label>
            <select id={`${id}-client`} name="clientId" defaultValue="" className={inputClass}>
              <option value="">No client yet</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-started`} className={labelClass}>
              Started on
            </label>
            <input id={`${id}-started`} name="startedOn" type="date" className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-description`} className={labelClass}>
            Description
          </label>
          <textarea
            id={`${id}-description`}
            name="description"
            rows={3}
            maxLength={10_000}
            placeholder="What the project covers, in a sentence or two"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
        <Link
          href={cancelHref}
          className="text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
