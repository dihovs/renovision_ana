"use client";

import { useLanguage } from "@/i18n/LanguageProvider";

const PARTNERS = [
  "Meridian Residential",
  "Statewide Insurance Group",
  "Harborview Property Management",
  "Northstar Claims Partners",
  "Crestline Realty",
  "Allied Property Insurers",
];

export default function PartnerLogos() {
  const { t } = useLanguage();
  const track = [...PARTNERS, ...PARTNERS];

  return (
    <section className="border-y border-black/5 bg-white py-14">
      <h2 className="text-center text-sm font-bold uppercase tracking-wide text-charcoal/50">
        {t.partners.title}
      </h2>
      <div className="mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee gap-12">
          {track.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex h-16 w-52 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-brand-blue-light/40 px-4 text-center text-sm font-semibold text-brand-blue/70"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
