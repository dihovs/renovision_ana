/**
 * One opening the operator placed on a wall, as an edited-plan save sends it —
 * the phone's `ScanGeometry.AuthoredOpening`, edge-keyed and editable.
 *
 * The four fields that place it are required. The rest are the opening's own
 * answers, each optional because a save from an older build, or an opening
 * nobody has asked about, simply does not carry them:
 *
 * - `height` and `sill` — floor to head, floor to the bottom (the reference's
 *   Distance to Floor), metres;
 * - `hingeAtStart` and `swingInward` — which jamb a door hangs on and which way
 *   it opens. Nothing in a scan records either, which is exactly why they are
 *   stored once somebody says.
 *
 * Until 11 Oct 2026 the save kept only the first four and dropped the rest, so
 * every door swing, window height and sill typed on the phone was gone the
 * next time the room was opened — found drawing the owner's reference plan,
 * where every bedroom door set to open out came back opening in.
 */
export type AuthoredOpening = {
  edge: number;
  offset: number;
  width: number;
  kind: string;
  height?: number;
  sill?: number;
  hingeAtStart?: boolean;
  swingInward?: boolean;
};

/** One record from the request body, or null when a required field is
    missing or not a number — a single bad record is dropped rather than
    stored as a door at NaN. An optional field that is present but malformed
    is left out on its own; the opening still saves. */
export function readAuthoredOpening(value: unknown): AuthoredOpening | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const edge = Number(record.edge);
  const offset = Number(record.offset);
  const width = Number(record.width);
  if (
    !Number.isInteger(edge) ||
    edge < 0 ||
    !Number.isFinite(offset) ||
    !Number.isFinite(width) ||
    typeof record.kind !== "string"
  ) {
    return null;
  }

  const opening: AuthoredOpening = { edge, offset, width, kind: record.kind };
  const metres = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  const height = metres(record.height);
  const sill = metres(record.sill);
  if (height !== undefined) opening.height = height;
  if (sill !== undefined) opening.sill = sill;
  if (typeof record.hingeAtStart === "boolean") opening.hingeAtStart = record.hingeAtStart;
  if (typeof record.swingInward === "boolean") opening.swingInward = record.swingInward;
  return opening;
}
