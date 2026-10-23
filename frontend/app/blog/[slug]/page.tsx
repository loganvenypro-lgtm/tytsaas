import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Languages } from "lucide-react"

import { BlogShell } from "@/components/blog/blog-shell"
import { ReadingProgress, TableOfContents } from "@/components/blog/article-chrome"
import { PostCover } from "@/components/blog/post-cover"
import { SITE_URL, getPost, getPosts } from "@/lib/blog"
import { createFormatters, getMessages } from "@/lib/i18n"

type Params = Promise<{ slug: string }>

export async function generateStaticParams() {
  return (await getPosts()).map((p) => ({ slug: p.slug }))
}

// Only the files in content/blog exist
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getPost((await params).slug)
  if (!found) return {}
  const { post } = found
  const url = `${SITE_URL}/blog/${post.slug}`
  return {
    title: `${post.title} · ${getMessages(post.lang).brand}`,
    description: post.description,
    authors: post.author ? [{ name: post.author }] : undefined,
    alternates: {
      canonical: url,
      languages: post.translation ? { [post.lang]: url, [post.lang === "fr" ? "en" : "fr"]: `${SITE_URL}/blog/${post.translation}` } : undefined,
    },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      tags: post.tags,
      locale: post.lang === "fr" ? "fr_FR" : "en_US",
      images: post.image ? [post.image] : undefined,
    },
  }
}

/** /blog/<slug>: one article, in the language it was written in. */
export default async function BlogPostPage({ params }: { params: Params }) {
  const found = await getPost((await params).slug)
  if (!found) notFound()
  const { post, Content } = found
  const t = getMessages(post.lang)
  const format = createFormatters(post.lang)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    inLanguage: post.lang,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": post.author ? "Person" : "Organization", name: post.author ?? t.brand },
    image: post.image,
  }

  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />
      <ReadingProgress />
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-28 sm:px-6">
        <Link href={`/blog?lang=${post.lang}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-950">
          <ArrowLeft className="size-4" /> {t.blog.back}
        </Link>

        <header className="mt-10 max-w-4xl">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <time dateTime={post.date}>{format.date(post.date, { day: "numeric", month: "long", year: "numeric" })}</time>
            <span>{t.blog.readingTime(post.readingTime)}</span>
            {post.author && <span>{post.author}</span>}
          </p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance text-slate-950 sm:text-6xl">{post.title}</h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-pretty text-slate-500">{post.description}</p>
        </header>

        <PostCover post={post} className="mt-12 aspect-[21/9]" />

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-20">
          <article lang={post.lang} className="max-w-[680px] min-w-0">
            <Content />
          </article>

          <aside className="order-first lg:order-none">
            <div className="space-y-8 lg:sticky lg:top-28">
              <div className="hidden lg:block">
                <TableOfContents title={t.blog.onThisPage} headings={post.headings} />
              </div>
              {post.tags && post.tags.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <li key={tag}>
                      <Link
                        href={`/blog?lang=${post.lang}&tag=${encodeURIComponent(tag)}`}
                        className="block rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-950 hover:text-slate-950"
                      >
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {post.translation && (
                <Link
                  href={`/blog/${post.translation}`}
                  hrefLang={post.lang === "fr" ? "en" : "fr"}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
                >
                  <Languages className="size-4" /> {t.blog.otherLanguage}
                </Link>
              )}
            </div>
          </aside>
        </div>
      </div>
    </BlogShell>
  )
}
