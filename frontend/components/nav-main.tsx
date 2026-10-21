"use client"

import * as React from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
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

export type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export function NavMain({ sections }: { sections: NavSection[] }) {
  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => (
        <SidebarGroup key={section.label} className="py-1 pl-3 pr-2 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="text-[11px] font-medium tracking-tight text-muted-foreground/80 px-2.5">
            {section.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                if (item.items && item.items.length > 0) {
                  return (
                    <Collapsible
                      key={item.title}
                      defaultOpen={item.isActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger
                          render={
                            <SidebarMenuButton
                              tooltip={item.title}
                              className={
                                item.isActive
                                  ? "bg-accent font-medium text-accent-foreground"
                                  : ""
                              }
                            />
                          }
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.title}</span>
                          <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-180 group-data-[state=open]/collapsible:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <a href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </a>
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
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={item.isActive}
                      className={
                        item.isActive
                          ? "bg-accent font-medium text-accent-foreground shadow-xs"
                          : ""
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
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
