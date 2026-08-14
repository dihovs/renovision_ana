import { saveScan, type RoomScanResult } from "@/lib/roomScan";

/**
 * Scans that could not reach the server yet.
 *
 * This exists because of where the work happens. A water-damage job is a
 * basement, and a basement has no bars. Walking a room with the phone up for
 * two minutes and then losing the measurement to a failed POST is the worst
 * failure this app can have: the room is still wet, the operator is now
 * upstairs, and the only copy of what they measured is gone.
 *
 * So a save that fails for want of a network is not an error shown to the
 * operator — it is a scan held on the device and sent when there is signal.
 * A save the SERVER refused is a different thing entirely and is re-thrown,
 * because retrying a request the server already understood and rejected just
 * hides a real bug behind an ever-growing queue.
 */

const KEY = "rv.pendingScans.v1";

export type PendingScan = {
  /** Local id, so a queued scan can be shown and removed before it has a
      server id. */
  localId: string;
  projectId: string;
  name: string;
  level: string;
  position: number;
  result: RoomScanResult;
  /** The living-area classification, kept with the held scan so a room that
      waited out an outage still lands typed. Absent on scans queued before
      the field existed. */
  roomType?: string | null;
  queuedAt: string;
};

/** True when the failure was the network rather than the server's judgement.
    `fetch` rejects with a TypeError when it cannot reach the host at all;
    anything that came back with a status was understood and answered. */
export function isOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  // Safari and WKWebView phrase this several ways, and this runs in a
  // WebView on a phone that is walking out of range mid-request.
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("load failed") ||
    message.includes("connection")
  );
}

function read(): PendingScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingScan =>
        !!item &&
        typeof item === "object" &&
        typeof (item as PendingScan).localId === "string" &&
        typeof (item as PendingScan).projectId === "string",
    );
  } catch {
    return [];
  }
}

function write(queue: PendingScan[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue));
    return true;
  } catch {
    // Out of quota. Refusing loudly is right: the operator needs to know the
    // measurement was not kept, while they are still standing in the room.
    return false;
  }
}

const listeners = new Set<() => void>();
let snapshot: { key: string; value: PendingScan[] } | null = null;
const EMPTY: PendingScan[] = [];

export function subscribePending(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Referentially stable between changes, for useSyncExternalStore. */
export function pendingSnapshot(): PendingScan[] {
  const current = read();
  const key = current.map((scan) => scan.localId).join(" ");
  if (snapshot?.key === key) return snapshot.value;
  snapshot = { key, value: current };
  return current;
}

export function serverPendingSnapshot(): PendingScan[] {
  return EMPTY;
}

function notify(): void {
  snapshot = null;
  for (const listener of listeners) listener();
}

export function pendingForProject(projectId: string, level?: string): PendingScan[] {
  return pendingSnapshot().filter(
    (scan) => scan.projectId === projectId && (level === undefined || scan.level === level),
  );
}

/**
 * Save a scan, keeping it on the device if the network is not there.
 *
 * Returns how the measurement was kept, so the caller can say so honestly
 * rather than showing the same success either way.
 */
export async function saveScanResilient(input: {
  projectId: string;
  name: string;
  level: string;
  position: number;
  result: RoomScanResult;
  roomType?: string | null;
}): Promise<{ stored: "server"; id: string } | { stored: "device" } | { stored: "lost" }> {
  try {
    const id = await saveScan(input);
    return { stored: "server", id };
  } catch (error) {
    if (!isOffline(error)) throw error;

    const queue = read();
    queue.push({
      ...input,
      // Not Date.now(): two scans finished in the same millisecond would
      // collide, and a colliding id silently drops one of them.
      localId: `p${queue.length}-${Math.random().toString(36).slice(2, 10)}`,
      queuedAt: new Date().toISOString(),
    });
    return write(queue) ? { stored: "device" } : { stored: "lost" };
  }
}

/**
 * Try to send everything held on the device.
 *
 * Stops at the first network failure rather than grinding through the whole
 * queue: if one request could not reach the server, neither will the next,
 * and each attempt costs an upload of geometry on a phone that is probably
 * on cellular.
 */
export async function flushScans(): Promise<{ sent: number; remaining: number }> {
  let queue = read();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;
  while (queue.length > 0) {
    const next = queue[0];
    try {
      await saveScan({
        projectId: next.projectId,
        name: next.name,
        level: next.level,
        position: next.position,
        result: next.result,
        roomType: next.roomType ?? null,
      });
      sent += 1;
      queue = queue.slice(1);
      write(queue);
    } catch (error) {
      if (isOffline(error)) break;
      // The server refused this one on its merits. Drop it rather than
      // letting a single malformed scan block every scan behind it forever.
      queue = queue.slice(1);
      write(queue);
    }
  }

  if (sent > 0) notify();
  return { sent, remaining: queue.length };
}

/** Give up on a queued scan — the operator's decision, not ours. */
export function discardPending(localId: string): void {
  const queue = read().filter((scan) => scan.localId !== localId);
  write(queue);
  notify();
}
