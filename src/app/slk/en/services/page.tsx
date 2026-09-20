import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { ServicesGrid, ContactTeaser } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.en.nav.services };

export default function SlkServicesEn() {
  return (
    <>
      <SlkHeader locale="en" path="/slk/en/services" />
      <main className="flex-1">
        <ServicesGrid locale="en" />
        <ContactTeaser locale="en" />
      </main>
      <SlkFooter locale="en" />
    </>
  );
}
