"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useI18n } from "@/components/i18n-provider"
import { DemoVideoButton } from "@/components/demo-video"
import { ReturbeMark } from "@/components/returbe-logo"
import { LOCALES, saveLocale } from "@/lib/i18n"
import { GOOGLE_PRIVACY_URL, LEGAL, YOUTUBE_TERMS_URL } from "@/lib/legal"
import { cn } from "@/lib/utils"

/** A thick red ring segment, as on the corners of the closing panel. `turn` rotates it by quarters. */
function Arc({ className, turn = 0 }: { className?: string; turn?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className={cn("pointer-events-none absolute", className)} style={{ transform: `rotate(${turn * 90}deg)` }}>
      <defs>
        <linearGradient id={`arc-${turn}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3b45" />
          <stop offset="1" stopColor="#b8000f" />
        </linearGradient>
      </defs>
      {/* Offset grey ring under the red one, for depth */}
      <circle cx="104" cy="104" r="72" fill="none" stroke="#e7e5e4" strokeWidth="40" strokeDasharray="113 400" />
      <circle cx="100" cy="100" r="72" fill="none" stroke={`url(#arc-${turn})`} strokeWidth="40" strokeDasharray="113 400" />
    </svg>
  )
}

// A channel's last uploads as bars around their median; the one under the pointer becomes the outlier
const BARS = Array.from({ length: 48 }, (_, i) => 18 + ((i * 37) % 23))
const MULTIPLIERS = Array.from({ length: 48 }, (_, i) => 6 + ((i * 53) % 90))

function OutlierSignature({ brand, hot, onHot }: { brand: string; hot: number; onHot: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  // Staggered growth on the first reveal only; hovering afterwards answers at once
  const [settled, setSettled] = useState(false)

  // Bars grow in once, when the footer scrolls into view
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        timer = setTimeout(() => setSettled(true), 1200)
        io.disconnect()
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
  }, [])

  function pick(clientX: number) {
    const rect = ref.current!.getBoundingClientRect()
    onHot(Math.min(BARS.length - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * BARS.length))))
  }

  return (
    <div aria-hidden className="relative mx-auto mt-14 max-w-6xl select-none">
      <div
        ref={ref}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        className="relative flex h-44 items-end gap-[3px] px-1 sm:h-56"
      >
        {/* Median of the channel */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[26%] border-t border-dashed border-slate-300" />
        {BARS.map((h, i) => {
          const isHot = i === hot
          return (
            <div key={i} className="relative flex h-full flex-1 items-end">
              <div
                className={cn(
                  "relative w-full rounded-t-[3px] transition-[height,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                  isHot ? "bg-gradient-to-t from-[#b8000f] to-[#ff3b45]" : "bg-slate-300/70"
                )}
                style={{ height: shown ? `${isHot ? 92 : h}%` : "0%", transitionDelay: settled ? "0ms" : `${i * 12}ms` }}
              >
                {isHot && shown && (
                  <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-[#e3061a] px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white shadow-[0_6px_16px_-6px_rgba(227,6,26,0.7)]">
                    ×{MULTIPLIERS[i]}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* The wordmark the bars stand on, fading into the page */}
      <p className="-mt-px bg-gradient-to-b from-slate-300 to-transparent bg-clip-text text-center text-[clamp(4rem,19vw,15rem)] leading-[0.8] font-bold tracking-[-0.06em] text-transparent">
        {brand}
      </p>
    </div>
  )
}

/** A small red "video" set inside the headline, carrying the multiplier of the bar being pointed at. */
function OutlierPill({ multiplier }: { multiplier: number }) {
  return (
    <span
      aria-hidden
      className="relative mx-1 inline-flex h-[1em] -translate-y-[0.06em] -rotate-3 items-center gap-[0.14em] rounded-[0.24em] bg-gradient-to-br from-[#ff3b45] to-[#b8000f] px-[0.3em] align-middle text-[0.5em] font-bold text-white shadow-[0_10px_24px_-10px_rgba(227,6,26,0.8)] transition-transform hover:rotate-0"
    >
      <span className="size-0 border-y-[0.32em] border-l-[0.5em] border-y-transparent border-l-white" />
      <span key={multiplier} className="lp-swap tabular-nums">×{multiplier}</span>
    </span>
  )
}

/** Closing call to action and footer of every public page (landing, blog, legal), with the YouTube API notice. */
export function SiteFooter() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.siteFooter
  const cta = t.landing.finalCta
  // The outlier bar under the pointer; its multiplier also shows in the headline
  const [hot, setHot] = useState(33)
  const words = cta.title.split(" ")

  const nav = [
    { href: "/welcome#features", label: f.features },
    { href: "/welcome#method", label: f.method },
    { href: "/welcome#faq", label: f.faq },
    { href: "/blog", label: f.blog },
    { href: "/login", label: f.signIn },
  ]
  const legal = [
    { href: "/terms", label: f.terms },
    { href: "/privacy", label: f.privacy },
    { href: "/legal-notice", label: f.notice },
  ]

  return (
    <footer className="relative overflow-hidden bg-[#f7f6f5] px-3 py-3 sm:px-6 sm:pt-14 sm:pb-16">
      {/* Warm glow behind the panel's edges */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_30%_60%_at_0%_50%,rgba(227,6,26,0.10),transparent_70%),radial-gradient(ellipse_30%_60%_at_100%_50%,rgba(227,6,26,0.10),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl">
      {/* Ring segments on the panel corners: the top two cut into it, the bottom two sit in the margins */}
      <Arc className="-top-[150px] -left-[150px] z-10 hidden size-[240px] sm:block" turn={0} />
      <Arc className="-top-[150px] -right-[150px] z-10 hidden size-[240px] sm:block" turn={1} />
      <Arc className="-bottom-[140px] -left-[190px] z-10 hidden size-[240px] lg:block" turn={3} />
      <Arc className="-right-[190px] -bottom-[140px] z-10 hidden size-[240px] lg:block" turn={2} />

      <div className="relative rounded-[2rem] border border-slate-200/70 bg-white px-6 pt-20 pb-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-12 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance text-slate-950 sm:text-6xl">
            {words.slice(0, -2).join(" ")} <OutlierPill multiplier={MULTIPLIERS[hot]} /> {words.slice(-2).join(" ")}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-pretty text-slate-500">{cta.text(t.brand)}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-b from-slate-800 to-slate-950 px-6 py-3 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_6px_16px_-6px_rgba(15,23,42,0.6)] transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e3061a]"
            >
              {cta.signUp}
            </Link>
            <DemoVideoButton title={cta.demo} className="rounded-full bg-slate-100 px-6 py-3 font-medium text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e3061a]">
              {cta.demo}
            </DemoVideoButton>
          </div>
        </div>

        <div className="mt-24 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <Link href="/welcome" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e3061a]">
              <ReturbeMark className="size-7" />
              <span className="text-lg font-bold tracking-tight text-slate-950">{t.brand}</span>
            </Link>
            <div className="inline-flex rounded-full bg-slate-100 p-0.5" role="group" aria-label={f.language}>
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
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase transition-colors",
                    l === locale ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <nav aria-label={f.product}>
            <ul className="flex flex-wrap gap-x-7 gap-y-2 text-sm text-slate-600">
              {nav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-slate-950">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {t.brand}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legal.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-slate-950">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${LEGAL.email}`} className="hover:text-slate-950">
                {LEGAL.email}
              </a>
            </li>
          </ul>
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-400">
          {f.youtubeBefore}{" "}
          <a href={YOUTUBE_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-700">
            {f.youtubeTerms}
          </a>{" "}
          {f.youtubeAnd}{" "}
          <a href={GOOGLE_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-700">
            {f.googlePrivacy}
          </a>
          . {f.notAffiliated}
        </p>
      </div>
      </div>
      <OutlierSignature brand={t.brand} hot={hot} onHot={setHot} />
    </footer>
  )
}
