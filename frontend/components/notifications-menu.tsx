"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, BellRing, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useI18n } from "@/components/i18n-provider"
import { ALERTS_CHANGED_EVENT, markAlertsRead } from "@/lib/alerts"
import { cn } from "@/lib/utils"

/** GET /api/notifications (controllers/notifications.js). */
type Notification =
  | { type: "alert"; id: string; title: string; count: number; detail: string | null; at: string; href: string }
  | { type: "invitation"; id: string; title: string; inviter: string | null; role: string; at: string; href: string }

type NotificationsResponse = { items: Notification[]; total: number }

/**
 * The bell left of the theme toggle: unread alert matches and pending team
 * invitations. Refreshed every 2 minutes, when an alert changes and on each page change.
 */
export function NotificationsMenu() {
  const { t, ago } = useI18n()
  const tn = t.notifications
  const pathname = usePathname()
  const [data, setData] = React.useState<NotificationsResponse>({ items: [], total: 0 })
  const [open, setOpen] = React.useState(false)

  const load = React.useCallback(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((next: NotificationsResponse | null) => next && setData(next))
      .catch(() => undefined)
  }, [])

  React.useEffect(() => {
    load()
    const timer = setInterval(load, 2 * 60_000)
    window.addEventListener(ALERTS_CHANGED_EVENT, load)
    return () => {
      clearInterval(timer)
      window.removeEventListener(ALERTS_CHANGED_EVENT, load)
    }
  }, [load])

  // Accepting an invitation or reading alerts happens on another page
  React.useEffect(load, [pathname, load])

  const hasAlerts = data.items.some((item) => item.type === "alert")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="icon" className="relative" aria-label={tn.open(data.total)} />}>
        {data.total ? <BellRing className="size-[1.2rem]" /> : <Bell className="size-[1.2rem]" />}
        {data.total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-background dark:bg-blue-500">
            {data.total > 99 ? "99+" : data.total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{tn.title}</p>
          {hasAlerts && (
            <button
              type="button"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => markAlertsRead().then(load).catch(() => undefined)}
            >
              {tn.markAllRead}
            </button>
          )}
        </div>

        {data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
            <Bell className="mb-1 size-5 text-muted-foreground" />
            <p className="text-sm font-medium">{tn.empty}</p>
            <p className="text-xs text-muted-foreground">{tn.emptyHint}</p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {data.items.map((item) => (
              <li key={`${item.type}:${item.id}`}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                      item.type === "alert"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    )}
                  >
                    {item.type === "alert" ? <BellRing className="size-4" /> : <Users className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">
                      {item.type === "alert" ? tn.alert(item.title, item.count) : tn.invitation(item.inviter, item.title)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.type === "alert" ? item.detail : tn.invitationAction}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{ago(item.at)}</span>
                  </span>
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasAlerts && (
          <div className="border-t px-4 py-2.5">
            <Link href="/alerts" onClick={() => setOpen(false)} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              {tn.seeAlerts}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
