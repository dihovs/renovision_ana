import type { Metadata } from "next";
import CommercialContent from "@/components/pages/CommercialContent";

export const metadata: Metadata = {
  title: "Commercial & Property Management",
  description:
    "Renovation services for property management companies: fast unit turnovers, clear documentation, one point of contact, and 24/7 emergency response.",
};

export default function CommercialPage() {
  return <CommercialContent />;
}
