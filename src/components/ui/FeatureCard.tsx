import Link from "next/link";
import type { ComponentType } from "react";

type FeatureCardProps = {
  icon: ComponentType;
  title: string;
  desc: string;
  href?: string;
  footer?: string;
  headingLevel?: "h2" | "h3";
};

export default function FeatureCard({
  icon: Icon,
  title,
  desc,
  href,
  footer,
  headingLevel: Heading = "h3",
}: FeatureCardProps) {
  const content = (
    <>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green-light text-brand-green">
        <Icon />
      </div>
      <Heading className="mt-5 font-heading text-lg font-bold text-brand-blue">{title}</Heading>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-charcoal/75">{desc}</p>
      {footer && (
        <span className="mt-4 text-sm font-bold text-brand-green group-hover:text-brand-green-dark">
          {footer}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group flex flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-lg"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
      {content}
    </div>
  );
}
