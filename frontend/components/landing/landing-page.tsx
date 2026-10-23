"use client"
/* eslint-disable @next/next/no-img-element -- remote YouTube thumbnails and avatars */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Dices,
  Flame,
  Hourglass,
  Image as ImageIcon,
  LayoutGrid,
  MousePointer2,
  Play,
  Search,
  Sparkles,
  Target,
  Telescope,
  TrendingUp,
  Type,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { DemoVideoButton } from "@/components/demo-video"
import { ReturbeMark } from "@/components/returbe-logo"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"
import {
  ChannelAvatar,
  CountUp,
  Reveal,
  SpotlightCard,
  Typewriter,
  VideoCard,
  formatMultiplier,
  useFormatNumber,
  type LandingVideo,
} from "./landing-parts"

export type { LandingVideo }

export interface LandingCreator {
  name: string
  avatar: string
  subscribers: number
}

export interface LandingStats {
  videos: number
  channels: number
  views: number
  /** Relevant videos at ×10 or more their channel's median. */
  bigOutliers: number
  /** Videos published in the last 7 days. */
  freshWeek: number
  /** Last successful scan, ISO. */
  updatedAt: string | null
}

export interface LandingData {
  stats: LandingStats
  /** Showcase outliers, one per channel, best first. */
  videos: LandingVideo[]
  /** Recent small-channel breakouts, for the proof section. */
  breakouts: LandingVideo[]
  niches: { id: string; label: { en: string; fr: string }; videos: LandingVideo[] }[]
  creators: LandingCreator[]
}

const NAV_KEYS = [
  { href: "#features", key: "features" },
  { href: "#proof", key: "proof" },
  { href: "#demo", key: "demo" },
  { href: "#method", key: "method" },
  { href: "#faq", key: "faq" },
  { href: "/blog", key: "blog" },
] as const

/** /welcome: the public page, fed with live numbers and real outliers from the index. */
export function LandingPage({ data }: { data: LandingData }) {
  const { videos, breakouts, niches, creators, stats } = data
  return (
    <div className="lp-root relative min-h-screen overflow-x-clip bg-white text-slate-900 selection:bg-red-100">
      <Navbar freshWeek={stats.freshWeek} />
      <Hero videos={videos} creators={creators} stats={stats} />
      <ProductPreview videos={videos.slice(0, 6)} />
      <Problem />
      <OutlierExplainer />
      <Features videos={videos} creators={creators} />
      <Proof videos={breakouts} />
      <NicheExplorer niches={niches} />
      <Method videos={videos} creators={creators} />
      <Comparison />
      <Faq />
      <SiteFooter />
    </div>
  )
}

// --- LOGO ---

function Logo() {
  const { t } = useI18n()
  return (
    <Link href="/welcome" className="flex items-center gap-2.5">
      <ReturbeMark className="size-7" />
      <span className="text-lg font-bold tracking-tight">{t.brand}</span>
    </Link>
  )
}

// --- NAVBAR ---

