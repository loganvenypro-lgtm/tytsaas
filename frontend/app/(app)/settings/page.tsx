import { SettingsView } from "@/components/settings/settings-view"
import { requireSession } from "@/lib/session"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { user, session } = await requireSession()
  const { tab } = await searchParams

  return <SettingsView user={user} currentSessionId={session.id} initialTab={tab ?? "profile"} />
}
