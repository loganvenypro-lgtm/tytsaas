import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { WeeklyNewsDialog } from "@/components/weekly-news-dialog"
import { requireSession } from "@/lib/session"

/** Shell of every signed-in page: sidebar, header, and a verified session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession()
  // New accounts answer the onboarding first; existing ones were marked as onboarded
  if (!user.onboardedAt) redirect("/onboarding")

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
      <WeeklyNewsDialog userId={user.id} name={user.name} />
    </SidebarProvider>
  )
}
