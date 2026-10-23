import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Rss } from "lucide-react"

import { BlogShell } from "@/components/blog/blog-shell"
import { PostCover } from "@/components/blog/post-cover"
import { SITE_URL, getPosts, type Post } from "@/lib/blog"
import { createFormatters, getMessages, isLocale, type Locale } from "@/lib/i18n"
import { getLocale, getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

type SearchParams = Promise<{ lang?: string; tag?: string }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t.blog.metaTitle(t.brand),
    description: t.blog.description,
    alternates: { canonical: `${SITE_URL}/blog`, types: { "application/rss+xml": `${SITE_URL}/blog/rss.xml` } },
  }
}

/** /blog: the articles in the reader's language (?lang= to switch), filterable by tag. */
export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  const { lang, tag } = await searchParams
  const locale = isLocale(lang) ? lang : await getLocale()
  const t = getMessages(locale)
  const inLocale = (await getPosts()).filter((p) => p.lang === locale)
  const tags = [...new Set(inLocale.flatMap((p) => p.tags ?? []))].sort()
  const posts = tag ? inLocale.filter((p) => p.tags?.includes(tag)) : inLocale
  const [featured, ...rest] = posts
  const href = (next: { tag?: string }) => {
    const params = new URLSearchParams()
    if (lang) params.set("lang", locale)
    if (next.tag) params.set("tag", next.tag)
    return params.size ? `/blog?${params}` : "/blog"
  }

  return (
    <BlogShell>
      <main className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
        <section className="pt-16 pb-10 sm:pt-24">
          <h1 className="max-w-4xl text-5xl leading-[1.02] font-semibold tracking-[-0.045em] text-balance text-slate-950 sm:text-7xl">
            {t.blog.heading}
          </h1>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xl text-lg leading-8 text-pretty text-slate-500">{t.blog.subheading}</p>
            <a href="/blog/rss.xml" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-950">
              <Rss className="size-4" /> {t.blog.rss}
            </a>
          </div>
        </section>

        {tags.length > 0 && (
          <nav aria-label="Tags" className="-mx-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none]! border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-6">
              {[undefined, ...tags].map((value) => (
                <li key={value ?? "all"}>
                  <Link
                    href={href({ tag: value })}
                    aria-current={tag === value ? "page" : undefined}
                    className={cn(
                      "-mb-px block border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                      tag === value ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-950"
                    )}
                  >
                    {value ?? t.blog.all}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {!featured ? (
          <p className="py-24 text-slate-500">{t.blog.empty}</p>
        ) : (
          <>
            <FeaturedPost post={featured} locale={locale} />
            {rest.length > 0 && (
              <ul className="mt-8 border-t border-slate-200">
                {rest.map((post) => (
                  <PostRow key={post.slug} post={post} locale={locale} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </BlogShell>
  )
}

function PostMetaLine({ post, locale }: { post: Post; locale: Locale }) {
  const t = getMessages(locale)
  const format = createFormatters(locale)
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
      <time dateTime={post.date}>{format.date(post.date, { day: "numeric", month: "long", year: "numeric" })}</time>
      <span>{t.blog.readingTime(post.readingTime)}</span>
    </p>
  )
}

function FeaturedPost({ post, locale }: { post: Post; locale: Locale }) {
  const t = getMessages(locale)
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group mt-10 grid items-center gap-8 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-blue-600 md:grid-cols-[1.15fr_1fr] md:gap-12"
    >
      <PostCover post={post} className="transition-transform duration-500 group-hover:scale-[1.01]" />
      <div>
        <PostMetaLine post={post} locale={locale} />
        <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance text-slate-950 sm:text-4xl">
          {post.title}
        </h2>
        <p className="mt-4 text-lg leading-8 text-pretty text-slate-500">{post.description}</p>
        <span className="mt-7 inline-flex items-center gap-1 text-sm font-semibold text-slate-950">
          {t.blog.readMore}
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  )
}

function PostRow({ post, locale }: { post: Post; locale: Locale }) {
  return (
    <li className="border-b border-slate-200">
      <Link href={`/blog/${post.slug}`} className="group grid gap-3 py-8 sm:grid-cols-[13rem_1fr] sm:gap-10">
        <PostMetaLine post={post} locale={locale} />
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance text-slate-950 group-hover:text-blue-700">{post.title}</h2>
          <p className="mt-2 max-w-2xl leading-7 text-pretty text-slate-500">{post.description}</p>
        </div>
      </Link>
    </li>
  )
}
