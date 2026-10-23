import { AuthShell } from "@/components/auth-shell"
import { ResetPasswordForm } from "@/components/password-reset-forms"

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  // token: set by Better Auth when the emailed link is valid; error=INVALID_TOKEN when it expired
  const { token, error } = await searchParams
  return (
    <AuthShell>
      <ResetPasswordForm token={typeof token === "string" ? token : undefined} linkError={typeof error === "string" ? error : undefined} />
    </AuthShell>
  )
}
