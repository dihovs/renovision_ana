import { notFound } from "next/navigation";
import BlogPostContent from "@/components/pages/BlogPostContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { blogPosts, getBlogPost } from "@/lib/blogPosts";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) {
    return buildMetadata({
      title: "Blogue",
      description: "Le blogue de Renovision AnA — conseils rénovation et dégât d'eau.",
      path: "/blog",
    });
  }

  // French metadata to match the French article the crawler actually receives
  // (SSR default is fr). The article content itself is untouched — both
  // languages still render through the client i18n toggle.
  return buildMetadata({
    title: post.fr.title,
    description: post.fr.metaDescription,
    path: `/blog/${post.slug}`,
    // Same source date as the BlogPosting JSON-LD below — the two must never
    // disagree or crawlers pick one at random.
    article: { publishedTime: post.publishedAt },
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  // BlogPosting authored by the organization (no individual bylines on these
  // posts), plus a French breadcrumb trail. French strings throughout, to
  // match the served page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.fr.title,
        description: post.fr.metaDescription,
        datePublished: post.publishedAt,
        inLanguage: "fr-CA",
        mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
        url: `${SITE_URL}/blog/${post.slug}`,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#business` },
        ...(post.heroImage ? { image: `${SITE_URL}${post.heroImage}` } : {}),
      },
      breadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Blogue", path: "/blog" },
        { name: post.fr.title, path: `/blog/${post.slug}` },
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
