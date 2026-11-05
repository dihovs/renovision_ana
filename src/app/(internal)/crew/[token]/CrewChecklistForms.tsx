"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { CrewChecklist, SubmitResult } from "@/lib/crm/checklists";
import {
  answeredCount,
  cleanValues,
  MAX_PHOTOS_PER_FIELD,
  type ChecklistField,
  type ChecklistValues,
  type FieldValue,
} from "@/lib/crm/checklistTypes";

export type FormLabels = {
  submit: string;
  sending: string;
  sent: string;
  queued: string;
  queuedCount: string;
  addPhoto: string;
  clear: string;
  signHere: string;
  pick: string;
  lastSent: string;
  fix: string;
  tooBig: string;
};

export type QueuedSubmit = {
  jobChecklistId: string;
  visitId: string | null;
  memberId: string | null;
  submittedBy: string | null;
  values: ChecklistValues;
  clientSubmissionId: string;
  submittedAt: string;
};

const PERSON_KEY = "rv-crew-person";

/**
 * The job's checklists, as forms the crew fills in on site.
 *
 * NEVER LOSE A FILLED FORM. A submit that fails for lack of signal is put in
 * this phone's storage and retried — when the page opens, when the phone
 * says it is back online, and every half minute while anything waits. Each
 * submit carries an id made here, so a retry of one that did arrive is
 * ignored by the server (migration 0056's unique index), never doubled.
 */
export default function CrewChecklistForms({
  token,
  checklists,
  visitId,
  people,
  labels,
  submitAction,
}: {
  token: string;
  checklists: CrewChecklist[];
  visitId: string | null;
  people: { id: string; name: string }[];
  labels: FormLabels;
  submitAction: (payload: QueuedSubmit) => Promise<SubmitResult>;
}) {
  const queueKey = `rv-checklist-queue:${token}`;
  const [queue, setQueue] = useState<QueuedSubmit[]>([]);
  const flushing = useRef(false);

  const readQueue = useCallback((): QueuedSubmit[] => {
    try {
      return JSON.parse(localStorage.getItem(queueKey) ?? "[]") as QueuedSubmit[];
    } catch {
      return [];
    }
  }, [queueKey]);
  const writeQueue = useCallback(
    (items: QueuedSubmit[]): boolean => {
      try {
        if (items.length) localStorage.setItem(queueKey, JSON.stringify(items));
        else localStorage.removeItem(queueKey);
        return true;
      } catch {
        return false;
      }
    },
    [queueKey],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let pending = readQueue();
      for (const item of [...pending]) {
        const result = await submitAction(item).catch(() => null);
        // Sent, or refused for good (a form the office has since removed):
        // either way it leaves the queue. Only "try again" stays.
        if (result && (result.ok || !result.retry)) {
          pending = pending.filter((p) => p.clientSubmissionId !== item.clientSubmissionId);
          writeQueue(pending);
        }
      }
      setQueue(pending);
    } finally {
      flushing.current = false;
    }
  }, [readQueue, writeQueue, submitAction]);

  useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => {
      if (readQueue().length) void flush();
    }, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
  }, [flush, readQueue]);

  const enqueue = useCallback(
    (item: QueuedSubmit): boolean => {
      const next = [...readQueue().filter((q) => q.clientSubmissionId !== item.clientSubmissionId), item];
      const ok = writeQueue(next);
      setQueue(next);
      return ok;
    },
    [readQueue, writeQueue],
  );

  if (checklists.length === 0) return null;

  return (
    <div className="space-y-4">
      {queue.length > 0 && (
        <p role="status" className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base font-bold text-amber-900">
          {labels.queuedCount.replace("{n}", String(queue.length))}
        </p>
      )}
      {checklists.map((checklist) => (
        <ChecklistForm
          key={checklist.id}
          checklist={checklist}
          visitId={visitId}
          people={people}
          labels={labels}
          submitAction={submitAction}
          enqueue={enqueue}
        />
      ))}
    </div>
  );
}

