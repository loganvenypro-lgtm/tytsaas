"use client"
/* eslint-disable @next/next/no-img-element -- remote YouTube thumbnails and avatars */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Bot,
  Check,
  ChevronDown,
  Command,
  Compass,
  Flame,
  Image as ImageIcon,
  LayoutGrid,
  Play,
  Radar,
  Search,
  TrendingUp,
  Type,
  Wallet,
  X,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import { compactStat, roundViews, type LandingCreator, type LandingData, type LandingStats } from "./landing-page"
import { ChannelAvatar, CountUp, Reveal, Typewriter, formatMultiplier, useFormatNumber, type LandingVideo } from "./landing-parts"

/*
 * /welcome2 palette (focus ring and smooth scroll live on .w2-root in globals.css):
 * ink #0A0A0A page, graphite #1A1A1A surfaces, paper #F5F5F5 text, signal #FF101A accent, rule #262626 hairlines.
 * Signal red only marks what beats a channel's median (scores, the outlier bar) and the one primary action.
 */

const NAV_KEYS = [
  { href: "#features", key: "features" },
  { href: "#proof", key: "proof" },
  { href: "#demo", key: "demo" },
  { href: "#method", key: "method" },
  { href: "#faq", key: "faq" },
] as const

/** Ink text on signal red: white on #FF101A falls short of 4.5:1. */
const SIGNAL_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#FF101A] px-6 py-3 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#ff3b43]"
const GHOST_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-[#F5F5F5] transition-colors hover:border-white/40 hover:bg-white/[0.04]"

export function LandingPageV2({ data }: { data: LandingData }) {
  const { t } = useI18n()
  const { videos, breakouts, niches, creators, stats } = data
  return (
    <div className="w2-root relative min-h-screen overflow-x-clip bg-[#0A0A0A] text-[#F5F5F5] selection:bg-[#FF101A] selection:text-[#0A0A0A]">
      <a
        href="#w2-main"
        className="sr-only z-[60] rounded-full bg-[#F5F5F5] px-4 py-2 text-sm font-semibold text-[#0A0A0A] focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.landing.v2.skip}
      </a>
      <Navbar freshWeek={stats.freshWeek} />
      <main id="w2-main">
        <Hero videos={videos} creators={creators} stats={stats} />
        <ProductPreview videos={videos.slice(0, 6)} />
        <MedianLine />
        <Problem />
        <Proof videos={breakouts} />
        <Features />
        <NicheExplorer niches={niches} />
        <Method />
        <Comparison />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

// --- LOGO ---

function Logo() {
  const { t } = useI18n()
  return (
    <Link href="/welcome2" className="flex items-center gap-2.5 rounded-lg">
      <span className="flex size-8 items-center justify-center rounded-lg bg-[#FF101A]">
        <Command className="size-4 text-[#0A0A0A]" />
      </span>
      <span className="text-lg font-semibold tracking-tight">{t.brand}</span>
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
    <header className="fixed inset-x-0 top-0 z-50">
      <a
        href="#demo"
        className="flex h-8 items-center justify-center gap-2 border-b border-[#262626] bg-[#1A1A1A] px-4 text-xs text-white/70 hover:text-[#F5F5F5]"
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#FF101A]" />
        <span className="truncate">{freshWeek >= 1_000 ? l.announcement(formatNumber(freshWeek)) : l.announcementFallback}</span>
        <span className="shrink-0 font-medium text-[#F5F5F5] underline decoration-white/30 underline-offset-4">{l.see}</span>
      </a>

      <nav
        className={cn(
          "border-b transition-colors duration-300",
          scrolled ? "border-[#262626] bg-[#0A0A0A]/85 backdrop-blur-xl" : "border-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="hidden items-center gap-1 md:flex">
            {NAV_KEYS.map((n) => (
              <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-[#F5F5F5]">
                {l.nav[n.key]}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden rounded-lg text-sm text-white/60 transition-colors hover:text-[#F5F5F5] sm:block">
              {l.nav.signIn}
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#F5F5F5] px-4 py-2 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-white"
            >
              {l.nav.start}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

// --- HERO (same content and structure as /welcome) ---

function Hero({ videos, creators, stats }: { videos: LandingVideo[]; creators: LandingCreator[]; stats: LandingStats }) {
  const { t, compact } = useI18n()
  const h = t.landing.hero
  const statItems = [
    { ...compactStat(stats.videos, t.landing.units), label: h.statVideos },
    { ...compactStat(stats.bigOutliers, t.landing.units), label: h.statOutliers },
    { ...compactStat(stats.views, t.landing.units), label: h.statViews },
  ]

  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-28 sm:pt-40">
      {/* A faint red halo behind the search box; the only colour in the hero besides the scores */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-40 h-[42rem] bg-[radial-gradient(ellipse_40%_42%_at_50%_50%,rgba(255,16,26,0.10),transparent_75%)]" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <TrustBadge creators={creators} stats={stats} />
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            <span className="block text-balance">
              {h.titleBefore}
              <span className="text-[#FF101A]">{h.titleHighlight}</span>
              {h.titleAfter}
            </span>
            <span className="block text-balance text-white/55">{h.titleLine2}</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-xl text-sm text-pretty text-white/60 sm:text-base">{h.subtitle(t.brand)}</p>
        </Reveal>
      </div>

      <div className="relative mt-9">
        <ThumbnailWall videos={videos} />

        <Reveal delay={240} className="relative z-10 mx-auto w-full max-w-xl">
          <HeroSearch />
        </Reveal>

        <Reveal delay={300} className="relative z-10 mt-10 flex justify-center">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 rounded-full bg-[#0A0A0A]/80 py-1 pr-3 pl-1 text-sm font-medium text-white/80 ring-1 ring-white/10 backdrop-blur hover:text-[#F5F5F5]"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-[#1A1A1A] ring-1 ring-white/15">
              <Play className="size-3 fill-[#F5F5F5] text-[#F5F5F5]" />
            </span>
            {h.demo} <span className="text-xs text-white/40">{h.demoLive}</span>
          </a>
        </Reveal>

        <div aria-hidden className="h-44 sm:h-48" />
      </div>

      <Reveal delay={400} className="relative z-10 mx-auto mt-10 grid max-w-4xl grid-cols-3 gap-2 text-center sm:gap-8">
        {statItems.map((s) => (
          <div key={s.label}>
            <p className="text-[1.75rem] font-semibold tracking-tight whitespace-nowrap sm:text-5xl md:text-6xl lg:text-7xl">
              <CountUp value={s.value} decimals={s.decimals} suffix={s.unit && ` ${s.unit}`} />
              <sup className="ml-0.5 align-super text-lg text-[#FF101A] sm:text-3xl lg:text-4xl">+</sup>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white/55 sm:text-sm">{s.label}</p>
          </div>
        ))}
      </Reveal>

      {creators.length >= 4 && (
        <Reveal delay={480} className="relative z-10 mt-14">
          <p className="text-center text-sm text-white/60">{h.creators(t.brand)}</p>
          <div className="lp-marquee-mask mx-auto mt-5 flex max-w-4xl overflow-hidden">
            <div className="lp-marquee flex shrink-0 gap-8 pr-8" style={{ animationDuration: "50s" }}>
              {[...creators, ...creators].map((c, i) => (
                <div key={`${c.name}-${i}`} aria-hidden={i >= creators.length} className="flex shrink-0 items-center gap-2.5">
                  <img src={c.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-9 rounded-full ring-1 ring-white/15" />
                  <div className="text-left leading-tight">
                    <p className="flex items-center gap-1 text-sm font-medium">
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

function TrustBadge({ creators, stats }: { creators: LandingCreator[]; stats: LandingStats }) {
  const { t, ago } = useI18n()
  const formatNumber = useFormatNumber()
  const avatars = creators.slice(0, 4)

  return (
    <div className="flex flex-col items-center gap-2.5">
      {stats.updatedAt && (
        <span className="flex items-center gap-2 text-xs text-white/55">
          {/* A recording light: the index is live */}
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#FF101A]/70 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-[#FF101A]" />
          </span>
          {t.landing.hero.updated(ago(stats.updatedAt))}
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-[#1A1A1A]/70 py-1 pr-3.5 text-xs text-white/75 backdrop-blur sm:text-sm",
          avatars.length >= 3 ? "pl-1" : "pl-3.5"
        )}
      >
        {avatars.length >= 3 && (
          <span className="flex -space-x-2">
            {avatars.map((c) => (
              <img key={c.name} src={c.avatar} alt="" referrerPolicy="no-referrer" className="size-6 rounded-full bg-[#1A1A1A] ring-2 ring-[#0A0A0A]" />
            ))}
          </span>
        )}
        <span>{t.landing.hero.channelsTracked(formatNumber(stats.channels))}</span>
      </span>
    </div>
  )
}

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
      <div className="relative rounded-2xl border border-white/10 bg-[#1A1A1A]/85 px-4 pt-4 pb-8 text-left shadow-2xl shadow-black/70 backdrop-blur-xl transition-colors focus-within:border-white/35">
        <label htmlFor="w2-hero-query" className="sr-only">
          {h.searchLabel}
        </label>
        <textarea
          id="w2-hero-query"
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
          className="peer block h-16 w-full resize-none bg-transparent text-sm text-[#F5F5F5] outline-none placeholder:text-transparent focus:placeholder:text-white/35"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-4 left-4 text-sm text-white/80 peer-focus:opacity-0 peer-[:not(:placeholder-shown)]:opacity-0"
        >
          <Typewriter words={h.searchExamples} />
        </span>
        <p className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Search className="size-3" /> {h.searchHint}
        </p>
      </div>
      <button
        type="submit"
        className={cn(SIGNAL_BUTTON, "absolute -bottom-5 left-1/2 -translate-x-1/2 px-5 py-2.5 whitespace-nowrap ring-4 ring-[#0A0A0A]")}
      >
        {h.searchSubmit}
      </button>
    </form>
  )
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
              <div key={`${v.id}-${i}`} className="w-44 shrink-0 rounded-xl border border-white/[0.06] bg-[#1A1A1A] p-1 sm:w-48">
                <div className="relative">
                  <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover" />
                  <ScoreBadge value={v.outlierMultiplier} className="absolute top-1.5 left-1.5" />
                </div>
                <p className="mt-1.5 line-clamp-2 px-1 text-[11px] leading-snug font-medium text-white/85">{v.title}</p>
                <p className="px-1 pt-0.5 pb-1 text-[10px] text-white/40">{t.landing.hero.views(formatNumber(roundViews(v.viewCount)))}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="lp-wall-shade absolute inset-0" />
      <div className="lp-wall-edge absolute inset-y-0 left-0" />
      <div className="lp-wall-edge absolute inset-y-0 right-0 -scale-x-100" />
    </div>
  )
}

// --- PRODUCT PREVIEW ---

function ProductPreview({ videos }: { videos: LandingVideo[] }) {
  const { t } = useI18n()
  const p = t.landing.preview
  const sideIcons = [LayoutGrid, Flame, TrendingUp, Compass, ImageIcon, Type, Wallet]
  if (videos.length === 0) return null

  return (
    <section aria-label={p.title} className="px-4 pb-28 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#262626] bg-[#111111] shadow-[0_40px_120px_-40px_rgba(255,16,26,0.25)]">
        <div className="flex items-center gap-2 border-b border-[#262626] px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="mx-auto truncate rounded-md bg-[#1A1A1A] px-6 py-1 text-[11px] text-white/45 sm:px-16">{p.url}</span>
        </div>

        <div className="flex">
          <div aria-hidden className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r border-[#262626] py-5 sm:flex">
            {sideIcons.map((Icon, i) => (
              <span key={i} className={cn("flex size-8 items-center justify-center rounded-lg", i === 1 ? "bg-[#F5F5F5] text-[#0A0A0A]" : "text-white/40")}>
                <Icon className="size-4" />
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-white/50">{p.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {p.filters.map((f, i) => (
                  <span
                    key={f}
                    className={cn(
                      "rounded-full border px-2.5 py-1",
                      i === 1 ? "border-[#FF101A]/60 text-[#F5F5F5]" : "border-[#262626] text-white/55"
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-6 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {videos.map((v, i) => (
                <div key={v.id} className={cn(i >= 2 && "hidden min-[420px]:block", i >= 4 && "min-[420px]:hidden lg:block")}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// --- THE MEDIAN LINE (why outliers) ---

function MedianLine() {
  const { t } = useI18n()
  const s = t.landing.solution
  // A channel whose uploads hover around its median, plus one breakout.
  const bars = [32, 41, 28, 36, 44, 30, 38, 100, 35, 40]

  return (
    <section className="border-t border-[#262626] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-end">
        <div>
          <h2 className="max-w-xl text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{s.title}</h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">{s.text}</p>
          <ul className="mt-8 max-w-xl divide-y divide-[#262626] border-y border-[#262626]">
            {s.points.map((point) => (
              <li key={point} className="flex items-start gap-3 py-3 text-white/85">
                <Check className="mt-1 size-4 shrink-0 text-white/40" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <Reveal>
          <figure>
            <figcaption className="flex items-baseline justify-between text-xs text-white/50">
              <span>{s.chartTitle}</span>
              <span>{s.chartViews}</span>
            </figcaption>
            <div className="relative mt-14 flex h-72 items-end gap-2 sm:h-80 sm:gap-3">
              {/* The line every video is measured against */}
              <div aria-hidden className="absolute inset-x-0 bottom-[36%] z-10 border-t border-dashed border-white/40">
                <span className="absolute -top-6 left-0 text-[11px] text-white/60">{s.median}</span>
              </div>
              {bars.map((h, i) => {
                const hot = h === 100
                return (
                  <div key={i} className="relative flex h-full flex-1 items-end">
                    {hot && (
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 text-sm font-semibold whitespace-nowrap text-[#FF101A] tabular-nums">
                        {s.outlier}
                      </span>
                    )}
                    <div
                      className={cn("lp-bar w-full rounded-t-sm", hot ? "bg-[#FF101A]" : "bg-[#262626]")}
                      style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                    />
                  </div>
                )
              })}
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}

// --- PROBLEM ---

function Problem() {
  const { t } = useI18n()
  const p = t.landing.problem
  const items = [
    { title: p.gutTitle, text: p.gutText },
    { title: p.lateTitle, text: p.lateText },
    { title: p.modelsTitle, text: p.modelsText },
  ]

  return (
    <section className="px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={`${p.titleBefore}${p.titleHighlight}`} subtitle={p.subtitle} />
        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="border-t border-white/25 pt-5">
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// --- PROOF (LIVE DATA, as a ledger) ---

function Proof({ videos }: { videos: LandingVideo[] }) {
  const { t, compact, ago } = useI18n()
  const p = t.landing.proof
  const v2 = t.landing.v2
  if (videos.length < 3) return null

  return (
    <section id="proof" className="scroll-mt-24 border-t border-[#262626] bg-[#111111] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={`${p.titleBefore}${p.titleHighlight}`} subtitle={p.subtitle(t.brand)} />

        <Reveal className="mt-12">
          <div className="hidden grid-cols-[10rem_minmax(0,1fr)_minmax(0,15rem)_5rem] gap-6 border-b border-[#262626] pb-3 text-xs text-white/45 md:grid">
            <span className="col-span-2">{v2.ledgerVideo}</span>
            <span>{v2.ledgerViews}</span>
            <span className="text-right">{v2.ledgerScore}</span>
          </div>
          <ol className="divide-y divide-[#262626]">
            {videos.map((v) => {
              const median = v.viewCount / Math.max(v.outlierMultiplier, 1)
              return (
                <li
                  key={v.id}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-x-4 gap-y-4 py-5 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,15rem)_5rem] md:items-center md:gap-6"
                >
                  <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-full rounded-md object-cover ring-1 ring-white/10" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm leading-snug font-medium">{v.title}</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-white/50">
                      <ChannelAvatar src={v.channelAvatar} />
                      <span className="truncate">
                        <span className="text-white/75">{v.channelTitle}</span>
                        <span className="ml-2">{t.common.subscribers(compact(v.channelSubscribers))}</span>
                        <span className="ml-2 hidden sm:inline">{ago(v.publishedAt, "day")}</span>
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 space-y-2 md:col-span-1">
                    <ProofBar label={p.median} views={median} width={Math.max(2, 100 / v.outlierMultiplier)} />
                    <ProofBar label={p.thisVideo} views={v.viewCount} width={100} hot />
                  </div>
                  <p className="col-start-3 row-start-1 text-right text-2xl font-semibold tracking-tight text-[#FF101A] tabular-nums md:col-start-auto md:row-start-auto md:text-3xl">
                    {formatMultiplier(v.outlierMultiplier)}
                  </p>
                </li>
              )
            })}
          </ol>
        </Reveal>

        <div className="mt-12">
          <Link href="/signup" className={SIGNAL_BUTTON}>
            {p.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}

function ProofBar({ label, views, width, hot = false }: { label: string; views: number; width: number; hot?: boolean }) {
  const { t, compact } = useI18n()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-white/45">{label}</span>
        <span className={cn("tabular-nums", hot ? "font-semibold text-[#F5F5F5]" : "text-white/55")}>{t.common.views(compact(views))}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#1F1F1F]">
        <div className={cn("lp-grow-x h-full rounded-full", hot ? "bg-[#FF101A]" : "bg-white/30")} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

// --- FEATURES (a plain index of the tools) ---

function Features() {
  const { t } = useI18n()
  const f = t.landing.features
  const tools = [
    { icon: Flame, title: f.outliersTitle, text: f.outliersText },
    { icon: Radar, title: f.nicheTitle, text: f.nicheText },
    { icon: TrendingUp, title: f.trendsTitle, text: f.trendsText },
    { icon: ImageIcon, title: f.thumbsTitle, text: f.thumbsText },
    { icon: Type, title: f.titlesTitle, text: f.titlesText },
    { icon: Bot, title: f.aiTitle, text: f.aiText },
    { icon: Wallet, title: f.revenueTitle, text: f.revenueText },
  ]

  return (
    <section id="features" className="scroll-mt-24 border-t border-[#262626] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            {/* French puts a space before the colon; keep it from wrapping onto its own line */}
            {f.titleBefore.replace(" :", " :")}
            {f.titleHighlight}
          </h2>
          <p className="mt-5 max-w-md text-base text-white/55 sm:text-lg">{f.subtitle}</p>
        </div>
        <ul className="divide-y divide-[#262626] border-y border-[#262626]">
          {tools.map(({ icon: Icon, title, text }) => (
            <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 py-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#1A1A1A]">
                <Icon className="size-4 text-white/70" />
              </span>
              <div>
                <h3 className="font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-white/55">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// --- NICHE EXPLORER (LIVE DATA) ---

function NicheExplorer({ niches }: { niches: LandingData["niches"] }) {
  const { t, locale } = useI18n()
  const d = t.landing.demo
  const [active, setActive] = useState(0)
  if (niches.length === 0) return null
  const current = niches[Math.min(active, niches.length - 1)]

  return (
    <section id="demo" className="scroll-mt-24 border-t border-[#262626] bg-[#111111] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={d.title} subtitle={d.subtitle(t.brand)} />

        <div className="mt-10 flex gap-6 overflow-x-auto border-b border-[#262626]">
          {niches.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={cn(
                "-mb-px shrink-0 border-b-2 pt-1 pb-3 text-sm font-medium transition-colors",
                i === active ? "border-[#F5F5F5] text-[#F5F5F5]" : "border-transparent text-white/50 hover:text-white/80"
              )}
            >
              {n.label[locale]}
            </button>
          ))}
        </div>

        <div key={current.id} className="lp-swap mt-10 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {current.videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>

        <div className="mt-12">
          <Link href="/signup" className={GHOST_BUTTON}>
            {d.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}

// --- METHOD (a real sequence, so it is numbered) ---

function Method() {
  const { t } = useI18n()
  const m = t.landing.method

  return (
    <section id="method" className="scroll-mt-24 border-t border-[#262626] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={m.title} />
        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
          {m.steps.map((s, i) => (
            <li key={s.title} className="border-t border-white/25 pt-5">
              <span className="text-5xl font-semibold tracking-tight text-white/20 tabular-nums">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// --- COMPARISON ---

function Comparison() {
  const { t } = useI18n()
  const c = t.landing.comparison

  return (
    <section className="border-t border-[#262626] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={c.title} />
        <div className="mt-12 overflow-hidden rounded-2xl border border-[#262626]">
          <div className="hidden grid-cols-[1.1fr_1fr_1fr] bg-[#1A1A1A] text-sm sm:grid">
            <div className="p-5" />
            <div className="p-5 text-white/55">{c.seoTools}</div>
            <div className="border-t-2 border-[#FF101A] p-5 font-semibold">{t.brand}</div>
          </div>
          {c.rows.map(([label, them, us]) => (
            <div key={label} className="grid grid-cols-1 border-t border-[#262626] text-sm first:border-t-0 sm:grid-cols-[1.1fr_1fr_1fr] sm:first:border-t">
              <div className="px-5 pt-5 font-medium sm:p-5">{label}</div>
              <div className="flex items-start gap-2 px-5 pt-3 text-white/45 sm:p-5">
                <X className="mt-0.5 size-4 shrink-0 text-white/25" />
                <span>
                  <span className="sr-only sm:hidden">{c.seoTools} : </span>
                  {them}
                </span>
              </div>
              <div className="flex items-start gap-2 px-5 pt-2 pb-5 text-[#F5F5F5] sm:bg-[#1A1A1A]/50 sm:p-5">
                <Check className="mt-0.5 size-4 shrink-0 text-[#FF101A]" />
                <span>
                  <span className="sr-only sm:hidden">{t.brand} : </span>
                  {us}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// --- FAQ ---

function Faq() {
  const { t } = useI18n()
  const faq = t.landing.faq

  return (
    <section id="faq" className="scroll-mt-24 border-t border-[#262626] px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">{faq.title}</h2>
        <div className="divide-y divide-[#262626] border-y border-[#262626]">
          {faq.items.map((item, i) => (
            <details key={item.q} open={i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-white/40 transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="max-w-prose pb-5 leading-relaxed text-white/60">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// --- FINAL CTA ---

function FinalCta() {
  const { t } = useI18n()
  const c = t.landing.finalCta

  return (
    <section className="border-t border-[#262626] px-4 py-24 sm:px-6 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-4xl text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-7xl">{c.title}</h2>
        <p className="mt-6 max-w-xl text-base text-white/60 sm:text-lg">{c.text(t.brand)}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className={SIGNAL_BUTTON}>
            {c.signUp}
          </Link>
          <a href="#demo" className={GHOST_BUTTON}>
            {c.demo}
          </a>
        </div>
      </div>
    </section>
  )
}

// --- FOOTER ---

function Footer() {
  const { t } = useI18n()
  const l = t.landing

  return (
    <footer className="border-t border-[#262626] px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo />
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/50">
          {NAV_KEYS.map((n) => (
            <a key={n.href} href={n.href} className="rounded hover:text-[#F5F5F5]">
              {l.nav[n.key]}
            </a>
          ))}
          <Link href="/login" className="rounded hover:text-[#F5F5F5]">
            {l.nav.signIn}
          </Link>
        </div>
        <p className="text-center text-sm text-white/40">{l.footer.rights(new Date().getFullYear(), t.brand)}</p>
      </div>
    </footer>
  )
}

// --- SHARED ---

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-5 max-w-2xl text-base text-pretty text-white/55 sm:text-lg">{subtitle}</p>}
    </div>
  )
}

function ScoreBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("rounded bg-[#FF101A] px-1.5 py-0.5 text-[11px] font-bold text-[#0A0A0A] tabular-nums", className)}>
      {formatMultiplier(value)}
    </span>
  )
}

/** Dark take on the landing VideoCard: the score is the only red on it. */
function VideoCard({ video }: { video: LandingVideo }) {
  const { t, compact, ago } = useI18n()
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#1A1A1A] ring-1 ring-white/10">
        <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
        <ScoreBadge value={video.outlierMultiplier} className="absolute top-2 left-2" />
        {video.duration && (
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">{video.duration}</span>
        )}
      </div>
      <div className="flex gap-2.5">
        <ChannelAvatar src={video.channelAvatar} />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm leading-snug font-medium">{video.title}</p>
          <p className="mt-1 flex min-w-0 gap-2 text-xs text-white/50">
            <span className="truncate">{video.channelTitle}</span>
            <span className="shrink-0">{t.common.views(compact(video.viewCount))}</span>
            <span className="hidden shrink-0 sm:inline">{ago(video.publishedAt, "day")}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
