"use client"

import * as React from "react"
import { Copy, LogOut, Mail, Plus, Share2, Trash2, UserMinus, Users, X } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { ShareLinkPanel } from "@/components/share/share-link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { authClient } from "@/lib/auth-client"
import { INVITATION_DAYS, TEAM_NAME_MAX, canManageTeam, inviteLink, switchWorkspace, type TeamRole } from "@/lib/teams"
import { CreateTeamDialog } from "./create-team-dialog"

type Confirm = { title: string; description: string; label: string; run: () => Promise<void> }

/** /team: the active team's members, invitations and settings. */
export function TeamView({ userId }: { userId: string }) {
  const { t, date } = useI18n()
  const { data: team, isPending } = authClient.useActiveOrganization()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState<Confirm | null>(null)

  if (isPending) {
    return (
      <Shell>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </Shell>
    )
  }

  if (!team) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>{t.teams.page.noTeamTitle}</CardTitle>
            <CardDescription>{t.teams.page.noTeamHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              {t.teams.create}
            </Button>
          </CardContent>
        </Card>
        <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      </Shell>
    )
  }

  const me = team.members.find((m) => m.userId === userId)
  const myRole = me?.role ?? "member"
  const manager = canManageTeam(myRole)
  const pending = team.invitations.filter((i) => i.status === "pending" && new Date(i.expiresAt) > new Date())
  const roleLabel = (role: string) => t.teams.roles[role as TeamRole] ?? role
  const fail = (err: unknown) =>
    toast.add({ type: "error", title: err instanceof Error ? err.message : t.teams.genericError })

  // Better Auth answers { error } rather than throwing
  async function call(promise: Promise<{ error: { message?: string } | null }>) {
    const { error } = await promise
    if (error) throw new Error(error.message || t.teams.genericError)
  }

  async function runConfirm() {
    if (!confirm) return
    try {
      await confirm.run()
      setConfirm(null)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <Shell>
      <TeamNameCard
        key={team.id + team.name}
        teamId={team.id}
        name={team.name}
        editable={manager}
        description={t.teams.page.shared}
        onRename={(name) => call(authClient.organization.update({ organizationId: team.id, data: { name } }))}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {t.teams.page.members}
            </CardTitle>
            <CardDescription>{t.teams.page.membersCount(team.members.length)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {team.members.map((m) => {
            const isMe = m.userId === userId
            // Owners manage everyone; admins manage members and admins, never the owner
            const canEdit = manager && !isMe && m.role !== "owner"
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2">
                <Avatar className="size-8">
                  <AvatarImage src={m.user.image ?? undefined} alt={m.user.name} />
                  <AvatarFallback>{m.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-sm leading-tight">
                  <span className="truncate font-medium">
                    {m.user.name}
                    {isMe && <span className="text-muted-foreground"> ({t.teams.page.you})</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{m.user.email}</span>
                </div>
                {canEdit ? (
                  <RoleSelect
                    value={m.role}
                    roles={myRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"]}
                    onChange={(role) =>
                      call(authClient.organization.updateMemberRole({ organizationId: team.id, memberId: m.id, role })).catch(fail)
                    }
                  />
                ) : (
                  <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.teams.page.remove}
                    onClick={() =>
                      setConfirm({
                        title: t.teams.page.removeTitle(m.user.name),
                        description: t.teams.page.removeDescription,
                        label: t.teams.page.remove,
                        run: () =>
                          call(authClient.organization.removeMember({ organizationId: team.id, memberIdOrEmail: m.id })),
                      })
                    }
                  >
                    <UserMinus />
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {manager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              {t.teams.page.inviteTitle}
            </CardTitle>
            <CardDescription>{t.teams.page.inviteDescription(INVITATION_DAYS)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InviteForm teamId={team.id} canInviteAdmin={manager} />
            <div className="grid gap-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Share2 className="size-4" />
                {t.share.teamLinkTitle}
              </h3>
              <p className="text-sm text-muted-foreground">{t.share.teamLinkDescription}</p>
              <ShareLinkPanel kind="team" targetId={team.id} />
            </div>
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">{t.teams.page.pending}</h3>
              {pending.length === 0 && <p className="text-sm text-muted-foreground">{t.teams.page.noPending}</p>}
              {pending.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">{inv.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {roleLabel(inv.role)} · {t.teams.page.expires(date(inv.expiresAt, { day: "numeric", month: "long" }))}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyLink(inv.id, t.teams.page.linkCopied)}>
                    <Copy />
                    {t.teams.page.copyLink}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.teams.page.cancelInvite}
                    onClick={() => call(authClient.organization.cancelInvitation({ invitationId: inv.id })).catch(fail)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.teams.page.danger}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {myRole !== "owner" && (
            <Button
              variant="destructive"
              onClick={() =>
                setConfirm({
                  title: t.teams.page.leaveTitle(team.name),
                  description: t.teams.page.leaveDescription,
                  label: t.teams.page.leave,
                  run: async () => {
                    await call(authClient.organization.leave({ organizationId: team.id }))
                    await switchWorkspace(null, "/")
                  },
                })
              }
            >
              <LogOut />
              {t.teams.page.leave}
            </Button>
          )}
          {myRole === "owner" && (
            <Button
              variant="destructive"
              onClick={() =>
                setConfirm({
                  title: t.teams.page.deleteTitle(team.name),
                  description: t.teams.page.deleteDescription,
                  label: t.teams.page.delete,
                  run: async () => {
                    await call(authClient.organization.delete({ organizationId: team.id }))
                    await switchWorkspace(null, "/")
                  },
                })
              }
            >
              <Trash2 />
              {t.teams.page.delete}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirm != null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={runConfirm}>
              {confirm?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">{children}</div>
}

async function copyLink(invitationId: string, message: string) {
  await navigator.clipboard.writeText(inviteLink(invitationId))
  toast.add({ type: "success", title: message })
}

function RoleSelect({
  value,
  roles,
  onChange,
}: {
  value: string
  roles: TeamRole[]
  onChange: (role: TeamRole) => void
}) {
  const { t } = useI18n()
  const items = Object.fromEntries(roles.map((r) => [r, t.teams.roles[r]]))
  return (
    <Select items={items} value={value} onValueChange={(v) => v && v !== value && onChange(v as TeamRole)}>
      <SelectTrigger className="w-32" aria-label={t.teams.page.roleLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end">
        {roles.map((r) => (
          <SelectItem key={r} value={r}>
            {t.teams.roles[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TeamNameCard({
  teamId,
  name: initialName,
  editable,
  description,
  onRename,
}: {
  teamId: string
  name: string
  editable: boolean
  description: string
  onRename: (name: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [name, setName] = React.useState(initialName)
  const [saving, setSaving] = React.useState(false)
  const trimmed = name.trim()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed || trimmed === initialName) return
    setSaving(true)
    try {
      await onRename(trimmed)
      toast.add({ type: "success", title: t.teams.page.renamed })
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : t.teams.genericError })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{initialName}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {editable && (
        <CardContent>
          <form id={`team-${teamId}`} onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={name}
              maxLength={TEAM_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              aria-label={t.teams.nameLabel}
            />
            <Button type="submit" disabled={saving || !trimmed || trimmed === initialName}>
              {t.common.save}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  )
}

function InviteForm({ teamId, canInviteAdmin }: { teamId: string; canInviteAdmin: boolean }) {
  const { t } = useI18n()
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<TeamRole>("member")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { data, error } = await authClient.organization.inviteMember({
      organizationId: teamId,
      email: email.trim(),
      role: role === "admin" ? "admin" : "member",
      resend: true,
    })
    setSending(false)
    if (error || !data) {
      setError(error?.message || t.teams.genericError)
      return
    }
    setEmail("")
    // No email is sent yet: the inviter passes the link on
    await navigator.clipboard.writeText(inviteLink(data.id)).catch(() => {})
    toast.add({ type: "success", title: t.teams.page.inviteCreated })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Input
          type="email"
          required
          className="min-w-48 flex-1"
          value={email}
          placeholder={t.teams.page.emailPlaceholder}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t.teams.page.emailLabel}
        />
        {canInviteAdmin && <RoleSelect value={role} roles={["member", "admin"]} onChange={setRole} />}
        <Button type="submit" disabled={sending || !email.trim()}>
          <Plus />
          {t.teams.page.invite}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
