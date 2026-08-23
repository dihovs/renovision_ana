/**
 * The one palette every plan drawing uses.
 *
 * The report puts two different renderers on facing pages — `FloorPlan` draws
 * a single room, `ReportStoreyPlan` draws the whole assembled storey — and
 * before this module each carried its own hex literals. They drifted: the
 * storey's fill was `#efeff0` against the room's `#ebebeb`, its dimension
 * rules `#8a8f97` against `#8a8a8e`, its labels two different inks. Nothing
 * was *wrong* on either page alone; side by side in one PDF they read as two
 * documents by two hands, which is exactly what an adjuster's eye picks up.
 *
 * Values are the room plan's, since that drawing was matched to the client's
 * own export first. Change them HERE and both drawings move together — that
 * is the whole point of the module.
 */

/** Walls and openings. Near-black rather than pure, so a large PDF fill does
    not look like a hole punched in the page. */
export const PLAN_INK = "#111111";

/** The floor inside the walls. */
export const PLAN_FILL = "#ebebeb";

/** Witness lines, arrowheads and extension rules — the drawing's furniture.
    Deliberately lighter than the label ink: a dimension should be readable
    without competing with the room it measures. */
export const PLAN_RULE = "#8a8a8e";

/** Every figure and name on the drawing: room names, areas, dimensions. One
    ink, so a plan does not appear to rank its own labels. */
export const PLAN_LABEL = "#3c3c43";

/** Halo drawn behind labels so a figure stays legible where it crosses a
    wall or a damage patch. */
export const PLAN_LABEL_HALO = "#ffffff";

/**
 * The locator's two tones — the storey drawn faint with one room in ink,
 * beside that room's own plan.
 *
 * NOT part of the shared palette above and deliberately not aligned to it.
 * The effect is entirely contrast: flatten these toward `PLAN_FILL` and the
 * highlighted room stops reading as highlighted. Kept here so the exception
 * is visible next to the rule rather than buried as a literal.
 */
export const LOCATOR_PALE_INK = "#c9ccd2";
export const LOCATOR_PALE_FILL = "#f6f7f8";
export const LOCATOR_INK_FILL = "#e9eaec";

/**
 * The numbered marker on an affected area. Amber on near-black, and
 * intentionally the one saturated thing on the page: it is the only mark that
 * indexes into the damage schedule, so it has to survive being photocopied
 * and faxed, which is still how some of these files travel.
 */
export const DAMAGE_MARK_FILL = "#e2a13a";
export const DAMAGE_MARK_LABEL = "#1b1c1f";
