"use client";

import { useMemo, useState, useTransition } from "react";
import type { SendPhotosResult } from "@/lib/crm/sendDocument";

export type PickablePhoto = {
  id: string;
  path: string;
  filename: string;
  roomName: string | null;
  url: string | null;
};

/**
 * Select photos already on the job, pick a recipient, and email them.
 *
 * A grid of checkboxes rather than a rail — the operator is choosing which
 * of possibly dozens of photos go to the customer, and that needs to see
 * many at once, not scroll a carousel one at a time.
 */
export default function SendPhotosPicker({
  projectId,
  photos,
  recipientOptions,
  sendAction,
}: {
  projectId: string;
  photos: PickablePhoto[];
  recipientOptions: string[];
  sendAction: (
    projectId: string,
    payload: {
      to: string[];
      photos: Array<{ path: string; filename: string }>;
      note: string;
      language: "fr" | "en";
    },
  ) => Promise<SendPhotosResult>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkedRecipients, setCheckedRecipients] = useState<Set<string>>(
    () => new Set(recipientOptions.slice(0, 1)),
  );
  const [extraEmail, setExtraEmail] = useState("");
  const [note, setNote] = useState("");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendPhotosResult | null>(null);

  const byRoom = useMemo(() => {
    const groups = new Map<string, PickablePhoto[]>();
    for (const photo of photos) {
      const key = photo.roomName ?? "Project files";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(photo);
    }
    return groups;
  }, [photos]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRecipient(address: string) {
    setCheckedRecipients((current) => {
      const next = new Set(current);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  }

  function send() {
    setError(null);
    setResult(null);

    const chosen = photos.filter((photo) => selected.has(photo.id));
    if (chosen.length === 0) {
      setError("Select at least one photo first.");
      return;
    }

    const to = [...checkedRecipients, extraEmail.trim()].filter(Boolean);
    if (to.length === 0) {
      setError("Pick or type at least one recipient.");
      return;
    }

    startTransition(async () => {
      try {
        const outcome = await sendAction(projectId, {
          to,
          photos: chosen.map((photo) => ({ path: photo.path, filename: photo.filename })),
          note,
          language,
        });
        if (outcome.skipped) {
          setError(outcome.skipped);
          return;
        }
        setResult(outcome);
        setSelected(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the email.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-bold text-charcoal">
            Photos <span className="font-normal text-charcoal/40">({selected.size} selected)</span>
          </h2>
          <button
            type="button"
            onClick={() => setSelected(new Set(photos.map((photo) => photo.id)))}
            className="cursor-pointer text-xs font-bold text-brand-blue hover:underline"
          >
            Select all
          </button>
        </div>

        <div className="mt-3 space-y-4">
          {[...byRoom.entries()].map(([room, group]) => (
            <div key={room}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-charcoal/40">
                {room}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {group.map((photo) => {
                  const checked = selected.has(photo.id);
                  return (
                    <button
                      type="button"
                      key={photo.id}
                      onClick={() => toggle(photo.id)}
                      aria-pressed={checked}
                      title={photo.filename}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                        checked ? "border-brand-blue" : "border-transparent hover:border-black/10"
                      }`}
                    >
                      {photo.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={photo.filename}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#f7f7f8] text-[10px] text-charcoal/40">
                          unavailable
                        </div>
                      )}
                      <span
                        className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${
                          checked
                            ? "border-brand-blue bg-brand-blue text-white"
                            : "border-white/70 bg-black/20 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-sm font-bold text-charcoal">Send to</h2>

        {recipientOptions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {recipientOptions.map((address) => (
              <label key={address} className="flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={checkedRecipients.has(address)}
                  onChange={() => toggleRecipient(address)}
                  className="h-4 w-4 rounded border-black/20"
                />
                {address}
              </label>
            ))}
          </div>
        )}

        <input
          type="email"
          value={extraEmail}
          onChange={(event) => setExtraEmail(event.target.value)}
          placeholder="Another address (optional)"
          className="mt-2 w-full rounded-lg border border-black/10 px-3 py-1.5 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
        />

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-charcoal/40">
            Language
          </span>
          <div className="flex gap-1">
            {(["fr", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                  language === lang
                    ? "bg-charcoal text-white"
                    : "bg-black/[0.04] text-charcoal/60 hover:bg-black/[0.08]"
                }`}
              >
                {lang === "fr" ? "Français" : "English"}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Optional note to include with the photos"
          className="mt-3 w-full rounded-lg border border-black/10 px-3 py-1.5 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
        />

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}

        {result && (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
            Sent {result.attached} photo{result.attached === 1 ? "" : "s"} to {result.sent.join(", ")}
            {result.missing.length > 0
              ? ` — ${result.missing.length} could not be read and ${result.missing.length === 1 ? "was" : "were"} left out.`
              : "."}
          </p>
        )}

        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="mt-4 cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send photos"}
        </button>
      </section>
    </div>
  );
}
