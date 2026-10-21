"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  CheckCircle2,
  Dices,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { authClient, signOut } from "@/lib/auth-client"
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

function fmtDate(value: string | Date | undefined, withTime = false) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value))
}

/* ------------------------------------------------------------------ profil */

function ProfileTab({ user }: { user: SessionUser }) {
  const router = useRouter()
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
      setStatus({ type: "error", message: "Le nom ne peut pas être vide." })
      return
    }
    setSaving(true)
    setStatus(null)
    const { error } = await authClient.updateUser({ name: name.trim(), image: preview })
    setSaving(false)
    if (error) {
      setStatus({ type: "error", message: error.message ?? "Impossible d'enregistrer le profil." })
      return
    }
    toast.add({ type: "success", title: "Profil mis à jour" })
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
          <CardTitle>Photo de profil</CardTitle>
          <CardDescription>Choisis un style d&apos;avatar, puis relance le tirage jusqu&apos;à trouver celui qui te plaît.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Avatar className="size-24 ring-4 ring-muted">
              <AvatarImage src={preview} alt="Aperçu de l'avatar" />
              <AvatarFallback className="text-2xl">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <p className="text-lg font-semibold">{name || user.name}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => setSeed(randomSeed())}>
                  <Dices />
                  Nouveau tirage
                </Button>
                <Button type="button" variant="ghost" size="lg" onClick={() => setSeed(user.email)}>
                  <RotateCcw />
                  Avatar par défaut
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Style</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {AVATAR_STYLES.map((s) => {
                const selected = s.id === style
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    aria-pressed={selected}
                    aria-label={`Style ${s.label}`}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                      selected ? "border-primary ring-3 ring-primary/15" : "hover:bg-muted"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getDicebearAvatar(seed, s.id)} alt="" className="size-11 rounded-full" loading="lazy" />
                    <span className={cn("text-[11px] font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nom affiché</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <p className="text-xs text-muted-foreground">Visible dans la barre latérale.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" value={user.email} disabled className="pl-8" />
              </div>
              <p className="text-xs text-muted-foreground">L&apos;email sert d&apos;identifiant et ne peut pas être modifié.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <StatusMessage status={status} />
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" size="lg" disabled={!dirty || saving} onClick={reset}>
              Annuler
            </Button>
            <Button type="submit" size="lg" disabled={!dirty || saving}>
              {saving && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  )
}

/* ------------------------------------------------------------------ sécurité */

function PasswordCard() {
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
      setStatus({ type: "error", message: "Le nouveau mot de passe doit contenir au moins 8 caractères." })
      return
    }
    if (next !== confirm) {
      setStatus({ type: "error", message: "Les deux mots de passe ne correspondent pas." })
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
        message: error.code === "INVALID_PASSWORD" ? "Mot de passe actuel incorrect." : (error.message ?? "Impossible de changer le mot de passe."),
      })
      return
    }
    setCurrent("")
    setNext("")
    setConfirm("")
    toast.add({
      type: "success",
      title: "Mot de passe modifié",
      description: revokeOthers ? "Tes autres appareils ont été déconnectés." : undefined,
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
          <CardDescription>Utilise au moins 8 caractères. Tu restes connecté sur cet appareil.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:max-w-md">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox checked={revokeOthers} onCheckedChange={(checked) => setRevokeOthers(checked === true)} />
            Déconnecter mes autres appareils
          </Label>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <StatusMessage status={status} />
          <Button type="submit" size="lg" className="ml-auto" disabled={saving || !current || !next || !confirm}>
            {saving && <Loader2 className="animate-spin" />}
            Changer le mot de passe
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

function describeDevice(userAgent?: string | null) {
  const ua = userAgent ?? ""
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null
  const mobile = /Mobile|iPhone|Android/.test(ua)
  const label = browser && os ? `${browser} sur ${os}` : browser || os || "Appareil inconnu"
  return { label, mobile }
}

function SessionsCard({ currentSessionId }: { currentSessionId: string }) {
  const [sessions, setSessions] = React.useState<DeviceSession[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  // Bumped after a revoke to reload the list
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    authClient.listSessions().then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message ?? "Impossible de charger les sessions.")
      else setSessions([...data].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)))
      setBusy(null)
    })
    return () => {
      cancelled = true
    }
  }, [version])

  async function revoke(session: DeviceSession) {
    setBusy(session.id)
    const { error } = await authClient.revokeSession({ token: session.token })
    if (error) toast.add({ type: "error", title: "Impossible de déconnecter cet appareil", description: error.message })
    else toast.add({ type: "success", title: "Appareil déconnecté", description: describeDevice(session.userAgent).label })
    setVersion((v) => v + 1)
  }

  async function revokeOthers() {
    setBusy("others")
    const { error } = await authClient.revokeOtherSessions()
    if (error) toast.add({ type: "error", title: "Impossible de déconnecter les autres appareils", description: error.message })
    else toast.add({ type: "success", title: "Autres appareils déconnectés" })
    setVersion((v) => v + 1)
  }

  const others = sessions?.filter((s) => s.id !== currentSessionId) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions actives</CardTitle>
        <CardDescription>Les appareils connectés à ton compte. Déconnecte ceux que tu ne reconnais pas.</CardDescription>
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
              const device = describeDevice(s.userAgent)
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
                      {current && <Badge variant="secondary">Cet appareil</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.ipAddress || "IP inconnue"} · actif le {fmtDate(s.updatedAt, true)}
                    </p>
                  </div>
                  {!current && (
                    <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => revoke(s)}>
                      {busy === s.id && <Loader2 className="animate-spin" />}
                      Déconnecter
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
            Déconnecter tous les autres appareils
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ apparence */

const THEMES = [
  { id: "light", label: "Clair", icon: Sun },
  { id: "dark", label: "Sombre", icon: Moon },
  { id: "system", label: "Système", icon: Monitor },
] as const

function AppearanceTab() {
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
        <CardTitle>Thème</CardTitle>
        <CardDescription>Choisis l&apos;apparence de l&apos;app. Le choix est gardé sur cet appareil.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:max-w-md sm:grid-cols-3">
          {THEMES.map((t) => {
            const selected = mounted && theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                  selected ? "border-primary ring-3 ring-primary/15" : "hover:bg-muted"
                )}
              >
                <t.icon className="size-5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ compte */

function AccountTab({ user }: { user: SessionUser }) {
  const router = useRouter()

  async function logout() {
    await signOut()
    toast.add({ type: "success", title: "Tu es déconnecté" })
    router.push("/login")
    router.refresh()
  }

  const rows = [
    { label: "Abonnement", value: <Badge>{user.plan || "Pro"}</Badge> },
    { label: "Rôle", value: user.role === "admin" ? <Badge variant="secondary">admin</Badge> : "Utilisateur" },
    { label: "Email", value: user.email },
    { label: "Membre depuis", value: fmtDate(user.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ton compte</CardTitle>
          <CardDescription>Les informations liées à ton abonnement.</CardDescription>
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
            <p className="text-sm font-medium">Se déconnecter</p>
            <p className="text-sm text-muted-foreground">Ferme ta session sur cet appareil.</p>
          </div>
          <Button variant="destructive" size="lg" onClick={logout}>
            <LogOut />
            Déconnexion
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

const TABS = ["profile", "security", "appearance", "account"]

export function SettingsView({
  user,
  currentSessionId,
  initialTab,
}: {
  user: SessionUser
  currentSessionId: string
  initialTab: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
        <p className="text-sm text-muted-foreground">Gère ton profil, ta sécurité et ton compte.</p>
      </div>
      <Tabs defaultValue={TABS.includes(initialTab) ? initialTab : "profile"} className="gap-5">
        <TabsList className="w-full flex-wrap justify-start p-1 group-data-horizontal/tabs:h-auto sm:w-fit">
          <TabsTrigger value="profile" className="flex-none px-3">
            <User />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-none px-3">
            <Lock />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex-none px-3">
            <Palette />
            Apparence
          </TabsTrigger>
          <TabsTrigger value="account" className="flex-none px-3">
            <UserCog />
            Compte
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab user={user} />
        </TabsContent>
        <TabsContent value="security" className="flex flex-col gap-4">
          <PasswordCard />
          <SessionsCard currentSessionId={currentSessionId} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
