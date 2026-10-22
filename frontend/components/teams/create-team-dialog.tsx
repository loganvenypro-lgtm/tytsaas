"use client"

import * as React from "react"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { TEAM_NAME_MAX, createTeam } from "@/lib/teams"

/** Name a new team; once created the user works in it, on its /team page. */
export function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed on open so each opening starts empty with no stale error */}
        <CreateTeamForm key={String(open)} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateTeamForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useI18n()
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createTeam(name.trim())
      // The new team is the session's workspace: reload everything on its page
      window.location.assign("/team")
    } catch (err) {
      setError(err instanceof Error ? err.message : t.teams.genericError)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t.teams.create}</DialogTitle>
        <DialogDescription>{t.teams.createDescription}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Input
          autoFocus
          value={name}
          maxLength={TEAM_NAME_MAX}
          placeholder={t.teams.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          aria-label={t.teams.nameLabel}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? t.teams.creating : t.teams.create}
        </Button>
      </DialogFooter>
    </form>
  )
}
