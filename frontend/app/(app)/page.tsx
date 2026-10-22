import { HomeView } from "@/components/home/home-view"
import { requireSession } from "@/lib/session"

export default async function HomePage() {
  const { user } = await requireSession()
  return <HomeView userId={user.id} />
}
