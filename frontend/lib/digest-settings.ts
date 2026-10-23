"use client"

// When the recap comes out and what it shows (GET/PUT /api/digest-settings).

export const DIGEST_SECTIONS = ["myChannel", "topVideos", "competitorHits", "risingChannels"] as const
export type DigestSection = (typeof DIGEST_SECTIONS)[number]

export interface DigestSettings {
  enabled: boolean
  frequency: "weekly" | "monthly"
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
  /** 1 to 28 */
  monthDay: number
  /** 0 to 23, in `timezone` */
  hour: number
  timezone: string
  sections: DigestSection[]
  email: boolean
}

type Response = { settings: DigestSettings; nextEditionAt: string | null }

async function request(init?: RequestInit): Promise<Response> {
  const res = await fetch("/api/digest-settings", {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const getDigestSettings = () => request()

export const saveDigestSettings = (patch: Partial<DigestSettings>) =>
  request({ method: "PUT", body: JSON.stringify(patch) })
