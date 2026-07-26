"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { GOOGLE_REVIEWS_URL } from "@/lib/constants";

type ReviewItem = { name: string; rating: number; quote: string };

export default function Testimonials({
  liveReviews,
  overallRating,
  reviewCount,
}: {
  liveReviews?: ReviewItem[];
  overallRating?: number | null;
  reviewCount?: number | null;
}) {
  const { t } = useLanguage();
  // Real, live-pulled reviews take priority; otherwise fall back to the
  // curated static ones (which are also real, just not fetched live). Real
  // review text is never translated, so live reviews show as written
  // regardless of site language — only the fallback set is locale-aware.
  const testimonials = liveReviews && liveReviews.length > 0 ? liveReviews : t.testimonials.items;
  const [index, setIndex] = useState(0);

  // Reset to the first slide whenever the testimonials array itself changes
  // (e.g. a language toggle swaps in a different static set) — adjusted
  // during render rather than in an effect, per React's guidance for
  // resetting state in response to a prop change.
  const [prevTestimonials, setPrevTestimonials] = useState(testimonials);
  if (prevTestimonials !== testimonials) {
    setPrevTestimonials(testimonials);
    setIndex(0);
  }

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(id);
  }, [testimonials.length]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
        {t.testimonials.title}
      </h2>

      {overallRating != null && reviewCount != null && (
        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-3 flex w-fit items-center gap-1.5 text-sm font-semibold text-charcoal/60 hover:text-brand-blue hover:underline"
        >
          <StarIcon className="h-4 w-4 text-brand-green" />
          {t.testimonials.overallRatingLabel(overallRating.toFixed(1), reviewCount)}
        </a>
      )}

      <div className="relative mt-10 min-h-[220px]">
        {testimonials.map((item, i) => (
          <figure
            key={`${item.name}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={i !== index}
          >
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={i === index ? 0 : -1}
              className="group flex h-full flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:shadow-md hover:ring-brand-blue/20"
            >
              <div className="flex gap-1 text-brand-green" aria-hidden="true">
                {Array.from({ length: item.rating }).map((_, s) => (
                  <StarIcon key={s} />
                ))}
              </div>
              <blockquote className="mt-4 max-w-2xl text-lg text-charcoal/85">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-sm font-bold text-brand-blue">
                {item.name}
                <span className="block font-normal text-charcoal/60 group-hover:underline">
                  {t.testimonials.googleReview}
                </span>
              </figcaption>
            </a>
          </figure>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        {testimonials.map((item, i) => (
          <button
            key={`${item.name}-${i}`}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show testimonial ${i + 1}`}
            className="flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i === index ? "bg-brand-green" : "bg-brand-blue/20"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className ?? "h-5 w-5"}>
      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L4.6 17.8l1.3-6-4.6-4.1 6.1-.6L10 1.5Z" />
    </svg>
  );
}