function readPerson(): string | null {
  try {
    return localStorage.getItem(PERSON_KEY);
  } catch {
    return null;
  }
}
function subscribePerson(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function ChecklistForm({
  checklist,
  visitId,
  people,
  labels,
  submitAction,
  enqueue,
}: {
  checklist: CrewChecklist;
  visitId: string | null;
  people: { id: string; name: string }[];
  labels: FormLabels;
  submitAction: (payload: QueuedSubmit) => Promise<SubmitResult>;
  enqueue: (item: QueuedSubmit) => boolean;
}) {
  const [values, setValues] = useState<ChecklistValues>(() => checklist.latest?.values ?? {});
  const [status, setStatus] = useState<"idle" | "sent" | "queued">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const personId = useSyncExternalStore(subscribePerson, readPerson, () => null);
  const person = people.find((p) => p.id === personId) ?? null;
  const { answered, total } = answeredCount(checklist.sections, values);

  function set(fieldId: string, value: FieldValue) {
    setValues((v) => ({ ...v, [fieldId]: value }));
    setStatus("idle");
  }

  function submit() {
    // The same check the server runs, first, so a missing answer is said
    // here and now rather than after a round trip on one bar of signal.
    const check = cleanValues(checklist.sections, values);
    setErrors(check.errors);
    if (check.errors.length) return;

    const item: QueuedSubmit = {
      jobChecklistId: checklist.id,
      visitId,
      memberId: person?.id ?? null,
      submittedBy: person?.name ?? null,
      values: check.values,
      clientSubmissionId: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
    };
    if (JSON.stringify(item).length > 3_800_000) {
      setErrors([labels.tooBig]);
      return;
    }
    start(async () => {
      const result = await submitAction(item).catch(() => null);
      if (result?.ok) {
        setStatus("sent");
      } else if (result && !result.retry) {
        setErrors(result.errors);
      } else {
        enqueue(item);
        setStatus("queued");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-lg font-bold text-charcoal">{checklist.name}</h2>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-charcoal/45">
          {answered}/{total}
        </span>
      </div>
      {checklist.latest && status === "idle" && (
        <p className="mb-3 text-sm text-charcoal/50">
          {labels.lastSent}{" "}
          {new Date(checklist.latest.submitted_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          {checklist.latest.submitted_by ? ` · ${checklist.latest.submitted_by}` : ""}
        </p>
      )}

      <div className="space-y-5">
        {checklist.sections.map((section) => (
          <fieldset key={section.id}>
            {section.title && (
              <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-charcoal/45">{section.title}</legend>
            )}
            <div className="space-y-3">
              {section.fields.map((field) => (
                <FieldInput key={field.id} field={field} value={values[field.id] ?? null} onChange={(v) => set(field.id, v)} labels={labels} />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {errors.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          <p className="font-bold">{labels.fix}</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className={`mt-4 flex min-h-[60px] w-full cursor-pointer items-center justify-center rounded-xl px-4 text-lg font-bold transition-colors disabled:opacity-60 ${
          status === "sent"
            ? "border-2 border-brand-green bg-brand-green-light text-brand-green-dark"
            : status === "queued"
              ? "border-2 border-amber-400 bg-amber-50 text-amber-900"
              : "bg-brand-blue text-white"
        }`}
      >
        {pending ? labels.sending : status === "sent" ? `✓ ${labels.sent}` : status === "queued" ? labels.queued : labels.submit}
      </button>
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  labels,
}: {
  field: ChecklistField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  labels: FormLabels;
}) {
  const label = (
    <span className="mb-1 block text-base font-semibold text-charcoal">
      {field.label}
      {field.required && <span className="text-red-600"> *</span>}
    </span>
  );
  const box = "w-full rounded-xl border border-black/15 bg-white px-3 py-3 text-lg outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

  switch (field.type) {
    case "checkbox":
      return (
        <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-7 w-7 shrink-0 accent-brand-green" />
          <span className="text-lg text-charcoal">
            {field.label}
            {field.required && <span className="text-red-600"> *</span>}
          </span>
        </label>
      );
    case "number":
      return (
        <label className="block">
          {label}
          <span className="flex items-center gap-2">
            <input type="text" inputMode="decimal" value={value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className={box} />
            {field.unit && <span className="text-lg text-charcoal/55">{field.unit}</span>}
          </span>
        </label>
      );
    case "dropdown":
      return (
        <label className="block">
          {label}
          <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} className={box}>
            <option value="">{labels.pick}</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    case "long_text":
      return (
        <label className="block">
          {label}
          <textarea rows={3} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={box} />
        </label>
      );
    case "link":
      return (
        <label className="block">
          {label}
          <input type="url" inputMode="url" placeholder="https://" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={box} />
        </label>
      );
    case "signature":
      return (
        <div>
          {label}
          <SignaturePad value={typeof value === "string" ? value : null} onChange={onChange} labels={labels} />
        </div>
      );
    case "photo":
      return (
        <div>
          {label}
          <PhotoField value={Array.isArray(value) ? value : []} onChange={onChange} labels={labels} />
        </div>
      );
    default:
      return (
        <label className="block">
          {label}
          <input type="text" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={box} />
        </label>
      );
  }
}

/** Finger signature on a canvas, saved as a small PNG. */
function SignaturePad({
  value,
  onChange,
  labels,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  labels: FormLabels;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !value) return;
    const img = new Image();
    img.onload = () => c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    img.src = value;
    // Only on first mount: the drawing itself is the source of truth after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  return (
    <div>
      <canvas
        ref={canvas}
        width={600}
        height={200}
        aria-label={labels.signHere}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-black/20 bg-white"
        onPointerDown={(e) => {
          const ctx = canvas.current!.getContext("2d")!;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#1f2a44";
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          drawing.current = true;
          canvas.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          if (dirty.current) onChange(canvas.current!.toDataURL("image/png"));
        }}
      />
      <div className="mt-1 flex justify-between text-sm">
        <span className="text-charcoal/40">{labels.signHere}</span>
        <button
          type="button"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            dirty.current = false;
            onChange(null);
          }}
          className="cursor-pointer font-semibold text-brand-blue"
        >
          {labels.clear}
        </button>
      </div>
    </div>
  );
}

/** Shrink a photo on the phone to 1024 px JPEG before it is stored or sent. */
async function shrink(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

function PhotoField({
  value,
  onChange,
  labels,
}: {
  value: string[];
  onChange: (value: string[] | null) => void;
  labels: FormLabels;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {value.map((src, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-20 w-20 rounded-lg object-cover" />
          <button
            type="button"
            aria-label={labels.clear}
            onClick={() => {
              const next = value.filter((_, j) => j !== i);
              onChange(next.length ? next : null);
            }}
            className="absolute -top-2 -right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-charcoal text-sm font-bold text-white"
          >
            ×
          </button>
        </div>
      ))}
      {value.length < MAX_PHOTOS_PER_FIELD && (
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-black/20 text-center text-xs font-bold text-charcoal/50">
          <span className="text-2xl leading-none">+</span>
          {labels.addPhoto}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const data = await shrink(file);
              if (data) onChange([...value, data]);
            }}
          />
        </label>
      )}
    </div>
  );
}

