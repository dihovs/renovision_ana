import ContactContent from "@/components/pages/ContactContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Contact",
  description:
    "Get in touch with Renovision AnA for a renovation, water damage restoration, or remodeling estimate in Laval and greater Montreal.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactContent />;
}
