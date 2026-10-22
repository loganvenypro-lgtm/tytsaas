"use client"

import * as React from "react"
import Link from "next/link"
import { LifeBuoy } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { ReturbeMark } from "@/components/returbe-logo"
import { useI18n } from "@/components/i18n-provider"
import { TeamSwitcher } from "@/components/teams/team-switcher"
import { NAV_SECTIONS } from "@/lib/nav"
import type { SessionUser } from "@/lib/session"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const SUPPORT_URL = "https://discord.gg/4cUtY3H3w"

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SessionUser }) {
  const { t } = useI18n()
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className="h-(--header-height) justify-center px-4 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <ReturbeMark className="size-5!" />
              <span className="text-lg leading-none font-bold tracking-tight">{t.brand}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pb-0">
          <TeamSwitcher />
        </SidebarGroup>
        <NavMain sections={NAV_SECTIONS} />
      </SidebarContent>
      <SidebarFooter className="pl-3 pr-2 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t.nav.support}
              render={<a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <LifeBuoy />
              <span>{t.nav.support}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
