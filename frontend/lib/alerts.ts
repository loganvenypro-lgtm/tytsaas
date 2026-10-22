"use client"

import * as React from "react"
import { request } from "@/lib/inspirations"
import type { OutlierVideo } from "@/components/top-videos/outlier-card"

/** Alerts (/alerts): saved Top Videos searches the worker checks every tick. Types and /api/alerts helpers. */

export const ALERTS_CHANGED_EVENT = "alerts-changed"

export type AlertSource = "all" | "competitors" | "inspirations"
export type AlertFrequency = "instant" | "daily" | "weekly"

/** Top Videos params (the API's names), all strings. */
export type AlertFilters = Partial<
  Record<"q" | "format" | "niche" | "subNiche" | "language" | "minViews" | "minMultiplier" | "minVph" | "minSubs" | "maxSubs", string>
>

export interface AlertRule {
  id: string
  name: string
  filters: AlertFilters
  source: AlertSource
  frequency: AlertFrequency
  /** Masked ("…abc123"), or null when the alert has no Discord webhook. */
  discordWebhook: string | null
  enabled: boolean
  createdAt: string
  lastCheckedAt: string | null
  lastSentAt: string | null
  unread: number
  matches: number
}

/** What the editor sends. discordWebhook: undefined keeps the current one, null removes it. */
export interface AlertInput {
  name: string
  filters: AlertFilters
  source: AlertSource
  frequency: AlertFrequency
  discordWebhook?: string | null
  enabled?: boolean
}

export interface AlertMatch extends OutlierVideo {
  alert: { id: string; name: string }
  matchedAt: string
  unread: boolean
}

function changed() {
  window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT))
}

export async function listAlerts() {
  const { alerts } = await request<{ alerts: AlertRule[] }>("/api/alerts")
  return alerts
}

export async function createAlert(input: AlertInput) {
  const { alert } = await request<{ alert: AlertRule }>("/api/alerts", { method: "POST", body: JSON.stringify(input) })
  changed()
  return alert
}

export async function updateAlert(id: string, patch: Partial<AlertInput>) {
  const { alert } = await request<{ alert: AlertRule }>(`/api/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
  changed()
  return alert
}

export async function deleteAlert(id: string) {
  await request(`/api/alerts/${encodeURIComponent(id)}`, { method: "DELETE" })
  changed()
}

export async function previewAlert(rule: AlertInput) {
  return request<{ items: OutlierVideo[]; total: number; narrow: boolean }>("/api/alerts/preview", {
    method: "POST",
    body: JSON.stringify({ rule }),
  })
}

export async function alertFeed({ alertId, unread }: { alertId?: string | null; unread?: boolean }) {
  const params = new URLSearchParams()
  if (alertId) params.set("alert", alertId)
  if (unread) params.set("unread", "true")
  const { items } = await request<{ items: AlertMatch[] }>(`/api/alerts/feed?${params}`)
  return items
}

export async function markAlertsRead(alertId?: string | null) {
  await request("/api/alerts/read", { method: "POST", body: JSON.stringify(alertId ? { alertId } : {}) })
  changed()
}

export async function testAlertDiscord(id: string) {
  await request(`/api/alerts/${encodeURIComponent(id)}/test`, { method: "POST" })
}

/** Unread matches of every alert, for the sidebar badge (refreshed after a change and every 5 minutes). */
export function useUnreadAlerts() {
  const [count, setCount] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    const load = () =>
      request<{ count: number }>("/api/alerts/unread")
        .then((data) => !cancelled && setCount(data.count))
        .catch(() => undefined)
    load()
    const timer = setInterval(load, 5 * 60_000)
    window.addEventListener(ALERTS_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener(ALERTS_CHANGED_EVENT, load)
    }
  }, [])
  return count
}
