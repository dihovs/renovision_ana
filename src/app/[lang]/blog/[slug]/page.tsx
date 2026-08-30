import { notFound } from "next/navigation";
import BlogPostContent from "@/components/pages/BlogPostContent";
import { HOME_LABEL, breadcrumbJsonLd, buildMetadata, localeUrl } from "@/lib/seo";
import { blogPosts, getBlogPost } from "@/lib/blogPosts";
import { HREFLANG, toLocale } from "@/i18n/routing";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = toLocale(lang);
  const post = getBlogPost(slug);
  if (!post) {
    return buildMetadata({
      locale,
      title: locale === "fr" ? "Blogue" : "Blog",
      description:
        locale === "fr"
          ? "Le blogue de Renovision AnA — conseils rénovation et dégât d'eau."
          : "Renovation tips, water damage prevention advice, and project stories from Renovision AnA.",
      path: "/blog",
    });
  }

  // Metadata in the language of the article the crawler actually receives.
  // Both halves have always existed in blogPosts.ts; until the route split
  // only the French half had a URL to attach to.
  // Compact metaTitle for the SERP; the full editorial title stays as the H1.
  return buildMetadata({
    locale,
    title: post[locale].metaTitle,
    description: post[locale].metaDescription,
    path: `/blog/${post.slug}`,
    // Same source date as the BlogPosting JSON-LD on this page — the two must
    // never disagree or crawlers pick one at random.
    article: { publishedTime: post.publishedAt },
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = toLocale(lang);
  const post = getBlogPost(slug);
  if (!post) notFound();

  // BlogPosting authored by the organization (no individual bylines on these
  // posts), plus a breadcrumb trail — both in the served language, so
  // `inLanguage` and the headline agree with the copy on the page.
  const copy = post[locale];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: copy.title,
        description: copy.metaDescription,
        datePublished: post.publishedAt,
        inLanguage: HREFLANG[locale],
        mainEntityOfPage: localeUrl(locale, `/blog/${post.slug}`),
        url: localeUrl(locale, `/blog/${post.slug}`),
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#business` },
        ...(post.heroImage ? { image: `${SITE_URL}${post.heroImage}` } : {}),
      },
      breadcrumbJsonLd(locale, [
        { name: HOME_LABEL[locale], path: "/" },
        { name: locale === "fr" ? "Blogue" : "Blog", path: "/blog" },
        { name: copy.title, path: `/blog/${post.slug}` },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostContent post={post} />
    </>
  );
}
