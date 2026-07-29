import Image from "next/image";

/**
 * A feature photo with the same grounding treatment as the homepage hero:
 * two offset shapes peeking out behind the frame, plus a soft blue-tinted
 * shadow. Without them a photo reads as a rectangle pasted onto white rather
 * than something sitting in the layout.
 *
 * Deliberately scoped to LARGE, single feature images. Small grid tiles
 * (gallery, the four About process steps) get a border and shadow only —
 * offset shapes repeated across a grid read as noise rather than depth.
 *
 * The wrapper must not clip: the shapes intentionally extend past the frame,
 * so `overflow-hidden` belongs on the inner frame, never the outer element.
 */
export default function GroundedImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 45vw, 90vw",
  priority = false,
  flip = false,
  aspect = "aspect-[4/3]",
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  /** Mirror the shapes for a photo sitting on the left of a two-column split. */
  flip?: boolean;
  aspect?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden
        className={`absolute -top-5 h-[70%] w-[55%] rounded-[2rem] bg-brand-blue-light/70 lg:-top-6 ${
          flip ? "-left-4 lg:-left-6" : "-right-4 lg:-right-6"
        }`}
      />
      <div
        aria-hidden
        className={`absolute bottom-3 h-[38%] w-[40%] rounded-[1.75rem] bg-brand-green-light ${
          flip ? "-right-4 lg:-right-5" : "-left-4 lg:-left-5"
        }`}
      />
      <div
        className={`relative ${aspect} w-full overflow-hidden rounded-2xl border border-black/5 shadow-[0_30px_60px_-20px_rgba(43,92,158,0.35)]`}
      >
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    </div>
  );
}
