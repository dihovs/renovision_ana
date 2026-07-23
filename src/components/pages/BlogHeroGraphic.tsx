export default function BlogHeroGraphic({
  stat,
  statLabel,
  compact = false,
}: {
  stat: string;
  statLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #2B5C9E 0%, #1F4677 100%)" }}
    >
      {/* Same restrained radial-highlight technique used on the chat widget
          header and the About page's service-area card, reused here so the
          blog's designed graphics stay visually consistent with the rest of
          the site instead of introducing a new one-off style. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 10% -10%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(60% 70% at 100% 120%, rgba(78,158,46,0.45), transparent 60%)",
        }}
      />
      <div className="relative px-4 text-center text-white">
        <p
          className={
            compact
              ? "font-heading text-4xl font-extrabold"
              : "font-heading text-7xl font-extrabold sm:text-8xl"
          }
        >
          {stat}
        </p>
        <p
          className={
            compact
              ? "mt-1 text-xs leading-snug text-white/80"
              : "mx-auto mt-3 max-w-xs text-sm leading-snug text-white/80 sm:text-base"
          }
        >
          {statLabel}
        </p>
      </div>
    </div>
  );
}
