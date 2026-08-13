/**
 * Arranging a floor's rooms on one drawing.
 *
 * An honest caveat lives at the centre of this file. RoomPlan measures each
 * room in ITS OWN coordinate space, from wherever the operator was standing
 * when they started. Two rooms scanned separately carry no information about
 * where they sit relative to each other — so a plan that showed them joined
 * would be inventing the building's layout, and inventing geometry is the
 * one thing a measurement tool must never do.
 *
 * So rooms are PACKED, not positioned: laid out in tidy rows at true scale,
 * each room's own shape and dimensions exact, their arrangement on the sheet
 * arbitrary. The UI says so. Real relative placement needs either a single
 * multi-room capture session (RoomPlan's own structure builder, which does
 * know) or the operator dragging rooms together — and that is the next piece
 * of work, not something to fake here.
 */

export type Size = { width: number; height: number };
export type Placed = { x: number; y: number; width: number; height: number };

/**
 * Shelf-pack rooms into rows, in the order they were measured.
 *
 * Row width targets a roughly square sheet — a floor of eight rooms in one
 * long line would render as an unreadable ribbon on a phone.
 */
export function packRooms(sizes: Size[], gap = 1.2): {
  placed: Placed[];
  width: number;
  height: number;
} {
  if (sizes.length === 0) return { placed: [], width: 0, height: 0 };

  // Aim for a sheet about as wide as it is tall: the side of the total area,
  // widened a little because rooms rarely tile perfectly.
  const totalArea = sizes.reduce((sum, s) => sum + s.width * s.height, 0);
  const widest = Math.max(...sizes.map((s) => s.width));
  const target = Math.max(Math.sqrt(totalArea) * 1.4, widest);

  const placed: Placed[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let sheetWidth = 0;

  for (const size of sizes) {
    // Wrap when this room would push the row past the target — unless the
    // row is empty, in which case a single over-wide room still has to go
    // somewhere.
    if (x > 0 && x + size.width > target) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    placed.push({ x, y, width: size.width, height: size.height });
    x += size.width + gap;
    sheetWidth = Math.max(sheetWidth, x - gap);
    rowHeight = Math.max(rowHeight, size.height);
  }

  return { placed, width: sheetWidth, height: y + rowHeight };
}

/**
 * The transform that brings one room to fill the view.
 *
 * Applied to a group inside a fixed viewBox rather than by changing the
 * viewBox itself, because a transform is what CSS can animate — and the zoom
 * reading as a movement, rather than a jump, is most of what makes tapping a
 * room feel like selecting it.
 */
export function zoomTo(
  target: Placed | null,
  sheet: { width: number; height: number },
  pad = 0.8,
): string {
  if (!target || sheet.width <= 0 || sheet.height <= 0) return "translate(0,0) scale(1)";

  const w = target.width + pad * 2;
  const h = target.height + pad * 2;
  if (w <= 0 || h <= 0) return "translate(0,0) scale(1)";

  // Capped: magnifying a cupboard to fill a phone screen looks broken, and
  // loses the context that makes the selection legible.
  const scale = Math.min(sheet.width / w, sheet.height / h, 4);
  const tx = sheet.width / 2 - scale * (target.x + target.width / 2);
  const ty = sheet.height / 2 - scale * (target.y + target.height / 2);
  return `translate(${round(tx)},${round(ty)}) scale(${round(scale)})`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
