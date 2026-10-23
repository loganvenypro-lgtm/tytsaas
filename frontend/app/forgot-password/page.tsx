import { AuthShell } from "@/components/auth-shell"
import { ForgotPasswordForm } from "@/components/password-reset-forms"

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  )
}
