import SafetyContent from "@/components/pages/SafetyContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Safety & Certifications",
  description:
    "Renovision AnA is licensed and insured with safety-trained crews, documented compliance, and insurance claims experience. Certificates available on request.",
  path: "/safety",
});

export default function SafetyPage() {
  return <SafetyContent />;
}
