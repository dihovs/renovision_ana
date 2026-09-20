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
  title: copy.en.meta.title,
  description: copy.en.meta.description,
};

export default function SlkHomeEn() {
  return (
    <>
      <SlkHeader locale="en" path="/slk/en" />
      <main className="flex-1">
        <Hero locale="en" />
        <ServicesGrid locale="en" />
        <SignatureSpotlight locale="en" />
        <ResultsGallery locale="en" />
        <AboutTeaser locale="en" />
        <ContactTeaser locale="en" />
      </main>
      <SlkFooter locale="en" />
    </>
  );
}
