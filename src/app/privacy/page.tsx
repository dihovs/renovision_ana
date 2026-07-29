import PrivacyContent from "@/components/pages/PrivacyContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "What personal information Renovision AnA collects, why, who it is shared with, how long it is kept, and how to access, correct or delete it.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <PrivacyContent />;
}
