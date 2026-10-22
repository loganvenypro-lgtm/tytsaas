import type { OutlierVideo } from "@/components/top-videos/outlier-card"

/** GET /api/weekly-digest: the creator's last 7 days. */
export type WeeklyDigest = {
  niche: { id: string; label: { fr: string; en: string } } | null
  topVideosSource: "niche" | "competitors" | "all"
  myChannel: {
    id: string
    name: string
    avatar: string | null
    uploads7d: number
    views7d: number | null
    subs7d: number | null
    bestVideo: OutlierVideo | null
  } | null
  topVideos: OutlierVideo[]
  competitorHits: OutlierVideo[]
  risingChannels: { id: string; name: string; handle: string | null; avatar: string | null; subscribers: number | null }[]
}

/** Fired on window to open the weekly recap on demand (the home page's shortcut). */
export const WEEKLY_NEWS_OPEN_EVENT = "weekly-news:open"

/** New editions come out on Mondays (0 = Sunday, 1 = Monday…). */
export const WEEKLY_NEWS_WEEKDAY = 1

/** Edition of the popup: the date of this week's release day, e.g. "2026-10-19". */
export function weeklyEditionId(now = new Date()): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() - WEEKLY_NEWS_WEEKDAY + 7) % 7))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
}

/** Whole days until the next edition (1 to 7). */
export function daysUntilNextEdition(now = new Date()): number {
  return (WEEKLY_NEWS_WEEKDAY - now.getDay() + 7) % 7 || 7
}
