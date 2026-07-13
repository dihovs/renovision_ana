"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";

const TESTIMONIALS = [
  {
    name: "Sarah M.",
    role: "Property Manager, Meridian Residential",
    rating: 5,
    quote:
      "Renovision Ana turns around unit repairs faster than any contractor we've worked with. Communication is excellent and tenants are always satisfied.",
  },
  {
    name: "James K.",
    role: "Homeowner",
    rating: 5,
    quote:
      "Our basement flooded and they had a crew out within hours. The restoration and repair work looked better than before the damage.",
  },
  {
    name: "Claims Team",
    role: "Regional Insurance Adjuster",
    rating: 5,
    quote:
      "Their documentation and photo reporting make the claims process seamless. One of the few contractors we recommend without hesitation.",
  },
  {
    name: "Denise R.",
    role: "Homeowner",
    rating: 5,
    quote:
      "The kitchen remodel exceeded our expectations, on budget and finished ahead of schedule. Highly professional team from start to finish.",
  },
];

export default function Testimonials() {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
        {t.testimonials.title}
      </h2>

      <div className="relative mt-10 min-h-[220px]">
        {TESTIMONIALS.map((item, i) => (
          <figure
            key={item.name}
            className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5 transition-opacity duration-700 ease-in-out ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={i !== index}
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
              <span className="block font-normal text-charcoal/60">{item.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {TESTIMONIALS.map((item, i) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show testimonial ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors cursor-pointer ${
              i === index ? "bg-brand-green" : "bg-brand-blue/20"
            }`}
          />
        ))}
      </div>

      <TestimonialSchema />
    </section>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L4.6 17.8l1.3-6-4.6-4.1 6.1-.6L10 1.5Z" />
    </svg>
  );
}

function TestimonialSchema() {
  const avg =
    TESTIMONIALS.reduce((sum, t) => sum + t.rating, 0) / TESTIMONIALS.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Renovision Ana",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(1),
      reviewCount: TESTIMONIALS.length,
    },
    review: TESTIMONIALS.map((t) => ({
      "@type": "Review",
      author: { "@type": "Person", name: t.name },
      reviewRating: {
        "@type": "Rating",
        ratingValue: t.rating,
        bestRating: 5,
      },
      reviewBody: t.quote,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
