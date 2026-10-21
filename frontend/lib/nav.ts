import type * as React from "react"
import {
  Clapperboard,
  Eye,
  Flame,
  FolderBookmark,
  Home,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import type { Messages } from "@/lib/i18n"

// Labels live in the messages (t.nav), so the sidebar follows the interface language
export type NavItemKey = keyof Messages["nav"]["items"]
export type NavSectionKey = keyof Messages["nav"]["sections"]

export type NavItem = {
  key: NavItemKey
  url: string
  icon: React.ComponentType<{ className?: string }>
  items?: { key: NavItemKey; url: string }[]
}

export type NavSection = {
  key: NavSectionKey
  items: NavItem[]
}

// The sidebar. An item with `items` is a collapsible folder; its own url is
// only used to match the pages under it.
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "discover",
    items: [
      { key: "home", url: "/", icon: Home },
      {
        key: "trending",
        url: "/trending",
        icon: Flame,
        items: [
          { key: "topVideos", url: "/trending/top-videos" },
          { key: "breakoutCreators", url: "/trending/breakout-creators" },
        ],
      },
      {
        key: "search",
        url: "/search",
        icon: Search,
        items: [
          { key: "keywords", url: "/search/keywords" },
          { key: "hashtags", url: "/search/hashtags" },
        ],
      },
    ],
  },
  {
    key: "tracking",
    items: [
      { key: "folders", url: "/folders", icon: FolderBookmark },
      {
        key: "channels",
        url: "/channels",
        icon: Eye,
        items: [
          { key: "competitors", url: "/channels/competitors" },
          { key: "inspirations", url: "/channels/inspirations" },
        ],
      },
    ],
  },
  {
    key: "creation",
    items: [
      { key: "studio", url: "/studio", icon: Clapperboard },
      {
        key: "aiTools",
        url: "/ai-tools",
        icon: Sparkles,
        items: [
          { key: "scriptGenerator", url: "/ai-tools/script-generator" },
          { key: "thumbnailIdeas", url: "/ai-tools/thumbnail-ideas" },
        ],
      },
      { key: "connectClaude", url: "/connect-claude", icon: Plug },
    ],
  },
]

// Pages reached from the user menu rather than the sidebar
const EXTRA_PAGES: Record<string, Omit<NavItem, "url">> = {
  "/settings": { key: "settings", icon: Settings },
  "/admin": { key: "admin", icon: ShieldCheck },
}

export function isActive(url: string, pathname: string) {
  return url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`)
}

export type NavTrail = { icon: NavItem["icon"]; crumbs: NavItemKey[] }

/** Where a page sits in the sidebar (trending › topVideos), or null when it isn't listed. */
export function navTrail(pathname: string): NavTrail | null {
  const extra = EXTRA_PAGES[pathname]
  if (extra) return { icon: extra.icon, crumbs: [extra.key] }
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const sub = item.items?.find((i) => isActive(i.url, pathname))
      if (sub) return { icon: item.icon, crumbs: [item.key, sub.key] }
      if (!item.items && isActive(item.url, pathname)) return { icon: item.icon, crumbs: [item.key] }
    }
  }
  return null
}
