import BasementsContent from "@/components/pages/BasementsContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Basement Transformations",
  description:
    "Full basement transformations from unfinished space to beautiful, livable rooms by Renovision AnA.",
  path: "/services/basements",
});

export default function BasementsPage() {
  return <BasementsContent />;
}
