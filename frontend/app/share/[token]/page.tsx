import { SharedView } from "@/components/share/shared-view"
import { getSession } from "@/lib/session"

/**
 * A share link. Public (excluded from proxy.ts): a folder opens read-only
 * without an account; a team link asks to sign in before joining.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getSession()
  return <SharedView token={token} signedIn={session != null} />
}
