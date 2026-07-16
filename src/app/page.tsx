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

export const metadata = buildMetadata({
  title: "Renovation & Water Damage Restoration in Laval & Montreal",
  description:
    "Interior renovations, flooring, kitchen & bath remodels, basement transformations, and water damage restoration for property managers, insurers, and homeowners across Laval and greater Montreal.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <ScrollBeforeAfter />
      <StatsBar />
      <TrustBar />
      <AudienceSections />
      <ServicesSection />
      <HowItWorks />
      <Testimonials />
      <PartnerLogos />
      <CtaBand />
    </>
  );
}
