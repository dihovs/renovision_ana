import CareersContent from "@/components/pages/CareersContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Careers",
  description:
    "Join the Renovision AnA team. We're hiring renovation carpenters, flooring installers, painters, drywall finishers, and apprentices.",
  path: "/careers",
});

export default function CareersPage() {
  return <CareersContent />;
}
