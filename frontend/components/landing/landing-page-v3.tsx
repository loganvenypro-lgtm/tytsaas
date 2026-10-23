"use client"
/* eslint-disable @next/next/no-img-element -- remote YouTube thumbnails and avatars */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BadgeCheck, Check, ChevronDown, Command, Lock, RotateCcw, Sparkles, X } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { CURRENCY, PLANS, monthlyPrice, yearlyPrice, type BillingPeriod } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { compactStat, type LandingCreator, type LandingData, type LandingStats } from "./landing-page"
import { ChannelAvatar, CountUp, formatMultiplier, useFormatNumber, type LandingVideo } from "./landing-parts"

/*
 * /welcome3 palette (focus ring, wide type and the hero motion live on .w3-root in globals.css):
 * paper #FFFFFF page, mist #F1F2F4 bands, ink #16171B text and dark panels, slate #5B6070 secondary text,
 * rule #E3E5E9 hairlines, signal #FF101A for bars and big scores, signal-deep #D6000F wherever red carries
 * small text (buttons, badges), since #FF101A on white falls short of 4.5:1.
 * Type is Archivo throughout; .w3-wide stretches it to 125% for headlines and every ×score.
 */

const NAV = [
  { href: "#tools", key: "tools" },
  { href: "#niches", key: "niches" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#D6000F] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#B8000D]"
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#16171B]/15 px-5 py-3 text-sm font-semibold text-[#16171B] transition-colors hover:border-[#16171B]/40"

export function LandingPageV3({ data, fontClass }: { data: LandingData; fontClass: string }) {
  const { t } = useI18n()
  const { videos, breakouts, niches, creators, stats } = data
  return (
    <div
      className={cn(
        "w3-root relative min-h-screen overflow-x-clip bg-white text-[#16171B] selection:bg-[#FF101A] selection:text-white",
        fontClass
      )}
    >
      <a
        href="#w3-main"
        className="sr-only z-[60] rounded-lg bg-[#16171B] px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.landing.v3.skip}
      </a>
      <Navbar />
      <main id="w3-main">
        <Hero breakouts={breakouts.length > 0 ? breakouts : videos} stats={stats} creators={creators} />
        <Creators creators={creators} />
        <Stats stats={stats} />
        <Versus />
        <Niches niches={niches} />
        <Tools videos={videos} niches={niches} creators={creators} />
        <Steps />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

// --- LOGO ---

function Logo({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n()
  return (
    <Link href="/welcome3" className="flex items-center gap-2 rounded-lg">
      <span className="flex size-8 items-center justify-center rounded-lg bg-[#D6000F]">
        <Command className="size-4 text-white" />
      </span>
      <span className={cn("w3-wide text-lg font-extrabold tracking-tight", dark && "text-white")}>{t.brand}</span>
    </Link>
  )
}

// --- NAVBAR ---

function Navbar() {
  const { t } = useI18n()
  const l = t.landing
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        scrolled ? "border-[#E3E5E9] bg-white/90 backdrop-blur-xl" : "border-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-[#5B6070] transition-colors hover:text-[#16171B]">
              {l.v3.nav[n.key]}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden rounded-lg text-sm text-[#5B6070] transition-colors hover:text-[#16171B] sm:block">
            {l.nav.signIn}
          </Link>
          <Link href="/signup" className="rounded-xl bg-[#16171B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2A2C33]">
            {l.nav.start}
          </Link>
        </div>
      </nav>
    </header>
  )
}

// --- HERO ---

function Hero({ breakouts, stats, creators }: { breakouts: LandingVideo[]; stats: LandingStats; creators: LandingCreator[] }) {
  const { t } = useI18n()
  const h = t.landing.v3.hero
  const formatNumber = useFormatNumber()
  const avatars = creators.slice(0, 4)

  return (
    <section className="px-4 pt-28 pb-20 sm:px-6 sm:pt-36 lg:pb-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-end gap-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
        <div className="lg:pb-6">
          {stats.channels > 0 && (
            <p className="inline-flex items-center gap-2.5 rounded-full bg-[#F1F2F4] py-1 pr-3.5 pl-1 text-sm text-[#5B6070]">
              {avatars.length >= 3 ? (
                <span className="flex -space-x-2">
                  {avatars.map((c) => (
                    <img key={c.name} src={c.avatar} alt="" referrerPolicy="no-referrer" className="size-6 rounded-full bg-[#E3E5E9] ring-2 ring-[#F1F2F4]" />
                  ))}
                </span>
              ) : (
                <span className="ml-2.5 size-2 rounded-full bg-[#FF101A]" />
              )}
              {h.badge(formatNumber(stats.channels))}
            </p>
          )}

          <h1 className="w3-wide mt-6 text-[2.6rem] leading-[0.98] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.5rem]">
            {h.title}
          </h1>
          <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-pretty text-[#5B6070] sm:text-lg">{h.subtitle(t.brand)}</p>

          <ChannelForm id="w3-hero-channel" className="mt-9 max-w-[34rem]" />
        </div>

        <OutlierPanel videos={breakouts.slice(0, 3)} />
      </div>
    </section>
  )
}

/** Channel link field: the first step of the product, so it opens sign-up. */
function ChannelForm({ id, className, dark = false }: { id: string; className?: string; dark?: boolean }) {
  const { t } = useI18n()
  const h = t.landing.v3.hero
  const router = useRouter()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        router.push("/signup")
      }}
      className={className}
    >
      <label htmlFor={id} className="sr-only">
        {h.inputLabel}
      </label>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl border p-2 transition-colors sm:flex-row sm:items-center",
          dark ? "border-white/15 bg-white/[0.06] focus-within:border-white/40" : "border-[#E3E5E9] bg-white focus-within:border-[#16171B]/40"
        )}
      >
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={h.inputPlaceholder}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base outline-none",
            dark ? "text-white placeholder:text-white/40" : "placeholder:text-[#8A8F9C]"
          )}
        />
        <button type="submit" className={PRIMARY}>
          {h.submit}
        </button>
      </div>
      <p className={cn("mt-3 text-sm", dark ? "text-white/55" : "text-[#5B6070]")}>{h.reassurance}</p>
    </form>
  )
}

