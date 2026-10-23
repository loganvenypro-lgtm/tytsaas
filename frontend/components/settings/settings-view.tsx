"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  CheckCircle2,
  Dices,
  Languages,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  RotateCcw,
  Smartphone,
  Sun,
  User,
  UserCog,
  XCircle,
} from "lucide-react"
import { cn } from "cn"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useI18n } from "@/components/i18n-provider"
import { DeleteAccountCard, YouTubeAccessCard } from "@/components/settings/data-controls"
import { DigestSettingsCard } from "@/components/settings/digest-settings-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { authClient, signOut } from "@/lib/auth-client"
import { LOCALES, LOCALE_NAMES, saveLocale, type Locale, type Messages } from "@/lib/i18n"
import { AVATAR_STYLES, getDicebearAvatar, parseAvatar, randomSeed, resolveAvatar, type AvatarStyle } from "@/lib/avatar"
import type { SessionUser } from "@/lib/session"

type Status = { type: "success" | "error"; message: string } | null

function StatusMessage({ status }: { status: Status }) {
  if (!status) return null
  const Icon = status.type === "success" ? CheckCircle2 : XCircle
  return (
    <p
      role={status.type === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-1.5 text-sm",
        status.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
      )}
    >
      <Icon className="size-4" />
      {status.message}
    </p>
  )
}

/* ------------------------------------------------------------------ profil */

