/**
 * The things standing in a room, drawn on the plan.
 *
 * **Why a plan needs them.** Put our floor beside the reference's page 2 and
 * the difference that survives every other fix is furniture: theirs draws the
 * bath, the toilet, the vanity, the beds, the counter runs, and ours drew
 * empty rectangles. It is not decoration. On a water loss the fixtures ARE
 * the scope — what has to come out, what has to be protected, what the
 * drying equipment has to work around — and a bathroom drawn as a blank box
 * tells an adjuster nothing about the bathroom.
 *
 * **Symbols, not pictures.** These are the plan conventions a trade already
 * reads: a bowl and a tank is a WC, a rectangle with a drain is a tub, four
 * rings is a range. Drawn at the object's own measured footprint, so a
 * 30-inch range occupies 30 inches of counter on the page.
 *
 * The catalogue itself lives on the phone (`ObjectCatalog.swift`, 300-odd
 * entries and growing). Nothing here tries to mirror it: this draws a real
 * symbol for the fixtures that read as symbols and an honest labelled
 * footprint for everything else, keyed off the same stored `kind` slug. An
 * object whose slug this file has never heard of is still a box at the right
 * size in the right place — which is the whole reason `kind` is a string.
 */

export type PlanObject = {
  id: string;
  kind: string;
  name: string | null;
  /** Centre of the footprint, in the room's own plan metres. */
  x: number;
  y: number;
  /** Degrees clockwise. */
  rotation: number;
  widthM: number;
  depthM: number;
};

/** Ink weight for a fixture outline, in plan metres. */
const LINE = 0.018;
const THIN = 0.012;

const ink = { fill: "none", stroke: "#3d434c", strokeWidth: LINE } as const;
const hair = { fill: "none", stroke: "#6a7078", strokeWidth: THIN } as const;

/**
 * Marks on the drawing rather than things in the room — a label, an arrow, a
 * north point. They carry no footprint worth drawing at scale and they are
 * never in a takeoff, so the plan leaves them out rather than printing a
 * box where a note is.
 */
const ANNOTATIONS = new Set([
  "note_label", "note_arrow", "note_flag", "note_north", "note_source",
  "hazard_marker", "moisture_sensor", "smoke_alarm", "co_alarm", "exit_sign",
]);

