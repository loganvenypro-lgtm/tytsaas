import posthog from "posthog-js"

// Ties events to the signed-in account, so two accounts on one browser don't merge
export function identifyCurrentUser() {
  if (!posthog.__loaded) return
  fetch("/api/auth/get-session")
    .then((res) => (res.ok ? res.json() : null))
    .then((session) => {
      const user = session?.user
      if (!user?.id) return
      const id = String(user.id)
      if (posthog.get_property("$user_state") === "identified" && posthog.get_distinct_id() !== id) posthog.reset()
      posthog.identify(id, { email: user.email, name: user.name, plan: user.plan, role: user.role })
    })
    .catch(() => {})
}

/** A product event; a no-op when PostHog is not configured. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (posthog.__loaded) posthog.capture(event, properties)
}
