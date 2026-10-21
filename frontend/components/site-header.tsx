"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { navTrail } from "@/lib/nav"

/** Top bar of the signed-in pages: where the page sits in the sidebar ("Trending › Top Videos"). */
export function SiteHeader() {
  const trail = navTrail(usePathname())

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        {trail && (
          <div className="flex items-center gap-1.5 text-base">
            <trail.icon className="size-4 text-muted-foreground" />
            {trail.crumbs.map((crumb, i) => (
              <React.Fragment key={crumb}>
                {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                <span className={i === trail.crumbs.length - 1 ? "font-medium" : "text-muted-foreground"}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
