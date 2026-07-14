import type { Metadata } from "next";
import CaseStudiesContent from "@/components/pages/CaseStudiesContent";

export const metadata: Metadata = {
  title: "Featured Project Case Studies",
  description:
    "Before/after project breakdowns from Renovision AnA: the problem we found, the solution we delivered, and the result for the client.",
};

export default function CaseStudiesPage() {
  return <CaseStudiesContent />;
}
