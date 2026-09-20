import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { ContactTeaser } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.fr.aboutPage.title };

export default function SlkAboutFr() {
  const t = copy.fr.aboutPage;
  return (
    <>
      <SlkHeader locale="fr" path="/slk/a-propos" />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h1 className="font-slk-serif text-4xl font-semibold text-[var(--slk-charcoal)]">
            {t.title}
          </h1>
          <p className="mt-3 text-lg text-[var(--slk-charcoal)]/70">{t.intro}</p>
          <div className="mt-8 space-y-4 text-[var(--slk-charcoal)]/80">
            {t.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
        <ContactTeaser locale="fr" />
      </main>
      <SlkFooter locale="fr" />
    </>
  );
}
