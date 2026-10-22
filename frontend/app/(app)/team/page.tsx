import { TeamView } from "@/components/teams/team-view"
import { requireSession } from "@/lib/session"

export default async function TeamPage() {
  const { user } = await requireSession()
  return <TeamView userId={user.id} />
}
