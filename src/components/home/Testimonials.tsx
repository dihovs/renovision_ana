"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { GOOGLE_REVIEWS_URL, REVIEW_COUNT_DISPLAY_THRESHOLD } from "@/lib/constants";
import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";

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

  // Split into disjoint columns so no review is ever on screen twice at
  // once — every column showing the whole list (rotated) made the same
  // name appear in all three columns simultaneously, which reads as
  // duplicated/fake content. Each column needs >= 2 unique cards or its
  // marquee duplicate repeats the same name back-to-back, so the column
  // count steps down with the number of real reviews available.
  const columnCount = testimonials.length >= 6 ? 3 : testimonials.length >= 4 ? 2 : 1;
  const perColumn = Math.ceil(testimonials.length / columnCount);
  const columns = Array.from({ length: columnCount }, (_, i) =>
    testimonials.slice(i * perColumn, (i + 1) * perColumn),
  ).filter((column) => column.length > 0);

  return (
    <section className="bg-brand-blue-light/30 py-20">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
          {t.testimonials.title}
        </h2>

        {overallRating != null && (
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto mt-3 flex w-fit items-center gap-1.5 text-sm font-semibold text-charcoal/60 hover:text-brand-blue hover:underline"
          >
            <StarIcon className="h-4 w-4 text-brand-green" />
            {reviewCount != null && reviewCount >= REVIEW_COUNT_DISPLAY_THRESHOLD
              ? t.testimonials.overallRatingLabel(overallRating.toFixed(1), reviewCount)
              : t.testimonials.overallRatingOnlyLabel(overallRating.toFixed(1))}
          </a>
        )}

        <div className="mt-10 flex max-h-[640px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          {columns.map((column, i) => (
            <TestimonialsColumn
              key={i}
              reviews={column}
              duration={column.length * 8 + i * 4}
              reviewLabel={t.testimonials.googleReview}
              className={i === 1 ? "hidden sm:block" : i === 2 ? "hidden lg:block" : undefined}
            />
          ))}
        </div>
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
