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

export type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  items?: { title: string; url: string }[]
}

export type NavSection = {
  label: string
  items: NavItem[]
}

// The sidebar. An item with `items` is a collapsible folder; its own url is
// only used to match the pages under it.
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Discover",
    items: [
      { title: "Home", url: "/", icon: Home },
      {
        title: "Trending",
        url: "/trending",
        icon: Flame,
        items: [
          { title: "Top Videos", url: "/trending/top-videos" },
          { title: "Breakout Creators", url: "/trending/breakout-creators" },
        ],
      },
      {
        title: "Search",
        url: "/search",
        icon: Search,
        items: [
          { title: "Keywords", url: "/search/keywords" },
          { title: "Hashtags", url: "/search/hashtags" },
        ],
      },
    ],
  },
  {
    label: "Tracking",
    items: [
      { title: "My Folders", url: "/folders", icon: FolderBookmark },
      {
        title: "Channels",
        url: "/channels",
        icon: Eye,
        items: [
          { title: "Competitors", url: "/channels/competitors" },
          { title: "Inspirations", url: "/channels/inspirations" },
        ],
      },
    ],
  },
  {
    label: "Creation",
    items: [
      { title: "Studio", url: "/studio", icon: Clapperboard },
      {
        title: "AI Tools",
        url: "/ai-tools",
        icon: Sparkles,
        items: [
          { title: "Script Generator", url: "/ai-tools/script-generator" },
          { title: "Thumbnail Ideas", url: "/ai-tools/thumbnail-ideas" },
        ],
      },
      { title: "Connect Claude", url: "/connect-claude", icon: Plug },
    ],
  },
]

// Pages reached from the user menu rather than the sidebar
const EXTRA_PAGES: Record<string, Omit<NavItem, "url">> = {
  "/settings": { title: "Paramètres", icon: Settings },
  "/admin": { title: "Admin", icon: ShieldCheck },
}

export function isActive(url: string, pathname: string) {
  return url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`)
}

export type NavTrail = { icon: NavItem["icon"]; crumbs: string[] }

/** Where a page sits in the sidebar ("Trending" › "Top Videos"), or null when it isn't listed. */
export function navTrail(pathname: string): NavTrail | null {
  const extra = EXTRA_PAGES[pathname]
  if (extra) return { icon: extra.icon, crumbs: [extra.title] }
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const sub = item.items?.find((i) => isActive(i.url, pathname))
      if (sub) return { icon: item.icon, crumbs: [item.title, sub.title] }
      if (!item.items && isActive(item.url, pathname)) return { icon: item.icon, crumbs: [item.title] }
    }
  }
  return null
}
