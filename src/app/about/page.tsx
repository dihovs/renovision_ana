import AboutContent from "@/components/pages/AboutContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "About Us",
  description:
    "Learn about Renovision AnA, our team, and our commitment to quality renovation and water damage restoration work in Laval and greater Montreal.",
  path: "/about",
});

export default function AboutPage() {
  return <AboutContent />;
}
