import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { ServicesGrid, ContactTeaser } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.fr.nav.services };

export default function SlkServicesFr() {
  return (
    <>
      <SlkHeader locale="fr" path="/slk/services" />
      <main className="flex-1">
        <ServicesGrid locale="fr" />
        <ContactTeaser locale="fr" />
      </main>
      <SlkFooter locale="fr" />
    </>
  );
}
