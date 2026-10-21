import { redirect } from "next/navigation"

import { SignupForm } from "@/components/signup-form"
import { getSession } from "@/lib/session"

export default async function SignupPage() {
  if (await getSession()) redirect("/")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  )
}
