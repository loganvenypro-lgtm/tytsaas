"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { toast } from "@/components/ui/toast"
import { signIn } from "@/lib/auth-client"
import { withNext } from "@/lib/utils"

export function LoginForm({
  oauthError,
  next = "/",
  className,
  ...props
}: React.ComponentProps<"div"> & { oauthError?: string; next?: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [error, setError] = useState<string | null>(() => oauthErrorMessage(oauthError, t))
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setPending(true)

    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      // Where the link of the verification email lands, for an account not verified yet
      callbackURL: next,
    })

    if (error) {
      setError(t.auth.errors[error.status === 429 ? "TOO_MANY_REQUESTS" : (error.code ?? "")] || error.message || t.auth.login.failed)
      setPending(false)
      return
    }
    toast.add({ type: "success", title: t.auth.login.welcomeBack })
    router.push(next)
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
              <ReturbeMark className="size-10" />
              <span className="sr-only">{t.brand}</span>
            </Link>
            <h1 className="text-xl font-bold">{t.auth.welcome(t.brand)}</h1>
            <FieldDescription>
              {t.auth.login.noAccount} <Link href={withNext("/signup", next)}>{t.auth.login.signUp}</Link>
            </FieldDescription>
          </div>
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
            <div className="flex items-center">
              <FieldLabel htmlFor="password">{t.auth.password}</FieldLabel>
              <Link href="/forgot-password" className="ml-auto text-sm underline-offset-4 hover:underline">
                {t.auth.login.forgotPassword}
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Field>
            <Button type="submit" disabled={pending}>
              {pending ? t.auth.login.pending : t.auth.login.submit}
            </Button>
          </Field>
          <FieldSeparator>{t.auth.orContinueWith}</FieldSeparator>
          <Field>
            <SocialSignInButton provider="google" callbackURL={next} errorCallbackURL={withNext("/login", next)} onError={setError} />
            <SocialSignInButton provider="discord" callbackURL={next} errorCallbackURL={withNext("/login", next)} onError={setError} />
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
