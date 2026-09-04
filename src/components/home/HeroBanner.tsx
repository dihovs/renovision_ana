"use client";

import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { REVIEW_COUNT_DISPLAY_THRESHOLD, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Full-bleed photographic hero.
 *
 * Interior photography is almost always warm — tungsten and evening daylight
 * push everything amber, which fights a blue-and-green brand. Rather than
 * ship a differently-graded copy of the file, the correction is done in CSS
 * so it stays tunable and applies to whatever photo is dropped in:
 *
 *   1. a brand-blue layer in `mix-blend-color` nudges hue toward the palette
 *      while leaving luminance intact — a real grade, not a wash over the top
 *   2. a whisper of brand green in the shadows via `soft-light`
 *   3. a charcoal scrim, heavier on the text side, buys legibility
 *
 * The current image is already shot cool, so the blue is dialled low. Swap in
 * a warmer photo and raise that opacity rather than editing the file.
 *
 * Text sits on the left, so the scrim is asymmetric: dark enough for contrast
 * where the words are, light enough on the right that the photo still reads.
 */
export default function HeroBanner({
  overallRating,
  reviewCount,
}: {
  overallRating?: number | null;
  reviewCount?: number | null;
}) {
  const { t } = useLanguage();
  const { openChat } = useChat();

  return (
    <section
      /* Header measures this to decide when it may hide on scroll and when to
         drop its transparent state — without it the threshold falls back to
         80px and the nav starts hiding almost immediately. */
      data-scroll-hero
      // Cancels the sticky header's space in flow so the photo runs behind it.
      // The matching paddingTop below keeps content clear of the nav. The value
      // is published at runtime by Header, so it tracks the real bar height.
      // The negative margin slides the photo behind the header, but it also
      // shifts the flex centring up by the same amount, which is what made the
      // content sit high and feel cramped under the nav. Matching top padding
      // gives the centring back the visible band rather than the full box.
      style={{
        marginTop: "calc(var(--header-h) * -1)",
        paddingTop: "var(--header-h)",
      }}
      className="relative isolate flex min-h-[68svh] items-center overflow-hidden bg-charcoal-dark sm:min-h-[78svh] lg:min-h-[88svh]"
    >
      {/* Illustration, not a project photo. The alt text describes the room
          without claiming it is completed work — the real before/after of an
          actual Laval basement is the section directly below this one. */}
      <Image
        src="/images/hero-basement-banner.jpg"
        alt="A finished basement family room with plank flooring, painted walls and recessed lighting"
        fill
        priority
        sizes="(min-width: 1672px) 1672px, 100vw"
        className="object-cover"
      />

      {/* Hue shift toward the brand blue. `color` blend keeps the photo's
          light and shadow and replaces only its hue and saturation, which is
          why the room still looks lit rather than tinted. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-brand-blue opacity-[0.12] mix-blend-color"
      />
      {/* A touch of brand green in the shadows, so the palette reads as both
          brand colours rather than only the blue. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-brand-green opacity-[0.07] mix-blend-soft-light"
      />

      {/* Legibility scrim — asymmetric, following the text. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-charcoal-dark/92 via-charcoal-dark/70 to-charcoal-dark/30"
      />
      {/* Vertical fade so the section hands off to the stats bar below
          instead of ending on a hard edge. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-charcoal-dark via-charcoal-dark/60 to-transparent"
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 px-4 pb-10 pt-2 sm:gap-8 sm:px-6 sm:pb-14 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:gap-14 lg:pb-20 lg:pt-4 lg:px-8">
        <div>
          <p className="mb-3 font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-green-soft sm:mb-4 sm:text-xs">
            {t.hero.eyebrow}
          </p>
          <h1 className="font-heading leading-[1.08] text-white">
            <span className="text-[1.75rem] font-medium sm:text-3xl lg:text-[3.5rem]">
              {t.hero.headlineStart}{" "}
            </span>
            <em className="block text-[1.5rem] font-extrabold italic text-brand-green-soft sm:text-2xl lg:text-[2.5rem]">
              {t.hero.headlineAccent}
            </em>
          </h1>
        </div>

        {/* Supporting column: sits under the headline on narrow screens, moves
            to the right of it from lg up. */}
        <div className="lg:pb-2 lg:pl-6 lg:pt-24">
          <p className="max-w-sm text-[13px] leading-relaxed text-white/80 sm:text-sm lg:text-[15px]">
            {t.hero.subheadline}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3 lg:gap-4">
            <button
              type="button"
              data-estimate-cta
              onClick={openChat}
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-brand-green px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] text-white shadow-lg transition-all hover:-translate-y-px hover:bg-brand-green-dark hover:shadow-xl"
            >
              {t.hero.ctaEstimate}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10"
            >
              {t.hero.ctaCall}
            </a>
          </div>

          {/* Same quiet credibility line as before — real rating when the
              Google pull is configured, otherwise the licensed-and-insured
              claim rather than an invented number. */}
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/60">
            {overallRating != null ? (
              <>
                <span className="flex text-brand-green-soft" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L4.6 17.8l1.3-6-4.6-4.1 6.1-.6L10 1.5Z" />
                    </svg>
                  ))}
                </span>
                {reviewCount != null && reviewCount >= REVIEW_COUNT_DISPLAY_THRESHOLD
                  ? t.testimonials.overallRatingLabel(overallRating.toFixed(1), reviewCount)
                  : t.testimonials.overallRatingOnlyLabel(overallRating.toFixed(1))}
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4 text-brand-green-soft"
                >
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                {t.trustBar.item3}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-6 hidden flex-col items-center gap-2.5 lg:flex"
      >
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.35em] text-white/55">
          {t.hero.scrollHint}
        </span>
        {/* Track keeps the space reserved so the animated line doesn't shift
            the label as it grows and retracts. */}
        <span className="relative h-9 w-px bg-white/15">
          <span className="animate-scroll-cue absolute inset-0 block bg-gradient-to-b from-white/0 via-white/80 to-white/0" />
        </span>
      </div>
    </section>
  );
}