// A channel's eleven ordinary uploads, as multiples of its median; the twelfth is the outlier.
const ORDINARY = [0.85, 1.2, 0.7, 1.05, 1.35, 0.9, 0.6, 1.1, 0.95, 1.25, 0.8]
const MEDIAN_HEIGHT = 26 // % of the chart

/**
 * The page's one orchestrated moment: eleven bars settle around the median line,
 * then the outlier grows through the top of its own frame.
 */
function OutlierPanel({ videos }: { videos: LandingVideo[] }) {
  const { t, compact } = useI18n()
  const h = t.landing.v3.hero
  const formatNumber = useFormatNumber()
  const [active, setActive] = useState(0)
  const video = videos[Math.min(active, videos.length - 1)] as LandingVideo | undefined
  const multiplier = video?.outlierMultiplier ?? 24
  // Past ~4× the bar no longer fits: it is capped above the frame, which is the point.
  const burst = Math.min(multiplier * MEDIAN_HEIGHT, 155)

  return (
    <div className="w3-dark relative mt-24 rounded-3xl bg-[#16171B] p-5 text-white sm:p-6 lg:mt-28">
      <p className="text-xs text-white/55">{h.chartTitle}</p>

      <div key={video?.id ?? "sample"} className="relative mt-5 h-44 sm:h-52">
        <div aria-hidden className="absolute inset-x-0 z-10 border-t border-dashed border-white/45" style={{ bottom: `${MEDIAN_HEIGHT}%` }}>
          <span className="absolute -top-5 left-0 text-[11px] text-white/60">{h.median}</span>
        </div>
        <div aria-hidden className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
          {ORDINARY.map((m, i) => (
            <div key={i} className="w3-bar flex-1 rounded-t-[3px] bg-white/[0.16]" style={{ height: `${m * MEDIAN_HEIGHT}%`, animationDelay: `${i * 45}ms` }} />
          ))}
          <div className="relative flex-1 self-end" style={{ height: `${burst}%` }}>
            <div className="w3-burst absolute inset-0 rounded-t-[3px] bg-[#FF101A]" />
            <span className="w3-label w3-wide absolute top-0 right-full mr-3 text-5xl leading-none font-extrabold tracking-tight whitespace-nowrap text-[#FF101A] tabular-nums sm:text-6xl">
              {formatMultiplier(multiplier)}
            </span>
          </div>
        </div>
      </div>

      {video && (
        <div className="mt-6 flex gap-4 border-t border-white/10 pt-5">
          <img src={video.thumbnail} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover sm:w-36" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-snug font-semibold">{video.title}</p>
            <p className="mt-1.5 text-xs text-white/55">
              {t.common.views(formatNumber(video.viewCount))}, {h.times(formatMultiplier(multiplier).slice(1))}
            </p>
            <p className="mt-1 truncate text-xs text-white/40">
              {video.channelTitle}, {t.common.subscribers(compact(video.channelSubscribers))}
            </p>
          </div>
        </div>
      )}

      {videos.length > 1 && (
        <div role="group" aria-label={h.pick} className="mt-5 flex gap-2">
          {videos.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              aria-label={v.title}
              className={cn(
                "relative w-16 overflow-hidden rounded-md ring-2 transition-opacity",
                i === active ? "opacity-100 ring-white" : "opacity-50 ring-transparent hover:opacity-80"
              )}
            >
              <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- CREATORS ---

function Creators({ creators }: { creators: LandingCreator[] }) {
  const { t, compact } = useI18n()
  if (creators.length < 4) return null

  return (
    <section aria-label={t.landing.v3.creators(t.brand)} className="border-y border-[#E3E5E9] py-8">
      <p className="px-4 text-center text-sm text-[#5B6070]">{t.landing.v3.creators(t.brand)}</p>
      <div className="lp-marquee-mask mt-5 flex overflow-hidden">
        <div className="lp-marquee flex shrink-0 gap-10 pr-10" style={{ animationDuration: "55s" }}>
          {[...creators, ...creators].map((c, i) => (
            <div key={`${c.name}-${i}`} aria-hidden={i >= creators.length} className="flex shrink-0 items-center gap-2.5">
              <img src={c.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-9 rounded-full bg-[#F1F2F4]" />
              <div className="leading-tight">
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {c.name} <BadgeCheck className="size-3.5 text-[#8A8F9C]" />
                </p>
                <p className="text-xs text-[#5B6070]">{t.common.subscribers(compact(c.subscribers))}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// --- STATS ---

function Stats({ stats }: { stats: LandingStats }) {
  const { t } = useI18n()
  const h = t.landing.hero
  if (stats.videos === 0) return null
  const items = [
    { ...compactStat(stats.videos, t.landing.units), label: h.statVideos },
    { ...compactStat(stats.bigOutliers, t.landing.units), label: h.statOutliers },
    { ...compactStat(stats.views, t.landing.units), label: h.statViews },
  ]

  return (
    <section className="px-4 py-20 sm:px-6">
      <dl className="mx-auto grid max-w-6xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
        {items.map((s) => (
          <div key={s.label} className="border-l-2 border-[#16171B] pl-5">
            <dd className="w3-wide text-5xl font-extrabold tracking-tight lg:text-6xl">
              <CountUp value={s.value} decimals={s.decimals} suffix={s.unit && ` ${s.unit}`} />
            </dd>
            <dt className="mt-2 text-sm text-[#5B6070]">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

// --- WITHOUT / WITH ---

function Versus() {
  const { t } = useI18n()
  const v = t.landing.v3.versus

  return (
    <section className="bg-[#F1F2F4] px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={v.title} />
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 sm:p-8">
            <h3 className="font-semibold text-[#5B6070]">{v.without}</h3>
            <ul className="mt-5 space-y-4">
              {v.withoutItems.map((item) => (
                <li key={item} className="flex gap-3 text-[#5B6070]">
                  <X className="mt-0.5 size-5 shrink-0 text-[#8A8F9C]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="w3-dark rounded-2xl bg-[#16171B] p-6 text-white sm:p-8">
            <h3 className="font-semibold">{v.with(t.brand)}</h3>
            <ul className="mt-5 space-y-4">
              {v.withItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-[#FF101A]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// --- NICHES (LIVE DATA) ---

function Niches({ niches }: { niches: LandingData["niches"] }) {
  const { t, locale } = useI18n()
  const n = t.landing.v3.niches
  const [active, setActive] = useState(0)
  if (niches.length === 0) return null
  const current = niches[Math.min(active, niches.length - 1)]

  return (
    <section id="niches" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={n.title} subtitle={n.subtitle(t.brand)} />

        <div className="-mx-4 mt-10 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {niches.map((niche, i) => (
            <button
              key={niche.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                i === active ? "bg-[#16171B] text-white" : "bg-[#F1F2F4] text-[#5B6070] hover:text-[#16171B]"
              )}
            >
              {niche.label[locale]}
            </button>
          ))}
        </div>

        <div key={current.id} className="lp-swap mt-10 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {current.videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>

        <div className="mt-12">
          <Link href="/signup" className={SECONDARY}>
            {n.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}

// --- TOOLS (each tile shows the tool's own screen, not an icon) ---

function Tools({ videos, niches, creators }: { videos: LandingVideo[]; niches: LandingData["niches"]; creators: LandingCreator[] }) {
  const { t, locale, compact } = useI18n()
  const f = t.landing.features
  const v3 = t.landing.v3.tools
  // Each niche's typical score: the median multiplier of its sample videos
  const nicheScores = niches
    .map((n) => {
      const sorted = n.videos.map((v) => v.outlierMultiplier).sort((a, b) => a - b)
      return { label: n.label[locale], score: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0 }
    })
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
  const topScore = nicheScores[0]?.score ?? 1

  return (
    <section id="tools" className="scroll-mt-20 border-t border-[#E3E5E9] px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={v3.title} subtitle={v3.subtitle} />

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-6">
          {/* Top videos: the main screen of the app */}
          <Tile title={v3.topVideos} text={v3.topVideosText} className="lg:col-span-4 lg:row-span-2">
            <ol className="divide-y divide-[#E3E5E9] rounded-xl border border-[#E3E5E9] bg-white">
              {videos.slice(0, 5).map((v) => (
                <li key={v.id} className="flex items-center gap-3 p-3">
                  <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-20 shrink-0 rounded-md object-cover sm:w-24" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{v.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[#5B6070]">
                      {v.channelTitle}, {t.common.views(compact(v.viewCount))}
                    </p>
                  </div>
                  <span className="w3-wide shrink-0 text-lg font-extrabold text-[#D6000F] tabular-nums">{formatMultiplier(v.outlierMultiplier)}</span>
                </li>
              ))}
            </ol>
          </Tile>

          <Tile title={f.nicheTitle} text={f.nicheText} className="lg:col-span-2">
            {nicheScores.length > 0 && (
              <ul className="space-y-3">
                {nicheScores.map((n) => (
                  <li key={n.label}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate font-medium">{n.label}</span>
                      <span className="text-[#5B6070] tabular-nums">{formatMultiplier(n.score)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#E3E5E9]">
                      <div className="h-full rounded-full bg-[#FF101A]" style={{ width: `${(n.score / topScore) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tile>

          <Tile title={f.titlesTitle} text={f.titlesText} className="lg:col-span-2">
            <ul className="space-y-2 text-sm">
              {f.titlePatterns.map((parts) => (
                <li key={parts.join("")} className="rounded-lg bg-white px-3 py-2">
                  {parts.map((part, i) =>
                    part.startsWith("[") ? (
                      <span key={i} className="rounded bg-[#16171B] px-1 text-white">
                        {part.slice(1, -1)}
                      </span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </li>
              ))}
            </ul>
          </Tile>

          <Tile title={f.aiTitle} text={f.aiText} className="lg:col-span-3">
            <div className="space-y-3 text-sm">
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#16171B] px-4 py-2.5 text-white">{f.aiQuestion}</p>
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-4 py-3">
                <p className="flex gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-[#D6000F]" />
                  {f.aiAnswer}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-10 text-[#5B6070]">
                  {f.aiIdeas.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Tile>

          <Tile title={f.trendsTitle} text={f.trendsText} className="lg:col-span-3">
            {creators.length > 0 && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {creators.slice(0, 4).map((c) => (
                  <li key={c.name} className="flex items-center gap-2.5 rounded-lg bg-white p-2.5">
                    <img src={c.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-8 rounded-full bg-[#F1F2F4]" />
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-[#5B6070]">{t.common.subscribers(compact(c.subscribers))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        </div>
      </div>
    </section>
  )
}

function Tile({ title, text, className, children }: { title: string; text: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-6 rounded-2xl bg-[#F1F2F4] p-5 sm:p-6", className)}>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-[#5B6070]">{text}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  )
}

// --- STEPS (a real sequence, so it is numbered) ---

function Steps() {
  const { t } = useI18n()
  const steps = t.landing.method.steps

  return (
    <section className="border-t border-[#E3E5E9] px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={t.landing.v3.steps.title} />
        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="w3-wide block text-6xl leading-none font-extrabold text-[#E3E5E9] tabular-nums">{i + 1}</span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[#5B6070]">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// --- PRICING ---

function Pricing() {
  const { t, locale } = useI18n()
  const p = t.pricing
  const v3 = t.landing.v3.pricing
  const [period, setPeriod] = useState<BillingPeriod>("yearly")
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n)

  return (
    <section id="pricing" className="scroll-mt-20 bg-[#F1F2F4] px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionHeading title={v3.title} subtitle={v3.subtitle} />
          <div role="group" aria-label={p.eyebrow} className="flex shrink-0 rounded-xl bg-white p-1">
            {(["monthly", "yearly"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                aria-pressed={period === id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  period === id ? "bg-[#16171B] text-white" : "text-[#5B6070] hover:text-[#16171B]"
                )}
              >
                {p[id]}
                {id === "yearly" && (
                  <span className={cn("text-xs font-semibold", period === id ? "text-[#FF6B71]" : "text-[#D6000F]")}>{v3.yearlyBadge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const copy = p.plans[plan.id]
            const featured = plan.id === "pro"
            return (
              <div
                key={plan.id}
                className={cn("flex flex-col rounded-2xl p-6 sm:p-8", featured ? "w3-dark bg-[#16171B] text-white" : "bg-white")}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{copy.name}</h3>
                  {featured && <span className="rounded-full bg-[#D6000F] px-2.5 py-0.5 text-xs font-semibold text-white">{p.popular}</span>}
                </div>
                <p className={cn("mt-1 text-sm", featured ? "text-white/60" : "text-[#5B6070]")}>{copy.audience}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="w3-wide text-5xl font-extrabold tracking-tight tabular-nums">{money(monthlyPrice(plan.monthly, period))}</span>
                  <span className={cn("text-sm", featured ? "text-white/60" : "text-[#5B6070]")}>{p.perMonth}</span>
                </p>
                <p className={cn("mt-1 h-5 text-xs", featured ? "text-white/50" : "text-[#5B6070]")}>
                  {period === "yearly" ? p.billedYearly(money(yearlyPrice(plan.monthly, period))) : p.billedMonthly}
                </p>
                <Link
                  href="/signup"
                  className={cn(
                    "mt-6",
                    featured ? PRIMARY : "inline-flex items-center justify-center rounded-xl bg-[#16171B] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2A2C33]"
                  )}
                >
                  {copy.cta}
                </Link>
                <ul className="mt-7 space-y-3 text-sm">
                  {copy.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-[#FF101A]" : "text-[#16171B]")} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[#5B6070]">
          <li className="flex items-center gap-2">
            <Check className="size-4" /> {p.reassurance.cancel}
          </li>
          <li className="flex items-center gap-2">
            <Lock className="size-4" /> {p.reassurance.secure}
          </li>
          <li className="flex items-center gap-2">
            <RotateCcw className="size-4" /> {p.reassurance.refund}
          </li>
        </ul>
      </div>
    </section>
  )
}

// --- FAQ ---

function Faq() {
  const { t } = useI18n()
  const faq = t.landing.v3.faq

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <h2 className="w3-wide text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">{faq.title}</h2>
        <div className="divide-y divide-[#E3E5E9] border-y border-[#E3E5E9]">
          {faq.items.map((item, i) => (
            <details key={item.q} open={i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-[#8A8F9C] transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="max-w-prose pb-5 leading-relaxed text-[#5B6070]">{item.a}</p>
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
  const c = t.landing.v3.final

  return (
    <section className="px-4 pb-6 sm:px-6">
      <div className="w3-dark mx-auto max-w-6xl rounded-3xl bg-[#16171B] px-6 py-16 text-white sm:px-12 sm:py-24">
        <h2 className="w3-wide max-w-3xl text-4xl leading-[1] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">{c.title}</h2>
        <p className="mt-6 max-w-xl text-base text-white/65 sm:text-lg">{c.text(t.brand)}</p>
        <ChannelForm id="w3-final-channel" dark className="mt-10 max-w-xl" />
      </div>
    </section>
  )
}

// --- FOOTER ---

function Footer() {
  const { t } = useI18n()
  const l = t.landing

  return (
    <footer className="px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo />
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[#5B6070]">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded hover:text-[#16171B]">
              {l.v3.nav[n.key]}
            </a>
          ))}
          <Link href="/blog" className="rounded hover:text-[#16171B]">
            {l.nav.blog}
          </Link>
          <Link href="/login" className="rounded hover:text-[#16171B]">
            {l.nav.signIn}
          </Link>
        </div>
        <p className="text-center text-sm text-[#5B6070]">{l.footer.rights(new Date().getFullYear(), t.brand)}</p>
      </div>
    </footer>
  )
}

// --- SHARED ---

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="w3-wide text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-5 max-w-2xl text-base text-pretty text-[#5B6070] sm:text-lg">{subtitle}</p>}
    </div>
  )
}

function VideoCard({ video }: { video: LandingVideo }) {
  const { t, compact, ago } = useI18n()
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-[#F1F2F4]">
        <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
        <span className="w3-wide absolute top-2 left-2 rounded-md bg-[#D6000F] px-1.5 py-0.5 text-xs font-extrabold text-white tabular-nums">
          {formatMultiplier(video.outlierMultiplier)}
        </span>
        {video.duration && (
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">{video.duration}</span>
        )}
      </div>
      <div className="flex gap-2.5">
        <ChannelAvatar src={video.channelAvatar} />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm leading-snug font-semibold">{video.title}</p>
          <p className="mt-1 flex min-w-0 gap-2 text-xs text-[#5B6070]">
            <span className="truncate">{video.channelTitle}</span>
            <span className="shrink-0">{t.common.views(compact(video.viewCount))}</span>
            <span className="hidden shrink-0 sm:inline">{ago(video.publishedAt, "day")}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
