import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Scans held on the device when the network is not there.
 *
 * The failure being guarded against is losing a measurement taken in a
 * basement with no signal — two minutes of walking a room, gone to a failed
 * POST, discovered only once the operator is back upstairs.
 */

// A minimal store, since jsdom is not configured for these unit tests.
class MemoryStorage {
  private data = new Map<string, string>();
  full = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.full) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("window", { localStorage: storage });
vi.stubGlobal("navigator", { onLine: true });

const saveScan = vi.fn();
vi.mock("@/lib/roomScan", () => ({ saveScan: (...args: unknown[]) => saveScan(...args) }));

const { flushScans, isOffline, pendingSnapshot, saveScanResilient, discardPending } = await import(
  "./scanQueue"
);

const scan = (name: string) => ({
  projectId: "p1",
  name,
  level: "Basement",
  position: 0,
  // The geometry is opaque to the queue; only that it survives matters.
  result: { walls: [], doorCount: 0, windowCount: 0, stairCount: 0 } as never,
});

beforeEach(() => {
  storage.removeItem("rv.pendingScans.v1");
  storage.full = false;
  saveScan.mockReset();
  (globalThis as { navigator: { onLine: boolean } }).navigator.onLine = true;
});

describe("isOffline", () => {
  it("treats a fetch-level failure as offline", () => {
    expect(isOffline(new TypeError("Load failed"))).toBe(true);
  });

  it("treats a server's own rejection as NOT offline", () => {
    // Queueing these would hide a real bug behind a growing queue.
    expect(isOffline(new Error("An affected area needs at least three corners."))).toBe(false);
  });

  it("believes the browser when it says there is no connection", () => {
    (globalThis as { navigator: { onLine: boolean } }).navigator.onLine = false;
    expect(isOffline(new Error("anything"))).toBe(true);
  });
});

describe("saveScanResilient", () => {
  it("reports a normal save as stored on the server", async () => {
    saveScan.mockResolvedValue("srv-1");
    await expect(saveScanResilient(scan("Kitchen"))).resolves.toEqual({
      stored: "server",
      id: "srv-1",
    });
    expect(pendingSnapshot()).toHaveLength(0);
  });

  it("keeps the measurement on the device when the network is gone", async () => {
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    await expect(saveScanResilient(scan("Basement bath"))).resolves.toEqual({ stored: "device" });

    const queued = pendingSnapshot();
    expect(queued).toHaveLength(1);
    expect(queued[0].name).toBe("Basement bath");
    expect(queued[0].projectId).toBe("p1");
  });

  it("re-throws what the server refused instead of queueing it forever", async () => {
    saveScan.mockRejectedValue(new Error("projectId is required."));
    await expect(saveScanResilient(scan("Nowhere"))).rejects.toThrow("projectId is required.");
    expect(pendingSnapshot()).toHaveLength(0);
  });

  it("says so plainly when the device cannot hold it either", async () => {
    // A full disk must not read as a successful save; the operator is still
    // in the room and can rescan.
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    storage.full = true;
    await expect(saveScanResilient(scan("Attic"))).resolves.toEqual({ stored: "lost" });
  });

  it("gives every queued scan its own id", async () => {
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    await saveScanResilient(scan("A"));
    await saveScanResilient(scan("B"));
    const ids = pendingSnapshot().map((s) => s.localId);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("flushScans", () => {
  it("sends everything once there is signal again", async () => {
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    await saveScanResilient(scan("A"));
    await saveScanResilient(scan("B"));

    saveScan.mockReset();
    saveScan.mockResolvedValue("srv");
    await expect(flushScans()).resolves.toEqual({ sent: 2, remaining: 0 });
    expect(pendingSnapshot()).toHaveLength(0);
  });

  it("stops at the first network failure rather than retrying the rest", async () => {
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    await saveScanResilient(scan("A"));
    await saveScanResilient(scan("B"));

    saveScan.mockReset();
    saveScan.mockResolvedValueOnce("srv").mockRejectedValueOnce(new TypeError("Load failed"));
    const result = await flushScans();
    expect(result).toEqual({ sent: 1, remaining: 1 });
    // Exactly one retry attempt after the success, not a loop over the queue.
    expect(saveScan).toHaveBeenCalledTimes(2);
  });

  it("drops a scan the server refuses, so it cannot block the queue", async () => {
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    await saveScanResilient(scan("bad"));
    await saveScanResilient(scan("good"));

    saveScan.mockReset();
    saveScan.mockRejectedValueOnce(new Error("geometry is invalid")).mockResolvedValueOnce("srv");
    await expect(flushScans()).resolves.toEqual({ sent: 1, remaining: 0 });
  });

  it("does nothing, cheaply, when there is nothing held", async () => {
    await expect(flushScans()).resolves.toEqual({ sent: 0, remaining: 0 });
    expect(saveScan).not.toHaveBeenCalled();
  });
});

describe("discardPending", () => {
  it("forgets one queued scan and keeps the rest", async () => {
    saveScan.mockRejectedValue(new TypeError("Load failed"));
    await saveScanResilient(scan("A"));
    await saveScanResilient(scan("B"));

    discardPending(pendingSnapshot()[0].localId);
    const left = pendingSnapshot();
    expect(left).toHaveLength(1);
    expect(left[0].name).toBe("B");
  });
});
