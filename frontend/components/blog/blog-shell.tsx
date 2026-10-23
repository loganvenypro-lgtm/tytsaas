import Link from "next/link"

import { ReturbeMark } from "@/components/returbe-logo"
import { SiteFooter } from "@/components/site-footer"
import { getT } from "@/lib/i18n/server"

// Header and footer of the public pages (blog, legal): white and quiet, so the text carries the page

function Wordmark({ brand, section }: { brand: string; section?: { label: string; href: string } }) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/welcome" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
        <ReturbeMark className="size-6" />
        <span className="text-[17px] font-bold tracking-tight">{brand}</span>
      </Link>
      {section && (
        <>
          <span aria-hidden className="h-5 w-px rotate-12 bg-slate-300" />
          <Link href={section.href} className="text-[17px] font-medium tracking-tight text-slate-500 transition-colors hover:text-slate-950">
            {section.label}
          </Link>
        </>
      )}
    </div>
  )
}

/** `section` names the part of the site next to the logo; the blog by default. */
export async function BlogShell({ children, section }: { children: React.ReactNode; section?: { label: string; href: string } | null }) {
  const t = await getT()
  const nav = t.landing.nav

  return (
    <div className="lp-root relative flex min-h-screen flex-col overflow-x-clip bg-white text-slate-900 selection:bg-blue-200">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark brand={t.brand} section={section === undefined ? { label: t.blog.title, href: "/blog" } : (section ?? undefined)} />
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

      <SiteFooter />
    </div>
  )
}
