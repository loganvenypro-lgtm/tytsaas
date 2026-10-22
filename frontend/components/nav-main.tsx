"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
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
import { ChevronDownIcon } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { NavFolders } from "@/components/nav-folders"
import { isActive, type NavSection } from "@/lib/nav"
import { useUnreadAlerts } from "@/lib/alerts"

function UnreadAlertsBadge() {
  const count = useUnreadAlerts()
  if (!count) return null
  return (
    <SidebarMenuBadge className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground">
      {count > 99 ? "99+" : count}
    </SidebarMenuBadge>
  )
}

export function NavMain({ sections }: { sections: NavSection[] }) {
  const { t } = useI18n()
  const pathname = usePathname()
  // Folders the user opened or closed by hand; the others follow the current page
  const [openFolders, setOpenFolders] = React.useState<Record<string, boolean>>({})

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => (
        <SidebarGroup key={section.key} className="py-1 pl-3 pr-2 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="text-[11px] font-medium tracking-tight text-muted-foreground/80 px-2.5">
            {t.nav.sections[section.key]}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.url, pathname)
                if (item.folderList) return <NavFolders key={item.url} item={item} />
                if (item.items && item.items.length > 0) {
                  return (
                    <Collapsible
                      key={item.url}
                      open={openFolders[item.url] ?? active}
                      onOpenChange={(open) => setOpenFolders((prev) => ({ ...prev, [item.url]: open }))}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger
                          render={
                            <SidebarMenuButton
                              tooltip={t.nav.items[item.key]}
                              className={
                                active
                                  ? "bg-accent font-medium text-accent-foreground"
                                  : ""
                              }
                            />
                          }
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{t.nav.items[item.key]}</span>
                          <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-180 group-data-[state=open]/collapsible:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.url}>
                                <SidebarMenuSubButton asChild isActive={isActive(subItem.url, pathname)}>
                                  <Link href={subItem.url}>
                                    <span>{t.nav.items[subItem.key]}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      tooltip={t.nav.items[item.key]}
                      isActive={active}
                      className={
                        active
                          ? "bg-accent font-medium text-accent-foreground shadow-xs"
                          : ""
                      }
                    >
                      <Link href={item.url}>
                        <Icon className="size-4 shrink-0" />
                        <span>{t.nav.items[item.key]}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge === "alerts" && <UnreadAlertsBadge />}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  )
}
