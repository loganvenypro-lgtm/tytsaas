"use client"

/**
 * The user's own channel ("Ma chaîne", /my-channel/*): types of the
 * /api/my-channel answers and the calls that change something.
 */

export interface MyChannel {
  id: string
  name: string
  handle: string | null
  avatar: string | null
  subscribers: number | null
  totalViews: number | null
  videoCount: number | null
  /** Videos of the channel the database has (the stats below come from them). */
  videosInDb: number
  medianViews: number | null
  uploadsPerWeek: number | null
  outlierRate: number | null
  niche: { id: string; label: { fr: string; en: string } } | null
  country: string | null
  lastStatsAt: string | null
}

export interface MyChannelStatus {
  /** The channel set on the account (OAuth link or onboarding), even when not analyzed yet. */
  channelId: string | null
  channel: MyChannel | null
  /** Set when the channel came from the Google link (channels.list mine=true). */
  linkedAt: string | null
  syncedAt: string | null
  nextSyncAt: string | null
  /** False while the last sync is too recent (once every 12 h). */
  canSync: boolean
  connection: { google: boolean; youtube: boolean; analytics: boolean }
  aiEnabled: boolean
}

export interface MyVideo {
  id: string
  title: string
  thumbnail: string
  views: number
  multiplier: number | null
  publishedAt: string
  isShort: boolean
  duration: string | null
  /** Lifetime average. */
  viewsPerDay: number
}

export interface Growth {
  days: number
  views: number
  subscribers: number | null
}

export interface AnalyticsSummary {
  status: "ok"
  startDate: string
  endDate: string
  views: number | null
  minutesWatched: number | null
  averageViewDuration: number | null
  subscribersGained: number | null
  subscribersLost: number | null
  days: { date: string; views: number | null; subscribersGained: number | null }[]
}

export interface OverviewResponse {
  channel: MyChannel
  period: {
    days: number
    uploads: number
    shorts: number
    outliers: number
    bestMultiplier: number | null
    medianLongViews: number | null
    medianShortViews: number | null
    lastUploadAt: string | null
  }
  growth: { week: Growth | null; month: Growth | null }
  history: { date: string; subscribers: number | null; views: number }[]
  recent: MyVideo[]
  best: MyVideo[]
  analytics: AnalyticsSummary | { status: "reconnect" | "unavailable" } | null
}

export interface VariantVersion {
  value: string | null
  image: string | null
  from: string | null
  current: boolean
  hoursLive: number
  viewsPerHour: number | null
}

export interface AbTest {
  video: MyVideo
  titles: VariantVersion[]
  thumbnails: VariantVersion[]
  lastChange: string | null
}

export interface AbTestsResponse {
  tests: AbTest[]
  videosInDb: number
}

export interface RevivalVideo extends MyVideo {
  windowHours: number
  gained: number
  views48h: number
  lifetimePerDay: number
  /** Views per day now / lifetime average per day. */
  pace: number | null
  measuredAt: string
}

export interface RevivalsResponse {
  minAge: number
  videos: RevivalVideo[]
  oldVideos: number
  measuredVideos: number
  totalViews48h: number
  medianViews: number | null
}

export interface ReviveAction {
  type: string
  priority: "high" | "medium" | "low"
  title: string
  detail: string
  examples: string[]
}

export interface ReviveReport {
  verdict: "reviving" | "steady" | "dormant" | null
  summary: string
  diagnosis: string
  actions: ReviveAction[]
  traffic: {
    sources: { source: string; views: number | null }[]
    searchTerms: { term: string; views: number | null }[]
  } | null
}

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
]

/** The channel's status changed (connected, synced): pages reload it. */
export const MY_CHANNEL_CHANGED_EVENT = "my-channel-changed"

/** An /api error with the backend's code ("reconnect", "too_soon"…), shown through t.myChannel.errors. */
export class MyChannelError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message)
  }
}

async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new MyChannelError(data?.error ?? `HTTP ${res.status}`, data?.code ?? null)
  return data as T
}

export const connectMyChannel = () => post<{ channelId: string; name: string; syncing: boolean }>("/api/my-channel/connect")
export const syncMyChannel = () => post<{ videos: number }>("/api/my-channel/sync")
export const fetchReviveReport = (videoId: string, locale: string, refresh = false) =>
  post<{ report: ReviveReport; createdAt: string; cached: boolean }>(
    `/api/my-channel/videos/${encodeURIComponent(videoId)}/report`,
    { locale, refresh },
  )
