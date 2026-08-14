"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import { rememberFloor } from "@/lib/floorMemory";
import { listScanProjects, roomScanSupport, type ScanProject, type ScanSupport } from "@/lib/roomScan";

/**
 * Start measuring, from the tab.
 *
 * A technician thinks in verbs — "I am going to scan this house" — so the
 * tab stays. What it no longer does is scan into nowhere: this asks the two
 * questions a measurement needs an answer to (which property, which storey)
 * and then hands off to the floor workspace, which is the single place
 * capture happens. One capture path, two entrances.
 *
 * The previous version of this screen measured rooms that belonged to no
 * project, kept them in memory, and lost them on reload. Rooms measured
 * that way were a record of work nobody could bill.
 */
const LEVELS = ["Basement", "Ground", "2nd", "3rd", "Attic"] as const;

export default function ScanStart() {
  const router = useRouter();
  const [projects, setProjects] = useState<ScanProject[] | null>(null);
  const [support, setSupport] = useState<ScanSupport | null>(null);
  const [chosen, setChosen] = useState<ScanProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listScanProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProjects([]);
        setError(err instanceof Error ? err.message : "Could not load the projects.");
      });
    roomScanSupport().then((s) => {
      if (!cancelled) setSupport(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function open(project: ScanProject, level: string) {
    tapFeedback("medium");
    rememberFloor(project.id, level);
    router.push(`/admin/projects/${project.id}/floors/${encodeURIComponent(level)}`);
  }

  return (
    <div className="space-y-3">
      {support && support.state !== "supported" && (
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <h2 className="font-heading text-sm font-bold text-charcoal">
            {support.state === "not-native"
              ? "Open this in the app to scan"
              : support.state === "plugin-missing"
                ? "Scanning isn't in this build"
                : "This device can't scan rooms"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-charcoal/55">
            {support.state === "not-native"
              ? "Room scanning uses the phone's LiDAR sensor, which a browser tab can't reach. Open Renovision on the iPhone."
              : support.state === "plugin-missing"
                ? "The scanner is missing from the installed app, so this says nothing about the phone. Rebuild and reinstall."
                : "Room scanning needs LiDAR — iPhone Pro from 12 onwards, or iPad Pro from 2020. You can still open a floor and enter rooms by hand."}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!chosen ? (
        <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <h2 className="px-4 pb-1 pt-3.5 font-heading text-sm font-bold text-charcoal">
            Which property?
          </h2>
          {projects === null ? (
            <p className="px-4 pb-4 text-sm text-charcoal/40">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="px-4 pb-4 text-sm leading-snug text-charcoal/50">
              No projects yet. A measurement belongs to a job — create the
              project first and its floor plans live inside it.
            </p>
          ) : (
            <ul className="divide-y divide-black/5 border-t border-black/5">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setChosen(project);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.03]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-[15px] font-bold text-charcoal">
                        {project.name}
                      </span>
                      <span className="block truncate text-xs text-charcoal/45">
                        {project.clientName ?? "No client"}
                        {project.roomCount > 0 &&
                          ` · ${project.roomCount} room${project.roomCount === 1 ? "" : "s"} measured`}
                      </span>
                    </span>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center gap-2 px-4 pb-1 pt-3.5">
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                setChosen(null);
              }}
              className="cursor-pointer text-xs font-bold text-brand-blue"
            >
              Change
            </button>
            <h2 className="min-w-0 flex-1 truncate font-heading text-sm font-bold text-charcoal">
              {chosen.name} — which floor?
            </h2>
          </div>
          <ul className="divide-y divide-black/5 border-t border-black/5">
            {LEVELS.map((level) => (
              <li key={level}>
                <button
                  type="button"
                  onClick={() => open(chosen, level)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.03]"
                >
                  <span className="flex-1 font-heading text-[15px] font-bold text-charcoal">
                    {level}
                  </span>
                  <Chevron />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-charcoal/25" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
