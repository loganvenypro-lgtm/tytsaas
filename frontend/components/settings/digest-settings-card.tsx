"use client"

import * as React from "react"
import { CalendarClock } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { DIGEST_SECTIONS, getDigestSettings, saveDigestSettings, type DigestSettings } from "@/lib/digest-settings"

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MONTH_DAYS = Array.from({ length: 28 }, (_, d) => d + 1)
// Monday first, as on a French calendar (0 = Sunday)
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

function timezones(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  return all.includes(current) ? all : [current, ...all]
}

/**
 * Settings › Preferences: when the recap comes out (weekly or monthly, day,
 * hour, timezone), what it shows and whether it's also emailed. Each change is
 * saved right away.
 */
export function DigestSettingsCard() {
  const { t, locale } = useI18n()
  const td = t.settings.digest
  const [settings, setSettings] = React.useState<DigestSettings | null>(null)
  const [nextAt, setNextAt] = React.useState<string | null>(null)

  React.useEffect(() => {
    getDigestSettings()
      .then(({ settings, nextEditionAt }) => {
        setSettings(settings)
        setNextAt(nextEditionAt)
      })
      .catch(() => toast.add({ type: "error", title: td.loadError }))
  }, [td.loadError])

  async function change(patch: Partial<DigestSettings>) {
    if (!settings) return
    const previous = settings
    setSettings({ ...settings, ...patch })
    try {
      const res = await saveDigestSettings(patch)
      setSettings(res.settings)
      setNextAt(res.nextEditionAt)
    } catch (err) {
      setSettings(previous)
      toast.add({ type: "error", title: err instanceof Error ? err.message : td.saveError })
    }
  }

  const weekdayName = (day: number) =>
    // 2024-01-07 was a Sunday: day 0 + n is the n-th weekday
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + day)))
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" />
          {td.title}
        </CardTitle>
        <CardDescription>{td.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!settings ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div className="grid gap-0.5">
                <Label htmlFor="digest-enabled">{td.enabled}</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.enabled && nextAt
                    ? td.next(
                        new Intl.DateTimeFormat(locale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: settings.timezone,
                        }).format(new Date(nextAt)),
                      )
                    : td.disabled}
                </p>
              </div>
              <Switch id="digest-enabled" checked={settings.enabled} onCheckedChange={(enabled) => change({ enabled })} />
            </div>

            <fieldset disabled={!settings.enabled} className="grid gap-5 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={td.frequency}>
                  <Picker
                    value={settings.frequency}
                    items={{ weekly: td.weekly, monthly: td.monthly }}
                    onChange={(frequency) => change({ frequency: frequency as DigestSettings["frequency"] })}
                  />
                </Field>
                {settings.frequency === "weekly" ? (
                  <Field label={td.weekday}>
                    <Picker
                      value={String(settings.weekday)}
                      items={Object.fromEntries(WEEKDAYS.map((d) => [String(d), weekdayName(d)]))}
                      onChange={(v) => change({ weekday: Number(v) })}
                    />
                  </Field>
                ) : (
                  <Field label={td.monthDay}>
                    <Picker
                      value={String(settings.monthDay)}
                      items={Object.fromEntries(MONTH_DAYS.map((d) => [String(d), td.dayOfMonth(d)]))}
                      onChange={(v) => change({ monthDay: Number(v) })}
                    />
                  </Field>
                )}
                <Field label={td.hour}>
                  <Picker
                    value={String(settings.hour)}
                    items={Object.fromEntries(HOURS.map((h) => [String(h), hourLabel(h)]))}
                    onChange={(v) => change({ hour: Number(v) })}
                  />
                </Field>
                <Field label={td.timezone}>
                  <Picker
                    value={settings.timezone}
                    items={Object.fromEntries(timezones(settings.timezone).map((z) => [z, z.replaceAll("_", " ")]))}
                    onChange={(timezone) => change({ timezone })}
                  />
                </Field>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                {settings.frequency === "weekly" ? td.coversWeek : td.coversMonth}
              </p>

              <div className="grid gap-2.5">
                <p className="text-sm font-medium">{td.sections}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {DIGEST_SECTIONS.map((section) => {
                    const checked = settings.sections.includes(section)
                    return (
                      <Label key={section} className="flex items-start gap-2.5 rounded-lg border p-3 font-normal">
                        <Checkbox
                          checked={checked}
                          // The backend refuses an empty recap: the last section can't be unticked
                          disabled={checked && settings.sections.length === 1}
                          onCheckedChange={(on) =>
                            change({
                              sections: on
                                ? DIGEST_SECTIONS.filter((s) => s === section || settings.sections.includes(s))
                                : settings.sections.filter((s) => s !== section),
                            })
                          }
                        />
                        <span className="grid gap-0.5">
                          <span className="text-sm font-medium">{td.sectionLabels[section].title}</span>
                          <span className="text-xs text-muted-foreground">{td.sectionLabels[section].hint}</span>
                        </span>
                      </Label>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="grid gap-0.5">
                  <Label htmlFor="digest-email">{td.email}</Label>
                  <p className="text-sm text-muted-foreground">{td.emailHint}</p>
                </div>
                <Switch id="digest-email" checked={settings.email} onCheckedChange={(email) => change({ email })} />
              </div>
            </fieldset>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Picker({ value, items, onChange }: { value: string; items: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v != null && v !== value && onChange(String(v))}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-72">
        {Object.entries(items).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
