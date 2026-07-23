"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
import CtaBand from "@/components/home/CtaBand";
import BlogHeroGraphic from "@/components/pages/BlogHeroGraphic";
import { IconCheckCircle } from "@/components/ui/icons";
import { parseBlogDate, type BlogPost } from "@/lib/blogPosts";

const copy = {
  en: { backToBlog: "← Back to blog", minRead: "min read" },
  fr: { backToBlog: "← Retour au blogue", minRead: "min de lecture" },
};

export default function BlogPostContent({ post }: { post: BlogPost }) {
  const { locale } = useLanguage();
  const c = copy[locale];
  const p = post[locale];
  const dateFormatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <Link href="/blog" className="text-sm font-bold text-brand-blue hover:underline">
          {c.backToBlog}
        </Link>

        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-brand-green">
          {post.categoryTag[locale]}
        </p>
        <h1 className="mt-3 font-heading text-3xl font-extrabold text-brand-blue sm:text-4xl">
          {p.title}
        </h1>
        <p className="mt-4 text-sm text-charcoal/50">
          {dateFormatter.format(parseBlogDate(post.publishedAt))} · {post.readTimeMinutes} {c.minRead}
        </p>

        <div className="relative mt-8 h-64 w-full overflow-hidden rounded-3xl sm:h-80">
          {post.heroImage ? (
            <Image src={post.heroImage} alt={p.title} fill sizes="768px" className="object-cover" priority />
          ) : (
            <BlogHeroGraphic stat={post.heroStat.value} statLabel={post.heroStat.label[locale]} />
          )}
        </div>

        <div className="mt-10 space-y-6">
          {p.sections.map((section, i) => {
            if (section.type === "heading") {
              return (
                <h2 key={i} className="pt-4 font-heading text-2xl font-bold text-brand-blue">
                  {section.text}
                </h2>
              );
            }
            if (section.type === "paragraph") {
              return (
                <p key={i} className="text-base leading-relaxed text-charcoal/80">
                  {section.text}
                </p>
              );
            }
            if (section.type === "list") {
              return (
                <ul key={i} className="space-y-3">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-3">
                      <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                      <span className="text-base leading-relaxed text-charcoal/80">{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (section.type === "linkParagraph") {
              return (
                <p key={i} className="text-base leading-relaxed text-charcoal/80">
                  {section.text}{" "}
                  <Link href={section.href} className="font-bold text-brand-blue hover:underline">
                    {section.linkText}
                  </Link>
                </p>
              );
            }
            if (section.type === "timeline") {
              return (
                <div key={i} className="relative space-y-8 border-l-2 border-brand-blue-light pl-6">
                  {section.items.map((step, j) => (
                    <div key={j} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-green"
                      />
                      <p className="inline-block rounded-full bg-brand-blue px-3 py-1 font-heading text-xs font-bold text-white">
                        {step.time}
                      </p>
                      <p className="mt-2 text-base leading-relaxed text-charcoal/80">{step.text}</p>
                    </div>
                  ))}
                </div>
              );
            }
            // stats
            return (
              <div key={i} className="grid gap-4 sm:grid-cols-3">
                {section.items.map((stat, j) => (
                  <div
                    key={j}
                    className="rounded-2xl bg-brand-blue-light/40 p-5 text-center ring-1 ring-black/5"
                  >
                    <p className="font-heading text-3xl font-extrabold text-brand-blue">{stat.value}</p>
                    <p className="mt-1.5 text-xs leading-snug text-charcoal/70">{stat.label}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </article>

      <CtaBand />
    </>
  );
}