function ProfileTab({ user }: { user: SessionUser }) {
  const router = useRouter()
  const { t } = useI18n()
  const tp = t.settings.profile
  const initial = React.useMemo(() => parseAvatar(resolveAvatar(user), user.email), [user])
  const [name, setName] = React.useState(user.name)
  const [style, setStyle] = React.useState<AvatarStyle>(initial.style)
  const [seed, setSeed] = React.useState(initial.seed)
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState<Status>(null)

  const preview = getDicebearAvatar(seed, style)
  const dirty = name.trim() !== user.name || preview !== resolveAvatar(user)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setStatus({ type: "error", message: tp.nameRequired })
      return
    }
    setSaving(true)
    setStatus(null)
    const { error } = await authClient.updateUser({ name: name.trim(), image: preview })
    setSaving(false)
    if (error) {
      setStatus({ type: "error", message: error.message ?? tp.saveFailed })
      return
    }
    toast.add({ type: "success", title: tp.saved })
    // Re-renders the server components, so the sidebar shows the new name and picture
    router.refresh()
  }

  function reset() {
    setName(user.name)
    setStyle(initial.style)
    setSeed(initial.seed)
    setStatus(null)
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{tp.pictureTitle}</CardTitle>
          <CardDescription>{tp.pictureDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Avatar className="size-24 ring-4 ring-muted">
              <AvatarImage src={preview} alt={tp.preview} />
              <AvatarFallback className="text-2xl">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <p className="text-lg font-semibold">{name || user.name}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => setSeed(randomSeed())}>
                  <Dices />
                  {tp.reroll}
                </Button>
                <Button type="button" variant="ghost" size="lg" onClick={() => setSeed(user.email)}>
                  <RotateCcw />
                  {tp.defaultAvatar}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{tp.style}</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {AVATAR_STYLES.map((s) => {
                const selected = s.id === style
                const label = t.settings.avatarStyles[s.id]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    aria-pressed={selected}
                    aria-label={tp.styleLabel(label)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                      selected ? "border-primary ring-3 ring-primary/15" : "hover:bg-muted"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getDicebearAvatar(seed, s.id)} alt="" className="size-11 rounded-full" loading="lazy" />
                    <span className={cn("text-[11px] font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{tp.name}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <p className="text-xs text-muted-foreground">{tp.nameHint}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{tp.email}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" value={user.email} disabled className="pl-8" />
              </div>
              <p className="text-xs text-muted-foreground">{tp.emailHint}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <StatusMessage status={status} />
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" size="lg" disabled={!dirty || saving} onClick={reset}>
              {t.common.cancel}
            </Button>
            <Button type="submit" size="lg" disabled={!dirty || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {t.common.save}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  )
}

/* ------------------------------------------------------------------ sécurité */

function PasswordCard() {
  const { t } = useI18n()
  const tp = t.settings.password
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [revokeOthers, setRevokeOthers] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState<Status>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus(null)
    if (next.length < 8) {
      setStatus({ type: "error", message: tp.tooShort })
      return
    }
    if (next !== confirm) {
      setStatus({ type: "error", message: tp.mismatch })
      return
    }
    setSaving(true)
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    })
    setSaving(false)
    if (error) {
      setStatus({
        type: "error",
        message: (error.code && t.auth.errors[error.code]) || error.message || tp.failed,
      })
      return
    }
    setCurrent("")
    setNext("")
    setConfirm("")
    toast.add({
      type: "success",
      title: tp.changed,
      description: revokeOthers ? tp.othersRevoked : undefined,
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{tp.title}</CardTitle>
          <CardDescription>{tp.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:max-w-md">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">{tp.current}</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">{tp.new}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">{tp.confirm}</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox checked={revokeOthers} onCheckedChange={(checked) => setRevokeOthers(checked === true)} />
            {tp.revokeOthers}
          </Label>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <StatusMessage status={status} />
          <Button type="submit" size="lg" className="ml-auto" disabled={saving || !current || !next || !confirm}>
            {saving && <Loader2 className="animate-spin" />}
            {tp.submit}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

type DeviceSession = {
  id: string
  token: string
  createdAt: string | Date
  updatedAt: string | Date
  ipAddress?: string | null
  userAgent?: string | null
}

function describeDevice(userAgent: string | null | undefined, ts: Messages["settings"]["sessions"]) {
  const ua = userAgent ?? ""
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null
  const mobile = /Mobile|iPhone|Android/.test(ua)
  const label = browser && os ? ts.browserOn(browser, os) : browser || os || ts.unknownDevice
  return { label, mobile }
}

function SessionsCard({ currentSessionId }: { currentSessionId: string }) {
  const { t, date } = useI18n()
  const ts = t.settings.sessions
  const [sessions, setSessions] = React.useState<DeviceSession[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  // Bumped after a revoke to reload the list
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    authClient.listSessions().then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message ?? ts.loadFailed)
      else setSessions([...data].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)))
      setBusy(null)
    })
    return () => {
      cancelled = true
    }
  }, [version, ts.loadFailed])

  async function revoke(session: DeviceSession) {
    setBusy(session.id)
    const { error } = await authClient.revokeSession({ token: session.token })
    if (error) toast.add({ type: "error", title: ts.revokeFailed, description: error.message })
    else toast.add({ type: "success", title: ts.revoked, description: describeDevice(session.userAgent, ts).label })
    setVersion((v) => v + 1)
  }

  async function revokeOthers() {
    setBusy("others")
    const { error } = await authClient.revokeOtherSessions()
    if (error) toast.add({ type: "error", title: ts.revokeOthersFailed, description: error.message })
    else toast.add({ type: "success", title: ts.othersRevoked })
    setVersion((v) => v + 1)
  }

  const others = sessions?.filter((s) => s.id !== currentSessionId) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ts.title}</CardTitle>
        <CardDescription>{ts.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <StatusMessage status={{ type: "error", message: error }} />
        ) : !sessions ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {sessions.map((s) => {
              const device = describeDevice(s.userAgent, ts)
              const Icon = device.mobile ? Smartphone : Laptop
              const current = s.id === currentSessionId
              return (
                <div key={s.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {device.label}
                      {current && <Badge variant="secondary">{ts.thisDevice}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.ipAddress || ts.unknownIp} ·{" "}
                      {ts.activeOn(date(s.updatedAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))}
                    </p>
                  </div>
                  {!current && (
                    <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => revoke(s)}>
                      {busy === s.id && <Loader2 className="animate-spin" />}
                      {ts.revoke}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
      {others.length > 0 && (
        <CardFooter className="justify-end border-t">
          <Button variant="outline" size="lg" disabled={busy !== null} onClick={revokeOthers}>
            {busy === "others" && <Loader2 className="animate-spin" />}
            {ts.revokeOthers}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ préférences */

const THEMES = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "system", icon: Monitor },
] as const

// Two-letter badge shown on each language tile
const LOCALE_BADGES: Record<Locale, string> = { fr: "FR", en: "EN" }

function ThemeCard() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  // The theme is only known in the browser; avoid a mismatch with the server render
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.theme.title}</CardTitle>
        <CardDescription>{t.settings.theme.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:max-w-md sm:grid-cols-3">
          {THEMES.map((option) => {
            const selected = mounted && theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                  selected ? "border-primary ring-3 ring-primary/15" : "hover:bg-muted"
                )}
              >
                <option.icon className="size-5" />
                {t.settings.theme[option.id]}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function LanguageCard() {
  const router = useRouter()
  const { locale, t } = useI18n()
  const [pending, startTransition] = React.useTransition()
  const [picked, setPicked] = React.useState<Locale>(locale)

  function pick(next: Locale) {
    if (next === locale) return
    setPicked(next)
    saveLocale(next)
    // Re-renders the server components (root layout included) with the new cookie
    startTransition(() => router.refresh())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.language.title}</CardTitle>
        <CardDescription>{t.settings.language.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:max-w-md sm:grid-cols-2">
          {LOCALES.map((l) => {
            const selected = l === locale
            return (
              <button
                key={l}
                type="button"
                lang={l}
                onClick={() => pick(l)}
                disabled={pending}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-all disabled:opacity-60",
                  selected ? "border-primary ring-3 ring-primary/15" : "hover:bg-muted"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {LOCALE_BADGES[l]}
                </span>
                <span className="flex-1 font-medium">{LOCALE_NAMES[l]}</span>
                {pending && l === picked ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  selected && !pending && <CheckCircle2 className="size-4 text-primary" />
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function PreferencesTab() {
  return (
    <div className="flex flex-col gap-4">
      <LanguageCard />
      <ThemeCard />
      <DigestSettingsCard />
    </div>
  )
}

/* ------------------------------------------------------------------ compte */

function AccountTab({ user }: { user: SessionUser }) {
  const router = useRouter()
  const { t, date } = useI18n()
  const ta = t.settings.account

  async function logout() {
    await signOut()
    toast.add({ type: "success", title: t.userMenu.loggedOut })
    router.push("/login")
    router.refresh()
  }

  const rows = [
    { label: ta.plan, value: <Badge>{user.plan || "Pro"}</Badge> },
    { label: ta.role, value: user.role === "admin" ? <Badge variant="secondary">admin</Badge> : ta.user },
    { label: ta.email, value: user.email },
    { label: ta.memberSince, value: user.createdAt ? date(user.createdAt, { day: "numeric", month: "long", year: "numeric" }) : "—" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{ta.title}</CardTitle>
          <CardDescription>{ta.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{ta.logoutTitle}</p>
            <p className="text-sm text-muted-foreground">{ta.logoutDescription}</p>
          </div>
          <Button variant="destructive" size="lg" onClick={logout}>
            <LogOut />
            {ta.logout}
          </Button>
        </CardContent>
      </Card>

      <YouTubeAccessCard />
      <DeleteAccountCard user={user} />
    </div>
  )
}

/* ------------------------------------------------------------------ page */

const TABS = ["profile", "security", "preferences", "account"]

export function SettingsView({
  user,
  currentSessionId,
  initialTab,
}: {
  user: SessionUser
  currentSessionId: string
  initialTab: string
}) {
  const { t } = useI18n()
  // "appearance" was the tab's name before the language picker joined it; old links still land here
  const tab = initialTab === "appearance" ? "preferences" : initialTab

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h2>
        <p className="text-sm text-muted-foreground">{t.settings.description}</p>
      </div>
      <Tabs defaultValue={TABS.includes(tab) ? tab : "profile"} className="gap-5">
        <TabsList className="w-full flex-wrap justify-start p-1 group-data-horizontal/tabs:h-auto sm:w-fit">
          <TabsTrigger value="profile" className="flex-none px-3">
            <User />
            {t.settings.tabs.profile}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-none px-3">
            <Lock />
            {t.settings.tabs.security}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex-none px-3">
            <Languages />
            {t.settings.tabs.preferences}
          </TabsTrigger>
          <TabsTrigger value="account" className="flex-none px-3">
            <UserCog />
            {t.settings.tabs.account}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab user={user} />
        </TabsContent>
        <TabsContent value="security" className="flex flex-col gap-4">
          <PasswordCard />
          <SessionsCard currentSessionId={currentSessionId} />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
