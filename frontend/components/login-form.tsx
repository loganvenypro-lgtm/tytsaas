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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SocialSignInButton, oauthErrorMessage } from "@/components/social-sign-in-button"
import { useI18n } from "@/components/i18n-provider"
import { toast } from "@/components/ui/toast"
import { signIn } from "@/lib/auth-client"
import { withNext } from "@/lib/utils"
import { GalleryVerticalEndIcon } from "lucide-react"

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
    })

    if (error) {
      setError((error.code && t.auth.errors[error.code]) || error.message || t.auth.login.failed)
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
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
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
            <FieldLabel htmlFor="password">{t.auth.password}</FieldLabel>
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
