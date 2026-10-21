import { redirect } from "next/navigation"

import { AdminView } from "@/components/admin/admin-view"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireSession } from "@/lib/session"

/** /admin: every user, onboarding, AI result and database of the site. Admins only. */
export default async function AdminPage() {
  const { user } = await requireSession()
  if (user.role !== "admin") redirect("/")

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
        <SiteHeader title="Admin" />
        <AdminView adminEmail={user.email} />
      </SidebarInset>
    </SidebarProvider>
  )
}
