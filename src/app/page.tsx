import ScrollBeforeAfter from "@/components/home/ScrollBeforeAfter";
import StatsBar from "@/components/home/StatsBar";
import TrustBar from "@/components/home/TrustBar";
import AudienceSections from "@/components/home/AudienceSections";
import ServicesSection from "@/components/home/ServicesSection";
import HowItWorks from "@/components/home/HowItWorks";
import Testimonials from "@/components/home/Testimonials";
import PartnerLogos from "@/components/home/PartnerLogos";
import CtaBand from "@/components/home/CtaBand";

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
