import { it } from "vitest";
import { toFloorPlan } from "./roomScan";
import { FT, CASES, CLEAN, TYPICAL, ROUGH, toScan, score } from "./roomOutline.fixtures";
it("scorecard", () => {
  const rows: string[] = [];
  for (const room of CASES) for (const [label, noise] of [["clean", CLEAN], ["typical", TYPICAL], ["rough", ROUGH]] as const) {
    // The noise floor: the same noisy walls, joined by something that already
    // knows which wall meets which (each wall's line crossed with the next
    // one's, in the room's true order). What error is left here is the scan's
    // and no outline code can remove it; anything above it is ours.
    let floorA = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const g = toScan(room, noise, seed) as unknown as { walls: { centerX: number; centerZ: number; axisX: number; axisZ: number }[] };
      const k = room.cornersFt.length;
      const lines = g.walls.slice(0, noise.split ? k + 1 : k);
      if (noise.split) continue; // piece order shifts with a split; floor measured on unsplit runs
      const pts = lines.map((w, i) => {
        const v = lines[(i - 1 + k) % k];
        const det = w.axisX * v.axisZ - w.axisZ * v.axisX;
        const t = ((v.centerX - w.centerX) * v.axisZ - (v.centerZ - w.centerZ) * v.axisX) / det;
        return { x: w.centerX + w.axisX * t, y: w.centerZ + w.axisZ * t };
      });
      floorA = Math.max(floorA, score(pts, room).areaErrPct);
    }
    let ok = 0, n = 0, worstA = 0, worstP = 0, cornersOk = 0, closed = 0, worstAng = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const plan = toFloorPlan(toScan(room, noise, seed));
      const s = score(plan.polygon, room);
      n++; if (s.closed) closed++; if (s.corners === room.corners) cornersOk++;
      if (s.closed) { worstA = Math.max(worstA, s.areaErrPct); worstP = Math.max(worstP, s.perimeterErrPct); worstAng = Math.max(worstAng, s.worstAngleDeg); }
      if (s.closed && s.corners === room.corners && s.areaErrPct < 1 && s.perimeterErrPct < 1) ok++;
    }
    rows.push(`${room.name.padEnd(48)} ${label.padEnd(8)} pass ${String(ok).padStart(2)}/${n}  closed ${closed}  rightCorners ${cornersOk}  worstArea ${worstA.toFixed(1)}%  worstPerim ${worstP.toFixed(1)}%  worstAngle ${worstAng.toFixed(1)}°  noiseFloorArea ${noise.split ? "n/a" : floorA.toFixed(1) + "%"}`);
  }
  require("fs").writeFileSync(process.env.SCORECARD_OUT ?? "/dev/null", rows.join("\n"));
});
