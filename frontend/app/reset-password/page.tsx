import { ResetPasswordForm } from "@/components/password-reset-forms"

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  // token: set by Better Auth when the emailed link is valid; error=INVALID_TOKEN when it expired
  const { token, error } = await searchParams
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ResetPasswordForm token={typeof token === "string" ? token : undefined} linkError={typeof error === "string" ? error : undefined} />
      </div>
    </div>
  )
}
