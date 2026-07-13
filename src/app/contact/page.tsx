import type { Metadata } from "next";
import { SITE_EMAIL, SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Renovision AnA for a renovation, water damage restoration, or remodeling estimate.",
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <h1 className="font-heading text-4xl font-extrabold text-brand-blue">Contact Us</h1>
      <p className="mt-4 text-lg text-charcoal/70">
        Reach out for a renovation, water damage restoration, or remodeling estimate.
      </p>
      <div className="mt-8 flex flex-col items-center gap-2 text-lg font-semibold text-brand-blue">
        <a href={`tel:${SITE_PHONE_TEL}`} className="hover:underline">
          {SITE_PHONE}
        </a>
        <a href={`mailto:${SITE_EMAIL}`} className="hover:underline">
          {SITE_EMAIL}
        </a>
      </div>
      <p className="mt-8 inline-block rounded-full bg-brand-blue-light px-4 py-1.5 text-sm font-semibold text-brand-blue">
        Contact form coming soon — use the chat widget for an instant estimate
      </p>
    </section>
  );
}
