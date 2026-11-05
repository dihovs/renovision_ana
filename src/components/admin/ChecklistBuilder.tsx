"use client";

import { useState, useTransition } from "react";
import type { BuilderState } from "@/app/(internal)/admin/checklists/actions";
import {
  FIELD_TYPE_LABEL,
  FIELD_TYPES,
  newField,
  newSection,
  type ChecklistField,
  type ChecklistSection,
  type FieldType,
} from "@/lib/crm/checklistTypes";

/**
 * Build a checklist: sections, each a list of typed fields. Everything is
 * edited in memory and saved as one document; the server re-validates with
 * the same rules (checklistTypes.cleanSections).
 */
export default function ChecklistBuilder({
  initial,
  save,
}: {
  initial: { name: string; description: string; sections: ChecklistSection[] };
  save: (payload: { name: string; description: string; sections: unknown }) => Promise<BuilderState>;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [sections, setSections] = useState<ChecklistSection[]>(
    initial.sections.length ? initial.sections : [newSection("Checks")],
  );
  const [state, setState] = useState<BuilderState>({});
  const [pending, start] = useTransition();

  const input =
    "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

  function updateSection(si: number, patch: Partial<ChecklistSection>) {
    setSections(sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  }
  function updateField(si: number, fi: number, patch: Partial<ChecklistField>) {
    updateSection(si, { fields: sections[si].fields.map((f, i) => (i === fi ? { ...f, ...patch } : f)) });
  }
  function move<T>(list: T[], from: number, to: number): T[] {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Checklist name, e.g. Drying set-up" aria-label="Checklist name" className={`${input} font-semibold`} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it is for (optional)"
          aria-label="Description"
          rows={2}
          className={`${input} mt-2`}
        />
      </div>

      {sections.map((section, si) => (
        <div key={section.id} className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <input
              value={section.title}
              onChange={(e) => updateSection(si, { title: e.target.value })}
              placeholder={`Section ${si + 1} title`}
              aria-label="Section title"
              className={`${input} font-heading font-bold`}
            />
            <IconButton label="Move section up" onClick={() => setSections(move(sections, si, si - 1))}>↑</IconButton>
            <IconButton label="Move section down" onClick={() => setSections(move(sections, si, si + 1))}>↓</IconButton>
            <IconButton label="Remove section" danger onClick={() => setSections(sections.filter((_, i) => i !== si))}>×</IconButton>
          </div>

          <ul className="mt-3 space-y-2">
            {section.fields.map((field, fi) => (
              <li key={field.id} className="rounded-xl bg-[#f6f8fb] p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const type = e.target.value as FieldType;
                      updateField(si, fi, { type, ...(type === "dropdown" && !field.options ? { options: [] } : {}) });
                    }}
                    aria-label="Field type"
                    className="rounded-lg border border-black/10 bg-white px-2 py-2 text-sm"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FIELD_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={field.label}
                    onChange={(e) => updateField(si, fi, { label: e.target.value })}
                    placeholder="Question or label"
                    aria-label="Field label"
                    className={`${input} min-w-[10rem] flex-1`}
                  />
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-charcoal/60">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(si, fi, { required: e.target.checked })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Required
                  </label>
                  <IconButton label="Move field up" onClick={() => updateSection(si, { fields: move(section.fields, fi, fi - 1) })}>↑</IconButton>
                  <IconButton label="Move field down" onClick={() => updateSection(si, { fields: move(section.fields, fi, fi + 1) })}>↓</IconButton>
                  <IconButton label="Remove field" danger onClick={() => updateSection(si, { fields: section.fields.filter((_, i) => i !== fi) })}>×</IconButton>
                </div>
                {field.type === "dropdown" && (
                  <input
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) => updateField(si, fi, { options: e.target.value.split(",").map((o) => o.trimStart()) })}
                    placeholder="Choices, separated by commas"
                    aria-label="Dropdown choices"
                    className={`${input} mt-2`}
                  />
                )}
                {field.type === "number" && (
                  <input
                    value={field.unit ?? ""}
                    onChange={(e) => updateField(si, fi, { unit: e.target.value })}
                    placeholder="Unit (optional), e.g. %"
                    aria-label="Unit"
                    className={`${input} mt-2 max-w-[12rem]`}
                  />
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => updateSection(si, { fields: [...section.fields, newField()] })}
            className="mt-2 cursor-pointer rounded-lg px-2 py-1 text-sm font-bold text-brand-blue hover:bg-brand-blue/[0.06]"
          >
            + Add field
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setSections([...sections, newSection()])}
        className="w-full cursor-pointer rounded-2xl border-2 border-dashed border-black/10 py-3 text-sm font-bold text-charcoal/55 hover:border-brand-blue/40 hover:text-brand-blue"
      >
        + Add section
      </button>

      <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const cleaned = sections.map((s) => ({
                ...s,
                fields: s.fields.map((f) => (f.type === "dropdown" ? { ...f, options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) } : f)),
              }));
              setState(await save({ name, description, sections: cleaned }));
            })
          }
          className="cursor-pointer rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save checklist"}
        </button>
        {state.saved && !pending && <span className="text-sm text-green-700">Saved.</span>}
        {state.errors && state.errors.length > 0 && (
          <ul className="text-sm text-red-700">
            {state.errors.slice(0, 4).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-base font-bold ${
        danger ? "text-charcoal/35 hover:bg-red-50 hover:text-red-600" : "text-charcoal/40 hover:bg-black/[0.04] hover:text-charcoal"
      }`}
    >
      {children}
    </button>
  );
}
