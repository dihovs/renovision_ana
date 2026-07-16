import KitchenBathContent from "@/components/pages/KitchenBathContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Kitchen & Bath Remodeling",
  description:
    "Modern, functional kitchen and bathroom remodels tailored to your budget and style, by Renovision AnA.",
  path: "/services/kitchen-bath",
});

export default function KitchenBathPage() {
  return <KitchenBathContent />;
}
