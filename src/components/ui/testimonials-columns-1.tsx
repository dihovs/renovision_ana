"use client";

import { motion } from "motion/react";
import { GOOGLE_REVIEWS_URL } from "@/lib/constants";

export type ColumnReview = { name: string; rating: number; quote: string };

// Renders a single vertically-looping column of real review cards. The list
// is duplicated once so the marquee (translateY -50%, repeat: Infinity) loops
// seamlessly — this is purely a visual technique, not a way to pad out
// content: only real reviews are ever passed in (see Testimonials.tsx). No
// avatar photos are shown, since we don't have rights to redisplay Google
// reviewers' profile photos — the rating + quote + name + a link back to the
// real Google review is what we can honestly show.
export function TestimonialsColumn(props: {
  className?: string;
  reviews: ColumnReview[];
  duration?: number;
  reviewLabel: string;
}) {
  return (
    <div className={props.className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 15,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[0, 1].map((dup) => (
          <div key={dup} className="flex flex-col gap-6" aria-hidden={dup === 1}>
            {props.reviews.map((review, i) => (
              <a
                key={`${review.name}-${i}`}
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={dup === 1 ? -1 : 0}
                className="group w-full max-w-xs rounded-3xl border border-black/5 bg-white p-8 shadow-lg shadow-brand-blue/5 transition-shadow hover:shadow-xl"
              >
                <div className="flex gap-1 text-brand-green" aria-hidden="true">
                  {Array.from({ length: review.rating }).map((_, s) => (
                    <StarIcon key={s} className="h-4 w-4" />
                  ))}
                </div>
                <blockquote className="mt-3 text-sm leading-relaxed text-charcoal/85">
                  &ldquo;{review.quote}&rdquo;
                </blockquote>
                <div className="mt-5">
                  <div className="font-heading text-sm font-bold text-brand-blue">{review.name}</div>
                  <div className="text-xs text-charcoal/50 group-hover:underline">{props.reviewLabel}</div>
                </div>
              </a>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L4.6 17.8l1.3-6-4.6-4.1 6.1-.6L10 1.5Z" />
    </svg>
  );
}
