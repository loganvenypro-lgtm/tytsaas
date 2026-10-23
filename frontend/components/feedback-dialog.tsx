"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { toast } from "@/components/ui/toast"

const KINDS = ["bug", "idea", "other"] as const
const MAX_LENGTH = 2000

// Free-text feedback, posted by POST /api/feedback to the team's Discord
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const [kind, setKind] = useState<(typeof KINDS)[number]>("idea")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, kind, page: pathname + window.location.search }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.add({ type: "success", title: t.userMenu.feedbackSent })
      setMessage("")
      onOpenChange(false)
    } catch (err) {
      toast.add({ type: "error", title: (err as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.userMenu.feedbackTitle}</DialogTitle>
          <DialogDescription>{t.userMenu.feedbackDescription}</DialogDescription>
        </DialogHeader>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[kind]}
          onValueChange={(v: string[]) => v[0] && setKind(v[0] as (typeof KINDS)[number])}
        >
          {KINDS.map((k) => (
            <ToggleGroupItem
              key={k}
              value={k}
              className="px-3 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
            >
              {t.userMenu.feedbackKinds[k]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.userMenu.feedbackPlaceholder}
          maxLength={MAX_LENGTH}
          rows={6}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {t.userMenu.feedbackSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
