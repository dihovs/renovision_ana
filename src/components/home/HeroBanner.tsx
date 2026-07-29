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
    <section className="relative isolate flex min-h-[88svh] items-center overflow-hidden bg-charcoal-dark">
      {/* Illustration, not a project photo. The alt text describes the room
          without claiming it is completed work — the real before/after of an
          actual Laval basement is the section directly below this one. */}
      <Image
        src="/images/hero-basement-banner.png"
        alt="A finished basement family room with plank flooring, painted walls and recessed lighting"
        fill
        priority
        sizes="100vw"
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

      <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.25em] text-brand-green-soft">
            {t.hero.eyebrow}
          </p>
          <h1 className="font-heading leading-[1.08] text-white">
            <span className="text-4xl font-medium sm:text-5xl lg:text-[3.5rem]">
              {t.hero.headlineStart}{" "}
            </span>
            <em className="block text-5xl font-extrabold italic text-brand-green-soft sm:text-6xl lg:text-[4.5rem]">
              {t.hero.headlineAccent}
            </em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
            {t.hero.subheadline}
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={openChat}
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-brand-green px-7 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-px hover:bg-brand-green-dark hover:shadow-xl"
            >
              {t.hero.ctaEstimate}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="inline-flex items-center justify-center rounded-full border-2 border-white/70 px-7 py-3.5 text-base font-bold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10"
            >
              {t.hero.ctaCall}
            </a>
          </div>

          {/* Same quiet credibility line as before — real rating when the
              Google pull is configured, otherwise the licensed-and-insured
              claim rather than an invented number. */}
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-white/70">
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
    </section>
  );
}
