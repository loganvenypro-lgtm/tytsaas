"use client"

import { useEffect, useRef, useState } from "react"

import { useI18n } from "@/components/i18n-provider"
import { INTL_LOCALES } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export interface LandingVideo {
  id: string
  title: string
  thumbnail: string
  channelTitle: string
  channelAvatar: string | null
  channelSubscribers: number
  viewCount: number
  outlierMultiplier: number
  publishedAt: string
  duration: string
}

// --- FORMATTERS ---

/** Grouped integer ("4 658" / "4,658") in the page's language. */
export function useFormatNumber() {
  const { locale } = useI18n()
  return (n: number) => new Intl.NumberFormat(INTL_LOCALES[locale]).format(n)
}

export function formatMultiplier(n: number) {
  return n >= 100 ? `×${Math.round(n)}` : `×${n.toFixed(1).replace(".0", "")}`
}

// --- MOTION HELPERS ---

/** Fades children in the first time they scroll into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Content already on screen at load shouldn't wait for the observer's first callback.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={cn("lp-reveal", visible && "lp-reveal-in", className)}>
      {children}
    </div>
  )
}

/** Counts from 0 to `value` once visible. */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  const { locale } = useI18n()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const t = reduced ? 1 : Math.min(1, (now - start) / 1600)
        const step = 10 ** decimals
        setDisplay(Math.round(value * (1 - Math.pow(1 - t, 4)) * step) / step)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, decimals])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {new Intl.NumberFormat(INTL_LOCALES[locale], { maximumFractionDigits: decimals }).format(display)}
      {suffix}
    </span>
  )
}

/** Cycles through words with a typing effect. */
export function Typewriter({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = words[index % words.length]
    const done = !deleting && length === word.length
    const empty = deleting && length === 0
    const delay = done ? 1600 : empty ? 250 : deleting ? 35 : 70

    const timer = setTimeout(() => {
      if (done) setDeleting(true)
      else if (empty) {
        setDeleting(false)
        setIndex((i) => i + 1)
      } else setLength((l) => l + (deleting ? -1 : 1))
    }, delay)
    return () => clearTimeout(timer)
  }, [words, index, length, deleting])

  return (
    <span>
      {words[index % words.length].slice(0, length)}
      <span className="lp-caret ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-[#e3061a]" />
    </span>
  )
}

/** Feature card: a bordered panel whose border firms up on hover. */
export function SpotlightCard({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode
  className?: string
  tone?: "light" | "dark"
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border transition-all duration-300",
        tone === "light"
          ? "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md"
          : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]",
        className
      )}
    >
      {children}
    </div>
  )
}

// --- VIDEO CARD ---

/** Stored avatar URLs go stale when a channel changes its picture, so a failed load falls back to a grey disc. */
export function ChannelAvatar({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className="size-7 shrink-0 rounded-full bg-slate-200" />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote YouTube avatars
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-7 shrink-0 rounded-full ring-1 ring-slate-200"
    />
  )
}

export function VideoCard({ video }: { video: LandingVideo }) {
  const { t, compact, ago } = useI18n()
  return (
    <div className="group/card flex min-w-0 flex-col gap-2.5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnails */}
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover/card:scale-105"
        />
        <span className="absolute top-2 left-2 rounded-md bg-[#e3061a] px-1.5 py-0.5 text-[11px] font-bold text-white shadow-md shadow-[#e3061a]/30">
          {formatMultiplier(video.outlierMultiplier)}
        </span>
        {video.duration && (
          <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1 py-0.5 text-[10px] font-medium text-white">
            {video.duration}
          </span>
        )}
      </div>
      <div className="flex gap-2.5">
        <ChannelAvatar src={video.channelAvatar} />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm leading-snug font-medium text-slate-800">{video.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {video.channelTitle} · {t.common.views(compact(video.viewCount))} · {ago(video.publishedAt, "day")}
          </p>
        </div>
      </div>
    </div>
  )
}
