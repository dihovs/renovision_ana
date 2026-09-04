import HeroBanner from "@/components/home/HeroBanner";
import ScrollBeforeAfter from "@/components/home/ScrollBeforeAfter";
import StatsBar from "@/components/home/StatsBar";
import TrustBar from "@/components/home/TrustBar";
import AudienceSections from "@/components/home/AudienceSections";
import ServicesSection from "@/components/home/ServicesSection";
import HowItWorks from "@/components/home/HowItWorks";
import AuthorityBadges from "@/components/home/AuthorityBadges";
import Testimonials from "@/components/home/Testimonials";
import PartnerLogos from "@/components/home/PartnerLogos";
import TechAdvantage from "@/components/home/TechAdvantage";
import AppNarrative from "@/components/home/AppNarrative";
import CtaBand from "@/components/home/CtaBand";
import { localizedMetadata } from "@/lib/seo";
import { getGoogleReviewsData } from "@/lib/googleReviews";

export const generateMetadata = localizedMetadata({
  path: "/",
  fr: {
    title: "Rénovation et dégât d'eau à Laval et Montréal",
    description:
      "Rénovations intérieures, planchers, cuisines et salles de bain, sous-sols et restauration après dégât d'eau à Laval et Montréal. Soumission gratuite et rapide.",
  },
  en: {
    title: "Renovation & Water Damage Restoration in Laval & Montreal",
    description:
      "Interior renovations, flooring, kitchens and baths, basements, and water damage restoration across Laval and greater Montreal. Fast, free estimates.",
  },
});

export default async function Home() {
  const reviews = await getGoogleReviewsData();

  return (
    <>
      <HeroBanner overallRating={reviews.overallRating} reviewCount={reviews.reviewCount} />
      <StatsBar />
      <ScrollBeforeAfter />
      {/* Authority signals first for B2B (property managers, insurers, brokers):
          certifications speak louder than testimonials to commercial buyers.
          Reviews follow for B2C — each segment sees its signal without scrolling
          past content meant for the other. */}
      <AuthorityBadges />
      <Testimonials
        liveReviews={reviews.items}
        overallRating={reviews.overallRating}
        reviewCount={reviews.reviewCount}
      />
      <TrustBar />
      <AudienceSections />
      <ServicesSection />
      <HowItWorks />
      <TechAdvantage />
      <AppNarrative />
      <PartnerLogos />
      <CtaBand />
    </>
  );
}
