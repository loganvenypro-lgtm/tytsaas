"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ReturbeMark } from "@/components/returbe-logo"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SocialSignInButton, oauthErrorMessage } from "@/components/social-sign-in-button"
import { useI18n } from "@/components/i18n-provider"
import { track } from "@/lib/analytics"
import { signUp } from "@/lib/auth-client"
import { withNext } from "@/lib/utils"
import { MailCheckIcon } from "lucide-react"

export function SignupForm({
  oauthError,
  next = "/",
  className,
  ...props
}: React.ComponentProps<"div"> & { oauthError?: string; next?: string }) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(() => oauthErrorMessage(oauthError, t))
  const [pending, setPending] = useState(false)
  // Set once the account exists: no session until the link in the email is clicked
  const [sentTo, setSentTo] = useState<string | null>(null)

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
    const email = String(form.get("email"))
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email,
      password,
      callbackURL: next,
    })

    if (error) {
      setError(t.auth.errors[error.status === 429 ? "TOO_MANY_REQUESTS" : (error.code ?? "")] || error.message || t.auth.signup.failed)
      setPending(false)
      return
    }
    track("user_signed_up", { method: "email" })
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <MailCheckIcon className="size-8" />
            <h1 className="text-xl font-bold">{t.auth.signup.checkEmailTitle}</h1>
            <FieldDescription>{t.auth.signup.checkEmail(sentTo)}</FieldDescription>
          </div>
          <FieldDescription className="text-center">
            <Link href={withNext("/login", next)}>{t.auth.signup.signIn}</Link>
          </FieldDescription>
        </FieldGroup>
      </div>
    )
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
              <ReturbeMark className="size-10" />
              <span className="sr-only">{t.brand}</span>
            </Link>
            <h1 className="text-xl font-bold">{t.auth.welcome(t.brand)}</h1>
            <FieldDescription>
              {t.auth.signup.hasAccount} <Link href={withNext("/login", next)}>{t.auth.signup.signIn}</Link>
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
          <FieldSeparator>{t.auth.orContinueWith}</FieldSeparator>
          <Field>
            <SocialSignInButton provider="google" callbackURL={next} errorCallbackURL={withNext("/signup", next)} onError={setError} />
            <SocialSignInButton provider="discord" callbackURL={next} errorCallbackURL={withNext("/signup", next)} onError={setError} />
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
