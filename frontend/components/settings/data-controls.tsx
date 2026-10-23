"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2, Unplug } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { signOut } from "@/lib/auth-client"
import type { SessionUser } from "@/lib/session"

async function call(path: string, method: "POST" | "DELETE") {
  const res = await fetch(path, { method })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
}

type YouTubeState = { youtube: boolean; channel: string | null } | null

/** Revokes Returbe's Google access to YouTube and deletes the channel's private data (POST /api/account/youtube/disconnect). */
export function YouTubeAccessCard() {
  const { t } = useI18n()
  const ta = t.settings.account
  const [state, setState] = React.useState<YouTubeState>(null)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(() => {
    fetch("/api/my-channel")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setState({ youtube: Boolean(data?.connection?.youtube), channel: data?.linkedAt ? (data.channel?.name ?? null) : null }))
      .catch(() => setState({ youtube: false, channel: null }))
  }, [])
  React.useEffect(load, [load])

  async function disconnect() {
    setBusy(true)
    try {
      await call("/api/account/youtube/disconnect", "POST")
      toast.add({ type: "success", title: ta.youtubeDisconnected })
      setOpen(false)
      load()
    } catch (err) {
      toast.add({ type: "error", title: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const connected = Boolean(state?.youtube || state?.channel)
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{ta.youtubeTitle}</p>
          <p className="text-sm text-muted-foreground">
            {!state ? "…" : state.channel ? ta.youtubeConnected(state.channel) : state.youtube ? ta.youtubeLinked : ta.youtubeNone}
          </p>
        </div>
        <Button variant="outline" size="lg" disabled={!connected} onClick={() => setOpen(true)}>
          <Unplug />
          {ta.youtubeDisconnect}
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ta.youtubeConfirmTitle}</DialogTitle>
            <DialogDescription>{ta.youtubeConfirmText}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {ta.cancel}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={disconnect}>
              {ta.youtubeDisconnect}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/** Deletes the account and everything it owns (DELETE /api/account), after the user types their email. */
export function DeleteAccountCard({ user }: { user: SessionUser }) {
  const router = useRouter()
  const { t } = useI18n()
  const ta = t.settings.account
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function remove() {
    setBusy(true)
    try {
      await call("/api/account", "DELETE")
      // The sessions went with the user; clear the cookie too
      await signOut().catch(() => {})
      toast.add({ type: "success", title: ta.deleted })
      router.push("/welcome")
      router.refresh()
    } catch (err) {
      toast.add({ type: "error", title: (err as Error).message })
      setBusy(false)
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{ta.deleteTitle}</p>
          <p className="text-sm text-muted-foreground">{ta.deleteDescription}</p>
        </div>
        <Button variant="destructive" size="lg" onClick={() => setOpen(true)}>
          <Trash2 />
          {ta.deleteButton}
        </Button>
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setTyped("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ta.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{ta.deleteConfirmText}</DialogDescription>
          </DialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={user.email} autoComplete="off" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {ta.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || typed.trim().toLowerCase() !== user.email.toLowerCase()}
              onClick={remove}
            >
              {ta.deleteConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
