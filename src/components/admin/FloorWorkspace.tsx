"use client";

import { useCallback, useEffect, useState } from "react";
import FloorPlan from "./FloorPlan";
import RoomSheet from "./RoomSheet";
import { tapFeedback } from "@/lib/haptics";
import { rememberFloor } from "@/lib/floorMemory";
import {
  listSavedScans,
  metersToFeet,
  roomScanSupport,
  saveScan,
  scanRoom,
  squareMetersToSquareFeet,
  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  wallAreaSquareMeters,
  type SavedScan,
  type ScanSupport,
} from "@/lib/roomScan";

/**
 * One storey of a property: its rooms, its totals, and the button that adds
 * to it.
 *
 * This is the screen the whole survey hangs off. The project says WHICH
 * building, the floor says WHICH storey, and from here a room is added
 * without asking either question again — which is the entire point of
 * reaching scanning through the project rather than through a standalone
 * tab. A scan started here already knows where it belongs, so it saves
 * itself, and a measurement that saves itself is one that still exists
 * tomorrow.
 */

/** How a room can be measured. Kept as data because the list grows: the
    manual corner mode and hand-drawn entry are the next two, and they should
    appear alongside scanning rather than somewhere else in the app. */
type ScanMode = {
  id: "lidar" | "corners" | "manual";
  title: string;
  detail: string;
  available: boolean;
};

