import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
  role?: string | null
  plan?: string | null
  createdAt?: string
  /** Null until /onboarding is finished or skipped. */
  onboardedAt?: string | null
}

type Session = {
  session: { id: string; expiresAt: string }
  user: SessionUser
}

// Cached per request: the layout and the page both ask, the backend is called once
export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = (await headers()).get("cookie") ?? ""
  const res = await fetch(`${process.env.BACKEND_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
})

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}
