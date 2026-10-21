import { headers } from "next/headers"
import { redirect } from "next/navigation"

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
  role?: string | null
}

type Session = {
  session: { id: string; expiresAt: string }
  user: SessionUser
}

export async function getSession(): Promise<Session | null> {
  const cookie = (await headers()).get("cookie") ?? ""
  const res = await fetch(`${process.env.BACKEND_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}
