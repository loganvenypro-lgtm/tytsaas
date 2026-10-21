import { redirect } from "next/navigation"

import { AdminView } from "@/components/admin/admin-view"
import { requireSession } from "@/lib/session"

/** /admin: every user, onboarding, AI result and database of the site. Admins only. */
export default async function AdminPage() {
  const { user } = await requireSession()
  if (user.role !== "admin") redirect("/")

  return <AdminView adminEmail={user.email} />
}
