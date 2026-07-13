import ScrollBeforeAfter from "@/components/home/ScrollBeforeAfter";
import TrustBar from "@/components/home/TrustBar";
import AudienceSections from "@/components/home/AudienceSections";
import ServicesSection from "@/components/home/ServicesSection";
import HowItWorks from "@/components/home/HowItWorks";
import Testimonials from "@/components/home/Testimonials";
import PartnerLogos from "@/components/home/PartnerLogos";

export default function Home() {
  return (
    <>
      <ScrollBeforeAfter />
      <TrustBar />
      <AudienceSections />
      <ServicesSection />
      <HowItWorks />
      <Testimonials />
      <PartnerLogos />
    </>
  );
}
