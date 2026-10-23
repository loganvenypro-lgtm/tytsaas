"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command as CommandPrimitive } from "cmdk"
import { ArrowRight, Folder, Gem, Search, Settings, ShieldCheck, Users } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { listFolders } from "@/components/folders/folders-client"
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useSession } from "@/lib/auth-client"
import { NAV_SECTIONS, type NavItem, type NavItemKey } from "@/lib/nav"
import type { SavedFolder } from "@/lib/saved-folders"

type Entry = { key: NavItemKey; url: string; icon: NavItem["icon"] }

/** Every page of the sidebar, sub-pages included (they keep their parent's icon). */
function sectionEntries(items: NavItem[]): Entry[] {
  return items.flatMap((item) =>
    item.items?.length
      ? item.items.map((sub) => ({ key: sub.key, url: sub.url, icon: item.icon }))
      : [{ key: item.key, url: item.url, icon: item.icon }],
  )
}

/**
 * Search box over the app's pages and the user's folders, opened from the
 * header or with Ctrl/⌘+K.
 */
export function CommandMenu() {
  const { t } = useI18n()
  const router = useRouter()
  const { data: session } = useSession()
  const [open, setOpen] = React.useState(false)
  const [folders, setFolders] = React.useState<SavedFolder[]>([])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Folders change often: refreshed each time the menu opens
  React.useEffect(() => {
    if (open) listFolders().then(setFolders).catch(() => setFolders([]))
  }, [open])

  const go = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  const account: Entry[] = [
    { key: "settings", url: "/settings", icon: Settings },
    { key: "team", url: "/team", icon: Users },
    { key: "pricing", url: "/pricing", icon: Gem },
    ...((session?.user as { role?: string | null } | undefined)?.role === "admin" ? [{ key: "admin" as const, url: "/admin", icon: ShieldCheck }] : []),
  ]
  const groups = [
    ...NAV_SECTIONS.map((s) => ({ key: s.key, label: t.nav.sections[s.key], entries: sectionEntries(s.items) })),
    { key: "account", label: t.commandMenu.account, entries: account },
  ]

  const itemClass = "group/entry min-h-8 gap-2.5 px-2.5 text-[13px]"

  return (
    <>
      <SidebarMenu className="mb-2">
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={`${t.commandMenu.trigger} (Ctrl K)`}
            onClick={() => setOpen(true)}
            className="bg-sidebar-accent/60 text-muted-foreground hover:text-sidebar-accent-foreground"
          >
            <Search />
            <span>{t.commandMenu.trigger}</span>
            <Kbd className="ml-auto bg-transparent group-data-[collapsible=icon]:hidden">Ctrl K</Kbd>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t.commandMenu.title}
        description={t.commandMenu.placeholder}
        className="top-[19vh]! gap-0 sm:max-w-[38rem]"
      >
        <Command className="rounded-none p-0">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              placeholder={t.commandMenu.placeholder}
              className="h-11 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
            />
          </div>
          <CommandList className="max-h-80 p-1.5">
            <CommandEmpty className="text-sm">{t.commandMenu.empty}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup
                key={group.key}
                heading={group.label}
                className="p-0 **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:uppercase"
              >
                {group.entries.map((entry) => (
                  <CommandItem
                    key={entry.url}
                    value={`${t.nav.items[entry.key]} ${t.commandMenu.descriptions[entry.key]}`}
                    onSelect={() => go(entry.url)}
                    className={itemClass}
                  >
                    <entry.icon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{t.nav.items[entry.key]}</span>
                    <span className="truncate text-muted-foreground">— {t.commandMenu.descriptions[entry.key]}</span>
                    <ArrowRight className="ml-auto hidden size-4 text-muted-foreground group-data-selected/entry:block" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {folders.length > 0 && (
              <CommandGroup
                heading={t.nav.items.folders}
                className="p-0 **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:uppercase"
              >
                {folders.map((folder) => (
                  <CommandItem
                    key={folder.id}
                    value={`${folder.name} ${folder.id}`}
                    onSelect={() => go(`/folders/${folder.id}`)}
                    className={itemClass}
                  >
                    <Folder className="size-4 text-muted-foreground" />
                    <span className="font-medium">{folder.name}</span>
                    <span className="truncate text-muted-foreground">
                      — {t.commandMenu.folderSummary(folder.videoCount, folder.channelCount)}
                    </span>
                    <ArrowRight className="ml-auto hidden size-4 text-muted-foreground group-data-selected/entry:block" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
