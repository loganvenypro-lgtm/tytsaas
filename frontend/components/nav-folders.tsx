"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"

import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n-provider"
import { listFolders } from "@/components/folders/folders-client"
import { isActive, type NavItem } from "@/lib/nav"
import { FOLDERS_CHANGED_EVENT, type SavedFolder } from "@/lib/saved-folders"

const OPEN_KEY = "nav_folders_open"
const OPEN_CHANGED_EVENT = "nav-folders-open-changed"

// The open state lives in localStorage; useSyncExternalStore reads it without a hydration mismatch
function subscribeOpen(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(OPEN_CHANGED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(OPEN_CHANGED_EVENT, onChange)
  }
}

function readOpen(): string | null {
  try {
    return localStorage.getItem(OPEN_KEY)
  } catch {
    return null
  }
}

function writeOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, String(open))
  } catch {
    // Storage blocked: the state just won't survive a reload
  }
  window.dispatchEvent(new Event(OPEN_CHANGED_EVENT))
}

/** The "My folders" link, with a chevron that lists each folder under it. */
export function NavFolders({ item }: { item: NavItem }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const active = isActive(item.url, pathname)
  const stored = React.useSyncExternalStore(subscribeOpen, readOpen, () => null)
  // Until the user picks, the list is open on the folder pages
  const open = stored === null ? active : stored === "true"
  const [folders, setFolders] = React.useState<SavedFolder[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const Icon = item.icon

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = () =>
      listFolders()
        .then((list) => {
          if (cancelled) return
          setFolders(list)
          setFailed(false)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    load()
    window.addEventListener(FOLDERS_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(FOLDERS_CHANGED_EVENT, load)
    }
  }, [open])

  return (
    <Collapsible open={open} onOpenChange={writeOpen} className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={t.nav.items[item.key]}
          isActive={pathname === item.url}
          className={
            active
              ? "bg-accent pr-8 font-medium text-accent-foreground shadow-xs"
              : "pr-8"
          }
        >
          <Link href={item.url}>
            <Icon className="size-4 shrink-0" />
            <span>{t.nav.items[item.key]}</span>
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger
          render={
            <SidebarMenuAction
              aria-label={open ? t.nav.folderList.hide : t.nav.folderList.show}
              className="text-muted-foreground"
            />
          }
        >
          <ChevronRightIcon className="size-3.5! transition-transform duration-200 group-data-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {folders === null && !failed && (
              <SidebarMenuSubItem>
                {/* Fixed width: SidebarMenuSkeleton's random one breaks hydration */}
                <div className="flex h-7 items-center px-2">
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </SidebarMenuSubItem>
            )}
            {folders === null && failed && (
              <SidebarMenuSubItem className="px-2 py-1 text-xs text-muted-foreground">
                {t.nav.folderList.loadError}
              </SidebarMenuSubItem>
            )}
            {folders?.length === 0 && (
              <SidebarMenuSubItem className="px-2 py-1 text-xs text-muted-foreground">
                {t.nav.folderList.empty}
              </SidebarMenuSubItem>
            )}
            {folders?.map((folder) => {
              const url = `/folders/${folder.id}`
              return (
                <SidebarMenuSubItem key={folder.id}>
                  <SidebarMenuSubButton asChild isActive={isActive(url, pathname)}>
                    <Link href={url} title={folder.name}>
                      <span>{folder.name}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
