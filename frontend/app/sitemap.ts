import type { MetadataRoute } from "next"

import { SITE_URL, getPosts } from "@/lib/blog"

/** /sitemap.xml: the public pages and every blog article, with its translation. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()
  return [
    { url: `${SITE_URL}/welcome`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      alternates: post.translation
        ? { languages: { [post.lang === "fr" ? "en" : "fr"]: `${SITE_URL}/blog/${post.translation}` } }
        : undefined,
    })),
  ]
}
