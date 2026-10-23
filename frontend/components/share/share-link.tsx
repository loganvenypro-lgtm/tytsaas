"use client"

import * as React from "react"
import { Copy, Link2, Link2Off, RefreshCw, Share2 } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import {
  disableShareLink,
  enableShareLink,
  getShareLink,
  shareUrl,
  type ShareKind,
  type ShareLink,
} from "@/lib/share-links"

async function copy(text: string, message: string) {
  await navigator.clipboard.writeText(text).catch(() => {})
  toast.add({ type: "success", title: message })
}

/**
 * The link of a folder or a team, with copy, regenerate and disable. Loads
 * the current state; nothing is created until the owner asks.
 */
export function ShareLinkPanel({ kind, targetId, initial }: { kind: ShareKind; targetId: string; initial?: ShareLink }) {
  const { t } = useI18n()
  const [link, setLink] = React.useState<ShareLink | null | undefined>(initial)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (initial) return
    getShareLink(kind, targetId)
      .then(setLink)
      .catch(() => setLink(null))
  }, [kind, targetId, initial])

  async function run(action: () => Promise<ShareLink | null>, message?: string) {
    setBusy(true)
    try {
      const next = await action()
      setLink(next)
      if (next?.enabled && message) await copy(shareUrl(next.token), message)
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : t.share.error })
    } finally {
      setBusy(false)
    }
  }

  if (link === undefined) return <Skeleton className="h-9 w-full" />

  if (!link?.enabled) {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">{link ? t.share.disabled : t.share.none}</p>
        <Button className="w-fit" disabled={busy} onClick={() => run(() => enableShareLink(kind, targetId), t.share.copied)}>
          <Link2 />
          {link ? t.share.enable : t.share.create}
        </Button>
      </div>
    )
  }

  const url = shareUrl(link.token)
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label={t.share.linkLabel} onFocus={(e) => e.target.select()} />
        <Button variant="outline" onClick={() => copy(url, t.share.copied)}>
          <Copy />
          {t.share.copy}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => run(() => enableShareLink(kind, targetId, true), t.share.regenerated)}
        >
          <RefreshCw />
          {t.share.regenerate}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => disableShareLink(kind, targetId))}>
          <Link2Off />
          {t.share.disable}
        </Button>
      </div>
    </div>
  )
}

/**
 * "Share" button of a folder: turns the link on if needed, copies it, and
 * opens a dialog to regenerate or disable it.
 */
export function ShareFolderButton({ folderId, folderName }: { folderId: string; folderName: string }) {
  const { t } = useI18n()
  const [link, setLink] = React.useState<ShareLink | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function share() {
    setBusy(true)
    try {
      const next = await enableShareLink("folder", folderId)
      await copy(shareUrl(next.token), t.share.copied)
      setLink(next)
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : t.share.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={share}>
        <Share2 />
        {t.share.button}
      </Button>
      <Dialog open={link != null} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.share.folderTitle(folderName)}</DialogTitle>
            <DialogDescription>{t.share.folderDescription}</DialogDescription>
          </DialogHeader>
          {link && <ShareLinkPanel kind="folder" targetId={folderId} initial={link} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** "Share" button for a page every signed-in user can open (a channel profile): copies its URL. */
export function CopyPageLinkButton() {
  const { t } = useI18n()
  return (
    <Button variant="outline" size="sm" onClick={() => copy(window.location.href, t.share.copied)}>
      <Share2 />
      {t.share.button}
    </Button>
  )
}
