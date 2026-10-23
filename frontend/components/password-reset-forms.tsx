"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GalleryVerticalEndIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-provider"
import { toast } from "@/components/ui/toast"
import { authClient } from "@/lib/auth-client"

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Link href="/" className="flex flex-col items-center gap-2 font-medium">
        <div className="flex size-8 items-center justify-center rounded-md">
          <GalleryVerticalEndIcon className="size-6" />
        </div>
        <span className="sr-only">{t.brand}</span>
      </Link>
      <h1 className="text-xl font-bold">{title}</h1>
      <FieldDescription>{subtitle}</FieldDescription>
    </div>
  )
}

/** /forgot-password: asks Better Auth to email a reset link (lib/auth.js sendResetPassword). */
export function ForgotPasswordForm() {
  const { t } = useI18n()
  const f = t.auth.forgot
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get("email"))
    setError(null)
    setPending(true)
    // Same answer whether or not the account exists, so the form can't be used to probe emails
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` })
    setPending(false)
    if (error) {
      setError((error.code && t.auth.errors[error.code]) || f.failed)
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <FieldGroup>
        <Header title={f.sentTitle} subtitle={f.sent(sentTo)} />
        <FieldDescription className="text-center">
          <Link href="/login">{f.backToLogin}</Link>
        </FieldDescription>
      </FieldGroup>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Header title={f.title} subtitle={f.subtitle} />
        <Field>
          <FieldLabel htmlFor="email">{t.auth.email}</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? f.pending : f.submit}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          <Link href="/login">{f.backToLogin}</Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}

/** /reset-password?token=…: where the emailed link lands (?error=INVALID_TOKEN when it expired). */
export function ResetPasswordForm({ token, linkError }: { token?: string; linkError?: string }) {
  const { t } = useI18n()
  const r = t.auth.reset
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!token || linkError) {
    return (
      <FieldGroup>
        <Header title={r.title} subtitle={r.invalidLink} />
        <Field>
          <Button nativeButton={false} render={<Link href="/forgot-password" />}>
            {r.requestNew}
          </Button>
        </Field>
      </FieldGroup>
    )
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get("password"))
    setError(null)
    if (newPassword !== form.get("confirm-password")) {
      setError(t.auth.signup.mismatch)
      return
    }
    setPending(true)
    const { error } = await authClient.resetPassword({ newPassword, token })
    if (error) {
      setError((error.code && t.auth.errors[error.code]) || error.message || r.failed)
      setPending(false)
      return
    }
    toast.add({ type: "success", title: r.done })
    router.push("/login")
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Header title={r.title} subtitle={r.subtitle} />
        <Field>
          <FieldLabel htmlFor="password">{r.newPassword}</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <FieldDescription>{t.auth.signup.passwordHint}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">{t.auth.signup.confirmPassword}</FieldLabel>
          <Input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? r.pending : r.submit}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
