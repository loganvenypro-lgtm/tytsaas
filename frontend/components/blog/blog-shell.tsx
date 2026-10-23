import Link from "next/link"

import { ReturbeMark } from "@/components/returbe-logo"
import { getT } from "@/lib/i18n/server"

// Header and footer of the public blog: white and quiet, so the articles carry the page

function Wordmark({ brand, blog }: { brand: string; blog: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/welcome" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
        <ReturbeMark className="size-6" />
        <span className="text-[17px] font-bold tracking-tight">{brand}</span>
      </Link>
      <span aria-hidden className="h-5 w-px rotate-12 bg-slate-300" />
      <Link href="/blog" className="text-[17px] font-medium tracking-tight text-slate-500 transition-colors hover:text-slate-950">
        {blog}
      </Link>
    </div>
  )
}

export async function BlogShell({ children }: { children: React.ReactNode }) {
  const t = await getT()
  const nav = t.landing.nav

  return (
    <div className="lp-root relative flex min-h-screen flex-col overflow-x-clip bg-white text-slate-900 selection:bg-blue-200">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark brand={t.brand} blog={t.blog.title} />
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 sm:block">
              {nav.signIn}
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {nav.start}
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-slate-200 bg-slate-50/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-[1fr_auto] sm:px-6">
          <div className="max-w-sm">
            <Link href="/welcome" className="inline-flex items-center gap-2.5">
              <ReturbeMark className="size-8" />
              <span className="text-xl font-bold tracking-tight">{t.brand}</span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-slate-500">{t.blog.description}</p>
          </div>
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-slate-600 sm:flex-col sm:items-end">
            <li><Link href="/welcome" className="hover:text-slate-950">{t.blog.product}</Link></li>
            <li><Link href="/blog" className="hover:text-slate-950">{t.blog.title}</Link></li>
            <li><a href="/blog/rss.xml" className="hover:text-slate-950">{t.blog.rss}</a></li>
            <li><Link href="/login" className="hover:text-slate-950">{nav.signIn}</Link></li>
          </ul>
        </div>
        <div className="border-t border-slate-200">
          <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-400 sm:px-6">
            {t.landing.footer.rights(new Date().getFullYear(), t.brand)}
          </p>
        </div>
      </footer>
    </div>
  )
}
