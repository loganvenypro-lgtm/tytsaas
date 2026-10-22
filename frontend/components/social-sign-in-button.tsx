"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { signIn } from "@/lib/auth-client"
import type { Messages } from "@/lib/i18n/messages/fr"

// Google's multicolor "G", as its branding guidelines require on sign-in buttons
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  )
}

// Discord's "Clyde" mark in Blurple
function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </svg>
  )
}

const PROVIDERS = {
  google: { name: "Google", Icon: GoogleIcon },
  discord: { name: "Discord", Icon: DiscordIcon },
}

// Better Auth sends the user back to errorCallbackURL with ?error=<code> when the
// OAuth flow fails; the page reads it and shows it through t.auth.oauthErrors.
export function SocialSignInButton({
  provider,
  callbackURL = "/",
  errorCallbackURL,
  onError,
}: {
  provider: keyof typeof PROVIDERS
  /** Where to land once signed in (an invitation link, say). */
  callbackURL?: string
  errorCallbackURL: string
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)
  const { name, Icon } = PROVIDERS[provider]

  async function onClick() {
    setPending(true)
    const { error } = await signIn.social({ provider, callbackURL, errorCallbackURL })
    // On success the browser is already navigating to the provider
    if (error) {
      onError((error.code && t.auth.errors[error.code]) || error.message || t.auth.social.failed(name))
      setPending(false)
    }
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={onClick}>
      <Icon />
      {pending ? t.auth.social.pending(name) : t.auth.social.continueWith(name)}
    </Button>
  )
}

export function oauthErrorMessage(code: string | undefined, t: Messages) {
  if (!code) return null
  return t.auth.oauthErrors[code] ?? t.auth.social.genericFailed
}
