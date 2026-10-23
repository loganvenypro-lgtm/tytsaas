import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth-shell"
import { LoginForm } from "@/components/login-form"
import { getSession } from "@/lib/session"
import { safeNextPath } from "@/lib/utils"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // error: set by Better Auth when the Google sign-in fails; next: where to go once signed in
  const { error, next: rawNext } = await searchParams
  const next = safeNextPath(rawNext)
  if (await getSession()) redirect(next)

  return (
    <AuthShell>
      <LoginForm oauthError={typeof error === "string" ? error : undefined} next={next} />
    </AuthShell>
  )
}
