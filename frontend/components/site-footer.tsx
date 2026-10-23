"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { useI18n } from "@/components/i18n-provider"
import { ReturbeMark } from "@/components/returbe-logo"
import { LOCALES, saveLocale } from "@/lib/i18n"
import { GOOGLE_PRIVACY_URL, LEGAL, YOUTUBE_TERMS_URL } from "@/lib/legal"
import { cn } from "@/lib/utils"

/** Footer of every public page (landing, blog, legal): links, language, and the YouTube API notice. */
export function SiteFooter() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.siteFooter

  const columns = [
    {
      title: f.product,
      links: [
        { href: "/welcome#features", label: f.features },
        { href: "/welcome#method", label: f.method },
        { href: "/welcome#faq", label: f.faq },
        { href: "/signup", label: f.signUp },
        { href: "/login", label: f.signIn },
      ],
    },
    { title: f.resources, links: [{ href: "/blog", label: f.blog }] },
    {
      title: f.legal,
      links: [
        { href: "/terms", label: f.terms },
        { href: "/privacy", label: f.privacy },
        { href: "/legal-notice", label: f.notice },
      ],
    },
  ]

  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-12 sm:px-6 lg:grid-cols-[1.4fr_2fr]">
        <div className="max-w-xs">
          <Link href="/welcome" className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
            <ReturbeMark className="size-7" />
            <span className="text-lg font-bold tracking-tight">{t.brand}</span>
          </Link>
          <p className="mt-4 text-sm leading-6 text-white/55">{f.tagline}</p>

          <div className="mt-6 inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10" role="group" aria-label={f.language}>
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={l === locale}
                onClick={() => {
                  saveLocale(l)
                  router.refresh()
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors",
                  l === locale ? "bg-white text-slate-950" : "text-white/60 hover:text-white"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/55 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs leading-5 text-white/40 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-1">
            <p className="font-medium text-white/70">© {new Date().getFullYear()} {t.brand}</p>
            <p>
              {f.youtubeBefore}{" "}
              <a href={YOUTUBE_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                {f.youtubeTerms}
              </a>{" "}
              {f.youtubeAnd}{" "}
              <a href={GOOGLE_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                {f.googlePrivacy}
              </a>
              . {f.notAffiliated}
            </p>
          </div>
          <a href={`mailto:${LEGAL.email}`} className="shrink-0 text-sm text-white/55 hover:text-white">
            {LEGAL.email}
          </a>
        </div>
      </div>
    </footer>
  )
}
