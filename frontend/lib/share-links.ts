"use client"

import type { SavedItem } from "@/lib/saved-folders"

// Share links (/share/<token>): a folder opens read-only for anyone, a team
// link is a reusable invitation. Owners enable, disable or regenerate them.

export type ShareKind = "folder" | "team"

export interface ShareLink {
  token: string
  enabled: boolean
  updatedAt: string
}

export type SharedObject =
  | {
      kind: "folder"
      folder: { name: string; updatedAt: string; owner: string | null }
      items: SavedItem[]
    }
  | { kind: "team"; team: { id: string; name: string; memberCount: number } }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

const manageUrl = (kind: ShareKind, targetId: string) => `/api/share/${kind}/${encodeURIComponent(targetId)}`

export async function getShareLink(kind: ShareKind, targetId: string) {
  return (await request<{ link: ShareLink | null }>(manageUrl(kind, targetId))).link
}

/** Creates or re-enables the link; `regenerate` gives it a new token (the old link stops working). */
export async function enableShareLink(kind: ShareKind, targetId: string, regenerate = false) {
  const res = await request<{ link: ShareLink }>(manageUrl(kind, targetId), {
    method: "POST",
    body: JSON.stringify({ regenerate }),
  })
  return res.link
}

export async function disableShareLink(kind: ShareKind, targetId: string) {
  return (await request<{ link: ShareLink | null }>(manageUrl(kind, targetId), { method: "DELETE" })).link
}

export const openShared = (token: string) => request<SharedObject>(`/api/shared/${encodeURIComponent(token)}`)

export const joinSharedTeam = (token: string) =>
  request<{ teamId: string; alreadyMember: boolean }>(`/api/shared/${encodeURIComponent(token)}/join`, { method: "POST" })

export const shareUrl = (token: string) => `${window.location.origin}/share/${token}`
