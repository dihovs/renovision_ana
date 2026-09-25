import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { PageIntro, ExpectStrip, ContactTeaser } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.fr.aboutPage.title };

export default function SlkAboutFr() {
  const t = copy.fr.aboutPage;
  return (
    <>
      <SlkHeader locale="fr" path="/slk/a-propos" />
      <main className="flex-1">
        <PageIntro eyebrow={t.eyebrow} title={t.title} intro={t.intro} />
        <section className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 sm:py-24 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:gap-20 lg:py-32">
          <p className="font-slk-serif text-[clamp(2rem,4.5vw,3.5rem)] font-light italic leading-[1.1] tracking-[-0.015em]">
            «&nbsp;{t.quote}&nbsp;»
          </p>
          <div className="space-y-6 font-light leading-relaxed text-[var(--slk-ink)]/80">
            {t.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
        <ExpectStrip locale="fr" />
        <ContactTeaser locale="fr" />
      </main>
      <SlkFooter locale="fr" />
    </>
  );
}
