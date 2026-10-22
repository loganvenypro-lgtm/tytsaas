import { InviteView } from "@/components/teams/invite-view"
import { getSession } from "@/lib/session"

/** An invitation link: signed-out visitors are asked to sign in with the invited email first. */
export default async function InvitePage({ params }: PageProps<"/invite/[id]">) {
  const { id } = await params
  const session = await getSession()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <InviteView invitationId={id} email={session?.user.email ?? null} />
      </div>
    </div>
  )
}
