"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
import BlogHeroGraphic from "@/components/pages/BlogHeroGraphic";
import { blogPosts, parseBlogDate } from "@/lib/blogPosts";

const copy = {
  en: {
    eyebrow: "Renovision AnA Blog",
    title: "Renovation Tips & Market Insights",
    intro:
      "Practical advice, prevention tips, and market context for property managers, insurers, and homeowners in Laval and Montreal.",
    readMore: "Read more →",
    minRead: "min read",
  },
  fr: {
    eyebrow: "Blogue de Renovision AnA",
    title: "Conseils de rénovation et tendances du marché",
    intro:
      "Des conseils pratiques, des recommandations de prévention et le contexte du marché pour les gestionnaires immobiliers, les assureurs et les propriétaires de Laval et Montréal.",
    readMore: "Lire la suite →",
    minRead: "min de lecture",
  },
};

export default function BlogContent() {
  const { locale } = useLanguage();
  const c = copy[locale];
  const dateFormatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-green">{c.eyebrow}</p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
          {c.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{c.intro}</p>
      </div>

      <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => {
          const p = post[locale];
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
            >
              <div className="relative h-48 w-full overflow-hidden">
                {post.heroImage ? (
                  <Image
                    src={post.heroImage}
                    alt={p.title}
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
                    <BlogHeroGraphic
                      stat={post.heroStat.value}
                      statLabel={post.heroStat.label[locale]}
                      compact
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  {post.categoryTag[locale]}
                </p>
                <h2 className="mt-2 font-heading text-lg font-bold text-brand-blue">{p.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-charcoal/75">{p.excerpt}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-charcoal/50">
                  <span>
                    {dateFormatter.format(parseBlogDate(post.publishedAt))} · {post.readTimeMinutes}{" "}
                    {c.minRead}
                  </span>
                  <span className="font-bold text-brand-blue">{c.readMore}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
