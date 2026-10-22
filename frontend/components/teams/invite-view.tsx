"use client"

import * as React from "react"
import Link from "next/link"
import { Users } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { authClient, signOut } from "@/lib/auth-client"
import type { TeamRole } from "@/lib/teams"
import { withNext } from "@/lib/utils"

type Invitation = {
  organizationName: string
  inviterEmail: string
  role: string
  expiresAt: string | Date
}

/**
 * Accept or decline a team invitation. Better Auth only shows it to the
 * invited email, so another account sees "not found" with a way to switch.
 */
export function InviteView({ invitationId, email }: { invitationId: string; email: string | null }) {
  const { t, date } = useI18n()
  const here = `/invite/${invitationId}`
  const [invitation, setInvitation] = React.useState<Invitation | null | undefined>(undefined)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!email) return
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data }) => setInvitation(data && data.status === "pending" ? data : null))
      .catch(() => setInvitation(null))
  }, [invitationId, email])

  async function accept() {
    setBusy(true)
    const { error } = await authClient.organization.acceptInvitation({ invitationId })
    if (error) {
      toast.add({ type: "error", title: error.message || t.teams.genericError })
      setBusy(false)
      return
    }
    toast.add({ type: "success", title: t.teams.invite.joined(invitation?.organizationName ?? "") })
    // Accepting makes the team the session's workspace
    window.location.assign("/")
  }

  async function reject() {
    setBusy(true)
    await authClient.organization.rejectInvitation({ invitationId })
    toast.add({ type: "success", title: t.teams.invite.rejected })
    window.location.assign("/")
  }

  async function switchAccount() {
    await signOut()
    window.location.assign(withNext("/login", here))
  }

  const header = (
    <CardHeader className="text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
        <Users className="size-5" />
      </div>
      <CardTitle>{t.teams.invite.title}</CardTitle>
    </CardHeader>
  )

  if (!email) {
    return (
      <Card>
        {header}
        <CardContent>
          <CardDescription className="text-center">{t.teams.invite.signedOut}</CardDescription>
        </CardContent>
        <CardFooter className="justify-center gap-2">
          <Button render={<Link href={withNext("/login", here)} />}>{t.teams.invite.signIn}</Button>
          <Button variant="outline" render={<Link href={withNext("/signup", here)} />}>
            {t.teams.invite.signUp}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (invitation === undefined) return <Skeleton className="h-56 w-full" />

  if (!invitation) {
    return (
      <Card>
        {header}
        <CardContent className="grid gap-1 text-center text-sm">
          <p>{t.teams.invite.notFound}</p>
          <p className="text-muted-foreground">{t.teams.invite.signedInAs(email)}</p>
        </CardContent>
        <CardFooter className="justify-center gap-2">
          <Button variant="outline" onClick={switchAccount}>
            {t.teams.invite.switchAccount}
          </Button>
          <Button render={<Link href="/" />}>{t.teams.invite.backHome}</Button>
        </CardFooter>
      </Card>
    )
  }

  const role = t.teams.roles[invitation.role as TeamRole] ?? invitation.role
  return (
    <Card>
      {header}
      <CardContent className="grid gap-1 text-center text-sm">
        <p className="font-medium">{t.teams.invite.invitedBy(invitation.inviterEmail, invitation.organizationName)}</p>
        <p className="text-muted-foreground">
          {t.teams.invite.role(role)} · {t.teams.invite.expires(date(invitation.expiresAt, { day: "numeric", month: "long" }))}
        </p>
        <p className="text-muted-foreground">{t.teams.page.shared}</p>
      </CardContent>
      <CardFooter className="justify-center gap-2">
        <Button variant="outline" disabled={busy} onClick={reject}>
          {t.teams.invite.reject}
        </Button>
        <Button disabled={busy} onClick={accept}>
          {t.teams.invite.accept}
        </Button>
      </CardFooter>
    </Card>
  )
}
