import { SITE_URL, getPosts } from "@/lib/blog"
import { getMessages } from "@/lib/i18n"

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** /blog/rss.xml: every article, both languages, newest first. */
export async function GET() {
  const t = getMessages("fr")
  const items = (await getPosts())
    .map(
      (post) => `    <item>
      <title>${escape(post.title)}</title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid>${SITE_URL}/blog/${post.slug}</guid>
      <description>${escape(post.description)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
${(post.tags ?? []).map((tag) => `      <category>${escape(tag)}</category>`).join("\n")}
    </item>`
    )
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(t.blog.metaTitle(t.brand))}</title>
    <link>${SITE_URL}/blog</link>
    <description>${escape(t.blog.description)}</description>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } })
}
