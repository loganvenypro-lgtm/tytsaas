"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, Flame, FolderOpen, Users } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { SavedItem } from "@/lib/saved-folders"
import { joinSharedTeam, openShared, type SharedObject } from "@/lib/share-links"
import { switchWorkspace } from "@/lib/teams"
import { cn, withNext } from "@/lib/utils"

/** /share/<token>: a shared folder (read-only) or a team invitation link. */
export function SharedView({ token, signedIn }: { token: string; signedIn: boolean }) {
  const { t } = useI18n()
  const [shared, setShared] = React.useState<SharedObject | null | undefined>(undefined)

  React.useEffect(() => {
    openShared(token)
      .then(setShared)
      .catch(() => setShared(null))
  }, [token])

  if (shared === undefined) {
    return (
      <Centered>
        <Skeleton className="h-56 w-full" />
      </Centered>
    )
  }

  if (!shared) {
    return (
      <Centered>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t.share.notFoundTitle}</CardTitle>
            <CardDescription>{t.share.notFound}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button nativeButton={false} render={<Link href="/" />}>
              {t.share.openApp}
            </Button>
          </CardFooter>
        </Card>
      </Centered>
    )
  }

  if (shared.kind === "team") return <TeamInvite token={token} team={shared.team} signedIn={signedIn} />
  return <SharedFolder folder={shared.folder} items={shared.items} signedIn={signedIn} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

function TeamInvite({
  token,
  team,
  signedIn,
}: {
  token: string
  team: { id: string; name: string; memberCount: number }
  signedIn: boolean
}) {
  const { t } = useI18n()
  const [busy, setBusy] = React.useState(false)
  const here = `/share/${token}`

  async function join() {
    setBusy(true)
    try {
      await joinSharedTeam(token)
      toast.add({ type: "success", title: t.teams.invite.joined(team.name) })
      await switchWorkspace(team.id, "/")
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : t.share.error })
      setBusy(false)
    }
  }

  return (
    <Centered>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
            <Users className="size-5" />
          </div>
          <CardTitle>{t.share.teamTitle(team.name)}</CardTitle>
          <CardDescription>{t.teams.page.membersCount(team.memberCount)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-center text-sm text-muted-foreground">
          <p>{t.teams.page.shared}</p>
          {!signedIn && <p>{t.share.teamSignedOut}</p>}
        </CardContent>
        <CardFooter className="justify-center gap-2">
          {signedIn ? (
            <Button disabled={busy} onClick={join}>
              {t.teams.invite.accept}
            </Button>
          ) : (
            <>
              <Button nativeButton={false} render={<Link href={withNext("/login", here)} />}>
                {t.teams.invite.signIn}
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href={withNext("/signup", here)} />}>
                {t.teams.invite.signUp}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </Centered>
  )
}

function SharedFolder({
  folder,
  items,
  signedIn,
}: {
  folder: { name: string; owner: string | null }
  items: SavedItem[]
  signedIn: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <FolderOpen className="size-6 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{folder.name}</h1>
              <p className="text-sm text-muted-foreground">
                {[folder.owner && t.share.sharedBy(folder.owner), t.share.readOnly].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href={signedIn ? "/" : "/welcome"} />}>
            {signedIn ? t.share.openApp : t.share.discover}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.folders.folderEmpty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) =>
              item.type === "video" ? <VideoCard key={`v-${item.id}`} item={item} /> : <ChannelCard key={`c-${item.id}`} item={item} />,
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VideoCard({ item }: { item: SavedItem }) {
  const { compact, t } = useI18n()
  const s = item.snapshot
  const url = `https://www.youtube.com/watch?v=${item.id}`
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <a href={url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover" />
        {s.multiplier != null && s.multiplier >= 1 && (
          <span
            className={cn(
              "absolute top-2 left-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold shadow-sm",
              s.multiplier >= 3 ? "bg-emerald-600 text-white" : "bg-white/90 text-slate-900",
            )}
          >
            <Flame className="size-3" />
            {s.multiplier.toFixed(1)}x
          </span>
        )}
      </a>
      <div className="flex flex-col gap-2 p-3.5">
        <a href={url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm leading-snug font-medium hover:underline">
          {s.title}
        </a>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{s.channelName}</span>
          <span className="flex shrink-0 items-center gap-2">
            {s.views != null && (
              <span className="flex items-center gap-1 tabular-nums">
                <Eye className="size-3" />
                {compact(s.views)}
              </span>
            )}
            {s.isShort != null && (
              <Badge variant="outline" className="font-normal">
                {s.isShort ? t.common.short : t.common.longVideo}
              </Badge>
            )}
          </span>
        </div>
      </div>
    </Card>
  )
}

function ChannelCard({ item }: { item: SavedItem }) {
  const { compact, t } = useI18n()
  const s = item.snapshot
  return (
    <Card className="gap-0 p-0">
      <a
        href={`https://www.youtube.com/channel/${item.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-3 px-4 py-6 text-center"
      >
        <Avatar className="size-16">
          {s.thumbnail && <AvatarImage src={s.thumbnail} alt="" />}
          <AvatarFallback className="text-lg">{s.title.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate font-medium">{s.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[s.handle, s.subscribers != null ? t.common.subscribers(compact(s.subscribers)) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge variant="secondary">{t.folders.channel}</Badge>
      </a>
    </Card>
  )
}
