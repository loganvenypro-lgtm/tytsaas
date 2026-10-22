import posthog from "posthog-js"

import { identifyCurrentUser } from "@/lib/analytics"

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

// Sent through /ingest (next.config.ts) so ad blockers don't drop the events
if (key) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2025-05-24",
  })
  identifyCurrentUser()
}