function Navbar({ freshWeek }: { freshWeek: number }) {
  const { t } = useI18n()
  const l = t.landing
  const formatNumber = useFormatNumber()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 text-white">
      {/* Announcement bar */}
      <a
        href="#demo"
        className="flex h-8 items-center justify-center gap-3 bg-[#e3061a] px-4 text-[11px] font-semibold tracking-wide text-white uppercase"
      >
        <span className="truncate">
          {freshWeek >= 1_000 ? l.announcement(formatNumber(freshWeek)) : l.announcementFallback}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 normal-case ring-1 ring-white/40">
          {l.see} <ChevronRight className="size-3" />
        </span>
      </a>

      <nav
        className={cn(
          "transition-all duration-300",
          scrolled ? "border-b border-white/10 bg-[#0a0a0c]/90 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo />
          <div className="hidden items-center gap-1 md:flex">
            {NAV_KEYS.map((n) => (
              <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-white/65 transition-colors hover:text-white">
                {l.nav[n.key]}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm text-white/65 transition-colors hover:text-white sm:block">
              {l.nav.signIn}
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-white/85"
            >
              {l.nav.start}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

// --- HERO ---

/** Rounds down to two significant digits in k / M / Md, so the "+" stays true (4 658 → 4,6 k). */
export function compactStat(n: number, units: { thousand: string; million: string; billion: string }) {
  const steps = [
    [1e9, units.billion],
    [1e6, units.million],
    [1e3, units.thousand],
  ] as const
  const [div, unit] = steps.find(([d]) => n >= d) ?? [1, ""]
  const scaled = n / div
  const step = 10 ** (Math.floor(Math.log10(Math.max(scaled, 1))) - 1)
  return { value: Math.floor(scaled / step) * step, decimals: step < 1 ? 1 : 0, unit }
}

function Hero({ videos, creators, stats }: { videos: LandingVideo[]; creators: LandingCreator[]; stats: LandingStats }) {
  const { t, compact } = useI18n()
  const h = t.landing.hero
  const statItems = [
    { ...compactStat(stats.videos, t.landing.units), label: h.statVideos },
    { ...compactStat(stats.bigOutliers, t.landing.units), label: h.statOutliers },
    { ...compactStat(stats.views, t.landing.units), label: h.statViews },
  ]

  return (
    <section className="relative overflow-hidden bg-[#0a0a0c] px-4 pt-32 pb-52 text-white sm:pt-40">
      {/* Halo centred on the search box, then a warmer glow rising from the bottom behind the wall */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-40 h-[42rem] bg-[radial-gradient(ellipse_42%_45%_at_50%_50%,rgba(227,6,26,0.13),rgba(184,0,15,0.04)_55%,transparent_75%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[44rem] bg-[radial-gradient(ellipse_55%_60%_at_50%_100%,rgba(227,6,26,0.22),rgba(184,0,15,0.07)_45%,transparent_75%)]" />
      {/* Decorative outlines framing the wall */}
      <div aria-hidden className="pointer-events-none absolute top-[23rem] left-[calc(50%-36rem)] hidden h-[28rem] w-[36rem] rounded-tl-[3rem] border-t border-l border-white/10 lg:block" />
      <div aria-hidden className="pointer-events-none absolute top-[34rem] left-[calc(50%-48rem)] hidden h-[20rem] w-[60rem] rounded-tl-[3rem] border-t border-l border-white/[0.06] lg:block" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <TrustBadge creators={creators} stats={stats} />
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mt-6 text-4xl leading-[1.05] font-bold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            <span className="block text-balance">
              {h.titleBefore}
              <span className="lp-gradient-text">{h.titleHighlight}</span>
              {h.titleAfter}
            </span>
            <span className="block text-balance">{h.titleLine2}</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-xl text-sm font-medium text-pretty text-white/60 sm:text-base">{h.subtitle(t.brand)}</p>
        </Reveal>
      </div>

      {/* Search box overlapping the first row of thumbnails */}
      <div className="relative mt-9">
        <ThumbnailWall videos={videos} />

        <Reveal delay={240} className="relative z-10 mx-auto w-full max-w-xl">
          <HeroSearch />
        </Reveal>

        <Reveal delay={300} className="relative z-10 mt-10 flex justify-center">
          <DemoVideoButton title={h.demo} className="group inline-flex items-center gap-2 rounded-full bg-[#0a0a0c]/80 py-1 pr-3 pl-1 text-sm font-medium text-white/80 ring-1 ring-white/10 backdrop-blur hover:text-white">
            <span className="flex size-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition-transform group-hover:scale-110">
              <Play className="size-3 fill-white text-white" />
            </span>
            {h.demo}
          </DemoVideoButton>
        </Reveal>

        {/* Leaves room for the second row of thumbnails under the button */}
        <div aria-hidden className="h-44 sm:h-48" />
      </div>

      <Reveal delay={400} className="relative z-10 mx-auto mt-10 grid max-w-4xl grid-cols-3 gap-2 text-center sm:gap-8">
        {statItems.map((s) => (
          <div key={s.label}>
            <p className="text-[1.75rem] font-bold tracking-tight whitespace-nowrap sm:text-5xl md:text-6xl lg:text-7xl">
              <CountUp value={s.value} decimals={s.decimals} suffix={s.unit && ` ${s.unit}`} />
              <sup className="lp-gradient-text ml-0.5 align-super text-lg sm:text-3xl lg:text-4xl">+</sup>
            </p>
            <p className="mt-1 text-[11px] leading-snug font-medium text-white/55 sm:text-sm">{s.label}</p>
          </div>
        ))}
      </Reveal>

      {creators.length >= 4 && (
        <Reveal delay={480} className="relative z-10 mt-12">
          <p className="text-center text-sm font-medium text-white/70">{h.creators(t.brand)}</p>
          <div className="lp-marquee-mask mx-auto mt-5 flex max-w-4xl overflow-hidden">
            <div className="lp-marquee flex shrink-0 gap-8 pr-8" style={{ animationDuration: "50s" }}>
              {[...creators, ...creators].map((c, i) => (
                <div key={`${c.name}-${i}`} aria-hidden={i >= creators.length} className="flex shrink-0 items-center gap-2.5">
                  <img src={c.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-9 rounded-full ring-1 ring-white/15" />
                  <div className="text-left leading-tight">
                    <p className="flex items-center gap-1 text-sm font-semibold">
                      {c.name} <BadgeCheck className="size-3.5 text-white/40" />
                    </p>
                    <p className="text-xs text-white/50">{t.common.subscribers(compact(c.subscribers))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </section>
  )
}

/** Live index status and the number of channels followed, in place of a review score. */
function TrustBadge({ creators, stats }: { creators: LandingCreator[]; stats: LandingStats }) {
  const { t, ago } = useI18n()
  const formatNumber = useFormatNumber()
  const avatars = creators.slice(0, 4)

  return (
    <div className="flex flex-col items-center gap-2.5">
      {stats.updatedAt && (
        <span className="flex items-center gap-2 text-xs font-medium text-white/55">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-emerald-400" />
          </span>
          {t.landing.hero.updated(ago(stats.updatedAt))}
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] py-1 pr-3.5 text-xs text-white/75 backdrop-blur sm:text-sm",
          avatars.length >= 3 ? "pl-1" : "pl-3.5"
        )}
      >
        {avatars.length >= 3 && (
          <span className="flex -space-x-2">
            {avatars.map((c) => (
              <img key={c.name} src={c.avatar} alt="" referrerPolicy="no-referrer" className="size-6 rounded-full bg-white/10 ring-2 ring-[#0a0a0c]" />
            ))}
          </span>
        )}
        <span>{t.landing.hero.channelsTracked(formatNumber(stats.channels))}</span>
      </span>
    </div>
  )
}

/** A real field with rotating example topics; like every CTA on the page, it leads to sign-up. */
function HeroSearch() {
  const { t } = useI18n()
  const h = t.landing.hero
  const router = useRouter()
  const [query, setQuery] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        router.push("/signup")
      }}
      className="relative"
    >
      <div className="relative rounded-2xl border border-white/10 bg-[#141417]/80 px-4 pt-4 pb-8 text-left shadow-2xl shadow-black/60 backdrop-blur-xl transition-colors focus-within:border-white/25">
        <label htmlFor="lp-hero-query" className="sr-only">
          {h.searchLabel}
        </label>
        <textarea
          id="lp-hero-query"
          rows={2}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={h.searchPlaceholder}
          className="peer block h-16 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-transparent focus:placeholder:text-white/35"
        />
        {/* Example topics type themselves until the field is focused or filled */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-4 left-4 text-sm text-white/80 peer-focus:opacity-0 peer-[:not(:placeholder-shown)]:opacity-0"
        >
          <Typewriter words={h.searchExamples} />
        </span>
        <p className="flex items-center gap-1.5 text-[11px] text-white/35">
          <Search className="size-3" /> {h.searchHint}
        </p>
      </div>
      <button
        type="submit"
        className="lp-shine absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#e3061a] px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-[0_0_34px_rgba(227,6,26,0.45)] ring-4 ring-[#0a0a0c] transition-all hover:bg-[#f0121f] hover:shadow-[0_0_44px_rgba(227,6,26,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-300"
      >
        <Sparkles className="size-4" /> {h.searchSubmit}
      </button>
    </form>
  )
}

/** Rounds down to three significant digits, e.g. 15 530 204 → 15 500 000. */
export function roundViews(n: number) {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(n, 1))) - 2)
  return Math.floor(n / step) * step
}

/** Two rows of real outlier thumbnails drifting behind the prompt box. */
function ThumbnailWall({ videos }: { videos: LandingVideo[] }) {
  const { t } = useI18n()
  const formatNumber = useFormatNumber()
  if (videos.length < 8) return null
  const half = Math.ceil(videos.length / 2)
  const rows = [videos.slice(0, half), videos.slice(half)]

  return (
    <div aria-hidden className="pointer-events-none absolute top-10 left-1/2 flex w-screen -translate-x-1/2 flex-col gap-4">
      {rows.map((row, r) => (
        <div key={r} className="lp-marquee-mask flex overflow-hidden">
          <div
            className={cn("lp-marquee flex shrink-0 gap-3 pr-3", r === 1 && "lp-marquee-reverse")}
            style={{ animationDuration: `${r === 0 ? 90 : 110}s` }}
          >
            {[...row, ...row].map((v, i) => (
              <div key={`${v.id}-${i}`} className="w-44 shrink-0 rounded-xl border border-white/[0.07] bg-[#151518] p-1 sm:w-48">
                <div className="relative">
                  <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover" />
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-[#e3061a] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-[#e3061a]/30">
                    {formatMultiplier(v.outlierMultiplier)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 px-1 text-[11px] leading-snug font-semibold text-white/85">{v.title}</p>
                <p className="px-1 pt-0.5 pb-1 text-[10px] text-white/40">{t.landing.hero.views(formatNumber(roundViews(v.viewCount)))}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Dim the cards around the search box so it reads first, and blur them out toward the edges */}
      <div className="lp-wall-shade absolute inset-0" />
      <div className="lp-wall-edge absolute inset-y-0 left-0" />
      <div className="lp-wall-edge absolute inset-y-0 right-0 -scale-x-100" />
    </div>
  )
}

// --- PRODUCT PREVIEW ---

function ProductPreview({ videos }: { videos: LandingVideo[] }) {
  const frameRef = useRef<HTMLDivElement>(null)

  // The frame starts tilted and flattens as it scrolls into view.
  useEffect(() => {
    const el = frameRef.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const onScroll = () => {
      const top = el.parentElement!.getBoundingClientRect().top
      const p = Math.min(1, Math.max(0, 1 - top / (window.innerHeight * 0.85)))
      el.style.transform = `perspective(1600px) rotateX(${16 * (1 - p)}deg) scale(${0.93 + 0.07 * p})`
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (videos.length === 0) return null
  return (
    <section className="relative z-10 -mt-40 px-4 pb-24">
      <div className="relative mx-auto max-w-6xl">
        <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-10 rounded-[3rem] bg-gradient-to-b from-[#e3061a]/15 via-[#ff4d4f]/5 to-transparent blur-3xl" />
        <div ref={frameRef} className="relative origin-top transition-transform duration-150 ease-out will-change-transform">
          <AppFrame videos={videos} />
        </div>
      </div>
    </section>
  )
}

function AppFrame({ videos }: { videos: LandingVideo[] }) {
  const { t } = useI18n()
  const p = t.landing.preview
  const sideIcons = [LayoutGrid, Flame, TrendingUp, Compass, ImageIcon, Type, Wallet]
  const gridRef = useRef<HTMLDivElement>(null)
  // Plays a search once the frame is on screen: placeholders, "Best outliers today", then the results
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle")

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        if (reduced) return setPhase("done")
        setPhase("loading")
        timer = setTimeout(() => setPhase("done"), 1700)
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_40px_100px_-30px_rgba(15,23,42,0.25)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="size-2.5 rounded-full bg-slate-200" />
        <span className="size-2.5 rounded-full bg-slate-200" />
        <span className="size-2.5 rounded-full bg-slate-200" />
        <span className="mx-auto rounded-md bg-slate-100 px-16 py-1 text-[11px] text-slate-400">{p.url}</span>
      </div>

      <div className="flex">
        <aside className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r border-slate-100 py-5 sm:flex">
          {sideIcons.map((Icon, i) => (
            <span key={i} className={cn("flex size-8 items-center justify-center rounded-lg", i === 1 ? "bg-slate-900 text-white" : "text-slate-400")}>
              <Icon className="size-4" />
            </span>
          ))}
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-slate-500">{p.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {p.filters.map((f, i) => (
                <span
                  key={f}
                  className={cn(
                    "rounded-lg border px-2.5 py-1",
                    i === 1 ? "border-red-200 bg-red-50 text-[#b8000f]" : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div ref={gridRef} className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-3">
            {videos.map((v, i) => (
              // The cards stay laid out while hidden, so the frame keeps its height when they come in
              <div key={v.id} className={cn("relative", i >= 4 && "hidden lg:block")}>
                <div className={phase === "done" ? "lp-card-in" : "invisible"} style={{ animationDelay: `${i * 70}ms` }}>
                  <VideoCard video={v} />
                </div>
                {phase !== "done" && <PreviewCardSkeleton />}
              </div>
            ))}
            {phase === "loading" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
                <div className="lp-swap w-60 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-900">
                    <Flame className="lp-pulse size-4 text-[#e3061a]" />
                    {p.loading}
                  </p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="lp-load-bar h-full rounded-full bg-[#e3061a]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** A card's shape (thumbnail, avatar, two lines) while the preview "searches". */
function PreviewCardSkeleton() {
  return (
    <div aria-hidden className="absolute inset-0 flex flex-col gap-2.5">
      <div className="lp-skeleton aspect-video w-full rounded-xl" />
      <div className="flex gap-2.5">
        <div className="lp-skeleton size-7 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
          <div className="lp-skeleton h-3 w-11/12 rounded" />
          <div className="lp-skeleton h-3 w-2/3 rounded" />
          <div className="lp-skeleton h-2.5 w-1/2 rounded" />
        </div>
      </div>
    </div>
  )
}

// --- PROBLEM ---

function Problem() {
  const { t } = useI18n()
  const p = t.landing.problem

  return (
    <section className="relative overflow-hidden px-4 py-24">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_45%_60%_at_50%_0%,rgba(227,6,26,0.05),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeader
          icon={CircleHelp}
          eyebrow={p.eyebrow}
          title={
            <>
              {p.titleBefore}
              <span className="lp-gradient-text">{p.titleHighlight}</span>
            </>
          }
          subtitle={p.subtitle}
        />

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Reveal>
            <ProblemCard icon={Dices} title={p.gutTitle} text={p.gutText}>
              <div className="space-y-2">
                {p.gutIdeas.map((idea, i) => (
                  <div key={idea} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="truncate text-slate-700">{idea}</span>
                    <span
                      className="lp-pulse shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                      style={{ animationDelay: `${i * 400}ms` }}
                    >
                      {p.gutBadge}
                    </span>
                  </div>
                ))}
              </div>
            </ProblemCard>
          </Reveal>

          <Reveal delay={100}>
            <ProblemCard icon={Hourglass} title={p.lateTitle} text={p.lateText}>
              <svg viewBox="0 0 220 100" className="w-full overflow-visible" role="img" aria-label={p.lateAria}>
                <text x="122" y="9" textAnchor="middle" className="fill-slate-400 text-[9px]">
                  {p.latePeak}
                </text>
                <path
                  d="M0 92 C40 90 60 80 85 50 S112 16 122 16 S148 40 168 65 S205 88 220 90"
                  pathLength={260}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="lp-draw"
                />
                <circle cx="122" cy="16" r="3.5" fill="#94a3b8" />
                <circle cx="180" cy="75" r="5" fill="#e3061a" className="lp-pulse" />
                <text x="180" y="62" textAnchor="middle" className="fill-[#b8000f] text-[9px] font-semibold">
                  {p.lateYou}
                </text>
              </svg>
            </ProblemCard>
          </Reveal>

          <Reveal delay={200}>
            <ProblemCard icon={Users} title={p.modelsTitle} text={p.modelsText}>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
                  <span className="size-8 shrink-0 rounded-full bg-slate-200" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-sm font-medium text-slate-700">{p.giant}</p>
                    <p className="text-[11px] text-slate-400">{p.giantSub}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-400">×1</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/60 p-2.5">
                  <span className="size-8 shrink-0 rounded-full bg-gradient-to-br from-[#b8000f] to-[#ff3b45]" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-sm font-medium text-slate-800">{p.small}</p>
                    <p className="text-[11px] text-slate-500">{p.smallSub}</p>
                  </div>
                  <span className="lp-gradient-text text-lg font-bold">×28</span>
                </div>
                <p className="pt-1 text-center text-[11px] text-slate-400">{p.modelsNote}</p>
              </div>
            </ProblemCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function ProblemCard({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: React.ElementType
  title: string
  text: string
  children: React.ReactNode
}) {
  return (
    <SpotlightCard className="flex h-full flex-col p-6">
      <div className="flex min-h-40 flex-col justify-center rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">{children}</div>
      <h3 className="mt-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Icon className="size-4 text-[#e3061a]" /> {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{text}</p>
    </SpotlightCard>
  )
}

// --- WHY OUTLIERS ---

function OutlierExplainer() {
  const { t } = useI18n()
  const s = t.landing.solution
  // A channel whose uploads hover around its median, plus one breakout.
  const bars = [32, 41, 28, 36, 44, 30, 38, 100, 35, 40]

  return (
    <section className="px-4 py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <SectionEyebrow icon={Telescope}>{s.eyebrow}</SectionEyebrow>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{s.title}</h2>
          <p className="mt-5 text-lg text-slate-600">{s.text}</p>
          <ul className="mt-8 space-y-3 text-slate-700">
            {s.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <Check className="size-3 text-[#e3061a]" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <SpotlightCard className="p-6 sm:p-8">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{s.chartTitle}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1">{s.chartViews}</span>
            </div>
            <div className="relative mt-8 flex h-64 items-end gap-2 sm:gap-3">
              <div className="absolute inset-x-0 bottom-[36%] border-t border-dashed border-slate-300">
                <span className="absolute right-0 -top-6 text-[11px] text-slate-500">{s.median}</span>
              </div>
              {bars.map((h, i) => {
                const hot = h === 100
                return (
                  <div key={i} className="relative flex h-full flex-1 items-end">
                    {hot && (
                      <span className="lp-float absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-[#e3061a] px-2 py-1 text-xs font-bold whitespace-nowrap text-white shadow-lg shadow-[#e3061a]/30">
                        {s.outlier}
                      </span>
                    )}
                    <div
                      className={cn(
                        "lp-bar w-full rounded-t-md",
                        hot ? "bg-gradient-to-t from-[#c8000f] to-[#ff4d4f] shadow-[0_0_40px_rgba(227,6,26,0.28)]" : "bg-slate-200"
                      )}
                      style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                    />
                  </div>
                )
              })}
            </div>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  )
}

// --- FEATURES (BENTO) ---

// Light cards on a warm grey band: red title, grey text, then a small live visual
function Features({ videos, creators }: { videos: LandingVideo[]; creators: LandingCreator[] }) {
  const { t, compact } = useI18n()
  const f = t.landing.features
  const thumbs = videos.slice(0, 4)

  return (
    <section id="features" className="relative scroll-mt-24 bg-[#f7f6f5] px-4 py-28">
      <div className="relative mx-auto max-w-6xl">
        <SectionHeader
          icon={Sparkles}
          eyebrow={f.eyebrow}
          title={
            <>
              {f.titleBefore}
              <span className="lp-gradient-text">{f.titleHighlight}</span>
            </>
          }
          subtitle={f.subtitle}
        />

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Outliers */}
          <Reveal className="md:col-span-2">
            <FeatureCard title={f.outliersTitle} text={f.outliersText}>
              <div className="space-y-2">
                {videos.slice(0, 3).map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-2 pr-4"
                    style={{ opacity: 1 - i * 0.2 }}
                  >
                    <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{v.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {v.channelTitle} · {t.common.subscribers(compact(v.channelSubscribers))}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-[#e3061a] tabular-nums">{formatMultiplier(v.outlierMultiplier)}</span>
                  </div>
                ))}
              </div>
            </FeatureCard>
          </Reveal>

          {/* Niche finder */}
          <Reveal delay={80}>
            <FeatureCard title={f.nicheTitle} text={f.nicheText}>
              <div className="flex items-center justify-center">
                <div className="relative size-36">
                  <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#ecebea" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="url(#lp-gauge)" strokeWidth="10" strokeLinecap="round" strokeDasharray="314" className="lp-gauge" />
                    <defs>
                      <linearGradient id="lp-gauge" x1="0" x2="1">
                        <stop offset="0%" stopColor="#b8000f" />
                        <stop offset="100%" stopColor="#ff3b45" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold text-slate-950">87</span>
                    <span className="text-[11px] text-slate-500">{f.opportunity}</span>
                  </div>
                </div>
              </div>
            </FeatureCard>
          </Reveal>

          {/* Channel trends: who is taking off, who is slowing down */}
          <Reveal>
            <FeatureCard title={f.trendsTitle} text={f.trendsText}>
              <ChannelTrends videos={videos} creators={creators} />
            </FeatureCard>
          </Reveal>

          {/* Thumbnails */}
          <Reveal delay={80}>
            <FeatureCard title={f.thumbsTitle} text={f.thumbsText}>
              <div className="grid grid-cols-2 gap-2">
                {thumbs.map((v, i) => (
                  <div key={v.id} className="relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                    <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded-md bg-white/90 px-1.5 text-[10px] font-medium text-slate-800 backdrop-blur">
                      {f.thumbTags[i]}
                    </span>
                  </div>
                ))}
              </div>
            </FeatureCard>
          </Reveal>

          {/* Title patterns */}
          <Reveal delay={160}>
            <FeatureCard title={f.titlesTitle} text={f.titlesText}>
              <div className="space-y-2 text-sm">
                {f.titlePatterns.map((parts, i) => (
                  <p key={i} className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-slate-700">
                    {parts.map((part, j) =>
                      part.startsWith("[") ? (
                        <span key={j} className="rounded-md bg-red-50 px-1 font-medium text-[#b8000f]">
                          {part}
                        </span>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </p>
                ))}
              </div>
            </FeatureCard>
          </Reveal>

          {/* AI assistant */}
          <Reveal className="md:col-span-2">
            <FeatureCard title={f.aiTitle} text={f.aiText}>
              <AiChat />
            </FeatureCard>
          </Reveal>

          {/* Monetization */}
          <Reveal delay={80}>
            <FeatureCard title={f.revenueTitle} text={f.revenueText}>
              <div className="flex flex-wrap gap-2">
                {f.revenueTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-3">
                <p className="text-[11px] text-slate-500">{f.revenueLabel}</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{f.revenueValue}</p>
              </div>
            </FeatureCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/**
 * The assistant card, on a loop: the question types itself, the assistant thinks,
 * its answer streams in word by word, then the three ideas land one by one.
 * Shown complete under reduced motion.
 */
function AiChat() {
  const { t } = useI18n()
  const f = t.landing.features
  const words = useMemo(() => f.aiAnswer.split(" "), [f.aiAnswer])
  // 0 typing the question, 1 thinking, 2 streaming the answer, 3 listing ideas, 4 holding
  const [phase, setPhase] = useState(0)
  const [n, setN] = useState(0)

  useEffect(() => {
    let step: ReturnType<typeof setTimeout>
    const at = (ms: number, fn: () => void) => (step = setTimeout(fn, ms))
    const next = (p: number) => {
      setPhase(p)
      setN(0)
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (phase !== 4) at(0, () => next(4))
    } else if (phase === 0) at(n < f.aiQuestion.length ? 35 : 500, () => (n < f.aiQuestion.length ? setN(n + 1) : next(1)))
    else if (phase === 1) at(1200, () => next(2))
    else if (phase === 2) at(n < words.length ? 70 : 300, () => (n < words.length ? setN(n + 1) : next(3)))
    else if (phase === 3) at(450, () => (n < f.aiIdeas.length ? setN(n + 1) : next(4)))
    else at(4000, () => next(0))
    return () => clearTimeout(step)
  }, [phase, n, words, f.aiQuestion, f.aiIdeas.length])

  const question = phase === 0 ? f.aiQuestion.slice(0, n) : f.aiQuestion
  const sent = phase > 0
  const answer = phase === 2 ? words.slice(0, n).join(" ") : phase > 2 ? f.aiAnswer : ""
  const ideas = phase === 3 ? n : phase === 4 ? f.aiIdeas.length : 0

  return (
    <div className="flex min-h-64 flex-col justify-end gap-3">
      <div
        className={cn(
          "ml-auto w-fit max-w-md rounded-2xl rounded-br-md px-4 py-2.5 text-sm transition-colors duration-300",
          sent ? "bg-slate-950 text-white" : "border border-dashed border-slate-300 bg-white text-slate-700"
        )}
      >
        {question || "\u00a0"}
        {!sent && <span className="lp-caret ml-px inline-block h-[1em] w-px translate-y-0.5 bg-[#e3061a]" />}
      </div>
      {phase > 0 && (
        <div className="lp-swap flex max-w-lg gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
            <ReturbeMark className="size-4" />
          </span>
          <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700">
            {phase === 1 ? (
              <span className="flex h-5 items-center gap-1" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            ) : (
              <>
                {answer}
                {ideas > 0 && (
                  <span className="mt-2 block text-slate-500">
                    {f.aiIdeas.slice(0, ideas).map((idea, i) => (
                      <span key={idea} className="lp-swap block">
                        {i + 1}. {idea}
                      </span>
                    ))}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FeatureCard({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white/70 p-7">
      <h3 className="text-[17px] font-semibold tracking-tight text-[#b8000f]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-pretty text-slate-500">{text}</p>
      <div className="mt-7 flex flex-1 flex-col justify-center">{children}</div>
    </div>
  )
}

/**
 * Overlapping channel avatars in two rows: the channels behind today's outliers
 * (taking off) and the long-established giants (growing slowly in relative terms).
 */
function ChannelTrends({ videos, creators }: { videos: LandingVideo[]; creators: LandingCreator[] }) {
  const { t } = useI18n()
  const f = t.landing.features
  const seen = new Set<string>()
  const rising = videos
    .filter((v) => v.channelAvatar && !seen.has(v.channelTitle) && seen.add(v.channelTitle))
    .slice(0, 5)
    .map((v) => ({ name: v.channelTitle, avatar: v.channelAvatar! }))
  const slowing = creators.filter((c) => !seen.has(c.name)).slice(0, 7)
  if (rising.length < 3) return null

  const rows = [
    { label: f.trendRising, dot: "bg-emerald-500", items: rising, slow: false },
    { label: f.trendSlowing, dot: "bg-[#e3061a]", items: slowing, slow: true },
  ]
  return (
    <div className="space-y-6">
      {rows.map((row) =>
        row.items.length === 0 ? null : (
          <div key={row.label}>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <span className={cn("size-2 rounded-full", row.dot)} />
              {row.label}
            </p>
            <div className="mt-3 flex -space-x-3">
              {row.items.map((c) => (
                <img
                  key={c.name}
                  src={c.avatar}
                  alt={c.name}
                  title={c.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className={cn(
                    "size-12 rounded-full bg-slate-100 ring-[3px] ring-white",
                    row.slow ? "opacity-45 grayscale" : "shadow-[0_6px_18px_-6px_rgba(15,23,42,0.35)]"
                  )}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// --- PROOF (LIVE DATA) ---

function Proof({ videos }: { videos: LandingVideo[] }) {
  const { t } = useI18n()
  const p = t.landing.proof
  if (videos.length < 3) return null

  return (
    <section id="proof" className="relative scroll-mt-24 overflow-hidden px-4 py-24">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(227,6,26,0.05),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeader
          icon={Target}
          eyebrow={p.eyebrow}
          title={
            <>
              {p.titleBefore}
              <span className="lp-gradient-text">{p.titleHighlight}</span>
            </>
          }
          subtitle={p.subtitle(t.brand)}
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v, i) => (
            <Reveal key={v.id} delay={(i % 3) * 100} className="h-full">
              <BreakoutCard video={v} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex justify-center">
          <Link
            href="/signup"
            className="lp-shine group relative inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white shadow-lg shadow-slate-950/20 transition-all hover:shadow-xl hover:shadow-[#e3061a]/20"
          >
            {p.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

function BreakoutCard({ video: v }: { video: LandingVideo }) {
  const { t, compact, ago } = useI18n()
  const median = v.viewCount / Math.max(v.outlierMultiplier, 1)

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <img src={v.thumbnail} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute top-3 left-3 rounded-lg bg-[#e3061a] px-2 py-1 text-sm font-bold text-white shadow-lg shadow-[#e3061a]/30">
          <CountUp value={Math.round(v.outlierMultiplier)} prefix="×" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 text-sm leading-snug font-semibold text-slate-900">{v.title}</p>
        <div className="mt-auto space-y-2.5 pt-5">
          <ProofBar label={t.landing.proof.median} views={median} width={Math.max(3, 100 / v.outlierMultiplier)} muted />
          <ProofBar label={t.landing.proof.thisVideo} views={v.viewCount} width={100} />
        </div>
        <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-4">
          <ChannelAvatar src={v.channelAvatar} />
          <p className="min-w-0 truncate text-xs text-slate-500">
            <span className="font-medium text-slate-700">{v.channelTitle}</span> · {t.common.subscribers(compact(v.channelSubscribers))} ·{" "}
            {ago(v.publishedAt, "day")}
          </p>
        </div>
      </div>
    </article>
  )
}

function ProofBar({ label, views, width, muted = false }: { label: string; views: number; width: number; muted?: boolean }) {
  const { t, compact } = useI18n()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={cn("font-semibold tabular-nums", muted ? "text-slate-500" : "text-slate-900")}>{t.common.views(compact(views))}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("lp-grow-x h-full rounded-full", muted ? "bg-slate-300" : "bg-gradient-to-r from-[#c8000f] to-[#ff3b45]")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// --- NICHE EXPLORER (LIVE DATA) ---

function NicheExplorer({ niches }: { niches: LandingData["niches"] }) {
  const { t, locale } = useI18n()
  const d = t.landing.demo
  const [active, setActive] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  // The white pill slides under the active tab (positioned in the DOM, no re-render)
  useEffect(() => {
    const place = () => {
      const tab = tabsRef.current?.querySelectorAll<HTMLButtonElement>("button")[active]
      const pill = pillRef.current
      if (!tab || !pill) return
      pill.style.width = `${tab.offsetWidth}px`
      pill.style.transform = `translateX(${tab.offsetLeft}px)`
      pill.style.opacity = "1"
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [active, niches.length])

  if (niches.length === 0) return null
  const current = niches[Math.min(active, niches.length - 1)]

  return (
    <section id="demo" className="scroll-mt-24 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeader icon={BarChart3} eyebrow={d.eyebrow} title={d.title} subtitle={d.subtitle(t.brand)} />

        <Reveal className="mt-10 flex justify-center">
          <div ref={tabsRef} className="relative flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <span
              ref={pillRef}
              aria-hidden
              className="absolute top-1 bottom-1 left-0 rounded-xl bg-white opacity-0 shadow-sm ring-1 ring-slate-200 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            />
            {niches.map((n, i) => (
              <button
                key={n.id}
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={cn(
                  "relative shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300",
                  i === active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {n.label[locale]}
              </button>
            ))}
          </div>
        </Reveal>

        <div key={current.id} className="lp-swap mt-10 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {current.videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>

        <Reveal className="mt-12 flex justify-center">
          <Link href="/signup" className="group inline-flex items-center gap-2 text-sm font-semibold text-[#b8000f] hover:text-[#8f000b]">
            {d.cta} <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

// --- METHOD ---

// Three steps as three cards: a small piece of the product on top, the step underneath
function Method({ videos, creators }: { videos: LandingVideo[]; creators: LandingCreator[] }) {
  const { t } = useI18n()
  const m = t.landing.method
  const visuals = [<StepChannel key="channel" creators={creators} />, <StepNiche key="niche" videos={videos} />, <StepIdeas key="ideas" videos={videos} />]

  return (
    <section id="method" className="scroll-mt-24 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-center text-4xl font-semibold tracking-[-0.035em] text-balance text-slate-950 sm:text-5xl">{m.title}</h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {m.steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 100} className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-[#f5f4f3]">
                <div aria-hidden className="relative flex h-64 items-center justify-center overflow-hidden">
                  {visuals[i]}
                </div>
                <div className="px-8 pt-2 pb-9 text-center">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-950">{s.title}</h3>
                  <p className="mx-auto mt-2.5 max-w-xs leading-relaxed text-pretty text-slate-500">{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Step 1, on a loop: a channel name types itself, its competitors pop in one by one,
 * the cursor clicks Continue, then the next channel. Static under reduced motion.
 */
function StepChannel({ creators }: { creators: LandingCreator[] }) {
  const { t } = useI18n()
  const m = t.landing.method
  const channels = useMemo(() => creators.slice(0, 6), [creators])
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [found, setFound] = useState(0)
  const [clicked, setClicked] = useState(false)

  useEffect(() => {
    if (channels.length < 2) return
    let step: ReturnType<typeof setTimeout>
    const at = (ms: number, fn: () => void) => (step = setTimeout(fn, ms))
    const name = channels[index].name
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (typed < name.length)
        at(0, () => {
          setTyped(name.length)
          setFound(5)
        })
    } else if (typed < name.length) at(55, () => setTyped(typed + 1))
    else if (found < 5) at(found === 0 ? 400 : 160, () => setFound(found + 1))
    else if (!clicked) at(700, () => setClicked(true))
    else
      at(900, () => {
        setIndex((index + 1) % channels.length)
        setTyped(0)
        setFound(0)
        setClicked(false)
      })
    return () => clearTimeout(step)
  }, [channels, index, typed, found, clicked])

  const mine = channels[index]
  if (!mine) return null
  const done = typed >= mine.name.length
  const others = creators.filter((c) => c.name !== mine.name).slice(index, index + 5)

  return (
    <div className="w-[85%] max-w-72">
      <p className="text-[11px] font-semibold text-slate-800">{m.yourChannel}</p>
      <div className="mt-1.5 flex h-9 items-center gap-2 rounded-xl bg-white px-2.5 ring-1 ring-slate-200">
        <img src={mine.avatar} alt="" referrerPolicy="no-referrer" className={cn("size-5 rounded-full transition-opacity duration-300", done ? "opacity-100" : "opacity-0")} />
        <span className="truncate text-xs font-medium text-slate-800">
          {mine.name.slice(0, typed)}
          {!done && <span className="lp-caret ml-px inline-block h-3 w-px translate-y-0.5 bg-[#e3061a]" />}
        </span>
        <BadgeCheck className={cn("ml-auto size-3.5 shrink-0 text-[#e3061a] transition-opacity duration-300", done ? "opacity-100" : "opacity-0")} />
      </div>
      <p className="mt-4 text-[11px] text-slate-500">{m.competitorsFound}</p>
      <div className="mt-1.5 flex h-7 items-center justify-between">
        <div className="flex -space-x-2">
          {others.map((c, i) => (
            <img
              key={c.name}
              src={c.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className={cn(
                "size-7 rounded-full bg-slate-200 ring-2 ring-[#f5f4f3] transition-all duration-300",
                i < found ? "scale-100 opacity-100" : "scale-50 opacity-0"
              )}
            />
          ))}
        </div>
        <span className={cn("relative rounded-full bg-slate-950 px-3 py-1 text-[11px] font-medium text-white transition-transform duration-150", clicked && "scale-95")}>
          {m.continue}
          <MousePointer2
            className={cn(
              "absolute -right-3 top-5 size-5 fill-slate-950 stroke-white transition-transform duration-500",
              found >= 5 ? "translate-x-0 translate-y-0" : "translate-x-6 translate-y-4"
            )}
          />
        </span>
      </div>
    </div>
  )
}

/** A counter that goes up every `ms` while motion is allowed; stays at 0 under reduced motion. */
function useLoop(ms: number) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setTick((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return tick
}

/**
 * Step 2, on a loop: three tall cuts of real outliers; every couple of seconds one column
 * swaps to the next outlier of the index and gets the red "spotted" ring.
 */
function StepNiche({ videos }: { videos: LandingVideo[] }) {
  const pool = videos.slice(0, 12)
  const tick = useLoop(2200)
  if (pool.length < 3) return null
  // Tick t swaps column t % 3; a column that has swapped n times shows pool[col + 3n]
  const active = tick % 3
  const slots = [0, 1, 2].map((col) => pool[(col + 3 * Math.floor((tick + ((3 - col) % 3)) / 3)) % pool.length])

  return (
    <div className="absolute inset-x-0 top-6 flex justify-center gap-2.5 [mask-image:linear-gradient(180deg,#000_55%,transparent)]">
      {slots.map((v, i) => (
        <div
          key={i}
          className={cn(
            "relative h-56 w-28 shrink-0 overflow-hidden rounded-2xl ring-2 transition-[box-shadow,ring-color] duration-500",
            i === 1 ? "mt-0" : "mt-6",
            tick > 0 && i === active ? "ring-[#e3061a] shadow-[0_10px_30px_-10px_rgba(227,6,26,0.6)]" : "ring-transparent"
          )}
        >
          <img key={v.id} src={v.thumbnail} alt="" loading="lazy" className="lp-swap size-full object-cover" />
          <span key={`${v.id}-x`} className="lp-swap absolute top-2 left-2 rounded-md bg-[#e3061a] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {formatMultiplier(v.outlierMultiplier)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Step 3, on a loop: an idea lands (a real outlier title), its kind's counter goes up,
 * and the chart redraws every third idea.
 */
function StepIdeas({ videos }: { videos: LandingVideo[] }) {
  const { t } = useI18n()
  const m = t.landing.method
  const tick = useLoop(2400)
  const series = [
    { color: "#e3061a", d: "M0 70 L22 58 L44 64 L66 40 L88 46 L110 22 L132 30 L154 10" },
    { color: "#10b981", d: "M0 78 L22 72 L44 74 L66 60 L88 62 L110 48 L132 52 L154 40" },
    { color: "#94a3b8", d: "M0 84 L22 82 L44 78 L66 80 L88 72 L110 74 L132 66 L154 64" },
  ]
  const counts = [12, 8, 6].map((base, i) => base + Math.floor((tick + 2 - i) / 3))
  const kind = tick % 3
  const idea = videos.length ? videos[tick % Math.min(videos.length, 12)] : null

  return (
    <div className="w-[85%] max-w-72 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
      <p className="text-[11px] text-slate-500">{m.ideasToday}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {m.ideaKinds.map((label, i) => (
          <span
            key={label}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors duration-300",
              tick > 0 && i === kind ? "bg-red-50 text-slate-900 ring-red-200" : "bg-slate-50 text-slate-700 ring-slate-200"
            )}
          >
            <span className="size-1.5 rounded-full" style={{ background: series[i].color }} />
            {label} <span className="text-slate-400 tabular-nums">{counts[i]}</span>
          </span>
        ))}
      </div>
      <svg key={`chart-${Math.floor(tick / 3)}`} viewBox="0 0 154 70" className="mt-3 w-full overflow-visible">
        {[15, 35, 55].map((y) => (
          <line key={y} x1="0" x2="154" y1={y} y2={y} stroke="#f1f5f9" />
        ))}
        {series.map((s) => (
          <path key={s.color} d={s.d} transform="translate(0 -14)" fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="lp-draw" pathLength={260} />
        ))}
        <circle cx="154" cy="-4" r="3.5" fill="#e3061a" />
      </svg>
      {idea && (
        <div key={`idea-${tick}`} className="lp-swap mt-2 flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 ring-1 ring-slate-200/80">
          <img src={idea.thumbnail} alt="" className="aspect-video w-12 shrink-0 rounded-md object-cover" />
          <p className="line-clamp-1 text-[10px] font-medium text-slate-700">{idea.title}</p>
        </div>
      )}
    </div>
  )
}

// --- COMPARISON ---

function Comparison() {
  const { t } = useI18n()
  const c = t.landing.comparison

  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeader icon={Search} eyebrow={c.eyebrow} title={c.title} />
        <Reveal className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-slate-50 text-xs font-medium tracking-wider text-slate-500 uppercase sm:text-sm sm:tracking-normal sm:normal-case">
            <div className="p-4 sm:p-5" />
            <div className="p-4 sm:p-5">{c.seoTools}</div>
            <div className="bg-red-50/70 p-4 text-slate-900 sm:p-5">{t.brand}</div>
          </div>
          {c.rows.map(([label, them, us]) => (
            <div key={label} className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-slate-100 text-sm">
              <div className="p-4 font-medium text-slate-700 sm:p-5">{label}</div>
              <div className="flex items-start gap-2 p-4 text-slate-400 sm:p-5">
                <X className="mt-0.5 size-4 shrink-0 text-slate-300" /> {them}
              </div>
              <div className="flex items-start gap-2 bg-red-50/40 p-4 text-slate-800 sm:p-5">
                <Check className="mt-0.5 size-4 shrink-0 text-[#e3061a]" /> {us}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// --- FAQ ---

function Faq() {
  const { t } = useI18n()
  const faq = t.landing.faq
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="scroll-mt-24 bg-slate-50/70 px-4 py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeader icon={Sparkles} eyebrow={faq.eyebrow} title={faq.title} />
        <div className="mt-12 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white shadow-sm">
          {faq.items.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-medium"
                >
                  {item.q}
                  <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform duration-300", isOpen && "rotate-180")} />
                </button>
                <div className={cn("grid transition-all duration-300 ease-out", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                  <p className="overflow-hidden px-6 text-slate-600">
                    <span className="block pb-5">{item.a}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// --- SHARED ---

type Tone = "light" | "dark"

function SectionEyebrow({ icon: Icon, children, tone = "light" }: { icon: React.ElementType; children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
        tone === "light" ? "border-slate-200 bg-white text-slate-600" : "border-white/15 bg-white/[0.04] text-white/70"
      )}
    >
      <Icon className={cn("size-3.5", tone === "light" ? "text-[#e3061a]" : "text-[#ff4d4f]")} /> {children}
    </span>
  )
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  tone = "light",
}: {
  icon: React.ElementType
  eyebrow: string
  title: React.ReactNode
  subtitle?: string
  tone?: Tone
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <SectionEyebrow icon={icon} tone={tone}>
        {eyebrow}
      </SectionEyebrow>
      <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h2>
      {subtitle && <p className={cn("mx-auto mt-4 max-w-2xl text-lg text-pretty", tone === "light" ? "text-slate-500" : "text-white/55")}>{subtitle}</p>}
    </Reveal>
  )
}
