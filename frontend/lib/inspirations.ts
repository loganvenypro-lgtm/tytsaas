"use client"

import * as React from "react"

/**
 * Channels the user follows: inspirations (/channels/inspirations) and
 * competitors (/channels/competitors). Types and /api helpers.
 */

export type FollowKind = "inspiration" | "competitor"

export const FOLLOWED_CHANGED_EVENT = "followed-channels-changed"

const BASE: Record<FollowKind, string> = { inspiration: "/api/inspirations", competitor: "/api/competitors" }

export interface InspirationVideo {
  id: string
  title: string
  thumbnail: string
  views: number
  multiplier: number | null
  publishedAt: string
  isShort: boolean
  duration: string | null
  /** Published since the user's last visit of the page. */
  isNew: boolean
}

export interface ChannelStats {
  id: string
  name: string
  handle: string | null
  avatar: string | null
  subscribers: number | null
  medianViews: number | null
  uploadsPerWeek: number | null
  outlierRate: number | null
  niche: string | null
  subNiche: string | null
  style: string | null
  isShortsChannel: boolean
  language: string | null
  country: string | null
  terminated: boolean
  /** Over the chosen period, at the chosen threshold. */
  outliers: number
  newOutliers: number
  bestMultiplier: number | null
  lastOutlierAt: string | null
  lastUploadAt: string | null
  uploads: number
}

export interface InspirationChannel extends ChannelStats {
  tags: string[]
  notes: string | null
  followedAt: string
  seenAt: string
  videos: InspirationVideo[]
}

export interface InspirationsResponse {
  channels: InspirationChannel[]
  /** Competitors: the user's own channel, to compare with. */
  me: ChannelStats | null
  /** Channels imported from Outlr the user doesn't follow yet (as this kind). */
  importable: number
  minMultiplier: number
  period: number
  format: "all" | "short" | "long"
}

export interface ChannelSearchResult {
  id: string
  name: string
  handle: string | null
  avatar: string | null
  subscribers: number | null
  niche: string | null
}

export const TAG_MAX = 32
export const NOTES_MAX = 4000

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

function changed() {
  followedIds = null
  window.dispatchEvent(new Event(FOLLOWED_CHANGED_EVENT))
}

export const listUrl = (kind: FollowKind, query: string) => `${BASE[kind]}?${query}`
const channelUrl = (kind: FollowKind, channelId: string) => `${BASE[kind]}/${encodeURIComponent(channelId)}`

export async function followChannel(kind: FollowKind, channelId: string) {
  await request(BASE[kind], { method: "POST", body: JSON.stringify({ channelId }) })
  changed()
}

export async function unfollowChannel(kind: FollowKind, channelId: string) {
  await request(channelUrl(kind, channelId), { method: "DELETE" })
  changed()
}

export async function updateFollowed(kind: FollowKind, channelId: string, patch: { tags?: string[]; notes?: string | null }) {
  return request<{ tags: string[]; notes: string | null }>(channelUrl(kind, channelId), {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function importOutlrChannels(kind: FollowKind) {
  const { imported } = await request<{ imported: number }>(`${BASE[kind]}/import-outlr`, { method: "POST" })
  changed()
  return imported
}

/** Outliers published until now stop being "new". keepalive: also sent when leaving the page. */
export function markFollowedSeen(kind: FollowKind) {
  return fetch(`${BASE[kind]}/seen`, { method: "POST", keepalive: true }).catch(() => undefined)
}

export async function searchChannels(q: string) {
  const { channels } = await request<{ channels: ChannelSearchResult[] }>(`/api/channels/search?q=${encodeURIComponent(q)}`)
  return channels
}

// Followed ids, shared by every "Follow" menu on the page (one request, refetched after a change)
type FollowedIds = Record<FollowKind, Set<string>>
let followedIds: Promise<FollowedIds> | null = null

function loadFollowedIds() {
  followedIds ??= request<Record<FollowKind, string[]>>("/api/followed-ids")
    .then((ids) => ({ inspiration: new Set(ids.inspiration), competitor: new Set(ids.competitor) }))
    .catch((err) => {
      followedIds = null
      throw err
    })
  return followedIds
}

/** How a channel is followed; null while loading (or when the list could not load). */
export function useFollowState(
  channelId: string,
): [Record<FollowKind, boolean> | null, (kind: FollowKind, followed: boolean) => void] {
  const [state, setState] = React.useState<{ id: string; value: Record<FollowKind, boolean> } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = () =>
      loadFollowedIds()
        .then(
          (ids) =>
            !cancelled &&
            setState({
              id: channelId,
              value: { inspiration: ids.inspiration.has(channelId), competitor: ids.competitor.has(channelId) },
            }),
        )
        .catch(() => undefined)
    load()
    window.addEventListener(FOLLOWED_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(FOLLOWED_CHANGED_EVENT, load)
    }
  }, [channelId])

  const value = state?.id === channelId ? state.value : null
  return [
    value,
    (kind, followed) =>
      setState((prev) =>
        prev?.id === channelId ? { id: channelId, value: { ...prev.value, [kind]: followed } } : prev,
      ),
  ]
}
