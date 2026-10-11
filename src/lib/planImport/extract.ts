import Anthropic from "@anthropic-ai/sdk";
import { ROOM_TYPES } from "../crm/livingArea";
import { parseLength } from "./lengths";
import type { ExtractedOpening, ExtractedRoom } from "./geometry";

/**
 * The reading half of plan import: what is on the drawing and roughly where.
 *
 * The model is asked for what it is good at — reading labels, telling a
 * closet from a hallway, recognising a door symbol from a window — and for
 * coordinates only roughly. Exact positions come afterwards, from the ink
 * (see `geometry.ts`). Printed sizes are copied verbatim and parsed in code;
 * a model doing feet-and-inches arithmetic is a model occasionally wrong by
 * a foot.
 */

/** The phone's own opening vocabulary (`PlanEditing.OpeningKind`). */
export const OPENING_KINDS = [
  "doorSingle",
  "doorDouble",
  "doorFrench",
  "doorSliding",
  "doorPatio",
  "doorPocket",
  "doorBifold",
  "doorBypass",
  "doorEntry",
  "doorGarage",
  "doorCased",
  "windowStandard",
  "windowWide",
  "windowSmall",
  "windowBay",
] as const;

const ROOM_TYPE_IDS = ROOM_TYPES.map((t) => t.id);
const OUTDOOR = new Set(["porch", "balcony"]);

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rooms", "openings", "notes"],
  properties: {
    rooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "roomType", "printedSize", "ceilingHeight", "corners"],
        properties: {
          name: { type: "string" },
          roomType: { type: "string", enum: ROOM_TYPE_IDS },
          printedSize: nullableString,
          ceilingHeight: nullableString,
          corners: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y"],
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
        },
      },
    },
    openings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "x1", "y1", "x2", "y2"],
        properties: {
          kind: { type: "string", enum: [...OPENING_KINDS] },
          x1: { type: "number" },
          y1: { type: "number" },
          x2: { type: "number" },
          y2: { type: "number" },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

function prompt(width: number, height: number): string {
  return `This is an architectural floor plan, ${width} × ${height} pixels. Coordinates are image pixels, origin at the top-left, x to the right, y down.

List every enclosed space on it: every room, closet, pantry, hallway, bathroom, laundry, garage, storage space, porch, deck and balcony. Include small ones — a linen closet is a space.

For each space:
- name: as labelled, in Title Case ("BEDROOM 4" → "Bedroom 4", "W.I.C." → "Walk-in Closet", "CLOS." → "Closet"). Number duplicates the way the plan does, or by position if it does not.
- roomType: the closest type from the list. A walk-in closet is "closet"; a foyer or entry is "entry"; a hall is "hallway"; a great room or family room is "living_room"; a breakfast nook is "dining_room"; a mud room is "laundry" if it has the washer, else "entry".
- printedSize: the dimension label exactly as printed ("18-8 x 19-4", "12'-10\\" x 11'-6\\""), or null if the space has none.
- ceilingHeight: the ceiling height if printed for that room ("10' CLG. HT." → "10'"), else null.
- corners: the INSIDE corners of the space — where the inner faces of its walls meet — in order going clockwise on the image. Walls are almost always horizontal or vertical: give corners so each side is exactly horizontal or vertical. A rectangle has 4 corners; an L-shaped room has 6. Where a space is open to its neighbour with no wall (a kitchen open to a breakfast nook), put the boundary where the plan's own label or flooring change puts it.

Openings: every door, window, garage door and wall opening, once each, as the two points where it meets the wall's jambs (x1,y1 and x2,y2) along the wall it sits in. Use:
- doorSingle for an ordinary hinged door; doorDouble for two leaves; doorFrench for glazed double doors; doorEntry for the main front door
- doorSliding, doorPatio (glass slider), doorPocket, doorBifold, doorBypass, doorGarage (overhead garage door)
- doorCased for a framed opening with no door, or a gap in a wall between two spaces
- windowStandard, windowWide (about 5 ft or more), windowSmall (about 2 ft or less), windowBay

notes: one or two sentences on anything you could not read or are unsure of. Empty if nothing.`;
}

export type Extraction = { rooms: ExtractedRoom[]; openings: ExtractedOpening[]; notes: string };

type Raw = {
  rooms: { name: string; roomType: string; printedSize: string | null; ceilingHeight: string | null; corners: { x: number; y: number }[] }[];
  openings: { kind: string; x1: number; y1: number; x2: number; y2: number }[];
  notes: string;
};

export class PlanReadError extends Error {}

export async function readPlan(image: Buffer, mediaType: "image/png", width: number, height: number): Promise<Extraction> {
  if (!process.env.ANTHROPIC_API_KEY) throw new PlanReadError("Plan reading is not configured on the server.");
  const client = new Anthropic();

  // Streamed: a whole house at high effort can take a minute or more, past
  // what a single blocking HTTP request should be asked to wait. The fallback
  // re-runs a declined request on another model inside the same call.
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
          { type: "text", text: prompt(width, height) },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new PlanReadError("The plan could not be read.");
  if (message.stop_reason === "max_tokens") throw new PlanReadError("That plan is too big to read in one go.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let raw: Raw;
  try {
    raw = JSON.parse(text) as Raw;
  } catch {
    throw new PlanReadError("The plan reader returned something unreadable.");
  }

  return {
    rooms: raw.rooms
      .filter((r) => r.corners.length >= 3)
      .map((r) => ({
        name: r.name.trim() || "Room",
        roomType: ROOM_TYPE_IDS.includes(r.roomType) ? r.roomType : "other",
        printedSize: r.printedSize?.trim() || null,
        ceilingHeight: r.ceilingHeight ? parseLength(r.ceilingHeight) : null,
        outdoor: OUTDOOR.has(r.roomType),
        polygon: r.corners.map((c) => ({ x: c.x, y: c.y })),
      })),
    openings: raw.openings.map((o) => ({ kind: o.kind, a: { x: o.x1, y: o.y1 }, b: { x: o.x2, y: o.y2 } })),
    notes: raw.notes ?? "",
  };
}
