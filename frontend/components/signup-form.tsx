"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-provider"
import { toast } from "@/components/ui/toast"
import { signUp } from "@/lib/auth-client"
import { GalleryVerticalEndIcon } from "lucide-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useI18n()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    setError(null)

    if (password !== form.get("confirm-password")) {
      setError(t.auth.signup.mismatch)
      return
    }

    setPending(true)
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
    })

    if (error) {
      setError((error.code && t.auth.errors[error.code]) || error.message || t.auth.signup.failed)
      setPending(false)
      return
    }
    toast.add({ type: "success", title: t.auth.signup.created, description: t.auth.signup.createdDescription(t.brand) })
    router.push("/")
    router.refresh()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Link
              href="/"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
              <span className="sr-only">{t.brand}</span>
            </Link>
            <h1 className="text-xl font-bold">{t.auth.welcome(t.brand)}</h1>
            <FieldDescription>
              {t.auth.signup.hasAccount} <Link href="/login">{t.auth.signup.signIn}</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="name">{t.auth.signup.name}</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder={t.auth.signup.namePlaceholder}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">{t.auth.email}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t.auth.emailPlaceholder}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t.auth.password}</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <FieldDescription>{t.auth.signup.passwordHint}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">{t.auth.signup.confirmPassword}</FieldLabel>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Field>
            <Button type="submit" disabled={pending}>
              {pending ? t.auth.signup.pending : t.auth.signup.submit}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {t.auth.termsBefore}
        <a href="#">{t.auth.terms}</a>
        {t.auth.termsAnd}
        <a href="#">{t.auth.privacy}</a>
        {t.auth.termsAfter}
      </FieldDescription>
    </div>
  )
}