/** One fixture, drawn in a box centred on the origin. */
function Symbol({ kind, w, d }: { kind: string; w: number; d: number }) {
  const x = -w / 2;
  const y = -d / 2;
  const box = <rect x={x} y={y} width={w} height={d} {...ink} />;

  switch (kind) {
    case "toilet": {
      // Tank across the back, bowl in front of it — the WC symbol every
      // plumber and adjuster already reads.
      const tank = d * 0.28;
      return (
        <>
          <rect x={x + w * 0.08} y={y} width={w * 0.84} height={tank} {...ink} />
          <ellipse
            cx={0}
            cy={y + tank + (d - tank) * 0.52}
            rx={w * 0.36}
            ry={(d - tank) * 0.46}
            {...ink}
          />
        </>
      );
    }

    case "bathtub":
      return (
        <>
          {box}
          <rect
            x={x + w * 0.07}
            y={y + d * 0.1}
            width={w * 0.86}
            height={d * 0.8}
            rx={Math.min(w, d) * 0.16}
            {...hair}
          />
          <circle cx={x + w * 0.2} cy={0} r={Math.min(w, d) * 0.06} {...hair} />
        </>
      );

    case "shower":
    case "shower_stall":
      return (
        <>
          {box}
          <path
            d={`M ${x} ${y} L ${x + w} ${y + d} M ${x + w} ${y} L ${x} ${y + d}`}
            {...hair}
          />
          <circle cx={0} cy={0} r={Math.min(w, d) * 0.09} {...ink} />
        </>
      );

    case "sink":
    case "kitchen_sink":
    case "utility_sink":
    case "laundry_tub":
    case "vanity_24":
      return (
        <>
          {box}
          <rect
            x={x + w * 0.12}
            y={y + d * 0.14}
            width={w * 0.76}
            height={d * 0.72}
            rx={Math.min(w, d) * 0.1}
            {...hair}
          />
          <circle cx={0} cy={0} r={Math.min(w, d) * 0.07} {...hair} />
        </>
      );

    case "range":
    case "oven":
      return (
        <>
          {box}
          {[
            [-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22],
          ].map(([fx, fy], i) => (
            <circle key={i} cx={w * fx} cy={d * fy} r={Math.min(w, d) * 0.13} {...hair} />
          ))}
        </>
      );

    case "refrigerator":
      return (
        <>
          {box}
          <line x1={x} y1={y + d * 0.55} x2={x + w} y2={y + d * 0.55} {...hair} />
        </>
      );

    case "dishwasher":
    case "washer":
    case "dryer":
      return (
        <>
          {box}
          <circle cx={0} cy={0} r={Math.min(w, d) * 0.3} {...hair} />
        </>
      );

    case "water_heater":
    case "furnace":
    case "air_handler":
    case "dehumidifier":
    case "dehumidifier_lgr":
    case "dehumidifier_desiccant":
    case "air_scrubber":
    case "hydroxyl_generator":
    case "ozone_generator":
    case "extraction_unit":
      return (
        <>
          {box}
          <circle cx={0} cy={0} r={Math.min(w, d) * 0.32} {...hair} />
          <line x1={x} y1={y} x2={x + w} y2={y + d} {...hair} />
        </>
      );

    case "air_mover":
    case "air_mover_axial":
    case "air_mover_centrifugal":
      return (
        <>
          {box}
          {/* Pointing the way it blows, which is the whole reason an air
              mover's rotation is stored. */}
          <path
            d={`M ${x + w * 0.2} ${y + d * 0.5} L ${x + w * 0.8} ${y + d * 0.5}
                M ${x + w * 0.6} ${y + d * 0.3} L ${x + w * 0.8} ${y + d * 0.5}
                L ${x + w * 0.6} ${y + d * 0.7}`}
            {...ink}
          />
        </>
      );

    case "bed_queen":
      return (
        <>
          {box}
          <line x1={x} y1={y + d * 0.24} x2={x + w} y2={y + d * 0.24} {...hair} />
          <rect
            x={x + w * 0.1}
            y={y + d * 0.04}
            width={w * 0.35}
            height={d * 0.16}
            rx={0.03}
            {...hair}
          />
          <rect
            x={x + w * 0.55}
            y={y + d * 0.04}
            width={w * 0.35}
            height={d * 0.16}
            rx={0.03}
            {...hair}
          />
        </>
      );

    case "sofa":
      return (
        <>
          {box}
          <rect
            x={x + w * 0.12}
            y={y + d * 0.28}
            width={w * 0.76}
            height={d * 0.66}
            rx={0.04}
            {...hair}
          />
        </>
      );

    case "stairs":
      return (
        <>
          {box}
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={i}
              x1={x}
              y1={y + (d * (i + 1)) / 7}
              x2={x + w}
              y2={y + (d * (i + 1)) / 7}
              {...hair}
            />
          ))}
        </>
      );

    case "fireplace":
      return (
        <>
          {box}
          <path
            d={`M ${x + w * 0.2} ${y + d} A ${w * 0.3} ${d * 0.6} 0 0 1 ${x + w * 0.8} ${y + d}`}
            {...hair}
          />
        </>
      );

    case "column":
    case "bulkhead":
      return <rect x={x} y={y} width={w} height={d} fill="#d7dade" stroke="#3d434c" strokeWidth={LINE} />;

    default:
      // Everything the catalogue has that this file has not been taught: an
      // honest footprint at the right size, with a corner tick so it reads
      // as a placed object and not as part of the building.
      return (
        <>
          {box}
          <path d={`M ${x} ${y + d * 0.25} L ${x + w * 0.25} ${y}`} {...hair} />
        </>
      );
  }
}

export default function PlanObjects({
  objects,
  /** Cabinet runs and counters are drawn, annotations are not. */
  labels = false,
}: {
  objects: PlanObject[];
  labels?: boolean;
}) {
  const drawable = objects.filter(
    (o) => !ANNOTATIONS.has(o.kind) && o.widthM > 0.05 && o.depthM > 0.05,
  );
  if (drawable.length === 0) return null;

  return (
    <g className="plan-objects">
      {drawable.map((object) => (
        <g
          key={object.id}
          transform={`translate(${object.x},${object.y}) rotate(${object.rotation})`}
        >
          {/* White under the symbol so the room's fill and any damage
              hatching do not read through a fixture that is sitting on top
              of them. */}
          <rect
            x={-object.widthM / 2}
            y={-object.depthM / 2}
            width={object.widthM}
            height={object.depthM}
            fill="#ffffff"
          />
          <Symbol kind={object.kind} w={object.widthM} d={object.depthM} />
          {labels && object.name && (
            <text
              y={object.depthM / 2 + 0.16}
              textAnchor="middle"
              fontSize={0.15}
              fill="#6a7078"
              stroke="#ffffff"
              strokeWidth={0.05}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {object.name}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
