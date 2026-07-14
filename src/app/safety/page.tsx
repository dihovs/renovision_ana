import type { Metadata } from "next";
import SafetyContent from "@/components/pages/SafetyContent";

export const metadata: Metadata = {
  title: "Safety & Certifications",
  description:
    "Renovision AnA is licensed and insured with safety-trained crews, documented compliance, and insurance claims experience. Certificates available on request.",
};

export default function SafetyPage() {
  return <SafetyContent />;
}
