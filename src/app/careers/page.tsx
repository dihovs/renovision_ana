import type { Metadata } from "next";
import CareersContent from "@/components/pages/CareersContent";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the Renovision AnA team. We're hiring renovation carpenters, flooring installers, painters, drywall finishers, and apprentices.",
};

export default function CareersPage() {
  return <CareersContent />;
}
