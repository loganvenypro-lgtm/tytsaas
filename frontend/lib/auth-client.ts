import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"

// No baseURL: requests go to /api/auth on this origin and next.config.ts
// rewrites them to the backend, so the session cookie stays first-party.
// organizationClient: teams, their members and invitations (lib/teams.ts)
export const authClient = createAuthClient({ plugins: [organizationClient()] })

export const { signIn, signUp, signOut, useSession } = authClient
