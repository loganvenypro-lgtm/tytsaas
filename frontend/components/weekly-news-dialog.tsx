"use client"

import * as React from "react"
import Link from "next/link"

import { fetchJson } from "@/components/explorer/explorer-ui"
import { useI18n } from "@/components/i18n-provider"
import type { OutlierVideo } from "@/components/top-videos/outlier-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "cn"
import { WEEKLY_NEWS_OPEN_EVENT, weeklyEditionId, type WeeklyDigest } from "@/lib/weekly-news"

const storageKey = (userId: string) => `weekly_news_seen:${userId}`

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

/**
 * The creator's weekly recap, built by the worker every Monday (worker/jobs/weeklyDigest.js):
 * opens once per edition and per user, the seen edition is kept in localStorage.
 * Skipped when the week has nothing to show or before the user's first edition.
 */
export function WeeklyNewsDialog({ userId, name }: { userId: string; name?: string | null }) {
  const { t, locale, compact, date } = useI18n()
  const [digest, setDigest] = React.useState<WeeklyDigest | null>(null)
  const [open, setOpen] = React.useState(false)
  const firstName = name?.trim().split(/\s+/)[0] || null

  React.useEffect(() => {
    let seen: string | null = null
    try {
      seen = localStorage.getItem(storageKey(userId))
    } catch {
      // Storage blocked: show it, it simply won't be remembered
    }
    if (seen === weeklyEditionId()) return
    let cancelled = false
    fetchJson<WeeklyDigest>("/api/weekly-digest")
      .then((data) => {
        // Monday before the worker ran: this is still last week's edition, already seen
        if (cancelled || data.edition === seen || (!data.topVideos.length && !data.myChannel)) return
        setDigest(data)
        setOpen(true)
      })
      .catch(() => {
        // The recap is a bonus: on error it just waits for the next load
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // The home page reopens the recap on demand, even once this edition was seen
  React.useEffect(() => {
    function reopen() {
      fetchJson<WeeklyDigest>("/api/weekly-digest")
        .then((data) => {
          setDigest(data)
          setOpen(true)
        })
        .catch(() => {
          // Nothing to show: the button simply does nothing
        })
    }
    window.addEventListener(WEEKLY_NEWS_OPEN_EVENT, reopen)
    return () => window.removeEventListener(WEEKLY_NEWS_OPEN_EVENT, reopen)
  }, [])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next || !digest) return
    try {
      localStorage.setItem(storageKey(userId), digest.edition)
    } catch {
      // Storage blocked
    }
  }

  if (!digest) return null
  const close = () => handleOpenChange(false)
  const { myChannel } = digest
  // Monthly editions swap the "week" wording for "month"
  const tw = digest.frequency === "monthly" ? { ...t.weeklyNews, ...t.weeklyNews.month } : t.weeklyNews
  const daysToNext = digest.nextEditionAt
    ? Math.max(1, Math.ceil((new Date(digest.nextEditionAt).getTime() - Date.now()) / 86_400_000))
    : null
  const [lead, ...runnersUp] = digest.topVideos
  const hasBottom = Boolean(myChannel || digest.risingChannels.length)

  // The days the edition covers: "Du 12 au 18 octobre" (periodEnd is the edition day, 00:00)
  const from = new Date(digest.periodStart)
  const to = new Date(new Date(digest.periodEnd).getTime() - 86_400_000)
  const sameMonth = from.getMonth() === to.getMonth()
  const range = tw.range(
    date(from, locale === "fr" && sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" }),
    date(to, { day: "numeric", month: "long" }),
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="gap-1.5 px-5 pt-6 pb-5 pr-12 sm:px-8 sm:pt-8">
          <p className="text-sm text-muted-foreground">{range}</p>
          <DialogTitle className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
            {tw.title(firstName)}
          </DialogTitle>
          <DialogDescription className="text-sm">{tw.subtitle(digest.niche?.label[locale] ?? null)}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto">
          {lead && (
            <section className="flex flex-col gap-3 border-t px-5 py-6 sm:px-8">
              <h3 className="text-sm font-medium">{tw.lead[digest.topVideosSource]}</h3>
              <LeadVideo video={lead} />
            </section>
          )}

          {runnersUp.length > 0 && (
            <section className="flex flex-col gap-2 border-t px-5 py-6 sm:px-8">
              <SectionTitle title={tw.runnersUp} href="/trending/top-videos" linkLabel={tw.fullRanking} onNavigate={close} />
              <ol className="flex flex-col">
                {runnersUp.map((video, i) => (
                  <li key={video.id}>
                    <VideoRow video={video} rank={i + 2} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {digest.competitorHits.length > 0 && (
            <section className="flex flex-col gap-2 border-t px-5 py-6 sm:px-8">
              <SectionTitle title={tw.competitorHits} />
              <ul className="flex flex-col">
                {digest.competitorHits.map((video) => (
                  <li key={video.id}>
                    <VideoRow video={video} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasBottom && (
            <div className="grid grid-cols-1 border-t sm:grid-cols-2 sm:divide-x">
              {myChannel && (
                <section className="flex min-w-0 flex-col gap-4 px-5 py-6 sm:px-8">
                  <SectionTitle title={tw.myWeek} />
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      {myChannel.avatar && <AvatarImage src={myChannel.avatar} alt="" />}
                      <AvatarFallback>{myChannel.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 truncate text-sm font-semibold">{myChannel.name}</p>
                  </div>
                  <dl className="flex flex-wrap gap-x-6 gap-y-3">
                    <Figure value={String(myChannel.uploads7d)} label={tw.uploads(myChannel.uploads7d)} />
                    {myChannel.views7d != null && <Figure value={signed(compact(myChannel.views7d), myChannel.views7d)} label={tw.views} tone={myChannel.views7d} />}
                    {myChannel.subs7d != null && <Figure value={signed(compact(myChannel.subs7d), myChannel.subs7d)} label={tw.subs} tone={myChannel.subs7d} />}
                  </dl>
                  {myChannel.bestVideo && (
                    <a href={watchUrl(myChannel.bestVideo.id)} target="_blank" rel="noreferrer" className="group -m-1.5 flex gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted">
                      <Thumbnail video={myChannel.bestVideo} className="w-24" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {myChannel.bestVideo.multiplier != null && (
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {tw.bestVideo(multiplier(myChannel.bestVideo.multiplier, locale))}
                          </span>
                        )}
                        <span className="line-clamp-2 text-sm leading-snug font-medium">{myChannel.bestVideo.title}</span>
                      </div>
                    </a>
                  )}
                </section>
              )}

              {digest.risingChannels.length > 0 && (
                <section className={cn("flex min-w-0 flex-col gap-3 px-5 py-6 sm:px-8", myChannel && "border-t sm:border-t-0")}>
                  <SectionTitle title={tw.risingChannels} href="/trending/niche-finder" linkLabel={tw.exploreNiche} onNavigate={close} />
                  <ul className="-mx-2 flex flex-col">
                    {digest.risingChannels.map((channel) => (
                      <li key={channel.id}>
                        <a
                          href={`https://www.youtube.com/channel/${channel.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                        >
                          <Avatar className="size-8">
                            {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
                            <AvatarFallback>{channel.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">{channel.name}</span>
                            {channel.subscribers != null && (
                              <span className="text-xs text-muted-foreground">{t.common.subscribers(compact(channel.subscribers))}</span>
                            )}
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="m-0 flex-row items-center justify-between rounded-none px-5 py-4 sm:justify-between sm:px-8">
          <p className="text-sm text-muted-foreground">{daysToNext ? tw.nextEdition(daysToNext) : null}</p>
          <DialogClose render={<Button size="lg" className="px-4" />}>{tw.dismiss}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const signed = (text: string, value: number) => (value > 0 ? `+${text}` : text)

/** "56,1" / "56.1" in the interface language; no decimal from 100x, where it is noise. */
const multiplier = (value: number, locale: string) => {
  const digits = value >= 100 ? 0 : 1
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

function SectionTitle({
  title,
  href,
  linkLabel,
  onNavigate,
}: {
  title: string
  href?: string
  linkLabel?: string
  onNavigate?: () => void
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {href && linkLabel && (
        <Link
          href={href}
          onClick={onNavigate}
          className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

/** One figure of the creator's week: the number, then what it counts. */
function Figure({ value, label, tone }: { value: string; label: string; tone?: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-2xl leading-tight font-semibold tracking-tight tabular-nums",
          tone != null && tone > 0 && "text-emerald-700 dark:text-emerald-400",
          tone != null && tone < 0 && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function Thumbnail({ video, className }: { video: OutlierVideo; className?: string }) {
  return (
    <div className={cn("relative aspect-video shrink-0 overflow-hidden rounded-md bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails, like OutlierCard */}
      <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
    </div>
  )
}

/** The week's number one: the thumbnail, and how far it beat its channel's usual views, in large type. */
function LeadVideo({ video }: { video: OutlierVideo }) {
  const { t, locale, compact, ago } = useI18n()
  const tw = t.weeklyNews
  return (
    <a
      href={watchUrl(video.id)}
      target="_blank"
      rel="noreferrer"
      className="group grid grid-cols-1 gap-5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:items-center sm:gap-7"
    >
      <Thumbnail video={video} className="w-full rounded-xl ring-1 ring-border" />
      <div className="flex min-w-0 flex-col gap-3">
        {video.multiplier != null && (
          <p className="flex flex-col">
            <span className="text-6xl leading-none font-semibold tracking-[-0.05em] text-emerald-600 tabular-nums sm:text-7xl dark:text-emerald-400">
              {multiplier(video.multiplier, locale)}x
            </span>
            <span className="mt-1.5 text-sm text-muted-foreground">{tw.leadMultiplier}</span>
          </p>
        )}
        <p className="line-clamp-3 text-base leading-snug font-semibold group-hover:underline">{video.title}</p>
        <p className="flex flex-col text-sm text-muted-foreground">
          <span className="truncate">{video.channel.name}</span>
          <span>
            {t.common.views(compact(video.views))}, {ago(video.publishedAt, "hour")}
          </span>
        </p>
      </div>
    </a>
  )
}

function VideoRow({ video, rank }: { video: OutlierVideo; rank?: number }) {
  const { t, locale, compact } = useI18n()
  return (
    <a
      href={watchUrl(video.id)}
      target="_blank"
      rel="noreferrer"
      className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted sm:gap-4"
    >
      {rank != null && <span className="w-4 shrink-0 text-sm text-muted-foreground tabular-nums">{rank}</span>}
      <Thumbnail video={video} className="w-20 sm:w-28" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{video.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {video.channel.name}, {t.common.views(compact(video.views))}
        </p>
      </div>
      {video.multiplier != null && video.multiplier >= 1 && (
        <span
          title={t.weeklyNews.multiplier(multiplier(video.multiplier, locale))}
          className={cn(
            "shrink-0 text-right text-base font-semibold tracking-tight tabular-nums sm:text-lg",
            video.multiplier >= 3 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {multiplier(video.multiplier, locale)}x
        </span>
      )}
    </a>
  )
}
