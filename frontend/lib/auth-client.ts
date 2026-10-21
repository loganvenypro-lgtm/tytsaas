import { createAuthClient } from "better-auth/react"

// No baseURL: requests go to /api/auth on this origin and next.config.ts
// rewrites them to the backend, so the session cookie stays first-party.
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
