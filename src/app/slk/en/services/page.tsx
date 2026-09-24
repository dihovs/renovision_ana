import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { PageIntro, ServicesGrid, ExpectStrip, ContactTeaser } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.en.nav.services };

export default function SlkServicesEn() {
  const t = copy.en.servicesIntro;
  return (
    <>
      <SlkHeader locale="en" path="/slk/en/services" />
      <main className="flex-1">
        <PageIntro eyebrow={t.eyebrow} title={t.title} intro={t.subtitle} />
        <ServicesGrid locale="en" showIntro={false} />
        <ExpectStrip locale="en" />
        <ContactTeaser locale="en" />
      </main>
      <SlkFooter locale="en" />
    </>
  );
}
