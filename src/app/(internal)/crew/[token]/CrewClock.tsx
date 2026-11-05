"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import type { CrewClockPerson } from "@/lib/crm/timeClock";

export type ClockLabels = {
  whoAreYou: string;
  start: string;
  stop: string;
  running: string;
  elsewhere: string;
  failed: string;
  change: string;
};

const PERSON_KEY = "rv-crew-person";

/** The person remembered on this phone. Read through a store so the server
    render (no localStorage) and the first client render agree. */
function readSaved(): string | null {
  try {
    return localStorage.getItem(PERSON_KEY);
  } catch {
    return null;
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Start / Stop for the person holding the phone.
 *
 * The crew link is per job, not per person, so the page asks once "who are
 * you" and remembers it on this phone. The server re-checks everything —
 * the token's job, the visit, that the person is active — so a wrong pick
 * costs a mis-attributed hour the office can fix, never another job's data.
 */
export default function CrewClock({
  people,
  visitId,
  labels,
  startAction,
  stopAction,
}: {
  people: CrewClockPerson[];
  visitId: string;
  labels: ClockLabels;
  startAction: (visitId: string, memberId: string) => Promise<boolean>;
  stopAction: (entryId: string) => Promise<boolean>;
}) {
  // undefined = not chosen on this page yet; null = "Not you?" was pressed.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const saved = useSyncExternalStore(subscribe, readSaved, () => null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const fallback = saved && people.some((p) => p.id === saved) ? saved : people.length === 1 ? people[0].id : null;
  const personId = chosen === undefined ? fallback : chosen;
  const person = people.find((p) => p.id === personId) ?? null;
  const open = person?.open ?? null;

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [open]);

  if (people.length === 0) return null;

  function choose(id: string) {
    setChosen(id);
    try {
      localStorage.setItem(PERSON_KEY, id);
    } catch {
      /* private mode: remembered for this visit only */
    }
  }

  if (!person) {
    return (
      <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
        <p className="mb-2 text-base font-bold text-charcoal">{labels.whoAreYou}</p>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              className="min-h-[48px] cursor-pointer rounded-xl border-2 border-brand-blue px-4 text-base font-bold text-brand-blue"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const elapsed = open ? Math.max(0, Math.floor((now - new Date(open.startedAt).getTime()) / 60_000)) : 0;
  const onOtherVisit = open && open.visitId && open.visitId !== visitId;

  function run(work: () => Promise<boolean>) {
    setFailed(false);
    start(async () => {
      const ok = await work().catch(() => false);
      if (!ok) setFailed(true);
    });
  }

  return (
    <div className="mt-3">
      {failed && (
        <p role="alert" className="mb-2 text-base font-bold text-red-800">
          {labels.failed}
        </p>
      )}
      <div className="mb-1.5 flex items-center justify-between text-sm text-charcoal/60">
        <span className="font-semibold">{person.name}</span>
        {people.length > 1 && (
          <button type="button" onClick={() => setChosen(null)} className="cursor-pointer font-semibold text-brand-blue">
            {labels.change}
          </button>
        )}
      </div>
      {open ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => stopAction(open.entryId))}
          className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-charcoal px-5 py-3 text-lg font-bold text-white disabled:opacity-60"
        >
          <span>■ {labels.stop}</span>
          <span className="tabular-nums">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => startAction(visitId, person.id))}
          className="flex min-h-[60px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-brand-blue bg-white px-4 py-3 text-lg font-bold text-brand-blue disabled:opacity-60"
        >
          ▶ {labels.start}
        </button>
      )}
      {onOtherVisit && <p className="mt-1.5 text-sm text-charcoal/55">{labels.elsewhere}</p>}
      {open && !onOtherVisit && <p className="mt-1.5 text-sm text-charcoal/55">{labels.running}</p>}
    </div>
  );
}
