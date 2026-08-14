"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import FloorPlan from "./FloorPlan";
import AddFloorPlan from "./AddFloorPlan";
import {
  floorsSnapshot,
  mergeFloors,
  reconcile,
  serverFloorsSnapshot,
  subscribeFloors,
} from "@/lib/floorMemory";
import { squareMetersToSquareFeet, type RoomScanResult } from "@/lib/roomScan";
import { FLOOR_ORDER } from "@/lib/crm/floors";

/**
 * The Floor plans section of a project — the way IN to measuring it.
 *
 * A client component for one reason: a floor created but not yet scanned
 * lives on the device (see `floorMemory`), and the server rendering this
 * page cannot see that. So the server sends what it has measured, and this
 * merges in what the operator has started.
 */

export type FloorRoom = {
  id: string;
  name: string;
  level: string;
  floorAreaSqm: number;
  stairCount: number;
  geometry: unknown;
};

export default function FloorPlanSection({
  projectId,
  measured,
  rooms,
  migrationPending,
}: {
  projectId: string;
  /** Storeys the database knows about, because a room sits on them. */
  measured: string[];
  rooms: FloorRoom[];
  /** The scans table isn't reachable yet — different from "not measured". */
  migrationPending: boolean;
}) {
  // Subscribed rather than copied into state: the remembered floors are
  // mutable state living outside React, and another component on this page
  // (the Add sheet) writes to them.
  const remembered = useSyncExternalStore(
    subscribeFloors,
    () => floorsSnapshot(projectId),
    serverFloorsSnapshot,
  );

  const measuredKey = measured.join("|");
  useEffect(() => {
    // Clears floors the database has caught up on, so the device's list
    // shrinks back to nothing as the survey gets done. Writes to the store,
    // which notifies the subscription above — no local state to keep in sync.
    reconcile(projectId, measuredKey ? measuredKey.split("|") : []);
  }, [projectId, measuredKey]);

  const levels = mergeFloors(measured, remembered, FLOOR_ORDER);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-charcoal">Floor plans</h2>
        <AddFloorPlan projectId={projectId} existing={levels} />
      </div>

      {migrationPending ? (
        <p className="mt-3 text-sm leading-snug text-charcoal/45">
          Run <code className="font-mono text-brand-blue">0024_room_scans.sql</code> in
          Supabase to turn floor plans on.
        </p>
      ) : levels.length === 0 ? (
        <p className="mt-3 text-sm leading-snug text-charcoal/45">
          No floor yet. Add a floor plan, then measure the rooms on it — the
          figures roll up into the statistics above.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {levels.map((level) => {
            const onLevel = rooms.filter((room) => room.level === level);
            const levelArea = onLevel.reduce((sum, room) => sum + room.floorAreaSqm, 0);
            const href = `/admin/projects/${projectId}/floors/${encodeURIComponent(level)}`;

            return (
              <div key={level}>
                <Link
                  href={href}
                  className="flex items-baseline justify-between gap-2 py-1 transition-colors hover:text-brand-blue"
                >
                  <span className="font-heading text-sm font-bold text-charcoal">{level}</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-charcoal/45">
                    {onLevel.length === 0
                      ? "Not measured"
                      : `${fmt(squareMetersToSquareFeet(levelArea))} sq ft · ${onLevel.length} room${
                          onLevel.length === 1 ? "" : "s"
                        }`}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>

                {onLevel.length > 0 && (
                  <ul className="mt-1.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {onLevel.map((room) => (
                      <li key={room.id} className="overflow-hidden rounded-xl border border-black/5">
                        <Link href={href}>
                          <div className="flex h-28 items-center justify-center bg-[#f7f7f8] p-2">
                            <FloorPlan
                              result={room.geometry as RoomScanResult}
                              name={room.name}
                              variant="thumb"
                            />
                          </div>
                          <div className="border-t border-black/5 px-2.5 py-2">
                            <span className="block truncate text-xs font-bold text-charcoal">
                              {room.name}
                            </span>
                            <span className="block text-[11px] tabular-nums text-charcoal/45">
                              {fmt(squareMetersToSquareFeet(room.floorAreaSqm))} sq ft
                              {room.stairCount > 0 && " · stairs"}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function fmt(value: number): string {
  return Math.round(value).toLocaleString("en-CA");
}
