"use client";

import { useEffect, useRef, useState } from "react";
import FloorPlan from "./FloorPlan";
import { tapFeedback } from "@/lib/haptics";
import {
  ceilingHeightMeters,
  listScanProjects,
  mergeScans,
  removeScanAt,
  resetScans,
  metersToFeet,
  roomScanSupport,
  saveScan,
  scanRoom,
  showRoomModel,
  squareMetersToSquareFeet,

  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  wallAreaSquareMeters,
  type MergedStructure,
  type RoomScanResult,
  type ScanProject,
  type ScanSupport,
} from "@/lib/roomScan";

/**
 * Measure a property with the phone, room by room.
 *
 * The scanning itself is Apple's RoomPlan — its own AR view, its own
 * wall-detection guidance — presented full-screen by the native plugin. What
 * comes back is geometry in metres; everything here turns that into the
 * imperial figures this price book is written in, because a scan that hands
 * back square metres to a business quoting in square feet has moved the
 * conversion problem rather than solved it.
 *
 * MULTI-ROOM IS THE POINT. A water-damage job is "the basement, the hallway
 * and the downstairs bathroom", not one room — so this keeps a list and
 * totals it. The running total across rooms is the number that actually goes
 * into a flooring line; a per-room figure means adding them up by hand at the
 * van, which is where mistakes come from.
 *
 * Deliberately does NOT auto-build a quote. The measurement is a fact; which
 * line items it justifies is a judgement, and this screen's job is to give
 * honest numbers to the person making it.
 */

/**
 * Which storey a room is on. RoomPlan scans one room at a time and has no
 * concept of a building, so the level is ours to track — and it has to be,
 * because "180 sq ft of flooring" means something different when it's split
 * across a basement and a second floor.
 */
const LEVELS = ["Basement", "Ground", "2nd", "3rd", "Attic"] as const;
type Level = (typeof LEVELS)[number];

type ScannedRoom = { id: string; name: string; level: Level; result: RoomScanResult };

type Status =
  | { kind: "checking" }
  | { kind: "unsupported"; support: ScanSupport }
  | { kind: "ready" }
  | { kind: "scanning" }
  | { kind: "failed"; message: string };

