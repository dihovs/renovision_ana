import { AFFECTED_AREA_FILL, DAMAGE_MARK_FILL, DAMAGE_MARK_LABEL } from "./planPalette";

/**
 * The report's own signage.
 *
 * **Why a claim document needs symbols at all.** The reference prints
 * everything in words: `Door`, `Affected Wall Area`. Words are unambiguous
 * and completely unscannable — an adjuster with forty files on a desk reads
 * the pictures first and the words only where the picture raised a question.
 * A drawn symbol beside a coloured swatch says *this patch, on the floor* in
 * the time it takes to glance, and the word underneath is still there to
 * settle it.
 *
 * **Drawn here, not licensed.** The house rule for this project is to reuse
 * the reference's workflow and never its artwork, so every glyph below is
 * ours: plain geometry, one weight, no fills except where a fill IS the
 * meaning.
 *
 * **They are legends, never the only statement.** Nothing in this document
 * is knowable from a symbol alone: every glyph is printed beside its label,
 * because a report that has to be decoded is a report that gets queried.
 *
 * **No cause glyphs.** There was a droplet, a flame, a spore cluster and a
 * struck point here, one per damage cause, and a `CauseTag` that printed the
 * tinted glyph beside its name. The damage cause is no longer stated in this
 * document at all, so the marks that named it are gone rather than left
 * unused — and the two affected-area swatches below now print the single
 * colour every patch is actually drawn in.
 */
/** One drawn convention, at the size it appears on the plan. */
function PlanSymbol({ children }: { children: React.ReactNode }) {
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const WALL = { stroke: "#1b1c1f", strokeWidth: 3.2, strokeLinecap: "butt" as const };
const THIN = { fill: "none", stroke: "#1b1c1f", strokeWidth: 1 };

/**
 * **What the drawing's own marks mean.**
 *
 * The plan already draws doors with a swing arc, windows as a thin double
 * line and openings as a plain gap — the conventions any set of drawings
 * uses. The reference prints them and explains none of them, which is fine
 * for a surveyor and not for the loss adjuster, contractor or homeowner who
 * will also read this. Six rows at the foot of the storey page cost almost
 * nothing and mean nobody has to ask.
 */
export function PlanLegend({
  t,
}: {
  /** The legend's own six lines, in the document's language. */
  t: {
    keyToDrawing: string;
    legendDoor: string;
    legendWindow: string;
    legendOpening: string;
    legendFloorArea: string;
    legendWallArea: string;
    legendKeyed: string;
    legendNote: string;
  };
}) {
  return (
    <div className="plan-legend">
      <p className="legend-title">{t.keyToDrawing}</p>
      <div className="legend-row">
        <span className="legend-item">
          <PlanSymbol>
            <path d="M1 8h7M22 8h7" {...WALL} />
            <path d="M8 8v-6.5" {...THIN} />
            <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" {...THIN} strokeDasharray="1.6 1.4" />
          </PlanSymbol>
          {t.legendDoor}
        </span>
        <span className="legend-item">
          <PlanSymbol>
            <path d="M1 8h8M21 8h8" {...WALL} />
            <path d="M9 6.4h12M9 9.6h12" {...THIN} />
          </PlanSymbol>
          {t.legendWindow}
        </span>
        <span className="legend-item">
          <PlanSymbol>
            <path d="M1 8h8M21 8h8" {...WALL} />
            <path d="M9 4.5v7M21 4.5v7" {...THIN} />
          </PlanSymbol>
          {t.legendOpening}
        </span>
      </div>
      <div className="legend-row">
        <span className="legend-item">
          <PlanSymbol>
            <rect x="2" y="3" width="26" height="10" rx="1.5" fill={AFFECTED_AREA_FILL} opacity="0.32" />
            <rect x="2" y="3" width="26" height="10" rx="1.5" fill="none" stroke={AFFECTED_AREA_FILL} strokeWidth="1.2" />
          </PlanSymbol>
          {t.legendFloorArea}
        </span>
        <span className="legend-item">
          <PlanSymbol>
            <path d="M1 12h28" {...WALL} />
            <rect x="6" y="3" width="15" height="5" rx="1" fill={AFFECTED_AREA_FILL} opacity="0.45" />
            <rect x="6" y="3" width="15" height="5" rx="1" fill="none" stroke={AFFECTED_AREA_FILL} strokeWidth="1.2" />
          </PlanSymbol>
          {t.legendWallArea}
        </span>
        <span className="legend-item">
          <PlanSymbol>
            <circle cx="9" cy="8" r="6" fill={DAMAGE_MARK_FILL} />
            <text
              x="9"
              y="11.2"
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill={DAMAGE_MARK_LABEL}
            >
              1
            </text>
            <path d="M18 8h11" {...THIN} strokeDasharray="2 1.6" />
          </PlanSymbol>
          {t.legendKeyed}
        </span>
      </div>
      <p className="legend-note">{t.legendNote}</p>
    </div>
  );
}
