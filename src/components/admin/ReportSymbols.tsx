import { DAMAGE_COLOR, damageLabel, type DamageType } from "@/lib/crm/areaShapes";
import type { Locale } from "@/i18n/translations";

/**
 * The report's own signage.
 *
 * **Why a claim document needs symbols at all.** The reference prints
 * everything in words: `Water`, `Door`, `Affected Wall Area`. Words are
 * unambiguous and completely unscannable — an adjuster with forty files on a
 * desk reads the pictures first and the words only where the picture raised
 * a question. A drawn symbol beside a coloured swatch says *water, on the
 * floor, this patch* in the time it takes to glance, and the word underneath
 * is still there to settle it.
 *
 * **Drawn here, not licensed.** The house rule for this project is to reuse
 * the reference's workflow and never its artwork, so every glyph below is
 * ours: plain geometry on a 24-unit grid, one weight, no fills except where
 * a fill IS the meaning. They are set in `currentColor` so a legend can tint
 * them to the cause's own colour without a second copy of the palette.
 *
 * **They are legends, never the only statement.** Nothing in this document
 * is knowable from a symbol alone: every glyph is printed beside its label,
 * because a report that has to be decoded is a report that gets queried.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** One cause, as a mark. 24×24, sized by the caller. */
export function CauseGlyph({ cause, size = 11 }: { cause: DamageType; size?: number }) {
  return (
    <svg
      className="glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {cause === "water" && (
        // A droplet. The one shape nobody has to be told the meaning of.
        <path d="M12 3.5c0 0-6.5 7.2-6.5 11.1a6.5 6.5 0 0 0 13 0C18.5 10.7 12 3.5 12 3.5Z" {...STROKE} />
      )}
      {cause === "fire" && (
        // A flame, and a second inner tongue — one curve alone reads as a
        // leaf at 11 pixels.
        <>
          <path d="M13.2 2.8c.6 3-1.1 4.3-2.6 5.7-1.8 1.7-3.9 3.5-3.9 6.7a7.3 7.3 0 0 0 14.6 0c0-2.5-1.2-4-2.4-5.2-.3 1.1-1.1 1.9-2 1.9 1-3.4-1.2-7.2-3.7-9.1Z" {...STROKE} />
          <path d="M12 20.6c-1.9 0-3.1-1.3-3.1-3 0-1.6 1.3-2.5 2.2-3.6.9 1.5 2.3 2 2.9 3.3.5 1.2-.3 3.3-2 3.3Z" {...STROKE} />
        </>
      )}
      {cause === "mould" && (
        // A spore cluster: three lobes and the specks that give it away on a
        // wall. Not a biohazard trefoil — that means something else.
        <>
          <circle cx="9" cy="10" r="4.2" {...STROKE} />
          <circle cx="15.6" cy="12.6" r="3.4" {...STROKE} />
          <circle cx="10.4" cy="17" r="2.6" {...STROKE} />
          <circle cx="18.8" cy="7.2" r="1.1" fill="currentColor" />
          <circle cx="4.6" cy="16.4" r="0.9" fill="currentColor" />
        </>
      )}
      {cause === "impact" && (
        // A struck point and the cracks running off it.
        <>
          <path d="M12 12 6 4.6M12 12l7.4-3.6M12 12l-2 8.4M12 12l7 6" {...STROKE} />
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
        </>
      )}
      {cause === "other" && (
        <>
          <circle cx="12" cy="12" r="8.4" {...STROKE} />
          <path d="M8.4 15.6 15.6 8.4" {...STROKE} />
        </>
      )}
    </svg>
  );
}

/** The cause, tinted, glyphed and named — the atom the legend is built from. */
export function CauseTag({
  cause,
  locale = "en",
}: {
  cause: DamageType;
  /** The document's language. `Dégât d'eau`, not `Eau` — see
      `DAMAGE_LABEL_FR` for why the insurance term is the right one. */
  locale?: Locale;
}) {
  return (
    <span className="cause-tag">
      <span className="cause-mark" style={{ color: DAMAGE_COLOR[cause] }}>
        <CauseGlyph cause={cause} />
      </span>
      {damageLabel(cause, locale)}
    </span>
  );
}

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
  causes,
  locale = "en",
  t,
}: {
  causes: DamageType[];
  locale?: Locale;
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
            <rect x="2" y="3" width="26" height="10" rx="1.5" fill="#6fb0e8" opacity="0.32" />
            <rect x="2" y="3" width="26" height="10" rx="1.5" fill="none" stroke="#6fb0e8" strokeWidth="1.2" />
          </PlanSymbol>
          {t.legendFloorArea}
        </span>
        <span className="legend-item">
          <PlanSymbol>
            <path d="M1 12h28" {...WALL} />
            <rect x="6" y="3" width="15" height="5" rx="1" fill="#6fb0e8" opacity="0.45" />
            <rect x="6" y="3" width="15" height="5" rx="1" fill="none" stroke="#6fb0e8" strokeWidth="1.2" />
          </PlanSymbol>
          {t.legendWallArea}
        </span>
        <span className="legend-item">
          <PlanSymbol>
            <circle cx="9" cy="8" r="6" fill="#e2a13a" />
            <text
              x="9"
              y="11.2"
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="#1b1c1f"
            >
              1
            </text>
            <path d="M18 8h11" {...THIN} strokeDasharray="2 1.6" />
          </PlanSymbol>
          {t.legendKeyed}
        </span>
      </div>
      {causes.length > 0 && (
        <div className="legend-row legend-causes">
          {causes.map((cause) => (
            <CauseTag key={cause} cause={cause} locale={locale} />
          ))}
        </div>
      )}
      <p className="legend-note">{t.legendNote}</p>
    </div>
  );
}