export default function RoomScanner() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [rooms, setRooms] = useState<ScannedRoom[]>([]);
  // The storey the next scan lands on, so a whole floor can be walked
  // without setting it per room.
  const [level, setLevel] = useState<Level>("Ground");
  // The combined floor, once asked for. Kept separate from the room list
  // because it is derived from it — recombining after another scan should
  // replace it, not append.
  const [merged, setMerged] = useState<MergedStructure | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  // Which project the scans are filed against. Until one is chosen the
  // measurements exist only on this screen — which is the state that used
  // to be permanent, and is now deliberately visible.
  const [projects, setProjects] = useState<ScanProject[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  // Rooms scanned before a project was picked would otherwise stay
  // memory-only forever — picking one later backfills them, because "I'll
  // choose the project after I scan" is the natural order on site.
  const savedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      for (const [index, room] of rooms.entries()) {
        if (savedIdsRef.current.has(room.id)) continue;
        try {
          await saveScan({
            projectId,
            name: room.name,
            level: room.level,
            position: index,
            result: room.result,
          });
          savedIdsRef.current.add(room.id);
          setSavedCount((n) => n + 1);
          setSaveError(null);
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : "Could not save the scan.");
          break;
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, rooms.length]);

  async function combine() {
    tapFeedback("medium");
    setMerging(true);
    setMergeError(null);
    try {
      setMerged(await mergeScans());
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(false);
    }
  }

  // A fresh screen is a fresh survey. The native merge set outlives the
  // WebView page, so without this the first room scanned at property B
  // gets combined with whatever was walked at property A yesterday.
  useEffect(() => {
    void resetScans();
  }, []);

  useEffect(() => {
    let cancelled = false;
    listScanProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      // A picker that can't load is not a reason to block scanning: the
      // measurements still matter, they just stay on the screen. But it IS
      // a reason to say so — silently hiding the picker looks like the
      // feature doesn't exist, when the truth is a migration or a login.
      .catch((err: unknown) => {
        if (cancelled) return;
        setProjects([]);
        setSaveError(err instanceof Error ? err.message : "Could not load projects.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    roomScanSupport().then((support) => {
      if (cancelled) return;
      setStatus(
        support.state === "supported" ? { kind: "ready" } : { kind: "unsupported", support },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    tapFeedback("medium");
    setStatus({ kind: "scanning" });
    try {
      const result = await scanRoom();
      setRooms((current) => [
        ...current,
        {
          id: `room-${Date.now()}`,
          name: `Room ${current.filter((r) => r.level === level).length + 1}`,
          level,
          result,
        },
      ]);
      // The combined plan no longer includes every room, so it stops being
      // the floor plan until it is rebuilt.
      setMerged(null);
      setStatus({ kind: "ready" });


    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Cancelling is not failing — it's the ordinary way to back out of a
      // scan, and an error card would read as something having gone wrong.
      if (/cancel/i.test(message)) setStatus({ kind: "ready" });
      else setStatus({ kind: "failed", message });
    }
  }

  if (status.kind === "checking") {
    return <p className="text-sm text-charcoal/45">Checking this device…</p>;
  }

  if (status.kind === "unsupported") {
    const { support } = status;
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-charcoal">
          {support.state === "plugin-missing"
            ? "Scanning isn't wired up in this build"
            : support.state === "not-native"
              ? "Open this in the app to scan"
              : "This device can't scan rooms"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-charcoal/60">
          {support.state === "plugin-missing" ? (
            <>
              The scanner is missing from the installed app, so this says
              nothing about the phone. Rebuild and reinstall from Xcode.
            </>
          ) : support.state === "not-native" ? (
            <>
              Room scanning uses the phone&apos;s LiDAR sensor, which a browser
              tab can&apos;t reach. Open Renovision on the iPhone.
            </>
          ) : (
            <>
              Room scanning needs the LiDAR sensor, which is on iPhone Pro
              models (12 Pro and later) and iPad Pro from 2020. Everything else
              in the app works normally here.
            </>
          )}
        </p>
        {support.state === "plugin-missing" && (
          <p className="mt-2 font-mono text-[11px] leading-snug text-charcoal/40">
            {support.detail}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {rooms.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-sm font-bold text-charcoal">Measure a property</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-charcoal/60">
            Walk each room slowly with the phone up, pointing at every wall in
            turn. Scan as many rooms as the job covers — they add up into one
            total you can price flooring, paint, drywall and baseboard from,
            without a tape measure.
          </p>
        </div>
      )}

      {status.kind === "failed" && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {status.message}
        </p>
      )}

      {rooms.length > 1 && <Totals rooms={rooms} />}

      {/* The combined plan, once there is more than one room to combine.
          This is the drawing that actually represents the property — the
          per-room plans below are its parts. It leads for that reason. */}
      {rooms.length > 1 && (
        <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
            <h2 className="font-heading text-sm font-bold text-charcoal">Floor plan</h2>
            <button
              type="button"
              onClick={combine}
              disabled={merging}
              className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {merging ? "Combining…" : merged ? "Recombine" : "Combine rooms"}
            </button>
          </div>

          {mergeError && (
            <p role="alert" className="px-4 py-3 text-sm font-medium text-red-700">
              {mergeError}
            </p>
          )}

          {merged ? (
            <div className="p-4">
              <FloorPlan result={merged} name="Floor plan" sections={merged.sections} />
              {merged.modelId && (
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    void showRoomModel(merged.modelId as string);
                  }}
                  className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/[0.04] text-sm font-bold text-brand-blue transition-colors active:bg-brand-blue/[0.1]"
                >
                  View the whole floor in 3D
                </button>
              )}
            </div>
          ) : (
            !mergeError && (
              <p className="px-4 py-4 text-sm text-charcoal/50">
                Each room below was measured on its own. Combining works out
                how they fit together and draws them as one plan.
              </p>
            )
          )}
        </section>
      )}

      {/* Which project these measurements belong to. Above the storey
          chips because it is the outer container: a floor is a floor OF
          something. */}
      {projects !== null && projects.length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <label
            htmlFor="scan-project"
            className="text-xs font-bold uppercase tracking-wide text-charcoal/45"
          >
            Project
          </label>
          <select
            id="scan-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-charcoal outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
          >
            <option value="">Don&apos;t save — measure only</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.clientName ? ` — ${project.clientName}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-snug text-charcoal/45">
            {projectId
              ? savedCount > 0
                ? `${savedCount} room${savedCount === 1 ? "" : "s"} saved to this project.`
                : "Each room is saved as you finish scanning it."
              : "Measurements will stay on this screen and are lost when it closes."}
          </p>
          {saveError && (
            <p role="alert" className="mt-1.5 text-[11px] font-medium text-red-700">
              {saveError}
            </p>
          )}
        </div>
      )}

      {/* Which storey the next scan belongs to. A row of chips rather than a
          select: it gets set once per floor and then left alone, so it
          should be one tap and always visible, not hidden in a menu. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LEVELS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              tapFeedback();
              setLevel(option);
            }}
            aria-pressed={level === option}
            className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              level === option
                ? "bg-charcoal text-white"
                : "bg-black/[0.05] text-charcoal/55 hover:bg-black/[0.08]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {LEVELS.filter((l) => rooms.some((room) => room.level === l)).map((levelName) => {
        const levelRooms = rooms.filter((room) => room.level === levelName);
        return (
          <div key={levelName} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-charcoal/45">
                {levelName}
              </h2>
              <span className="text-xs font-semibold tabular-nums text-charcoal/40">
                {round(
                  levelRooms.reduce(
                    (sum, room) =>
                      sum + squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.result)),
                    0,
                  ),
                )}{" "}
                sq ft
              </span>
            </div>
            {levelRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onRename={(name) =>
                  setRooms((current) =>
                    current.map((r) => (r.id === room.id ? { ...r, name } : r)),
                  )
                }
                onRemove={() => {
                  tapFeedback();
                  setRooms((current) => {
                    // Native holds rooms in capture order == insertion order
                    // here; tell it which one left or the next Combine
                    // includes a room the operator deleted.
                    const index = current.findIndex((r) => r.id === room.id);
                    if (index >= 0) void removeScanAt(index);
                    return current.filter((r) => r.id !== room.id);
                  });
                  setMerged(null);
                }}
                defaultOpen={room.id === rooms[rooms.length - 1]?.id}
              />
            ))}
          </div>
        );
      })}

      <button
        type="button"
        onClick={start}
        disabled={status.kind === "scanning"}
        className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand-blue text-base font-bold text-white shadow-lg shadow-brand-blue/20 transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {status.kind === "scanning"
          ? "Scanning…"
          : rooms.length === 0
            ? "Start scan"
            : "Add another room"}
      </button>
    </div>
  );
}

/** The whole-job numbers. Only shown once there's more than one room to add
    up — with a single room it would just repeat the card below it. */
function Totals({ rooms }: { rooms: ScannedRoom[] }) {
  const floorSqFt = rooms.reduce(
    (sum, room) => sum + squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.result)),
    0,
  );
  const perimeterFt = rooms.reduce(
    (sum, room) => sum + metersToFeet(totalWallLengthMeters(room.result)),
    0,
  );
  const wallAreaSqFt = rooms.reduce((sum, room) => sum + wallAreaOf(room.result), 0);

  return (
    <div className="rounded-2xl bg-charcoal-dark p-4 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">
        All {rooms.length} rooms
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <DarkFigure label="Floor" value={round(floorSqFt)} unit="sq ft" />
        <DarkFigure label="Wall area" value={round(wallAreaSqFt)} unit="sq ft" />
        <DarkFigure label="Perimeter" value={round(perimeterFt)} unit="ft" />
      </div>
    </div>
  );
}

function RoomCard({
  room,
  onRename,
  onRemove,
  defaultOpen,
}: {
  room: ScannedRoom;
  onRename: (name: string) => void;
  onRemove: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { result } = room;

  const floorSqFt = squareMetersToSquareFeet(totalFloorAreaSquareMeters(result));
  const perimeterFt = metersToFeet(totalWallLengthMeters(result));
  const heightFt = metersToFeet(ceilingHeightMeters(result));

  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <input
          value={room.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Room name"
          className="min-w-0 flex-1 bg-transparent font-heading text-base font-bold text-charcoal outline-none"
        />
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-charcoal/50">
          {round(floorSqFt)} sq ft
        </span>
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setOpen((v) => !v);
          }}
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={open}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-charcoal/40 transition-colors hover:bg-black/[0.04]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="space-y-4 p-4">
          <FloorPlan result={result} name={room.name} />

          {result.modelId && (
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                void showRoomModel(result.modelId as string);
              }}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/[0.04] text-sm font-bold text-brand-blue transition-colors active:bg-brand-blue/[0.1]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 2 3 7v10l9 5 9-5V7z" strokeLinejoin="round" />
                <path d="M3 7l9 5 9-5M12 12v10" strokeLinejoin="round" />
              </svg>
              View 3D model
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Figure label="Floor" value={round(floorSqFt)} unit="sq ft" hint="Flooring, underlay" />
            <Figure
              label="Wall area"
              value={round(wallAreaOf(result))}
              unit="sq ft"
              hint="Paint, drywall"
            />
            <Figure label="Perimeter" value={round(perimeterFt)} unit="ft" hint="Baseboard, trim" />
            <Figure label="Ceiling" value={round(heightFt, 1)} unit="ft" hint="Tallest wall" />
          </div>

          <p className="text-sm text-charcoal/70">
            {result.walls.length} wall{result.walls.length === 1 ? "" : "s"} ·{" "}
            {result.doorCount} door{result.doorCount === 1 ? "" : "s"} ·{" "}
            {result.windowCount} window{result.windowCount === 1 ? "" : "s"}
            {result.openingCount > 0 &&
              ` · ${result.openingCount} opening${result.openingCount === 1 ? "" : "s"}`}
            {result.stairCount > 0 && (
              <span className="font-semibold text-brand-blue">
                {" "}
                · {result.stairCount} staircase{result.stairCount === 1 ? "" : "s"}
              </span>
            )}
          </p>

          {result.stairCount > 0 && (
            <p className="rounded-lg bg-brand-blue/[0.06] px-3 py-2 text-[11px] leading-snug text-brand-blue">
              A staircase was detected. Its treads and risers are not in the
              floor area above — price that separately.
            </p>
          )}

          <p className="text-[11px] leading-snug text-charcoal/45">
            Wall area has the doors and windows taken out of it — it is what
            gets painted, not the whole perimeter. Gross wall area, for
            framing and insulation, is {round(squareMetersToSquareFeet(wallAreaSquareMeters(result).gross))} sq ft.
          </p>

          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer text-xs font-bold text-charcoal/35 transition-colors hover:text-red-600"
          >
            Remove this room
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The room from above, drawn from the wall transforms.
 *
 * A plain SVG in metres with the viewBox doing the scaling, so it fits any
 * width without arithmetic here. Padded by half a metre so the strokes at the
 * extremes aren't clipped by the edge of the box.
 */
/**
 * The room as a drawn plan, in the drafting conventions a printed floor plan
 * actually uses — measured against Magicplan's own output rather than
 * invented:
 *
 *   - solid black walls with real thickness, light grey floor behind them
 *   - openings cut clean out of the wall, doors with a swing arc
 *   - dimensions on witness lines OUTSIDE the plan, with arrowheads, the
 *     overall span on the outer tier and per-wall breakdowns on the inner
 *     one; horizontal text across the top, rotated up the side
 *   - a scale bar, because a plan without one is a picture
 *
 * The earlier version rotated a bare number along each wall, which is why
 * it read as a sketch: no witness lines, no arrows, no overall span, and
 * labels that fought the walls they sat on.
 */
/** Net wall area in square feet — doors and windows already taken out,
    because that is the figure paint and drywall are priced on. */
function wallAreaOf(result: RoomScanResult): number {
  return squareMetersToSquareFeet(wallAreaSquareMeters(result).net);
}

function Figure({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.015] p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-charcoal">
        {value}
        <span className="ml-1 text-sm font-semibold text-charcoal/50">{unit}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-charcoal/40">{hint}</p>
    </div>
  );
}

function DarkFigure({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="text-[11px] font-bold uppercase tracking-wide text-white/45">{label}</span>
      <p className="mt-0.5 font-heading text-xl font-bold tabular-nums text-white">
        {value}
        <span className="ml-1 text-xs font-semibold text-white/50">{unit}</span>
      </p>
    </div>
  );
}

function round(value: number, decimals = 0): string {
  return value.toLocaleString("en-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
