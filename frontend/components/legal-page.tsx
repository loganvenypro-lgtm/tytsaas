import type { Metadata } from "next"
import Link from "next/link"

import { BlogShell } from "@/components/blog/blog-shell"
import { SITE_URL } from "@/lib/blog"
import { getLocale, getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

// Terms, privacy and legal notice: MDX in content/legal/<doc>.<locale>.mdx, shown in the reader's language
export const LEGAL_DOCS = ["terms", "privacy", "legal-notice"] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

async function load(doc: LegalDoc) {
  const locale = await getLocale()
  return (await import(`@/content/legal/${doc}.${locale}.mdx`)) as { default: React.ComponentType; meta: { title: string } }
}

export async function legalMetadata(doc: LegalDoc): Promise<Metadata> {
  const [{ meta }, t] = await Promise.all([load(doc), getT()])
  return { title: `${meta.title} · ${t.brand}`, alternates: { canonical: `${SITE_URL}/${doc}` } }
}

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const [{ default: Content, meta }, t] = await Promise.all([load(doc), getT()])
  const f = t.siteFooter
  const tabs: { doc: LegalDoc; label: string }[] = [
    { doc: "terms", label: f.terms },
    { doc: "privacy", label: f.privacy },
    { doc: "legal-notice", label: f.notice },
  ]

  return (
    <BlogShell section={{ label: f.legal, href: "/terms" }}>
      <main className="mx-auto max-w-6xl px-4 pt-14 pb-28 sm:px-6">
        <nav aria-label={f.legal} className="-mx-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none]! border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-6">
            {tabs.map((tab) => (
              <li key={tab.doc}>
                <Link
                  href={`/${tab.doc}`}
                  aria-current={tab.doc === doc ? "page" : undefined}
                  className={cn(
                    "-mb-px block border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                    tab.doc === doc ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-950"
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Links written as JSX in the MDX (to use LEGAL values) skip the MDX components: style them here */}
        <article className="max-w-[680px] pt-12 [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_a]:decoration-blue-600/30 [&_a]:underline-offset-4 hover:[&_a]:decoration-blue-600">

          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 sm:text-5xl">{meta.title}</h1>
          <Content />
        </article>
      </main>
    </BlogShell>
  )
}
