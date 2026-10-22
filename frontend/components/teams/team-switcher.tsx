"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Settings2, User, Users } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { toast } from "@/components/ui/toast"
import { authClient, useSession } from "@/lib/auth-client"
import { switchWorkspace } from "@/lib/teams"
import { CreateTeamDialog } from "./create-team-dialog"

/** Sidebar menu to pick the workspace: the personal space or one of the user's teams. */
export function TeamSwitcher() {
  const { t } = useI18n()
  const { isMobile } = useSidebar()
  const { data: session } = useSession()
  const { data: teams } = authClient.useListOrganizations()
  const [createOpen, setCreateOpen] = React.useState(false)

  const activeId = session?.session.activeOrganizationId ?? null
  const active = teams?.find((team) => team.id === activeId) ?? null

  async function pick(teamId: string | null) {
    if (teamId === (active?.id ?? null)) return
    try {
      await switchWorkspace(teamId)
    } catch {
      toast.add({ type: "error", title: t.teams.switchError })
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton tooltip={active?.name ?? t.teams.personal} className="aria-expanded:bg-muted" />}
          >
            {active ? <Users /> : <User />}
            <span className="truncate font-medium">{active?.name ?? t.teams.personal}</span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="start" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t.teams.switcherLabel}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => pick(null)}>
                <User />
                <span className="truncate">{t.teams.personal}</span>
                {!active && <Check className="ml-auto" />}
              </DropdownMenuItem>
              {teams?.map((team) => (
                <DropdownMenuItem key={team.id} onClick={() => pick(team.id)}>
                  <Users />
                  <span className="truncate">{team.name}</span>
                  {team.id === active?.id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {active && (
              <DropdownMenuItem onClick={() => window.location.assign("/team")}>
                <Settings2 />
                {t.teams.manage}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus />
              {t.teams.create}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
