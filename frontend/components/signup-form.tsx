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
import { signUp } from "@/lib/auth-client"
import { GalleryVerticalEndIcon } from "lucide-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    setError(null)

    if (password !== form.get("confirm-password")) {
      setError("Passwords do not match")
      return
    }

    setPending(true)
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
    })

    if (error) {
      setError(error.message ?? "Could not create account")
      setPending(false)
      return
    }
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
              <span className="sr-only">Acme Inc.</span>
            </Link>
            <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
            <FieldDescription>
              Already have an account? <Link href="/login">Sign in</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="m@example.com"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <FieldDescription>Must be at least 8 characters.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
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
              {pending ? "Creating account..." : "Create Account"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
