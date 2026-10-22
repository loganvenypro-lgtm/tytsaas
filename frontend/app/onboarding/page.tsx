import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { requireSession } from "@/lib/session"

/** /onboarding: first-run questions, outside the app shell. Can be replayed once done. */
export default async function OnboardingPage() {
  await requireSession()
  return <OnboardingFlow />
}
