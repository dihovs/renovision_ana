/**
 * Site icon set.
 *
 * These were originally hand-drawn SVGs with inconsistent stroke weights and
 * a few shapes that didn't read at card size — four plain squares standing in
 * for flooring, a box-with-a-circle for kitchens. They're now Lucide icons
 * (MIT, drawn on a consistent 24x24 grid), re-exported under the original
 * names so the 24 files importing them didn't have to change.
 *
 * Two icons were doing double duty, which showed up as visibly identical
 * cards: renovations and drywall shared a hammer, painting and repairs shared
 * a brush. Both now have their own.
 *
 * IconStairs stays hand-drawn — Lucide has no stairs glyph, and it's the one
 * shape here where the literal reading (steps down into a basement) is worth
 * more than an approximate stand-in.
 */
import {
  ArrowUpFromLine,
  Bath,
  Building2,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Droplets,
  Flag,
  Frame,
  Grid3x3,
  Hammer,
  House,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  PaintRoller,
  Phone,
  ShieldCheck,
  Tag,
  Wrench,
} from "lucide-react";

type IconProps = { className?: string };

const base = "h-7 w-7";

// Lucide's default stroke is 2, a touch heavy next to this site's type. 1.75
// keeps the icons crisp without letting them outweigh the headings they sit
// above. Set once here so the whole set stays visually consistent.
const STROKE = 1.75;

function make(Glyph: typeof Phone) {
  return function Icon({ className = base }: IconProps) {
    return <Glyph className={className} strokeWidth={STROKE} absoluteStrokeWidth />;
  };
}

export const IconPhone = make(Phone);
export const IconChat = make(MessageCircle);
export const IconDashboard = make(LayoutDashboard);
export const IconTag = make(Tag);
export const IconDroplet = make(Droplets);
export const IconBuilding = make(Building2);
export const IconShield = make(ShieldCheck);
export const IconHome = make(House);
export const IconClipboard = make(ClipboardList);
export const IconCheckCircle = make(CircleCheck);
export const IconCalendar = make(CalendarDays);
export const IconMapPin = make(MapPin);
export const IconFlag = make(Flag);

/** Kitchens & bathrooms. A tub reads instantly; the old box-and-circle didn't. */
export const IconKitchen = make(Bath);
/** Flooring. A tile grid rather than four oversized squares. */
export const IconTiles = make(Grid3x3);
/** Interior renovations. */
export const IconHammer = make(Hammer);
/** Painting — previously shared the brush with repairs. */
export const IconBrush = make(PaintRoller);
/** Small repairs — previously shared the brush with painting. */
export const IconWrench = make(Wrench);
/** Drywall — previously shared the hammer with renovations. */
export const IconDrywall = make(Frame);
/**
 * Sewer backup. Deliberately not the droplet: water damage and a backup are
 * different jobs with different decontamination rules, and two identical cards
 * would flatten that. An arrow coming *up* out of a line is the literal thing
 * that happens.
 */
export const IconBackflow = make(ArrowUpFromLine);

/** Basement transformations. Hand-drawn: Lucide has no stairs glyph. */
export function IconStairs({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 20h4v-4h4v-4h4V8h5" />
      <path d="M7 20v-4M11 16v-4M15 12V8" />
    </svg>
  );
}
