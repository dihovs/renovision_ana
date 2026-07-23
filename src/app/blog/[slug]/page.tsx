import { notFound } from "next/navigation";
import BlogPostContent from "@/components/pages/BlogPostContent";
import { buildMetadata } from "@/lib/seo";
import { blogPosts, getBlogPost } from "@/lib/blogPosts";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return buildMetadata({ title: "Blog", description: "Renovision AnA blog.", path: "/blog" });

  return buildMetadata({
    title: post.en.title,
    description: post.en.metaDescription,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return <BlogPostContent post={post} />;
}
