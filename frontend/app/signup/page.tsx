import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth-shell"
import { SignupForm } from "@/components/signup-form"
import { getSession } from "@/lib/session"
import { safeNextPath } from "@/lib/utils"

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // error: set by Better Auth when the Google sign-in fails; next: where to go once signed up
  const { error, next: rawNext } = await searchParams
  const next = safeNextPath(rawNext)
  if (await getSession()) redirect(next)

  return (
    <AuthShell>
      <SignupForm oauthError={typeof error === "string" ? error : undefined} next={next} />
    </AuthShell>
  )
}
