import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { cache } from "react"
import GithubSlugger from "github-slugger"

import type { Locale } from "@/lib/i18n"

// Articles live in content/blog/<slug>.mdx and export their own `meta`:
//   export const meta = { title, description, date: "2026-10-23", lang: "fr", tags: [...], translation: "<slug>" }
// `translation` links the same article in the other language (hreflang + language switch).

export interface PostMeta {
  title: string
  description: string
  /** ISO date, YYYY-MM-DD */
  date: string
  lang: Locale
  tags?: string[]
  author?: string
  /** Cover image (path under /public or absolute URL) */
  image?: string
  /** Slug of the same article in the other language */
  translation?: string
  draft?: boolean
}

export interface Post extends PostMeta {
  slug: string
  /** Section headings (##), with the ids rehype-slug gives them, for the table of contents */
  headings: { id: string; text: string }[]
  /** Rough reading time, in minutes */
  readingTime: number
}

const CONTENT_DIR = path.join(process.cwd(), "content", "blog")

async function loadModule(slug: string) {
  return (await import(`@/content/blog/${slug}.mdx`)) as { default: React.ComponentType; meta: PostMeta }
}

/** Every published article, newest first. */
export const getPosts = cache(async (): Promise<Post[]> => {
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith(".mdx"))
  const posts = await Promise.all(
    files.map(async (file) => {
      const slug = file.slice(0, -4)
      const { meta } = await loadModule(slug)
      const source = await readFile(path.join(CONTENT_DIR, file), "utf8")
      return { ...meta, slug, headings: headingsOf(source), readingTime: Math.max(1, Math.round(source.split(/\s+/).length / 220)) }
    })
  )
  return posts
    .filter((p) => !p.draft || process.env.NODE_ENV === "development")
    .sort((a, b) => b.date.localeCompare(a.date))
})

export async function getPost(slug: string) {
  const post = (await getPosts()).find((p) => p.slug === slug)
  if (!post) return null
  const { default: Content } = await loadModule(slug)
  return { post, Content }
}

// Absolute URLs for the sitemap, RSS and canonical links; set it in production
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

function headingsOf(source: string) {
  const slugger = new GithubSlugger()
  return [...source.matchAll(/^## (.+)$/gm)].map(([, raw]) => {
    const text = raw.replace(/[*_`]/g, "").trim()
    return { id: slugger.slug(text), text }
  })
}
