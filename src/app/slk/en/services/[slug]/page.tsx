import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { ServiceDetail } from "@/components/slk/sections";
import { copy } from "@/content/slk/copy";

export function generateStaticParams() {
  return copy.en.services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = copy.en.services.find((s) => s.slug === slug);
  return { title: service?.title ?? copy.en.nav.services };
}

export default async function SlkServiceDetailEn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!copy.en.services.some((s) => s.slug === slug)) notFound();
  return (
    <>
      <SlkHeader locale="en" path={`/slk/en/services/${slug}`} />
      <main className="flex-1">
        <ServiceDetail locale="en" slug={slug} />
      </main>
      <SlkFooter locale="en" />
    </>
  );
}
