"use client"

import { authClient } from "@/lib/auth-client"

// Teams are Better Auth organizations: members share folders and followed
// channels. The session's active team is the workspace every page reads.

export const TEAM_NAME_MAX = 60
/** How long an invitation stays valid (invitationExpiresIn in lib/auth.js). */
export const INVITATION_DAYS = 7

export type TeamRole = "owner" | "admin" | "member"

export const canManageTeam = (role?: string | null) => role === "owner" || role === "admin"

/** The workspace's data comes from the server: reload the page after a switch. */
export async function switchWorkspace(teamId: string | null, then?: string) {
  const { error } = await authClient.organization.setActive({ organizationId: teamId })
  if (error) throw new Error(error.message)
  if (then) window.location.assign(then)
  else window.location.reload()
}

/** Create a team (the backend makes its slug); the user becomes its owner and works in it. */
export async function createTeam(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data.team
}

/** The link an invited person opens to join (/invite/<id>). */
export const inviteLink = (invitationId: string) => `${window.location.origin}/invite/${invitationId}`
