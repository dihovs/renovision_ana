import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import {
  Hero,
  ServicesGrid,
  SignatureSpotlight,
  ResultsGallery,
  AboutTeaser,
  ContactTeaser,
} from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export const metadata: Metadata = {
  title: copy.fr.meta.title,
  description: copy.fr.meta.description,
};

export default function SlkHomeFr() {
  return (
    <>
      <SlkHeader locale="fr" path="/slk" />
      <main className="flex-1">
        <Hero locale="fr" />
        <ServicesGrid locale="fr" />
        <SignatureSpotlight locale="fr" />
        <ResultsGallery locale="fr" />
        <AboutTeaser locale="fr" />
        <ContactTeaser locale="fr" />
      </main>
      <SlkFooter locale="fr" />
    </>
  );
}
