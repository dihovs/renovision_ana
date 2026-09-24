import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { PageIntro, ServicesGrid, ExpectStrip, ContactTeaser } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.fr.nav.services };

export default function SlkServicesFr() {
  const t = copy.fr.servicesIntro;
  return (
    <>
      <SlkHeader locale="fr" path="/slk/services" />
      <main className="flex-1">
        <PageIntro eyebrow={t.eyebrow} title={t.title} intro={t.subtitle} />
        <ServicesGrid locale="fr" showIntro={false} />
        <ExpectStrip locale="fr" />
        <ContactTeaser locale="fr" />
      </main>
      <SlkFooter locale="fr" />
    </>
  );
}
