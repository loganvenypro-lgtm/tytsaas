// Shapes of /api/channels/lookup and /api/channels/:id/profile (controllers/channelLookup.js)

export type Localized = { en: string; fr: string }
export type Niche = { id: string; label: Localized }

export interface ChannelHit {
  id: string
  name: string
  handle: string | null
  avatar: string | null
  subscribers: number | null
  totalViews: number | null
  videoCount: number | null
  country: string | null
  niche: Niche | null
  inDatabase: boolean
}

export interface LookupResponse {
  channels: ChannelHit[]
  /** Found on YouTube (1 quota unit) when the database had no match. */
  external: ChannelHit | null
}

export type Range = { low: number; typical: number; high: number }

export interface HistoryPoint {
  date: string
  totalViews: number | null
  subscribers: number | null
  /** Gained per day since the previous point, null on the first one. */
  views: number | null
  subscribersGained: number | null
}

export interface ChannelVideo {
  id: string
  title: string
  thumbnail: string
  publishedAt: string
  duration: string | null
  isShort: boolean
  isLivestream: boolean
  views: number
  likes: number | null
  comments: number | null
  /** From two worker readings; null when the video wasn't read twice in that window. */
  views24h: number | null
  views48h: number | null
  multiplier: number | null
  abTest: { thumbnails: number; titles: number }
  rpm: number
  revenue: Range
}

export interface RankedVideo extends ChannelVideo {
  /** 1 = most viewed of the list. */
  rank: number
}

export type VideoFormat = "long" | "short"

export interface VideosPage {
  items: ChannelVideo[]
  total: number
  page: number
  hasMore: boolean
}

export interface VideoStats {
  video: ChannelVideo & { usualViews: number | null; viewsPerHour: number | null; engagementRate: number | null }
  channel: { id: string; name: string; avatar: string | null } | null
  history: { at: string; views: number; likes: number | null; comments: number | null }[]
  /** The video and the 9 of the same format released before it. */
  ranking: RankedVideo[]
}

export interface ChannelProfile {
  channel: {
    id: string
    name: string
    handle: string | null
    avatar: string | null
    description: string | null
    country: string | null
    createdAt: string | null
    subscribers: number | null
    totalViews: number | null
    videoCount: number | null
    medianViews: number | null
    uploadsPerWeek: number | null
    outlierRate: number | null
    niche: Niche | null
    lang: string | null
    updatedAt: string | null
    terminatedAt: string | null
  }
  ranks: { total: number; subscribers: number | null; totalViews: number }
  period: { days: number | null; views: number | null; subscribers: number | null; revenue: Range | null }
  history: HistoryPoint[]
  /** Uploads of the last 31 days, oldest first: the chart marks them. */
  uploads: { id: string; title: string; publishedAt: string; isShort: boolean }[]
  monetization: {
    status: "eligible" | "early" | "not_eligible" | null
    rpm: Range
    longRpm: number
    shortRpm: number
    dailyViews: number | null
    monthlyRevenue: { low: number; high: number } | null
  }
  /** Whole channel, from its total view counter. */
  recent: { views24h: number | null; views48h: number | null }
  /** The 10 latest videos of each format, newest first. */
  latest: Record<VideoFormat, RankedVideo[]>
  split: {
    long: { videos: number; views: number }
    short: { videos: number; views: number }
    storedVideos: number
    since: string | null
  }
}

type Label = Partial<Localized> & { en: string }
type ProfileAxis = { id: string; label: Label; share: number; niche?: string }

/** GET /api/channels/:id/similar (controllers/channels.js similar). */
export interface SimilarResponse {
  keywords: string[]
  profile?: {
    niches: ProfileAxis[]
    subNiches: ProfileAxis[]
    formats: ProfileAxis[]
    language: string | null
    shortShare: number
    medianDuration: number | null
  }
  items: {
    id: string
    name: string
    handle: string | null
    avatar: string | null
    subscribers: number | null
    country: string | null
    createdAt: string | null
    outlierRate: number | null
    opportunityScore: number | null
    trendScore: number | null
    matchingVideos: number
    niche?: Label | null
    subNiche?: Label | null
    sampleVideo?: { id: string; title: string } | null
  }[]
  videos?: {
    id: string
    title: string
    thumbnail: string
    views: number
    multiplier: number | null
    publishedAt: string
    isShort: boolean
    channelId: string
    channelName: string
  }[]
}
