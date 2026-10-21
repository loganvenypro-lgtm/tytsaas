"use client"

import * as React from "react"

import { NavMain, type NavSection } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import type { SessionUser } from "@/lib/session"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Home,
  Flame,
  Search,
  FolderBookmark,
  Eye,
  Clapperboard,
  Sparkles,
  Plug,
  Command,
} from "lucide-react"

const sidebarSections: NavSection[] = [
  {
    label: "Discover",
    items: [
      {
        title: "Home",
        url: "#",
        icon: Home,
        isActive: true,
      },
      {
        title: "Trending",
        url: "#",
        icon: Flame,
        items: [
          { title: "Top Videos", url: "#" },
          { title: "Breakout Creators", url: "#" },
        ],
      },
      {
        title: "Search",
        url: "#",
        icon: Search,
        items: [
          { title: "Keywords", url: "#" },
          { title: "Hashtags", url: "#" },
        ],
      },
    ],
  },
  {
    label: "Tracking",
    items: [
      {
        title: "My Folders",
        url: "#",
        icon: FolderBookmark,
      },
      {
        title: "Channels",
        url: "#",
        icon: Eye,
        items: [
          { title: "Competitors", url: "#" },
          { title: "Inspirations", url: "#" },
        ],
      },
    ],
  },
  {
    label: "Creation",
    items: [
      {
        title: "Studio",
        url: "#",
        icon: Clapperboard,
      },
      {
        title: "AI Tools",
        url: "#",
        icon: Sparkles,
        items: [
          { title: "Script Generator", url: "#" },
          { title: "Thumbnail Ideas", url: "#" },
        ],
      },
      {
        title: "Connect Claude",
        url: "#",
        icon: Plug,
      },
    ],
  },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SessionUser }) {
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className="h-(--header-height) justify-center px-4 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <Command className="size-5!" />
              <span className="text-base font-semibold">Acme Inc.</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={sidebarSections} />
      </SidebarContent>
      <SidebarFooter className="pl-3 pr-2 group-data-[collapsible=icon]:px-2">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
