import ScrollBeforeAfter from "@/components/home/ScrollBeforeAfter";
import StatsBar from "@/components/home/StatsBar";
import TrustBar from "@/components/home/TrustBar";
import AudienceSections from "@/components/home/AudienceSections";
import ServicesSection from "@/components/home/ServicesSection";
import HowItWorks from "@/components/home/HowItWorks";
import Testimonials from "@/components/home/Testimonials";
import PartnerLogos from "@/components/home/PartnerLogos";
import CtaBand from "@/components/home/CtaBand";
import { buildMetadata } from "@/lib/seo";
import { getGoogleReviewsData } from "@/lib/googleReviews";

export const metadata = buildMetadata({
  title: "Renovation & Water Damage Restoration in Laval & Montreal",
  description:
    "Interior renovations, flooring, kitchen & bath remodels, basement transformations, and water damage restoration for property managers, insurers, and homeowners across Laval and greater Montreal.",
  path: "/",
});

export default async function Home() {
  const reviews = await getGoogleReviewsData();

  return (
    <>
      <ScrollBeforeAfter overallRating={reviews.overallRating} reviewCount={reviews.reviewCount} />
      <StatsBar />
      <Testimonials
        liveReviews={reviews.items}
        overallRating={reviews.overallRating}
        reviewCount={reviews.reviewCount}
      />
      <TrustBar />
      <AudienceSections />
      <ServicesSection />
      <HowItWorks />
      <PartnerLogos />
      <CtaBand />
    </>
  );
}