export default function FloorWorkspace({
  projectId,
  projectName,
  level,
}: {
  projectId: string;
  projectName: string;
  level: string;
}) {
  const [rooms, setRooms] = useState<SavedScan[] | null>(null);
  const [support, setSupport] = useState<ScanSupport | null>(null);
  const [picking, setPicking] = useState<"what" | "how" | null>(null);
  const [openRoom, setOpenRoom] = useState<SavedScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await listSavedScans(projectId);
      setRooms(all.filter((room) => room.level === level));
      setError(null);
    } catch (err) {
      setRooms([]);
      setError(err instanceof Error ? err.message : "Could not load the rooms.");
    }
  }, [projectId, level]);

  // Subscribing to two external systems: the server's copy of this floor, and
  // whether this device can scan at all. Both settle in a callback, never in
  // the effect body — a cancelled flag drops a late answer rather than
  // writing it into a component that has moved on.
  useEffect(() => {
    let cancelled = false;
    listSavedScans(projectId)
      .then((all) => {
        if (cancelled) return;
        setRooms(all.filter((room) => room.level === level));
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRooms([]);
        setError(err instanceof Error ? err.message : "Could not load the rooms.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, level]);

  // Reaching a floor by any route — a link, a back button, a typed URL —
  // is enough for it to exist. Otherwise a floor opened from history
  // vanishes from the project behind it.
  useEffect(() => {
    rememberFloor(projectId, level);
  }, [projectId, level]);

  useEffect(() => {
    let cancelled = false;
    roomScanSupport().then((s) => {
      if (!cancelled) setSupport(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const modes: ScanMode[] = [
    {
      id: "lidar",
      title: "Scan the room",
      detail:
        support?.state === "supported"
          ? "Walk the room with the phone up. Fastest and most accurate."
          : support?.state === "not-native"
            ? "Open Renovision on the iPhone to use this."
            : "This device has no LiDAR sensor.",
      available: support?.state === "supported",
    },
    {
      id: "corners",
      title: "Point at the corners",
      detail: "Stand still and tap each corner. For phones without LiDAR. Coming next.",
      available: false,
    },
    {
      id: "manual",
      title: "Enter the dimensions",
      detail: "Type width and length for a square room. Coming next.",
      available: false,
    },
  ];

  async function startScan() {
    setPicking(null);
    setBusy(true);
    setError(null);
    tapFeedback("medium");
    try {
      const result = await scanRoom();
      const position = rooms?.length ?? 0;
      await saveScan({
        projectId,
        name: `Room ${position + 1}`,
        level,
        position,
        result,
      });
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Backing out of a scan is not a failure and must not look like one.
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setBusy(false);
    }
  }

  const floorSqFt = (rooms ?? []).reduce(
    (sum, room) => sum + squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.geometry)),
    0,
  );
  const wallSqFt = (rooms ?? []).reduce(
    (sum, room) => sum + squareMetersToSquareFeet(wallAreaSquareMeters(room.geometry).net),
    0,
  );
  const perimeterFt = (rooms ?? []).reduce(
    (sum, room) => sum + metersToFeet(totalWallLengthMeters(room.geometry)),
    0,
  );

  return (
    <div className="space-y-3 pb-28">
      <div className="rounded-2xl bg-charcoal-dark p-4">
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/45">
          {projectName}
        </span>
        <h1 className="font-heading text-2xl font-bold text-white">{level}</h1>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <DarkFigure label="Floor" value={floorSqFt} unit="sq ft" />
          <DarkFigure label="Walls" value={wallSqFt} unit="sq ft" />
          <DarkFigure label="Perimeter" value={perimeterFt} unit="ft" />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {rooms === null ? (
        <p className="px-1 text-sm text-charcoal/40">Loading the rooms…</p>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-sm">
          <h2 className="font-heading text-base font-bold text-charcoal">
            Nothing measured on this floor
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-charcoal/55">
            Tap <span className="font-bold text-charcoal">Add</span> below and choose
            a room. Every room you measure lands here and adds into the totals
            above.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setOpenRoom(room);
                }}
                className="w-full cursor-pointer overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-sm active:scale-[0.98]"
              >
                <div className="flex h-32 items-center justify-center bg-[#f4f4f5] p-2">
                  <FloorPlan result={room.geometry} name={room.name} variant="thumb" />
                </div>
                <div className="border-t border-black/5 px-3 py-2.5">
                  <span className="block truncate font-heading text-sm font-bold text-charcoal">
                    {room.name}
                  </span>
                  <span className="block text-xs tabular-nums text-charcoal/45">
                    {Math.round(
                      squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.geometry)),
                    ).toLocaleString("en-CA")}{" "}
                    sq ft
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The Add button, pinned. On a phone this is reached with a thumb
          while standing in the room being measured. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            tapFeedback("medium");
            setPicking("what");
          }}
          className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand-blue text-base font-bold text-white shadow-lg shadow-brand-blue/25 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? (
            "Scanning…"
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add
            </>
          )}
        </button>
      </div>

      {picking === "what" && (
        <Sheet title="Add to this floor" onClose={() => setPicking(null)}>
          <Choice
            title="Room"
            detail="Measure a room and add it to this floor."
            onClick={() => setPicking("how")}
          />
          <Choice title="Photo" detail="Coming next." disabled />
          <Choice title="Note" detail="Coming next." disabled />
        </Sheet>
      )}

      {picking === "how" && (
        <Sheet title="How do you want to measure it?" onClose={() => setPicking(null)}>
          {modes.map((mode) => (
            <Choice
              key={mode.id}
              title={mode.title}
              detail={mode.detail}
              disabled={!mode.available}
              onClick={mode.id === "lidar" ? startScan : undefined}
            />
          ))}
        </Sheet>
      )}

      {openRoom && (
        <RoomSheet
          room={openRoom}
          onClose={() => setOpenRoom(null)}
          onChanged={() => void reload()}
        />
      )}
    </div>
  );
}

/** A bottom sheet of choices — the iOS action-sheet shape, which is what a
    "+" means on a phone. */
function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/40"
      />
      <div className="relative rounded-t-3xl bg-[#f7f7f8] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-9 rounded-full bg-black/15" />
        <h2 className="mt-3 text-center font-heading text-base font-bold text-charcoal">
          {title}
        </h2>
        <div className="mt-3 space-y-2">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 h-12 w-full cursor-pointer rounded-2xl bg-white text-sm font-bold text-charcoal/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Choice({
  title,
  detail,
  onClick,
  disabled,
}: {
  title: string;
  detail: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition-colors active:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-[15px] font-bold text-charcoal">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-charcoal/50">{detail}</span>
      </span>
      {!disabled && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-charcoal/25" aria-hidden>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function DarkFigure({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</span>
      <p className="mt-0.5 font-heading text-xl font-bold tabular-nums text-white">
        {Math.round(value).toLocaleString("en-CA")}
        <span className="ml-1 text-[11px] font-semibold text-white/50">{unit}</span>
      </p>
    </div>
  );
}
